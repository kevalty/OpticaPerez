-- Optica Perez - Maqueta de la peticion del cliente (nov. 2026): nuevo tipo de producto "gafa".
-- IMPORTANTE: ejecutar SOLA (un valor nuevo de enum no se puede usar en la misma transaccion), antes de la 0020.
alter type public.product_type add value if not exists 'gafa' after 'montura';
