-- Optica Perez - Esquema inicial (Semana 1)
-- Aplicar en Supabase: SQL Editor -> pegar y ejecutar (o `supabase db push`).
-- RLS activo en TODAS las tablas. Sin politica = sin acceso.

create extension if not exists pgcrypto;

-- ============ Tipos ============
create type public.user_role as enum ('recepcionista', 'doctor', 'administrador', 'otro');
create type public.eye as enum ('OD', 'OI');
create type public.appointment_status as enum ('en_espera', 'en_consulta', 'atendido');
create type public.order_status as enum ('enviado_a_hacer', 'procesando', 'listo_para_entrega');
create type public.product_type as enum ('montura', 'lente', 'insumo');
create type public.movement_type as enum ('entrada', 'salida');
create type public.reminder_type as enum ('pedido_listo', 'control', 'fidelizacion');
create type public.send_status as enum ('pendiente', 'enviado', 'fallido');

-- ============ Utilidades ============
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============ Usuarios del sistema (perfil de auth.users) ============
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default '',
  email text not null,
  rol public.user_role not null default 'otro',
  activo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Rol y estado del usuario autenticado. SECURITY DEFINER para evitar recursion en RLS.
-- Un usuario inactivo o borrado NO tiene rol (devuelve null) => sin acceso a nada.
create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path = '' as $$
  select u.rol from public.users u
  where u.id = (select auth.uid()) and u.activo and u.deleted_at is null
$$;

create or replace function public.has_role(variadic roles public.user_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_user_role() = any (roles), false)
$$;

revoke all on function public.current_user_role() from public, anon;
revoke all on function public.has_role(public.user_role[]) from public, anon;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.has_role(public.user_role[]) to authenticated;

