-- Optica Perez - Semana 5: seguimiento de pedidos y enlace publico para el cliente.
-- Aplicar DESPUES de 0011 (que se ejecuta sola). Es seguro correrla mas de una vez.
--
-- Estados (en orden): enviado_a_hacer -> recibido_en_laboratorio -> enviado_a_riobamba -> listo_para_recibir -> entregado
-- Todo cambio de estado pasa por cambiar_estado_pedido(): valida el orden, guarda fecha y usuario en el historial.
-- El cliente (sin cuenta) ve su pedido con un enlace que lleva un token exclusivo (seguimiento_publico).

-- ============ Token exclusivo por pedido + fecha de entrega real ============
-- 64 caracteres hexadecimales al azar (dos UUID v4 sin guiones): imposible de adivinar.
alter table public.orders
  add column if not exists token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  add column if not exists entregado_en timestamptz;
create unique index if not exists orders_token_uniq on public.orders (token);

-- Pedidos creados con los estados anteriores pasan a los nuevos.
update public.orders set estado = 'recibido_en_laboratorio' where estado::text = 'procesando';
update public.orders set estado = 'listo_para_recibir' where estado::text = 'listo_para_entrega';
update public.order_status_history set estado = 'recibido_en_laboratorio' where estado::text = 'procesando';
update public.order_status_history set estado = 'listo_para_recibir' where estado::text = 'listo_para_entrega';

-- ============ Cierre de caminos directos ============
-- Los pedidos se crean solo con crear_venta() y su estado cambia solo con cambiar_estado_pedido().
revoke insert, delete, truncate on public.orders from authenticated;
revoke update on public.orders from authenticated;
grant update (fecha_entrega, notas) on public.orders to authenticated;   -- recepcion puede reprogramar la entrega
revoke insert on public.order_status_history from authenticated;

drop trigger if exists audit_orders on public.orders;
create trigger audit_orders after insert or update on public.orders for each row execute function public.audit_write();

-- ============ Orden de los estados ============
create or replace function public.orden_estados()
returns text[] language sql immutable set search_path = '' as $$
  select array['enviado_a_hacer', 'recibido_en_laboratorio', 'enviado_a_riobamba', 'listo_para_recibir', 'entregado']
$$;

-- ============ cambiar_estado_pedido ============
-- Recepcion avanza un paso a la vez. El administrador tambien puede corregir hacia atras un paso.
-- Entregar exige saldo en cero (el administrador puede autorizar la excepcion).
create or replace function public.cambiar_estado_pedido(p_orden uuid, p_estado public.order_status)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  o public.orders; s public.sales;
  orden text[] := public.orden_estados();
  i_act integer; i_new integer; es_admin boolean;
begin
  if not public.has_role('recepcionista', 'administrador', 'otro') then
    raise exception 'No tienes permiso para cambiar el estado de un pedido' using errcode = '42501';
  end if;
  es_admin := public.has_role('administrador');
  select * into o from public.orders where id = p_orden and deleted_at is null for update;
  if not found then raise exception 'Pedido no encontrado' using errcode = 'P0002'; end if;

  i_act := array_position(orden, o.estado::text);
  i_new := array_position(orden, p_estado::text);
  if i_act is null or i_new is null then
    raise exception 'Estado no valido' using errcode = 'P0001';
  end if;
  if i_new = i_act then
    raise exception 'El pedido ya esta en ese estado' using errcode = 'P0001';
  end if;
  if i_new <> i_act + 1 and not (es_admin and i_new = i_act - 1) then
    raise exception 'Solo se puede avanzar un paso a la vez' using errcode = 'P0001';
  end if;
  if p_estado = 'entregado' and not es_admin then
    select * into s from public.sales where id = o.sale_id;
    if found and s.total - s.pagado > 0 then
      raise exception 'Cobra el saldo pendiente antes de entregar el pedido' using errcode = 'P0001';
    end if;
  end if;

  update public.orders
     set estado = p_estado,
         entregado_en = case when p_estado = 'entregado' then now() when i_new < i_act then null else entregado_en end
   where id = p_orden;
  insert into public.order_status_history (order_id, estado, user_id) values (p_orden, p_estado, uid);
  return jsonb_build_object('estado', p_estado, 'avisar', p_estado = 'listo_para_recibir');
end $$;
revoke all on function public.cambiar_estado_pedido(uuid, public.order_status) from public, anon;
grant execute on function public.cambiar_estado_pedido(uuid, public.order_status) to authenticated;

-- ============ Especificaciones del pedido SIN medidas de la Rx ============
-- Diseno, tratamiento y material salen de la hoja RX de la ficha; las medidas (esfera, cilindro...) nunca.
create or replace function public.especificaciones_pedido(p_record uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'primaria', case when jsonb_typeof(mr.recetario -> 'primaria') = 'object' then (mr.recetario -> 'primaria') - 'od'::text - 'oi'::text end,
    'segundo', case when jsonb_typeof(mr.recetario -> 'segundo') = 'object' then (mr.recetario -> 'segundo') - 'od'::text - 'oi'::text end)
  from public.medical_records mr where mr.id = p_record
