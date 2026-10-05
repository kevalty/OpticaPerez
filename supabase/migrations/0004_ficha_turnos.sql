-- Optica Perez - Semana 3 (parte 2): documento del paciente, flujo de turnos y ficha medica.
-- Aplicar DESPUES de 0003 (SQL Editor -> pegar todo -> Run).

-- ============ Pacientes: documento de identidad ============
alter table public.patients
  add column tipo_documento text not null default 'cedula' check (tipo_documento in ('cedula', 'pasaporte')),
  add column documento text check (documento is null or char_length(documento) between 5 and 20);
-- Un documento no puede repetirse entre pacientes activos.
create unique index patients_documento_uniq on public.patients (documento)
  where documento is not null and deleted_at is null;

-- ============ Ficha y turno ============
alter table public.medical_records
  add column indicaciones_recepcion text check (char_length(indicaciones_recepcion) <= 2000);
alter table public.appointments
  add column medical_record_id uuid references public.medical_records (id);
-- Un paciente no puede tener dos turnos "en curso" el mismo dia.
create unique index appointments_activo_uniq on public.appointments (patient_id, fecha)
  where deleted_at is null and estado in ('agendado', 'en_espera', 'en_consulta');

-- ============ Reglas del flujo de turnos (en la BD, no solo en la pantalla) ============
--   agendado -> en_espera      : recepcion (llego el paciente)
--   en_espera -> en_consulta   : doctor (lo pasa al consultorio)
--   en_consulta -> atendido    : doctor, y solo si hay ficha guardada
--   atendido -> finalizado     : recepcion (entrego indicaciones / impresion)
--   cancelar (deleted_at)      : recepcion, solo antes de que empiece la consulta
-- El administrador puede todo. Sin sesion de usuario (SQL Editor / service role) no se aplica.
create or replace function public.guard_appointment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r public.user_role; ok boolean;
begin
  if (select auth.uid()) is null then return new; end if;
  r := public.current_user_role();

  if tg_op = 'INSERT' then
    if r is distinct from 'administrador'
       and (new.estado::text not in ('agendado', 'en_espera') or new.medical_record_id is not null) then
      raise exception 'Un turno nuevo solo puede crearse agendado o en espera' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.patient_id is distinct from old.patient_id and r is distinct from 'administrador' then
    raise exception 'No se puede cambiar el paciente de un turno' using errcode = '42501';
  end if;

  if new.estado is distinct from old.estado then
    ok := case r
      when 'administrador' then true
      when 'recepcionista' then (old.estado::text, new.estado::text) in
        (('agendado', 'en_espera'), ('atendido', 'finalizado'))
      when 'doctor' then (old.estado::text, new.estado::text) in
        (('en_espera', 'en_consulta'), ('en_consulta', 'atendido'))
      else false end;
    if not coalesce(ok, false) then
      raise exception 'Cambio de estado no permitido para tu rol' using errcode = '42501';
    end if;
    if new.estado::text = 'atendido' and new.medical_record_id is null and r is distinct from 'administrador' then
      raise exception 'Para marcar atendido hay que guardar la ficha medica' using errcode = '42501';
    end if;
  end if;

  if new.deleted_at is distinct from old.deleted_at then
    if r not in ('recepcionista', 'administrador')
       or (r = 'recepcionista' and old.estado::text not in ('agendado', 'en_espera')) then
      raise exception 'No se puede cancelar este turno' using errcode = '42501';
    end if;
  end if;

  return new;
end $$;

create trigger guard_appointment_ins before insert on public.appointments
  for each row execute function public.guard_appointment();
create trigger guard_appointment_upd before update on public.appointments
  for each row execute function public.guard_appointment();

