-- Optica Perez - Semana 2: directorio de optometristas y candado de archivado.
-- Aplicar despues de 0001 (SQL Editor -> pegar todo -> Run).

-- Lista minima (id + nombre) de optometristas activos, para asignar turnos.
-- La recepcion no puede leer la tabla users (RLS), por eso se expone solo esto.
create or replace function public.list_optometristas()
returns table (id uuid, nombre text)
language sql stable security definer set search_path = '' as $$
  select u.id, coalesce(nullif(u.nombre, ''), u.email)
  from public.users u
  where u.rol = 'doctor' and u.activo and u.deleted_at is null
    and public.has_role('recepcionista', 'doctor', 'administrador')
  order by 2
$$;
revoke all on function public.list_optometristas() from public, anon;
grant execute on function public.list_optometristas() to authenticated;

-- Solo un administrador puede archivar o restaurar pacientes y fichas (soft delete).
-- Sin sesion de usuario (SQL Editor / service role) no se aplica, para poder dar mantenimiento.
create or replace function public.guard_soft_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is distinct from old.deleted_at
     and (select auth.uid()) is not null
     and not public.has_role('administrador') then
    raise exception 'Solo un administrador puede archivar o restaurar registros'
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger guard_patients_soft_delete before update on public.patients
  for each row execute function public.guard_soft_delete();
create trigger guard_records_soft_delete before update on public.medical_records
  for each row execute function public.guard_soft_delete();
