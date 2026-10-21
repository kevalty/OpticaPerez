-- Optica Perez - Semana 6: WhatsApp (recibo y aviso de pedido, recordatorios) con Meta Cloud API.
-- Aplicar DESPUES de 0012 (SQL Editor -> pegar todo -> Run). Es seguro correrla mas de una vez.
--
-- El envio lo hace la app (server) con las variables WHATSAPP_* de Vercel; aqui queda lo que guarda la base:
--   - patients.acepta_whatsapp : el paciente autoriza recibir mensajes (politica de WhatsApp: requiere consentimiento)
--   - whatsapp_plantillas      : nombre de cada plantilla aprobada en Meta y si esta activa
--   - whatsapp_envios          : historial de envios (solo se anade; nunca se edita ni se borra)
--   - recordatorios_pendientes : quien debe recibir turno / saldo / control de adaptacion / control anual (recepcion no lee fichas)

alter table public.patients add column if not exists acepta_whatsapp boolean not null default true;

-- ============ Plantillas ============
create table if not exists public.whatsapp_plantillas (
  tipo text primary key check (tipo in ('pedido_recibo', 'pedido_listo', 'control_adaptacion', 'control_anual', 'turno', 'saldo')),
  nombre text not null check (char_length(nombre) between 1 and 512),   -- nombre EXACTO de la plantilla en Meta
  idioma text not null default 'es' check (char_length(idioma) between 2 and 10),
  activa boolean not null default false,
  descripcion text not null,
  texto_sugerido text not null,
  updated_at timestamptz not null default now()
);
alter table public.whatsapp_plantillas enable row level security;
revoke all on public.whatsapp_plantillas from anon;
revoke insert, delete, truncate on public.whatsapp_plantillas from authenticated;
revoke update on public.whatsapp_plantillas from authenticated;
grant update (nombre, idioma, activa) on public.whatsapp_plantillas to authenticated;
drop policy if exists wa_plantillas_select on public.whatsapp_plantillas;
create policy wa_plantillas_select on public.whatsapp_plantillas for select to authenticated
  using (public.has_role('recepcionista', 'administrador'));
drop policy if exists wa_plantillas_update on public.whatsapp_plantillas;
create policy wa_plantillas_update on public.whatsapp_plantillas for update to authenticated
  using (public.has_role('administrador')) with check (public.has_role('administrador'));

insert into public.whatsapp_plantillas (tipo, nombre, idioma, activa, descripcion, texto_sugerido) values
  ('pedido_recibo', 'pedido_enviado_a_hacer', 'es', true, 'Recibo al cerrar la venta: pedido enviado a hacer (con el enlace de seguimiento).',
   'Hola {{1}} 👋, gracias por confiar en Óptica Pérez. Tu pedido N.º {{2}} fue *enviado a hacer*. Aquí puedes ver el detalle y cómo avanza.  [Botón «Visitar sitio web», URL dinámica: https://optica-perez.vercel.app/seguimiento/{{1}}]'),
  ('pedido_listo', 'pedido_listo_para_recibir', 'es', true, 'Aviso cuando el pedido esta listo para recibir en Riobamba.',
   'Hola {{1}} 😊, ¡tu pedido N.º {{2}} ya está *listo para recibir* en nuestro local de Riobamba! Saldo pendiente: {{3}}. Detalle de tu pedido:  [Botón «Visitar sitio web», URL dinámica: https://optica-perez.vercel.app/seguimiento/{{1}}]'),
  ('turno', 'recordatorio_turno', 'es', false, 'Recordatorio de la cita agendada para manana.',
   'Hola {{1}}, te recordamos tu cita en Óptica Pérez el {{2}} a las {{3}}. Si no puedes asistir, avísanos por este medio.'),
  ('saldo', 'recordatorio_saldo', 'es', false, 'Recordatorio de saldo pendiente (ventas con mas de 7 dias).',
   'Hola {{1}}, te recordamos que tu pedido N.º {{2}} tiene un saldo pendiente de {{3}}. Puedes cancelarlo en nuestro local de Riobamba. ¡Gracias!'),
  ('control_adaptacion', 'recordatorio_control_adaptacion', 'es', false, 'Control de adaptacion: 15 a 45 dias despues de entregar el pedido.',
   'Hola {{1}}, ¿cómo te has adaptado a tus lentes nuevos? Si sientes alguna molestia, pasa por Óptica Pérez para revisarlos.'),
  ('control_anual', 'recordatorio_control_anual', 'es', false, 'Fidelizacion: control visual anual (segun los meses de control de la ultima ficha).',
   'Hola {{1}} 👓, tu última consulta fue el {{2}} y ya es momento de tu control visual. Escríbenos o pasa por nuestro local de Riobamba para agendar tu cita.')
on conflict (tipo) do nothing;

