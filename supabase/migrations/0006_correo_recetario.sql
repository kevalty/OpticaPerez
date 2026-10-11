-- Optica Perez - Correo del paciente y recetario de lentes (formato Essilor).
-- Aplicar DESPUES de 0005 (SQL Editor -> pegar todo -> Run). Aplicar ANTES de publicar la version nueva de la app.

-- ============ Pacientes: correo electronico (obligatorio al registrar; puede repetirse) ============
-- No es unico a proposito: una familia puede compartir correo. Los pacientes ya registrados quedan sin correo
-- hasta que se editen (la app se lo pide al guardar cambios).
alter table public.patients
  add column email text check (email is null or char_length(email) <= 120);

-- ============ Recetario de lentes ============
-- Es la hoja "RECETARIO" que se envia al laboratorio: Rx por ojo (esfera, cilindro, eje, prisma, base,
-- adicion, altura, DP lejos/cerca), diseno, tratamiento y material, mas un segundo par opcional.
-- Se guarda como JSON dentro de la ficha (todo o nada con guardar_ficha). El doctor la llena en la consulta;
-- la recepcionista la recibe solo por certificado_recepcion() para imprimirla.
alter table public.medical_records
  add column recetario jsonb check (recetario is null or (jsonb_typeof(recetario) = 'object' and pg_column_size(recetario) <= 8000));

-- ============ guardar_ficha: ahora tambien guarda el recetario ============
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
    avh_condicion, avh_od, avh_oi, rx_tipo, cie_od, cie_oi, test_colores, necesita_lentes, control_meses,
    recetario)
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
    (p_ficha->>'necesita_lentes')::boolean, (p_ficha->>'control_meses')::smallint,
    case when jsonb_typeof(p_ficha->'recetario') = 'object' then p_ficha->'recetario' end)
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

-- ============ certificado_recepcion: ahora incluye contacto del paciente y el recetario ============
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
    'telefono', p.telefono, 'email', p.email, 'direccion', p.direccion,
    'fecha', t.fecha,
    'optometrista', (select coalesce(nullif(u.nombre, ''), u.email) from public.users u where u.id = mr.optometrista_id),
    'registro_msp', (select u.registro_msp from public.users u where u.id = mr.optometrista_id),
    'avh_condicion', mr.avh_condicion, 'avh_od', mr.avh_od, 'avh_oi', mr.avh_oi,
    'rx_tipo', mr.rx_tipo, 'cie_od', mr.cie_od, 'cie_oi', mr.cie_oi,
    'test_colores', mr.test_colores, 'necesita_lentes', mr.necesita_lentes, 'control_meses', mr.control_meses,
    'indicaciones', mr.indicaciones_recepcion,
    'recetario', mr.recetario,
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
