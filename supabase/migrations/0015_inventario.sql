-- Optica Perez - Semana 7: inventario (consulta para recepcion, historial de movimientos y motivo en los ajustes).
--   - inventory_movements.nota          : motivo de un ajuste manual (compra, merma, conteo...)
--   - ajustar_stock(producto, delta, nota): solo administrador; la nota queda en el historial
--   - inventario_movimientos(producto, limite): historial con nombres (la recepcionista no puede leer la tabla users)
-- Se puede ejecutar varias veces.

alter table public.inventory_movements add column if not exists nota text check (char_length(nota) <= 200);

drop function if exists public.ajustar_stock(uuid, integer);
create or replace function public.ajustar_stock(p_producto uuid, p_delta integer, p_nota text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); pr public.products; nota text := nullif(left(btrim(coalesce(p_nota, '')), 200), '');
begin
  if not public.has_role('administrador') then
    raise exception 'Solo un administrador puede ajustar el stock' using errcode = '42501';
  end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 100000 then
    raise exception 'Cantidad no valida' using errcode = 'P0001';
  end if;
  select * into pr from public.products where id = p_producto and deleted_at is null for update;
  if not found then raise exception 'Producto no encontrado' using errcode = 'P0002'; end if;
  if not pr.controla_stock then raise exception 'Este producto se hace a pedido y no maneja stock' using errcode = 'P0001'; end if;
  if pr.stock + p_delta < 0 then
    raise exception 'No hay stock suficiente para descontar (hay %)', pr.stock using errcode = 'P0001';
  end if;
  update public.products set stock = stock + p_delta where id = p_producto;
  insert into public.inventory_movements (product_id, tipo, cantidad, user_id, nota)
  values (p_producto, case when p_delta > 0 then 'entrada' else 'salida' end::public.movement_type, abs(p_delta), uid, nota);
  return pr.stock + p_delta;
end $$;
revoke all on function public.ajustar_stock(uuid, integer, text) from public, anon;
grant execute on function public.ajustar_stock(uuid, integer, text) to authenticated;

create or replace function public.inventario_movimientos(p_producto uuid default null, p_limite integer default 100)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when not public.has_role('recepcionista', 'administrador', 'otro') then '[]'::jsonb else
    coalesce((select jsonb_agg(to_jsonb(x) order by x.fecha desc) from (
      select m.id, m.fecha, m.tipo::text as tipo, m.cantidad, m.nota, m.product_id,
             pr.nombre as producto, u.nombre as usuario, m.venta_id, s.numero as venta_numero
        from public.inventory_movements m
        join public.products pr on pr.id = m.product_id
        left join public.users u on u.id = m.user_id
        left join public.sales s on s.id = m.venta_id
       where p_producto is null or m.product_id = p_producto
       order by m.fecha desc
       limit least(greatest(coalesce(p_limite, 100), 1), 300)
    ) x), '[]'::jsonb) end;
$$;
revoke all on function public.inventario_movimientos(uuid, integer) from public, anon;
grant execute on function public.inventario_movimientos(uuid, integer) to authenticated;
