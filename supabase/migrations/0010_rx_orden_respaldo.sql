-- Optica Perez - La hoja RX de la orden usa la Rx principal de la ficha cuando la hoja RX no trae medidas,
-- y su fecha por defecto es la de Guayaquil (antes podia salir con el dia siguiente al final de la tarde).
-- Aplicar DESPUES de 0008/0009 (SQL Editor -> pegar todo -> Run). Es seguro correrla mas de una vez.

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
    'fecha', coalesce(mr.fecha, (now() at time zone 'America/Guayaquil')::date),  -- fecha local, no la del servidor (UTC)
    'recetario', mr.recetario,
    'tiene_ficha', (mr.id is not null),
    -- Rx principal de la ficha: respaldo cuando la hoja RX no tiene las medidas llenas
    'rx', (select coalesce(jsonb_agg(jsonb_build_object('ojo', x.ojo, 'esfera', x.esfera, 'cilindro', x.cilindro,
             'eje', x.eje, 'add', x.add, 'dp', x.dp) order by x.ojo), '[]'::jsonb)
           from public.rx_prescriptions x where x.record_id = mr.id and x.deleted_at is null)
  ) into res from public.patients p where p.id = o.patient_id;
  if mr.id is not null then
    insert into public.audit_log (user_id, accion, tabla, registro_id) values ((select auth.uid()), 'ver', 'medical_records', mr.id);
  end if;
  return res;
end $$;
revoke all on function public.rx_orden(uuid) from public, anon;
grant execute on function public.rx_orden(uuid) to authenticated;