-- Al crear un usuario en Auth se crea su perfil SIN privilegios (inactivo, rol 'otro').
-- El rol NUNCA se toma de los metadatos del registro (evita escalada de privilegios).
-- Un administrador lo activa y le asigna rol.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id, email, nombre)
  values (new.id, coalesce(new.email, ''), coalesce(split_part(new.email, '@', 1), ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============ Pacientes ============
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 200),
  direccion text check (char_length(direccion) <= 300),
  telefono text check (char_length(telefono) <= 30),
  edad smallint check (edad between 0 and 130),
  ocupacion text check (char_length(ocupacion) <= 120),
  fecha_registro date not null default current_date,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.patients (nombre);

-- ============ Turnos ============
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  fecha date not null default current_date,
  hora time,
  estado public.appointment_status not null default 'en_espera',
  recepcionista_id uuid references public.users (id),
  optometrista_id uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.appointments (fecha, estado);

-- ============ Fichas medicas (datos clinicos sensibles) ============
create table public.medical_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  optometrista_id uuid not null references public.users (id),
  fecha date not null default current_date,
  observaciones text check (char_length(observaciones) <= 5000),
  rx_anterior_od text, rx_anterior_oi text,
  add_od text, add_oi text,
  avcc_od text, avcc_oi text,
  avsc_od text, avsc_oi text,
  ppc_od text, ppc_oi text,
  queratometria_od text, queratometria_oi text,
  oftalmoscopia_od text, oftalmoscopia_oi text,
  retinoscopia_od text, retinoscopia_oi text,
  lectura_computador_od text, lectura_computador_oi text,
  recomendaciones text check (char_length(recomendaciones) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.medical_records (patient_id, fecha desc);

create table public.rx_prescriptions (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.medical_records (id),
  ojo public.eye not null,
  esfera numeric(5,2), cilindro numeric(5,2),
  eje smallint check (eje between 0 and 180),
  av text, add numeric(4,2), dp numeric(4,1),
  color text, bifocal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.rx_prescriptions (record_id);

create table public.contact_lens_trials (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.medical_records (id),
  ojo public.eye not null,
  prueba text, av text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.contact_lens_trials (record_id);

-- ============ Productos e inventario ============
create table public.products (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 200),
  tipo public.product_type not null,
  stock integer not null default 0 check (stock >= 0),
  precio numeric(10,2) not null default 0 check (precio >= 0),
  stock_minimo integer not null default 0 check (stock_minimo >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ============ Pedidos / ordenes de trabajo ============
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  record_id uuid references public.medical_records (id),
  estado public.order_status not null default 'enviado_a_hacer',
  fecha_creacion timestamptz not null default now(),
  fecha_entrega date,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.orders (estado);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  estado public.order_status not null,
  fecha timestamptz not null default now(),
  user_id uuid not null references public.users (id)
);
create index on public.order_status_history (order_id, fecha);

-- ============ Ventas ============
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients (id),
  vendedor_id uuid not null references public.users (id),
  fecha timestamptz not null default now(),
  total numeric(10,2) not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.sales (fecha);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id),
  product_id uuid not null references public.products (id),
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(10,2) not null check (precio_unitario >= 0)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  tipo public.movement_type not null,
  cantidad integer not null check (cantidad > 0),
  venta_id uuid references public.sales (id),
  orden_id uuid references public.orders (id),
  fecha timestamptz not null default now(),
  user_id uuid references public.users (id)
);

-- ============ WhatsApp ============
create table public.whatsapp_reminders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  tipo public.reminder_type not null,
  mensaje text not null,
  fecha_envio timestamptz,
  estado_envio public.send_status not null default 'pendiente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ Auditoria (append-only; sin datos clinicos, solo quien/que/cuando) ============
create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references public.users (id),
  accion text not null check (accion in ('ver', 'crear', 'editar', 'eliminar')),
  tabla text not null,
  registro_id uuid,
  created_at timestamptz not null default now()
);
create index on public.audit_log (tabla, registro_id, created_at desc);

-- Registra desde la app quien VIO una ficha (los SELECT no disparan triggers).
create or replace function public.log_access(p_tabla text, p_registro_id uuid, p_accion text default 'ver')
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (user_id, accion, tabla, registro_id)
  select (select auth.uid()), p_accion, p_tabla, p_registro_id
  where public.current_user_role() is not null
$$;
revoke all on function public.log_access(text, uuid, text) from public, anon;
grant execute on function public.log_access(text, uuid, text) to authenticated;

-- Triggers de auditoria para escrituras sobre fichas y pacientes.
create or replace function public.audit_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (user_id, accion, tabla, registro_id)
  values ((select auth.uid()),
          case tg_op when 'INSERT' then 'crear' else 'editar' end,
          tg_table_name, new.id);
  return new;
end $$;

create trigger audit_medical_records after insert or update on public.medical_records
  for each row execute function public.audit_write();
create trigger audit_patients after insert or update on public.patients
  for each row execute function public.audit_write();

-- ============ updated_at automatico ============
do $$
declare t text;
begin
  foreach t in array array['users','patients','appointments','medical_records','rx_prescriptions',
    'contact_lens_trials','products','orders','sales','whatsapp_reminders']
  loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ============ RLS: activar en TODAS las tablas ============
alter table public.users enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;
alter table public.medical_records enable row level security;
alter table public.rx_prescriptions enable row level security;
alter table public.contact_lens_trials enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_status_history enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.whatsapp_reminders enable row level security;
alter table public.audit_log enable row level security;

-- El rol anonimo no toca nada. Solo 'authenticated' (y luego filtrado por RLS).
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- ============ Politicas ============
-- users: cada quien ve su propio perfil; solo administrador gestiona usuarios.
create policy users_select on public.users for select to authenticated
  using (id = (select auth.uid()) or public.has_role('administrador'));
create policy users_admin_write on public.users for update to authenticated
  using (public.has_role('administrador')) with check (public.has_role('administrador'));

-- patients: recepcion, doctor y admin. Sin DELETE (se usa soft delete: deleted_at).
create policy patients_select on public.patients for select to authenticated
  using (public.has_role('recepcionista','doctor','administrador')
         and (deleted_at is null or public.has_role('administrador')));
create policy patients_insert on public.patients for insert to authenticated
  with check (public.has_role('recepcionista','doctor','administrador'));
create policy patients_update on public.patients for update to authenticated
  using (public.has_role('recepcionista','doctor','administrador'))
  with check (public.has_role('recepcionista','doctor','administrador'));

-- appointments
create policy appointments_select on public.appointments for select to authenticated
  using (public.has_role('recepcionista','doctor','administrador') and deleted_at is null);
create policy appointments_insert on public.appointments for insert to authenticated
  with check (public.has_role('recepcionista','administrador'));
create policy appointments_update on public.appointments for update to authenticated
  using (public.has_role('recepcionista','doctor','administrador'))
  with check (public.has_role('recepcionista','doctor','administrador'));

-- medical_records: SOLO doctor y administrador. Recepcion NO ve contenido clinico.
create policy records_select on public.medical_records for select to authenticated
  using (public.has_role('doctor','administrador')
         and (deleted_at is null or public.has_role('administrador')));
create policy records_insert on public.medical_records for insert to authenticated
  with check (public.has_role('doctor','administrador')
              and (optometrista_id = (select auth.uid()) or public.has_role('administrador')));
create policy records_update on public.medical_records for update to authenticated
  using (public.has_role('administrador')
         or (public.has_role('doctor') and optometrista_id = (select auth.uid())))
  with check (public.has_role('administrador')
         or (public.has_role('doctor') and optometrista_id = (select auth.uid())));

create policy rx_select on public.rx_prescriptions for select to authenticated
  using (public.has_role('doctor','administrador'));
create policy rx_insert on public.rx_prescriptions for insert to authenticated
  with check (public.has_role('doctor','administrador'));
create policy rx_update on public.rx_prescriptions for update to authenticated
  using (public.has_role('doctor','administrador'))
  with check (public.has_role('doctor','administrador'));

create policy cl_select on public.contact_lens_trials for select to authenticated
  using (public.has_role('doctor','administrador'));
create policy cl_insert on public.contact_lens_trials for insert to authenticated
  with check (public.has_role('doctor','administrador'));
create policy cl_update on public.contact_lens_trials for update to authenticated
  using (public.has_role('doctor','administrador'))
  with check (public.has_role('doctor','administrador'));

-- products: lectura para el personal; escritura solo administrador.
create policy products_select on public.products for select to authenticated
  using (public.has_role('recepcionista','doctor','administrador','otro') and deleted_at is null);
create policy products_write on public.products for all to authenticated
  using (public.has_role('administrador')) with check (public.has_role('administrador'));

-- orders: recepcion/admin escriben; doctor solo lee.
create policy orders_select on public.orders for select to authenticated
  using (public.has_role('recepcionista','doctor','administrador','otro') and deleted_at is null);
create policy orders_insert on public.orders for insert to authenticated
  with check (public.has_role('recepcionista','administrador','otro'));
create policy orders_update on public.orders for update to authenticated
  using (public.has_role('recepcionista','administrador','otro'))
  with check (public.has_role('recepcionista','administrador','otro'));

-- order_status_history: append-only, el usuario registrado es siempre quien hace el cambio.
create policy osh_select on public.order_status_history for select to authenticated
  using (public.has_role('recepcionista','doctor','administrador','otro'));
create policy osh_insert on public.order_status_history for insert to authenticated
  with check (public.has_role('recepcionista','administrador','otro')
              and user_id = (select auth.uid()));

-- sales / sale_items: doctor NO accede. Vendedores crean las suyas; admin todo.
create policy sales_select on public.sales for select to authenticated
  using (deleted_at is null and (public.has_role('administrador')
         or (public.has_role('recepcionista','otro') and vendedor_id = (select auth.uid()))));
create policy sales_insert on public.sales for insert to authenticated
  with check (public.has_role('administrador')
         or (public.has_role('recepcionista','otro') and vendedor_id = (select auth.uid())));
create policy sales_update on public.sales for update to authenticated
  using (public.has_role('administrador')) with check (public.has_role('administrador'));

create policy sale_items_select on public.sale_items for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id));
create policy sale_items_insert on public.sale_items for insert to authenticated
  with check (exists (select 1 from public.sales s where s.id = sale_id));

