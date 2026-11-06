-- Optica Perez - ajustes tras la QA completa:
--   1) Busqueda de pacientes que ignora tildes y mayusculas ("jose" encuentra "Jose" y "José").
--   2) Cambio de turno: la recepcionista puede ver y cobrar el saldo de una venta con saldo pendiente hecha por otra
--      recepcionista (solo ventas activas con saldo; las demas siguen siendo solo del vendedor).
--   3) Proteccion contra pagos repetidos: el mismo monto y metodo en la misma venta en menos de 10 segundos se rechaza.
-- Se puede ejecutar varias veces.

-- ============ 1) Busqueda sin tildes ============
create or replace function public.sin_tildes(t text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select translate(lower(coalesce(t, '')), 'áéíóúüñàèìòù', 'aeiouunaeiou')
$$;

-- security invoker: la RLS de patients decide que filas ve cada rol.
create or replace function public.buscar_pacientes(p_q text, p_limite integer default 50)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with b as (
    select '%' || replace(replace(replace(public.sin_tildes(btrim(coalesce(p_q, ''))), '\', '\\'), '%', '\%'), '_', '\_') || '%' as q
  )
  select coalesce(jsonb_agg(to_jsonb(x) order by x.nombre), '[]'::jsonb) from (
    select p.id, p.nombre, p.documento, p.telefono, p.edad
      from public.patients p, b
     where p.deleted_at is null
       and (public.sin_tildes(p.nombre) like b.q or public.sin_tildes(coalesce(p.documento, '')) like b.q or public.sin_tildes(coalesce(p.telefono, '')) like b.q)
     order by p.nombre
     limit least(greatest(coalesce(p_limite, 50), 1), 200)
  ) x
$$;
revoke all on function public.buscar_pacientes(text, integer) from public, anon;
grant execute on function public.buscar_pacientes(text, integer) to authenticated;

-- ============ 2) Cambio de turno: saldos de otras recepcionistas ============
drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales for select to authenticated
  using (deleted_at is null and (public.has_role('administrador')
         or (public.has_role('recepcionista', 'otro')
             and (vendedor_id = (select auth.uid()) or (estado = 'activa' and total - pagado > 0)))));

-- ============ 3) Pagos repetidos ============
create or replace function public.registrar_abono(p_venta uuid, p_monto numeric, p_metodo text, p_nota text default null)
returns numeric language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); s public.sales; v_monto numeric := round(p_monto, 2);
begin
  if not public.has_role('recepcionista', 'administrador', 'otro') then
    raise exception 'No tienes permiso para registrar pagos' using errcode = '42501';
  end if;
  select * into s from public.sales where id = p_venta and deleted_at is null for update;
  -- Una recepcionista solo toca sus ventas o las que aun tienen saldo (cambio de turno).
  if not found or (not public.has_role('administrador') and s.vendedor_id <> uid and s.total - s.pagado <= 0) then
    raise exception 'Venta no encontrada' using errcode = 'P0002';
  end if;
  if s.estado = 'anulada' then
    raise exception 'La venta esta anulada' using errcode = 'P0001';
  end if;
  if v_monto is null or v_monto <= 0 then
    raise exception 'Escribe un monto mayor a cero' using errcode = 'P0001';
  end if;
  if v_monto > s.total - s.pagado then
    raise exception 'El abono supera el saldo pendiente (%)', to_char(s.total - s.pagado, 'FM999990.00') using errcode = 'P0001';
  end if;
  if p_metodo not in ('efectivo', 'tarjeta', 'transferencia', 'otro') then
    raise exception 'Elige un metodo de pago' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.sale_payments pg
              where pg.sale_id = p_venta and pg.monto = v_monto and pg.metodo = p_metodo and pg.user_id = uid
                and pg.fecha > now() - interval '10 seconds') then
    raise exception 'Ese pago ya se registró hace un momento. Revisa la lista de pagos.' using errcode = 'P0001';
  end if;
  insert into public.sale_payments (sale_id, monto, metodo, nota, user_id)
  values (p_venta, v_monto, p_metodo, left(nullif(btrim(p_nota), ''), 200), uid);
  update public.sales set pagado = pagado + v_monto where id = p_venta;
  return s.total - s.pagado - v_monto;
end $$;
revoke all on function public.registrar_abono(uuid, numeric, text, text) from public, anon;
grant execute on function public.registrar_abono(uuid, numeric, text, text) to authenticated;
