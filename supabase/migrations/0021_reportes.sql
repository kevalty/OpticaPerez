-- Optica Perez - Semana 9: reportes de ventas (solo administrador). Se puede ejecutar varias veces.
-- reporte_ventas(desde, hasta): todo calculado en la base, con el dia local del negocio (America/Guayaquil).
--   - Solo ventas ACTIVAS (las anuladas no cuentan). Maximo 366 dias.
--   - por_producto / por_tipo: el descuento global de la venta se reparte proporcionalmente entre sus renglones,
--     asi la suma de los productos coincide con lo vendido.
--   - "cobrado" = pagos recibidos dentro del periodo (aunque la venta sea de antes); "saldo" = lo que aun deben las ventas del periodo.
create or replace function public.reporte_ventas(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  if not public.has_role('administrador') then
    raise exception 'Solo un administrador puede ver los reportes' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'El rango de fechas no es valido' using errcode = 'P0001';
  end if;
  if p_hasta - p_desde > 366 then
    raise exception 'El periodo no puede pasar de un año' using errcode = 'P0001';
  end if;

  with v as (
    select s.id, s.numero, s.fecha, (s.fecha at time zone 'America/Guayaquil')::date as dia,
           s.total, s.subtotal, s.descuento, s.pagado, s.vendedor_id,
           (select coalesce(sum(i.cantidad * i.precio_unitario), 0) from public.sale_items i where i.sale_id = s.id) as bruto
      from public.sales s
     where s.deleted_at is null and s.estado = 'activa'
       and (s.fecha at time zone 'America/Guayaquil')::date between p_desde and p_hasta
  ),
  items as (
    select i.product_id, coalesce(nullif(i.nombre, ''), pr.nombre, 'Producto') as nombre, pr.tipo::text as tipo, i.cantidad,
           round((i.cantidad * i.precio_unitario - i.descuento) * case when v.subtotal > 0 then v.total / v.subtotal else 0 end, 2) as neto
      from public.sale_items i
      join v on v.id = i.sale_id
      left join public.products pr on pr.id = i.product_id
  ),
  pagos as (
    select p.metodo, p.monto
      from public.sale_payments p join public.sales s on s.id = p.sale_id
     where s.deleted_at is null and s.estado = 'activa'
       and (p.fecha at time zone 'America/Guayaquil')::date between p_desde and p_hasta
  )
  select jsonb_build_object(
    'desde', p_desde, 'hasta', p_hasta,
    'resumen', jsonb_build_object(
      'ventas', (select count(*) from v),
      'vendido', coalesce((select sum(total) from v), 0),
      'descuentos', coalesce((select sum(bruto - total) from v), 0),
      'cobrado', coalesce((select sum(monto) from pagos), 0),
      'saldo', coalesce((select sum(total - pagado) from v), 0),
      'anuladas', (select count(*) from public.sales s where s.deleted_at is null and s.estado = 'anulada'
                    and (s.fecha at time zone 'America/Guayaquil')::date between p_desde and p_hasta)),
    'por_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', d.dia, 'ventas', d.n, 'vendido', d.t) order by d.dia)
                          from (select dia, count(*) as n, sum(total) as t from v group by dia) d), '[]'::jsonb),
    'por_producto', coalesce((select jsonb_agg(jsonb_build_object('nombre', x.nombre, 'tipo', x.tipo, 'cantidad', x.c, 'total', x.t) order by x.t desc, x.nombre)
                               from (select nombre, tipo, sum(cantidad) as c, sum(neto) as t from items group by nombre, tipo) x), '[]'::jsonb),
    'por_tipo', coalesce((select jsonb_agg(jsonb_build_object('tipo', x.tipo, 'cantidad', x.c, 'total', x.t) order by x.t desc)
                           from (select coalesce(tipo, 'otro') as tipo, sum(cantidad) as c, sum(neto) as t from items group by 1) x), '[]'::jsonb),
    'por_vendedor', coalesce((select jsonb_agg(jsonb_build_object('vendedor', x.nombre, 'ventas', x.n, 'vendido', x.t, 'saldo', x.sd) order by x.t desc)
                               from (select coalesce(nullif(u.nombre, ''), u.email, 'Sin nombre') as nombre, count(*) as n, sum(v.total) as t, sum(v.total - v.pagado) as sd
                                       from v left join public.users u on u.id = v.vendedor_id group by 1) x), '[]'::jsonb),
    'por_metodo', coalesce((select jsonb_agg(jsonb_build_object('metodo', x.metodo, 'pagos', x.n, 'total', x.t) order by x.t desc)
                             from (select metodo, count(*) as n, sum(monto) as t from pagos group by metodo) x), '[]'::jsonb),
    'ventas', coalesce((select jsonb_agg(jsonb_build_object('numero', q.numero, 'fecha', q.dia, 'vendedor', q.nombre, 'total', q.total, 'descuento', q.dto, 'pagado', q.pagado, 'saldo', q.saldo) order by q.numero)
                         from (select v.numero, v.dia, coalesce(nullif(u.nombre, ''), u.email, 'Sin nombre') as nombre, v.total,
                                      (v.bruto - v.total) as dto, v.pagado, v.total - v.pagado as saldo
                                 from v left join public.users u on u.id = v.vendedor_id order by v.numero limit 5000) q), '[]'::jsonb)
  ) into res;
  return res;
end $$;
revoke all on function public.reporte_ventas(date, date) from public, anon;
grant execute on function public.reporte_ventas(date, date) to authenticated;
