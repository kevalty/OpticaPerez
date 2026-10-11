-- Optica Perez - Endurecimiento de seguridad.
-- Aplicar DESPUES de 0006 (SQL Editor -> pegar todo -> Run). Es seguro correrla mas de una vez.

-- ============ 1. Bitacora: log_access ya no acepta cualquier tabla ni accion ============
-- Antes cualquier usuario activo podia insertar entradas con tabla/id arbitrarios (ensuciar la auditoria).
-- Ahora: solo 'ver', solo tablas conocidas, y las fichas solo las puede registrar doctor/administrador.
create or replace function public.log_access(p_tabla text, p_registro_id uuid, p_accion text default 'ver')
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (user_id, accion, tabla, registro_id)
  select (select auth.uid()), 'ver', p_tabla, p_registro_id
  where p_accion = 'ver'
    and p_registro_id is not null
    and (
      (p_tabla = 'medical_records' and public.has_role('doctor', 'administrador'))
      or (p_tabla in ('patients', 'appointments') and public.has_role('recepcionista', 'doctor', 'administrador'))
    )
$$;
revoke all on function public.log_access(text, uuid, text) from public, anon;
grant execute on function public.log_access(text, uuid, text) to authenticated;

-- ============ 2. Bloqueo progresivo de inicios de sesion fallidos ============
-- 5 fallos seguidos bloquean el correo 1 min; cada fallo extra duplica la espera (maximo 30 min).
-- La tabla no es accesible desde la app: solo por estas funciones.
create table if not exists public.login_attempts (
  email_key text primary key check (char_length(email_key) <= 254),
  fallos integer not null default 0,
  bloqueado_hasta timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;

-- Segundos que faltan para poder intentar de nuevo (0 = libre).
create or replace function public.login_estado(p_email text)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((
    select greatest(0, ceil(extract(epoch from (bloqueado_hasta - now()))))::integer
    from public.login_attempts where email_key = lower(btrim(left(p_email, 254)))
  ), 0)
$$;

create or replace function public.login_fallo(p_email text)
returns integer language plpgsql security definer set search_path = '' as $$
declare k text := lower(btrim(left(p_email, 254))); n integer; espera integer;
begin
  if k = '' then return 0; end if;
  insert into public.login_attempts (email_key, fallos) values (k, 1)
  on conflict (email_key) do update set fallos = public.login_attempts.fallos + 1, updated_at = now()
  returning fallos into n;
  if n >= 5 then
    espera := least(1800, 60 * (2 ^ least(n - 5, 10))::integer);
    update public.login_attempts set bloqueado_hasta = now() + make_interval(secs => espera) where email_key = k;
    return espera;
  end if;
  return 0;
end $$;

-- Solo despues de un inicio de sesion correcto, y solo para el propio correo (si no, un atacante
-- podria reiniciar su contador).
create or replace function public.login_ok(p_email text)
returns void language sql security definer set search_path = '' as $$
  delete from public.login_attempts
  where email_key = lower(btrim(left(p_email, 254)))
    and email_key = lower(coalesce((select auth.jwt() ->> 'email'), ''))
$$;

revoke all on function public.login_estado(text), public.login_fallo(text), public.login_ok(text) from public;
grant execute on function public.login_estado(text), public.login_fallo(text) to anon, authenticated;
grant execute on function public.login_ok(text) to authenticated;
