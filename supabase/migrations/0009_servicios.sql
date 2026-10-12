-- Optica Perez - Semana 4: tipo de producto "servicio" (consulta, ajuste, reparacion...). Sin stock.
-- Aplicar DESPUES de 0008. EJECUTAR SOLA (un valor nuevo de enum no se puede usar en la misma transaccion).
alter type public.product_type add value if not exists 'servicio';
