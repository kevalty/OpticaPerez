-- Optica Perez - Maqueta de la peticion del cliente (nov. 2026). Ejecutar DESPUES de la 0019. Se puede ejecutar varias veces.
--   1) Inventario: marca, modelo y color de cada producto
--   2) Pacientes: fecha de nacimiento (mensaje de cumpleanos)
--   3) Receta externa: clientes que traen copia de receta (no pasan por consultorio ni generan historia clinica)
--   4) Entrega: fotos de como se entrega y confirmacion de recepcion + garantia (por enlace o en el iPad)
--   5) WhatsApp: cumpleanos, renovacion de lunas y aviso de entrega

-- ============ 1) Inventario ============
alter table public.products
  add column if not exists marca text check (char_length(marca) <= 60),
  add column if not exists modelo text check (char_length(modelo) <= 60),
  add column if not exists color text check (char_length(color) <= 60);

-- ============ 2) Pacientes ============
alter table public.patients add column if not exists fecha_nacimiento date
  check (fecha_nacimiento is null or (fecha_nacimiento >= date '1900-01-01' and fecha_nacimiento <= current_date));

-- ============ 3) Receta externa ============
alter table public.orders
  add column if not exists receta_externa jsonb check (receta_externa is null or (jsonb_typeof(receta_externa) = 'object' and pg_column_size(receta_externa) < 4000)),
  add column if not exists receta_foto_path text check (char_length(receta_foto_path) <= 200);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recetas', 'recetas', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
drop policy if exists recetas_select on storage.objects;
create policy recetas_select on storage.objects for select to authenticated
  using (bucket_id = 'recetas' and public.has_role('recepcionista', 'doctor', 'administrador', 'otro'));
drop policy if exists recetas_insert on storage.objects;
create policy recetas_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'recetas' and public.has_role('recepcionista', 'administrador')
              and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{32}\.(jpg|png|webp)$');
drop policy if exists recetas_delete on storage.objects;
create policy recetas_delete on storage.objects for delete to authenticated
  using (bucket_id = 'recetas' and public.has_role('administrador'));

-- Guarda la receta externa en la orden. La orden deja de ligarse a una ficha medica: NO se crea historia clinica.
-- p_datos = {od:{esfera,cilindro,eje,add,dp}, oi:{...}, nota}
create or replace function public.guardar_receta_externa(p_orden uuid, p_datos jsonb, p_foto text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role('recepcionista', 'administrador') then
    raise exception 'No tienes permiso para esta accion' using errcode = '42501';
  end if;
  if p_datos is not null and (jsonb_typeof(p_datos) <> 'object' or pg_column_size(p_datos) > 3500) then
    raise exception 'Los datos de la receta no son validos' using errcode = 'P0001';
  end if;
  if p_foto is not null and p_foto !~ '^[0-9a-f-]{36}/[0-9a-f]{32}\.(jpg|png|webp)$' then
    raise exception 'La foto de la receta no es valida' using errcode = 'P0001';
  end if;
  update public.orders
     set receta_externa = p_datos, receta_foto_path = coalesce(p_foto, receta_foto_path), record_id = null
   where id = p_orden and deleted_at is null;
  if not found then raise exception 'Pedido no encontrado' using errcode = 'P0002'; end if;
  return true;
end $$;
revoke all on function public.guardar_receta_externa(uuid, jsonb, text) from public, anon;
grant execute on function public.guardar_receta_externa(uuid, jsonb, text) to authenticated;

-- rx_orden: ahora tambien devuelve la receta externa (si la hay). La recepcionista sigue sin leer fichas.
create or replace function public.rx_orden(p_orden uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.orders; mr public.medical_records; res jsonb;
begin
  if not public.has_role('recepcionista', 'doctor', 'administrador', 'otro') then return null; end if;
  select * into o from public.orders where id = p_orden and deleted_at is null;
  if not found then return null; end if;
  if o.record_id is not null then
    select * into mr from public.medical_records where id = o.record_id;
  end if;
  select jsonb_build_object(
    'paciente', p.nombre, 'tipo_documento', p.tipo_documento, 'documento', p.documento,
    'telefono', p.telefono, 'email', p.email, 'direccion', p.direccion,
    'fecha', coalesce(mr.fecha, current_date),
    'recetario', mr.recetario,
    'tiene_ficha', (mr.id is not null),
    'receta_externa', o.receta_externa,
    'receta_foto', (o.receta_foto_path is not null)
  ) into res from public.patients p where p.id = o.patient_id;
  if mr.id is not null then
    insert into public.audit_log (user_id, accion, tabla, registro_id) values ((select auth.uid()), 'ver', 'medical_records', mr.id);
  end if;
  return res;
end $$;
revoke all on function public.rx_orden(uuid) from public, anon;
grant execute on function public.rx_orden(uuid) to authenticated;

-- ============ 4) Entrega: fotos y confirmacion ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entregas', 'entregas', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create table if not exists public.order_fotos (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  path text not null check (path ~ '^[0-9a-f-]{36}/[0-9a-f]{32}\.(jpg|png|webp)$'),
  user_id uuid not null references public.users (id),
  created_at timestamptz not null default now()
);
create index if not exists order_fotos_order_idx on public.order_fotos (order_id, created_at);
alter table public.order_fotos enable row level security;
revoke all on public.order_fotos from anon;
revoke update, truncate on public.order_fotos from authenticated;
drop policy if exists order_fotos_select on public.order_fotos;
create policy order_fotos_select on public.order_fotos for select to authenticated
  using (public.has_role('recepcionista', 'doctor', 'administrador', 'otro') and exists (select 1 from public.orders o where o.id = order_id));