$$;
revoke all on function public.especificaciones_pedido(uuid) from public, anon, authenticated;

-- ============ lista_pedidos ============
-- p_filtro: 'activos' (sin entregar), 'listos', 'entregados' o 'todos'. El saldo no se muestra al doctor.
create or replace function public.lista_pedidos(p_filtro text default 'activos')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare res jsonb; ver_dinero boolean;
begin
  if not public.has_role('recepcionista', 'doctor', 'administrador', 'otro') then return '[]'::jsonb; end if;
  ver_dinero := not public.has_role('doctor');
  select coalesce(jsonb_agg(to_jsonb(x) order by x.fecha_entrega nulls last, x.creado desc), '[]'::jsonb) into res
  from (
    select o.id, s.numero, p.nombre as paciente, p.telefono, o.estado, o.fecha_entrega, o.created_at as creado,
           case when ver_dinero then s.total - s.pagado end as saldo
    from public.orders o
    join public.patients p on p.id = o.patient_id
    left join public.sales s on s.id = o.sale_id
    where o.deleted_at is null
      and case p_filtro
            when 'activos' then o.estado::text <> 'entregado'
            when 'listos' then o.estado::text = 'listo_para_recibir'
            when 'entregados' then o.estado::text = 'entregado'
            else true end
    order by o.fecha_entrega nulls last, o.created_at desc
    limit 300
  ) x;
  return res;
end $$;
revoke all on function public.lista_pedidos(text) from public, anon;
grant execute on function public.lista_pedidos(text) to authenticated;

-- ============ pedido_detalle (para el personal) ============
create or replace function public.pedido_detalle(p_orden uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare o public.orders; s public.sales; p public.patients; ver_dinero boolean; res jsonb;
begin
  if not public.has_role('recepcionista', 'doctor', 'administrador', 'otro') then return null; end if;
  ver_dinero := not public.has_role('doctor');
  select * into o from public.orders where id = p_orden and deleted_at is null;
  if not found then return null; end if;
  select * into p from public.patients where id = o.patient_id;
  select * into s from public.sales where id = o.sale_id;

  res := jsonb_build_object(
    'id', o.id, 'estado', o.estado, 'fecha_entrega', o.fecha_entrega, 'notas', o.notas,
    'creado', o.created_at, 'entregado_en', o.entregado_en,
    'numero', s.numero, 'sale_id', s.id,
    'paciente', p.nombre, 'patient_id', p.id, 'telefono', p.telefono,
    'total', case when ver_dinero then s.total end,
    'pagado', case when ver_dinero then s.pagado end,
    'saldo', case when ver_dinero then s.total - s.pagado end,
    'token', case when ver_dinero then o.token end,
    'items', coalesce((select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad) order by i.nombre)
                       from public.sale_items i where i.sale_id = s.id), '[]'::jsonb),
    'especificaciones', public.especificaciones_pedido(o.record_id),
    'historial', coalesce((select jsonb_agg(jsonb_build_object('estado', h.estado, 'fecha', h.fecha,
                             'usuario', coalesce(nullif(u.nombre, ''), u.email)) order by h.fecha)
                           from public.order_status_history h left join public.users u on u.id = h.user_id
                           where h.order_id = o.id), '[]'::jsonb));
  return res;
end $$;
revoke all on function public.pedido_detalle(uuid) from public, anon;
grant execute on function public.pedido_detalle(uuid) to authenticated;

-- ============ seguimiento_publico (el cliente, sin cuenta) ============
-- Solo con el token exclusivo del pedido. Devuelve lo que el cliente necesita ver: que pidio, estado, fechas, saldo.
-- NO devuelve cedula, correo, direccion ni medidas de la Rx; del nombre solo el primer nombre.
create or replace function public.seguimiento_publico(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare o public.orders; s public.sales; p public.patients;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into o from public.orders where token = p_token and deleted_at is null;
  if not found then return null; end if;
  select * into p from public.patients where id = o.patient_id;
  select * into s from public.sales where id = o.sale_id;
  return jsonb_build_object(
    'numero', s.numero,
    'nombre_pila', split_part(btrim(p.nombre), ' ', 1),
    'estado', o.estado, 'creado', o.created_at, 'fecha_entrega', o.fecha_entrega, 'entregado_en', o.entregado_en,
    'saldo', s.total - s.pagado,
    'items', coalesce((select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad) order by i.nombre)
                       from public.sale_items i where i.sale_id = s.id), '[]'::jsonb),
    'especificaciones', public.especificaciones_pedido(o.record_id),
    'historial', coalesce((select jsonb_agg(jsonb_build_object('estado', h.estado, 'fecha', h.fecha) order by h.fecha)
                           from public.order_status_history h where h.order_id = o.id), '[]'::jsonb));
end $$;
revoke all on function public.seguimiento_publico(text) from public;
grant execute on function public.seguimiento_publico(text) to anon, authenticated;
