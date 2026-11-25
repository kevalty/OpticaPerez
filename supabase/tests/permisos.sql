-- Optica Perez - Prueba de permisos por rol (solo lectura: no crea ni modifica datos).
-- Como usarla: pegarla completa en el SQL Editor de Supabase y ejecutarla. Necesita al menos un usuario ACTIVO de cada rol
-- (recepcionista, doctor, administrador). Cada linea dice OK o FALLA; al final avisa cuantas fallaron.
-- Las pruebas de tablas solo cuentan cuando el administrador ve al menos una fila de esa tabla (si no hay datos dice SIN DATOS).
do $$
declare
  uid_rec uuid; uid_doc uuid; uid_adm uuid;
  fallas integer := 0; total integer := 0;
  t record; f record; vis_adm bigint; vis bigint; ok boolean; msg text;
begin
  select id into uid_rec from public.users where rol = 'recepcionista' and activo and deleted_at is null limit 1;
  select id into uid_doc from public.users where rol = 'doctor' and activo and deleted_at is null limit 1;
  select id into uid_adm from public.users where rol = 'administrador' and activo and deleted_at is null limit 1;
  if uid_rec is null or uid_doc is null or uid_adm is null then
    raise exception 'Hace falta al menos un usuario activo de cada rol (recepcionista, doctor, administrador).';
  end if;

  -- 1) TABLAS: cuantas filas ve cada rol (la RLS decide). esperado: Y = ve, N = no ve nada
  for t in
    select * from (values
      ('medical_records', 'recepcionista', false), ('medical_records', 'doctor', true),
      ('rx_prescriptions', 'recepcionista', false), ('rx_prescriptions', 'doctor', true),
      ('contact_lens_trials', 'recepcionista', false), ('contact_lens_trials', 'doctor', true),
      ('audit_log', 'recepcionista', false), ('audit_log', 'doctor', false),
      ('sales', 'doctor', false), ('sale_items', 'doctor', false), ('sale_payments', 'doctor', false),
      ('whatsapp_envios', 'doctor', false), ('whatsapp_plantillas', 'doctor', false),
      ('entrega_confirmaciones', 'doctor', true), ('order_fotos', 'recepcionista', true)
    ) v(tabla, rol, esperado)
  loop
    total := total + 1;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', uid_adm::text, true);
    execute format('select count(*) from public.%I', t.tabla) into vis_adm;
    perform set_config('request.jwt.claim.sub', case t.rol when 'doctor' then uid_doc else uid_rec end::text, true);
    begin
      execute format('select count(*) from public.%I', t.tabla) into vis;
    exception when others then vis := 0; end;
    execute 'reset role';
    if vis_adm = 0 then
      raise notice 'SIN DATOS  % (%): el administrador no ve filas, no se puede comprobar', t.tabla, t.rol;
      total := total - 1;
    elsif (vis > 0) = t.esperado then
      raise notice 'OK         % (%): % filas visibles (esperado: %)', t.tabla, t.rol, vis, case when t.esperado then 'ver' else 'no ver' end;
    else
      raise notice 'FALLA      % (%): % filas visibles (esperado: %)', t.tabla, t.rol, vis, case when t.esperado then 'ver' else 'no ver' end;
      fallas := fallas + 1;
    end if;
  end loop;

  -- 2) FUNCIONES solo para administrador: recepcion y doctor deben recibir "sin permiso" (42501)
  for f in
    select * from (values
      ('reporte_ventas', 'select public.reporte_ventas(current_date, current_date)'),
      ('auditoria_registros', 'select public.auditoria_registros(current_date, current_date)'),
      ('revision_seguridad', 'select public.revision_seguridad()'),
      ('ajustar_stock', 'select public.ajustar_stock(gen_random_uuid(), 1, ''prueba'')'),
      ('anular_venta', 'select public.anular_venta(gen_random_uuid(), ''prueba'')')
    ) v(nombre, sentencia)
  loop
    foreach msg in array array['recepcionista', 'doctor'] loop
      total := total + 1;
      execute 'set local role authenticated';
      perform set_config('request.jwt.claim.sub', case msg when 'doctor' then uid_doc else uid_rec end::text, true);
      ok := false;
      begin
        execute f.sentencia;
      exception when sqlstate '42501' then ok := true;
                when others then ok := false; end;
      execute 'reset role';
      if ok then raise notice 'OK         %() bloqueada para %', f.nombre, msg;
      else raise notice 'FALLA      %() NO esta bloqueada para %', f.nombre, msg; fallas := fallas + 1; end if;
    end loop;
  end loop;

  -- 3) ANONIMO: ninguna tabla accesible y solo las funciones publicas previstas
  total := total + 1;
  select count(*) into vis from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('anon', c.oid, 'select,insert,update,delete');
  if vis = 0 then raise notice 'OK         el rol anonimo no tiene acceso a ninguna tabla';
  else raise notice 'FALLA      el rol anonimo tiene acceso a % tablas', vis; fallas := fallas + 1; end if;

  total := total + 1;
  select count(*) into vis from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and p.proname not in ('confirmar_entrega', 'entrega_foto_publica', 'login_estado', 'login_fallo', 'seguimiento_foto_path', 'seguimiento_publico');
  if vis = 0 then raise notice 'OK         el rol anonimo solo ejecuta las funciones publicas previstas (seguimiento, confirmacion y control de inicio de sesion)';
  else raise notice 'FALLA      el rol anonimo puede ejecutar % funciones no previstas', vis; fallas := fallas + 1; end if;

  raise notice '----';
  raise notice 'RESULTADO: % de % pruebas correctas%', total - fallas, total, case when fallas = 0 then ' ✔' else ' - REVISAR LAS LINEAS «FALLA»' end;
end $$;