drop policy if exists order_fotos_insert on public.order_fotos;
create policy order_fotos_insert on public.order_fotos for insert to authenticated
  with check (public.has_role('recepcionista', 'administrador') and user_id = (select auth.uid()) and exists (select 1 from public.orders o where o.id = order_id));
drop policy if exists order_fotos_delete on public.order_fotos;
create policy order_fotos_delete on public.order_fotos for delete to authenticated using (public.has_role('administrador'));

create table if not exists public.entrega_confirmaciones (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id),
  nombre_firma text not null check (char_length(nombre_firma) between 2 and 120),
  buen_estado boolean not null check (buen_estado),
  acepta_garantia boolean not null check (acepta_garantia),
  via text not null check (via in ('whatsapp', 'ipad')),
  confirmado_en timestamptz not null default now()
);
alter table public.entrega_confirmaciones enable row level security;
revoke all on public.entrega_confirmaciones from anon, authenticated;
grant select on public.entrega_confirmaciones to authenticated;
drop policy if exists entrega_conf_select on public.entrega_confirmaciones;
create policy entrega_conf_select on public.entrega_confirmaciones for select to authenticated
  using (public.has_role('recepcionista', 'doctor', 'administrador', 'otro') and exists (select 1 from public.orders o where o.id = order_id));

-- Fotos publicas por enlace: quien conoce la ruta (id del pedido + nombre aleatorio) puede verlas. Solo las fotos de ENTREGA.
create or replace function public.entrega_foto_publica(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.order_fotos f where f.path = p_name)
$$;
revoke all on function public.entrega_foto_publica(text) from public;
grant execute on function public.entrega_foto_publica(text) to anon, authenticated;

drop policy if exists entregas_select_staff on storage.objects;
create policy entregas_select_staff on storage.objects for select to authenticated
  using (bucket_id = 'entregas' and public.has_role('recepcionista', 'doctor', 'administrador', 'otro'));
drop policy if exists entregas_select_publico on storage.objects;
create policy entregas_select_publico on storage.objects for select to anon
  using (bucket_id = 'entregas' and public.entrega_foto_publica(name));
drop policy if exists entregas_insert on storage.objects;
create policy entregas_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'entregas' and public.has_role('recepcionista', 'administrador')
              and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{32}\.(jpg|png|webp)$');
drop policy if exists entregas_delete on storage.objects;
create policy entregas_delete on storage.objects for delete to authenticated
  using (bucket_id = 'entregas' and public.has_role('administrador'));

