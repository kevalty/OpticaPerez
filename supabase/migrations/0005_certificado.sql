-- Optica Perez - Certificado: campos nuevos de la ficha y registro profesional del doctor.
-- Aplicar DESPUES de 0004 (SQL Editor -> pegar todo -> Run).

-- ============ Datos que lleva el certificado y que la ficha aun no tenia ============
alter table public.medical_records
  add column avh_condicion text check (char_length(avh_condicion) <= 60),   -- p. ej. "SIN RX AO."
  add column avh_od text check (char_length(avh_od) <= 30),                  -- agudeza visual habitual
  add column avh_oi text check (char_length(avh_oi) <= 30),
  add column rx_tipo text check (char_length(rx_tipo) <= 30),                -- p. ej. "FINAL"
  add column cie_od text check (char_length(cie_od) <= 60),                  -- p. ej. "H52.1 / H52.2"
  add column cie_oi text check (char_length(cie_oi) <= 60),
  add column test_colores text check (char_length(test_colores) <= 60),      -- p. ej. "NORMAL"
  add column necesita_lentes boolean,
  add column control_meses smallint check (control_meses between 1 and 60);

-- Registro del Ministerio de Salud Publica que se imprime bajo la firma. Lo asigna el administrador.
alter table public.users
  add column registro_msp text check (char_length(registro_msp) <= 30);

-- ============ guardar_ficha: ahora tambien guarda los campos del certificado ============
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
    recomendaciones, indicaciones_recepcion,
    avh_condicion, avh_od, avh_oi, rx_tipo, cie_od, cie_oi, test_colores, necesita_lentes, control_meses)
  values (
    t.patient_id, (select auth.uid()), t.fecha, p_ficha->>'observaciones',
    p_ficha->>'rx_anterior_od', p_ficha->>'rx_anterior_oi', p_ficha->>'add_od', p_ficha->>'add_oi',
    p_ficha->>'avcc_od', p_ficha->>'avcc_oi', p_ficha->>'avsc_od', p_ficha->>'avsc_oi',
    p_ficha->>'ppc_od', p_ficha->>'ppc_oi', p_ficha->>'queratometria_od', p_ficha->>'queratometria_oi',
    p_ficha->>'oftalmoscopia_od', p_ficha->>'oftalmoscopia_oi',
    p_ficha->>'retinoscopia_od', p_ficha->>'retinoscopia_oi',
    p_ficha->>'lectura_computador_od', p_ficha->>'lectura_computador_oi',
    p_ficha->>'recomendaciones', p_ficha->>'indicaciones_recepcion',
    p_ficha->>'avh_condicion', p_ficha->>'avh_od', p_ficha->>'avh_oi', p_ficha->>'rx_tipo',
    p_ficha->>'cie_od', p_ficha->>'cie_oi', p_ficha->>'test_colores',
    (p_ficha->>'necesita_lentes')::boolean, (p_ficha->>'control_meses')::smallint)
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

-- ============ Certificado para recepcion (reemplaza a receta_recepcion) ============
-- La recepcionista NO puede leer fichas. Esta funcion le entrega unicamente lo que lleva el
-- certificado que se entrega al paciente (agudeza visual, Rx final, DP, codigos CIE, test de
-- colores, necesidad de lentes, control) mas las indicaciones del doctor para recepcion.
-- Nunca devuelve observaciones, queratometria, oftalmoscopia, retinoscopia ni lentes de contacto.
-- Solo de turnos ya atendidos, y cada consulta queda en la bitacora de auditoria.
drop function if exists public.receta_recepcion(uuid);

create or replace function public.certificado_recepcion(p_turno uuid)
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
    'registro_msp', (select u.registro_msp from public.users u where u.id = mr.optometrista_id),
    'avh_condicion', mr.avh_condicion, 'avh_od', mr.avh_od, 'avh_oi', mr.avh_oi,
    'rx_tipo', mr.rx_tipo, 'cie_od', mr.cie_od, 'cie_oi', mr.cie_oi,
    'test_colores', mr.test_colores, 'necesita_lentes', mr.necesita_lentes, 'control_meses', mr.control_meses,
    'indicaciones', mr.indicaciones_recepcion,
    'rx', (select coalesce(jsonb_agg(jsonb_build_object('ojo', x.ojo, 'esfera', x.esfera, 'cilindro', x.cilindro,
             'eje', x.eje, 'av', x.av, 'add', x.add, 'dp', x.dp) order by x.ojo), '[]'::jsonb)
           from public.rx_prescriptions x where x.record_id = mr.id and x.deleted_at is null))
  into res
  from public.patients p where p.id = t.patient_id;

  insert into public.audit_log (user_id, accion, tabla, registro_id)
  values ((select auth.uid()), 'ver', 'medical_records', mr.id);
  return res;
end $$;
revoke all on function public.certificado_recepcion(uuid) from public, anon;
grant execute on function public.certificado_recepcion(uuid) to authenticated;