-- inventory_movements: append-only.
create policy inv_select on public.inventory_movements for select to authenticated
  using (public.has_role('recepcionista','administrador','otro'));
create policy inv_insert on public.inventory_movements for insert to authenticated
  with check (public.has_role('recepcionista','administrador','otro')
              and user_id = (select auth.uid()));

-- whatsapp_reminders
create policy wa_select on public.whatsapp_reminders for select to authenticated
  using (public.has_role('recepcionista','administrador'));
create policy wa_insert on public.whatsapp_reminders for insert to authenticated
  with check (public.has_role('recepcionista','administrador'));
create policy wa_update on public.whatsapp_reminders for update to authenticated
  using (public.has_role('administrador')) with check (public.has_role('administrador'));

-- audit_log: solo administrador lee. Nadie edita ni borra (se escribe via funciones/triggers).
create policy audit_select on public.audit_log for select to authenticated
  using (public.has_role('administrador'));

-- Tablas append-only: ademas de RLS, se quita el permiso de editar/borrar a nivel de tabla.
revoke update, delete, truncate on public.audit_log from authenticated;
revoke update, delete, truncate on public.order_status_history from authenticated;
revoke update, delete, truncate on public.inventory_movements from authenticated;
-- Pacientes y fichas: nunca se borran fisicamente (trazabilidad clinica), solo soft delete.
revoke delete, truncate on public.patients from authenticated;
revoke delete, truncate on public.medical_records from authenticated;
