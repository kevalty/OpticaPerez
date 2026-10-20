-- Optica Perez - Semana 5: nuevos estados del pedido. EJECUTAR SOLA (un valor nuevo de enum no se puede usar en la misma transaccion).
-- Flujo: enviado_a_hacer -> recibido_en_laboratorio -> enviado_a_riobamba -> listo_para_recibir -> entregado
alter type public.order_status add value if not exists 'recibido_en_laboratorio';
alter type public.order_status add value if not exists 'enviado_a_riobamba';
alter type public.order_status add value if not exists 'listo_para_recibir';
alter type public.order_status add value if not exists 'entregado';