-- ============ Guardar la ficha completa de una consulta (todo o nada) ============
-- SECURITY INVOKER: se aplican las politicas RLS del doctor que la llama.
create or replace function public.guardar_ficha(p_turno uuid, p_ficha jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare t public.appointments; v_id uuid; x jsonb;
begin
  select * into t from public.appointments where id = p_turno and deleted_at is null for update;
  if not found then
    raise exception 'Turno no encontrado' using errcode = 'P0002';
  end if;
  if t.estado::text <> 'en_consulta' then
    raise exception 'El turno no esta en consulta' using errcode = 'P0001';
  end if;

  insert into public.medical_records (
    patient_id, optometrista_id, fecha, observaciones,
    rx_anterior_od, rx_anterior_oi, add_od, add_oi, avcc_od, avcc_oi, avsc_od, avsc_oi,
    ppc_od, ppc_oi, queratometria_od, queratometria_oi, oftalmoscopia_od, oftalmoscopia_oi,
    retinoscopia_od, retinoscopia_oi, lectura_computador_od, lectura_computador_oi,
    recomendaciones, indicaciones_recepcion)
  values (
    t.patient_id, (select auth.uid()), t.fecha, p_ficha->>'observaciones',
    p_ficha->>'rx_anterior_od', p_ficha->>'rx_anterior_oi', p_ficha->>'add_od', p_ficha->>'add_oi',
    p_ficha->>'avcc_od', p_ficha->>'avcc_oi', p_ficha->>'avsc_od', p_ficha->>'avsc_oi',
    p_ficha->>'ppc_od', p_ficha->>'ppc_oi', p_ficha->>'queratometria_od', p_ficha->>'queratometria_oi',
    p_ficha->>'oftalmoscopia_od', p_ficha->>'oftalmoscopia_oi',
    p_ficha->>'retinoscopia_od', p_ficha->>'retinoscopia_oi',
    p_ficha->>'lectura_computador_od', p_ficha->>'lectura_computador_oi',
    p_ficha->>'recomendaciones', p_ficha->>'indicaciones_recepcion')
  returning id into v_id;

  for x in select * from jsonb_array_elements(coalesce(p_ficha->'rx', '[]'::jsonb)) loop
    insert into public.rx_prescriptions (record_id, ojo, esfera, cilindro, eje, av, add, dp, color, bifocal)
    values (v_id, (x->>'ojo')::public.eye, (x->>'esfera')::numeric, (x->>'cilindro')::numeric,
            (x->>'eje')::smallint, x->>'av', (x->>'add')::numeric, (x->>'dp')::numeric,
            x->>'color', coalesce((x->>'bifocal')::boolean, false));
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p_ficha->'cl', '[]'::jsonb)) loop
    insert into public.contact_lens_trials (record_id, ojo, prueba, av)
    values (v_id, (x->>'ojo')::public.eye, x->>'prueba', x->>'av');
  end loop;

  update public.appointments set estado = 'atendido', medical_record_id = v_id where id = p_turno;
  return v_id;
end $$;
revoke all on function public.guardar_ficha(uuid, jsonb) from public, anon;
grant execute on function public.guardar_ficha(uuid, jsonb) to authenticated;

-- ============ Receta para recepcion (solo lo necesario, nunca la ficha completa) ============
-- La recepcionista NO puede leer fichas. Esta funcion le entrega unicamente la tabla Rx,
-- el color/bifocal y las "indicaciones para recepcion" que escribio el doctor, y solo de
-- turnos ya atendidos. Cada consulta queda registrada en la bitacora de auditoria.
create or replace function public.receta_recepcion(p_turno uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.appointments; mr public.medical_records; res jsonb;
begin
  if not public.has_role('recepcionista', 'doctor', 'administrador') then
    return null;
  end if;
  select * into t from public.appointments
    where id = p_turno and deleted_at is null and estado::text in ('atendido', 'finalizado');
  if not found or t.medical_record_id is null then return null; end if;
  select * into mr from public.medical_records where id = t.medical_record_id;

  select jsonb_build_object(
    'paciente', p.nombre, 'tipo_documento', p.tipo_documento, 'documento', p.documento,
    'fecha', t.fecha,
    'optometrista', (select coalesce(nullif(u.nombre, ''), u.email) from public.users u where u.id = mr.optometrista_id),
    'indicaciones', mr.indicaciones_recepcion,
    'color', (select x.color from public.rx_prescriptions x where x.record_id = mr.id and x.deleted_at is null order by x.ojo limit 1),
    'bifocal', (select coalesce(bool_or(x.bifocal), false) from public.rx_prescriptions x where x.record_id = mr.id and x.deleted_at is null),
    'rx', (select coalesce(jsonb_agg(jsonb_build_object('ojo', x.ojo, 'esfera', x.esfera, 'cilindro', x.cilindro,
             'eje', x.eje, 'av', x.av, 'add', x.add, 'dp', x.dp) order by x.ojo), '[]'::jsonb)
           from public.rx_prescriptions x where x.record_id = mr.id and x.deleted_at is null))
  into res
  from public.patients p where p.id = t.patient_id;

  insert into public.audit_log (user_id, accion, tabla, registro_id)
  values ((select auth.uid()), 'ver', 'medical_records', mr.id);
  return res;
end $$;
revoke all on function public.receta_recepcion(uuid) from public, anon;
grant execute on function public.receta_recepcion(uuid) to authenticated;

-- ============ Cancelar un turno (soft delete) ============
-- Se hace por funcion porque las politicas RLS no dejan "esconder" una fila que luego
-- ya no se podria ver. Recepcion solo puede cancelar turnos agendados o en espera.
create or replace function public.cancelar_turno(p_turno uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role('recepcionista', 'administrador') then
    raise exception 'No tienes permiso para cancelar turnos' using errcode = '42501';
  end if;
  update public.appointments set deleted_at = now()
  where id = p_turno and deleted_at is null
    and (estado::text in ('agendado', 'en_espera') or public.has_role('administrador'));
  if not found then
    raise exception 'El turno no existe o ya no se puede cancelar' using errcode = 'P0002';
  end if;
end $$;
revoke all on function public.cancelar_turno(uuid) from public, anon;
grant execute on function public.cancelar_turno(uuid) to authenticated;
