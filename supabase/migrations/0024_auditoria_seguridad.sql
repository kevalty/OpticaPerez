-- Optica Perez - Semana 10: auditoria y endurecimiento de seguridad. Se puede ejecutar varias veces.
--   1) Las funciones de trigger y de apoyo dejan de ser ejecutables por el publico (rol anonimo).
--   2) Mas bitacora: cambios de productos y usuarios, fotos de entrega y confirmaciones de entrega del cliente.
--   3) auditoria_registros(): consulta de la bitacora (solo administrador), con nombres y filtros.
--   4) revision_seguridad(): revision automatica del estado de seguridad (solo administrador).

-- ============ 1) Funciones que no deben ser publicas ============
do $$
declare f text;
begin
  foreach f in array array['public.audit_write()', 'public.guard_appointment()', 'public.guard_soft_delete()', 'public.handle_new_auth_user()', 'public.set_updated_at()'] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', f);
    end if;
  end loop;
  -- Ayudantes puros: solo para usuarios con sesion.
  foreach f in array array['public.orden_estados()', 'public.sin_tildes(text)'] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon', f);
      execute format('grant execute on function %s to authenticated', f);
    end if;
  end loop;
end $$;

-- ============ 2) Mas bitacora ============
drop trigger if exists audit_products on public.products;
create trigger audit_products after insert or update on public.products for each row execute function public.audit_write();
drop trigger if exists audit_users on public.users;
create trigger audit_users after insert or update on public.users for each row execute function public.audit_write();
drop trigger if exists audit_order_fotos on public.order_fotos;
create trigger audit_order_fotos after insert on public.order_fotos for each row execute function public.audit_write();
drop trigger if exists audit_entrega_confirmaciones on public.entrega_confirmaciones;
create trigger audit_entrega_confirmaciones after insert on public.entrega_confirmaciones for each row execute function public.audit_write();

-- ============ 3) Consulta de la bitacora ============
create or replace function public.auditoria_registros(
  p_desde date, p_hasta date, p_tabla text default null, p_accion text default null,
  p_usuario uuid default null, p_q text default null, p_limite integer default 200)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if not public.has_role('administrador') then
    raise exception 'Solo un administrador puede ver la auditoria' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'El rango de fechas no es valido' using errcode = 'P0001';
  end if;
  if p_hasta - p_desde > 366 then
    raise exception 'El periodo no puede pasar de un año' using errcode = 'P0001';
  end if;
  if q is not null then
    q := '%' || replace(replace(replace(public.sin_tildes(q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.id desc) from (
      select a.id, a.created_at, a.accion, a.tabla, a.registro_id,
             coalesce(nullif(u.nombre, ''), u.email, 'Sistema / cliente (enlace)') as usuario, u.rol::text as rol, pa.nombre as paciente
        from public.audit_log a
        left join public.users u on u.id = a.user_id
        left join lateral (
          select p.nombre from public.patients p where p.id = case a.tabla
            when 'patients' then a.registro_id
            when 'medical_records' then (select mr.patient_id from public.medical_records mr where mr.id = a.registro_id)
            when 'orders' then (select o.patient_id from public.orders o where o.id = a.registro_id)
            when 'sales' then (select s.patient_id from public.sales s where s.id = a.registro_id)
            when 'sale_payments' then (select s.patient_id from public.sale_payments sp join public.sales s on s.id = sp.sale_id where sp.id = a.registro_id)
            when 'entrega_confirmaciones' then (select o.patient_id from public.entrega_confirmaciones c join public.orders o on o.id = c.order_id where c.id = a.registro_id)
            when 'order_fotos' then (select o.patient_id from public.order_fotos f join public.orders o on o.id = f.order_id where f.id = a.registro_id)
          end
        ) pa on true
       where (a.created_at at time zone 'America/Guayaquil')::date between p_desde and p_hasta
         and (p_tabla is null or a.tabla = p_tabla)
         and (p_accion is null or a.accion = p_accion)
         and (p_usuario is null or a.user_id = p_usuario)
         and (q is null or public.sin_tildes(coalesce(pa.nombre, '')) like q)
       order by a.id desc
       limit least(greatest(coalesce(p_limite, 200), 1), 1000)
    ) x), '[]'::jsonb);
end $$;
revoke all on function public.auditoria_registros(date, date, text, text, uuid, text, integer) from public, anon;
grant execute on function public.auditoria_registros(date, date, text, text, uuid, text, integer) to authenticated;

-- ============ 4) Revision automatica de seguridad ============
create or replace function public.revision_seguridad()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  if not public.has_role('administrador') then
    raise exception 'Solo un administrador puede ver la revision de seguridad' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'tablas', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'),
    'tablas_sin_rls', coalesce((select jsonb_agg(c.relname order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                                 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), '[]'::jsonb),
    'tablas_sin_politicas', coalesce((select jsonb_agg(c.relname order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                                       where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
                                         and not exists (select 1 from pg_policy p where p.polrelid = c.oid)), '[]'::jsonb),
    'funciones_sin_search_path', coalesce((select jsonb_agg(p.proname order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                            where n.nspname = 'public' and p.prosecdef
                                              and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) cf where cf like 'search_path=%')), '[]'::jsonb),
    'funciones_publicas', coalesce((select jsonb_agg(distinct p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                     where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')
                                       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')), '[]'::jsonb),
    'tablas_con_acceso_anonimo', coalesce((select jsonb_agg(c.relname order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                                            where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('anon', c.oid, 'select,insert,update,delete')), '[]'::jsonb),
    'buckets_publicos', coalesce((select jsonb_agg(b.id order by b.id) from storage.buckets b where b.public), '[]'::jsonb),
    'administradores_activos', (select count(*) from public.users where rol = 'administrador' and activo and deleted_at is null),
    'usuarios_activos', (select count(*) from public.users where activo and deleted_at is null)
  ) into res;
  return res;
end $$;
revoke all on function public.revision_seguridad() from public, anon;
grant execute on function public.revision_seguridad() to authenticated;