-- El cliente confirma (sin cuenta, con el token de su pedido). Solo si el pedido ya esta entregado. Una sola vez.
create or replace function public.confirmar_entrega(p_token text, p_nombre text, p_buen_estado boolean, p_garantia boolean, p_via text default 'whatsapp')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.orders; c public.entrega_confirmaciones; v_nombre text := btrim(coalesce(p_nombre, ''));
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'Enlace no valido' using errcode = 'P0002'; end if;
  select * into o from public.orders where token = p_token and deleted_at is null;
  if not found then raise exception 'Enlace no valido' using errcode = 'P0002'; end if;
  select * into c from public.entrega_confirmaciones where order_id = o.id;
  if found then return jsonb_build_object('ya', true, 'fecha', c.confirmado_en, 'via', c.via); end if;
  if o.estado::text <> 'entregado' then raise exception 'Tu pedido aun no esta entregado' using errcode = 'P0001'; end if;
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 120 then raise exception 'Escribe tu nombre completo' using errcode = 'P0001'; end if;
  if not coalesce(p_buen_estado, false) or not coalesce(p_garantia, false) then
    raise exception 'Marca las dos casillas para confirmar' using errcode = 'P0001';
  end if;
  insert into public.entrega_confirmaciones (order_id, nombre_firma, buen_estado, acepta_garantia, via)
  values (o.id, regexp_replace(v_nombre, '[[:cntrl:]]', '', 'g'), true, true, case when p_via = 'ipad' then 'ipad' else 'whatsapp' end)
  returning * into c;
  return jsonb_build_object('ya', false, 'fecha', c.confirmado_en, 'via', c.via);
end $$;
revoke all on function public.confirmar_entrega(text, text, boolean, boolean, text) from public;
grant execute on function public.confirmar_entrega(text, text, boolean, boolean, text) to anon, authenticated;

-- Ruta de una foto de entrega para la pagina publica (solo con el token del pedido).
create or replace function public.seguimiento_foto_path(p_token text, p_foto uuid)
returns text language sql stable security definer set search_path = '' as $$
  select f.path from public.order_fotos f join public.orders o on o.id = f.order_id
   where o.token = p_token and o.deleted_at is null and f.id = p_foto and p_token ~ '^[0-9a-f]{64}$'
$$;
revoke all on function public.seguimiento_foto_path(text, uuid) from public;
grant execute on function public.seguimiento_foto_path(text, uuid) to anon, authenticated;

-- seguimiento_publico: ahora tambien las fotos de entrega y si el cliente ya confirmo.
create or replace function public.seguimiento_publico(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare o public.orders; s public.sales; p public.patients; c public.entrega_confirmaciones;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into o from public.orders where token = p_token and deleted_at is null;
  if not found then return null; end if;
  select * into p from public.patients where id = o.patient_id;
  select * into s from public.sales where id = o.sale_id;
  select * into c from public.entrega_confirmaciones where order_id = o.id;
  return jsonb_build_object(
    'numero', s.numero,
    'nombre_pila', split_part(btrim(p.nombre), ' ', 1),
    'estado', o.estado, 'creado', o.created_at, 'fecha_entrega', o.fecha_entrega, 'entregado_en', o.entregado_en,
    'saldo', s.total - s.pagado,
    'items', coalesce((select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad) order by i.nombre)
                       from public.sale_items i where i.sale_id = s.id), '[]'::jsonb),
    'especificaciones', public.especificaciones_pedido(o.record_id),
    'historial', coalesce((select jsonb_agg(jsonb_build_object('estado', h.estado, 'fecha', h.fecha) order by h.fecha)
                           from public.order_status_history h where h.order_id = o.id), '[]'::jsonb),
    'fotos', coalesce((select jsonb_agg(jsonb_build_object('id', f.id) order by f.created_at) from public.order_fotos f where f.order_id = o.id), '[]'::jsonb),
    'confirmacion', case when c.id is not null then jsonb_build_object('fecha', c.confirmado_en, 'via', c.via) end);
end $$;
revoke all on function public.seguimiento_publico(text) from public;
grant execute on function public.seguimiento_publico(text) to anon, authenticated;