-- ============ Historial de envios ============
create table if not exists public.whatsapp_envios (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('pedido_recibo', 'pedido_listo', 'control_adaptacion', 'control_anual', 'turno', 'saldo')),
  patient_id uuid references public.patients (id),
  order_id uuid references public.orders (id),
  sale_id uuid references public.sales (id),
  appointment_id uuid references public.appointments (id),
  destino text not null check (char_length(destino) <= 20),
  plantilla text check (char_length(plantilla) <= 512),
  estado text not null check (estado in ('enviado', 'fallido')),
  wa_message_id text check (char_length(wa_message_id) <= 200),
  error text check (char_length(error) <= 500),
  enviado_por uuid references public.users (id),
  created_at timestamptz not null default now()
);
create index if not exists wa_envios_tipo_idx on public.whatsapp_envios (tipo, created_at desc);
create index if not exists wa_envios_order_idx on public.whatsapp_envios (order_id);
create index if not exists wa_envios_patient_idx on public.whatsapp_envios (patient_id);
alter table public.whatsapp_envios enable row level security;
revoke all on public.whatsapp_envios from anon;
revoke update, delete, truncate on public.whatsapp_envios from authenticated;
drop policy if exists wa_envios_select on public.whatsapp_envios;
create policy wa_envios_select on public.whatsapp_envios for select to authenticated
  using (public.has_role('recepcionista', 'administrador'));
drop policy if exists wa_envios_insert on public.whatsapp_envios;
create policy wa_envios_insert on public.whatsapp_envios for insert to authenticated
  with check (public.has_role('recepcionista', 'administrador') and enviado_por = (select auth.uid()));

-- ============ recordatorios_pendientes ============
-- Quien debe recibir un recordatorio hoy. La recepcionista no lee fichas: la base calcula el control anual por ella.
--  turno               : citas agendadas para manana
--  saldo               : ventas activas con saldo y mas de 7 dias (sin aviso en 15 dias)
--  control_adaptacion  : pedidos entregados hace 15 a 45 dias
--  control_anual       : ultima ficha + meses de control (12 si no se indico) vencido o a 15 dias, sin cita proxima, sin aviso en 180 dias
-- Solo pacientes que autorizaron WhatsApp y que aun no recibieron ese mismo aviso.
create or replace function public.recordatorios_pendientes()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare hoy date := (now() at time zone 'America/Guayaquil')::date; res jsonb;
begin
  if not public.has_role('recepcionista', 'administrador') then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.tipo, x.paciente), '[]'::jsonb) into res from (
    select 'turno'::text as tipo, p.id as patient_id, p.nombre as paciente, p.telefono, a.id as ref_id,
           jsonb_build_object('fecha', a.fecha, 'hora', coalesce(to_char(a.hora, 'HH24:MI'), '')) as datos
      from public.appointments a join public.patients p on p.id = a.patient_id
     where a.deleted_at is null and a.estado::text = 'agendado' and a.fecha = hoy + 1
       and p.deleted_at is null and p.acepta_whatsapp
       and not exists (select 1 from public.whatsapp_envios e where e.tipo = 'turno' and e.estado = 'enviado' and e.appointment_id = a.id)
    union all
    select 'saldo', p.id, p.nombre, p.telefono, s.id,
           jsonb_build_object('numero', s.numero, 'saldo', s.total - s.pagado)
      from public.sales s join public.patients p on p.id = s.patient_id
     where s.deleted_at is null and s.estado = 'activa' and s.total - s.pagado > 0 and s.fecha < now() - interval '7 days'
       and p.deleted_at is null and p.acepta_whatsapp
       and not exists (select 1 from public.whatsapp_envios e where e.tipo = 'saldo' and e.estado = 'enviado' and e.sale_id = s.id
                       and e.created_at > now() - interval '15 days')
    union all
    select 'control_adaptacion', p.id, p.nombre, p.telefono, o.id,
           jsonb_build_object('numero', s.numero, 'entregado', (o.entregado_en at time zone 'America/Guayaquil')::date)
      from public.orders o join public.patients p on p.id = o.patient_id left join public.sales s on s.id = o.sale_id
     where o.deleted_at is null and o.estado::text = 'entregado'
       and o.entregado_en between now() - interval '45 days' and now() - interval '15 days'
       and p.deleted_at is null and p.acepta_whatsapp
       and not exists (select 1 from public.whatsapp_envios e where e.tipo = 'control_adaptacion' and e.estado = 'enviado' and e.order_id = o.id)
    union all
    select 'control_anual', p.id, p.nombre, p.telefono, p.id,
           jsonb_build_object('ultima', m.fecha, 'meses', m.meses)
      from public.patients p
      join lateral (select mr.fecha, coalesce(mr.control_meses, 12) as meses
                      from public.medical_records mr
                     where mr.patient_id = p.id and mr.deleted_at is null
                     order by mr.fecha desc, mr.created_at desc limit 1) m on true
     where p.deleted_at is null and p.acepta_whatsapp
       and (m.fecha + make_interval(months => m.meses))::date <= hoy + 15
       and not exists (select 1 from public.whatsapp_envios e where e.tipo = 'control_anual' and e.estado = 'enviado'
                       and e.patient_id = p.id and e.created_at > now() - interval '180 days')
       and not exists (select 1 from public.appointments a2 where a2.patient_id = p.id and a2.deleted_at is null and a2.fecha >= hoy)
  ) x;
  return res;
end $$;
revoke all on function public.recordatorios_pendientes() from public, anon;
grant execute on function public.recordatorios_pendientes() to authenticated;