-- ============ 5) WhatsApp: nuevos avisos ============
alter table public.whatsapp_plantillas drop constraint if exists whatsapp_plantillas_tipo_check;
alter table public.whatsapp_plantillas add constraint whatsapp_plantillas_tipo_check
  check (tipo in ('pedido_recibo', 'pedido_listo', 'control_adaptacion', 'control_anual', 'turno', 'saldo', 'cumpleanos', 'renovacion', 'entrega'));
alter table public.whatsapp_envios drop constraint if exists whatsapp_envios_tipo_check;
alter table public.whatsapp_envios add constraint whatsapp_envios_tipo_check
  check (tipo in ('pedido_recibo', 'pedido_listo', 'control_adaptacion', 'control_anual', 'turno', 'saldo', 'cumpleanos', 'renovacion', 'entrega'));

insert into public.whatsapp_plantillas (tipo, nombre, idioma, activa, descripcion, texto_sugerido) values
  ('entrega', 'entrega_confirmar', 'es', false, 'Al entregar el pedido: foto de la entrega y confirmación de recepción con la garantía (con el enlace del pedido).',
   'Hola {{1}} 😊, ¡gracias por elegirnos! Tu pedido N.º {{2}} ya está en tus manos. Aquí puedes ver cómo lo entregamos y confirmar que lo recibiste en perfecto estado, junto con la información de tu garantía.  [Botón «Ver mi entrega», URL dinámica: https://optica-perez.vercel.app/seguimiento/{{1}}]'),
  ('cumpleanos', 'felicitacion_cumpleanos', 'es', false, 'Felicitación de cumpleaños con descuento (categoría Marketing; solo pacientes que aceptaron WhatsApp).',
   'Feliz cumpleaños, {{1}} 🎂 En Óptica Pérez queremos celebrarlo contigo: presenta este mensaje y recibe un {{2}} de descuento en tu próxima compra. ¡Que tengas un día maravilloso!'),
  ('renovacion', 'renovacion_lunas', 'es', false, 'Renovación de lunas con descuento, pasados unos 6 meses de la entrega (categoría Marketing).',
   'Hola {{1}}, ha pasado un tiempo desde que estrenaste tus lentes y queremos que sigas viendo perfecto. Renueva tus lunas con un {{2}} de descuento exclusivo para ti. ¡Te esperamos en Óptica Pérez!')
on conflict (tipo) do nothing;

-- Pendientes: se agregan cumpleanos (hoy) y renovacion (entregado hace 6 a 9 meses, sin aviso en 9 meses).
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
    union all
    select 'cumpleanos', p.id, p.nombre, p.telefono, p.id, jsonb_build_object('fecha', p.fecha_nacimiento)
      from public.patients p
     where p.deleted_at is null and p.acepta_whatsapp and p.fecha_nacimiento is not null
       and to_char(p.fecha_nacimiento, 'MM-DD') = to_char(hoy, 'MM-DD')
       and not exists (select 1 from public.whatsapp_envios e where e.tipo = 'cumpleanos' and e.estado = 'enviado'
                       and e.patient_id = p.id and e.created_at > now() - interval '300 days')
    union all
    select 'renovacion', p.id, p.nombre, p.telefono, p.id,
           jsonb_build_object('entregado', (max(o.entregado_en) at time zone 'America/Guayaquil')::date)
      from public.patients p join public.orders o on o.patient_id = p.id
     where p.deleted_at is null and p.acepta_whatsapp and o.deleted_at is null and o.estado::text = 'entregado'
     group by p.id, p.nombre, p.telefono
    having max(o.entregado_en) between now() - interval '9 months' and now() - interval '6 months'
       and not exists (select 1 from public.whatsapp_envios e where e.tipo = 'renovacion' and e.estado = 'enviado'
                       and e.patient_id = p.id and e.created_at > now() - interval '9 months')
  ) x;
  return res;
end $$;
revoke all on function public.recordatorios_pendientes() from public, anon;
grant execute on function public.recordatorios_pendientes() to authenticated;
