-- Optica Perez - Semana 8: panel administrativo.
-- Los usuarios se crean y se activan SOLO desde Supabase (decision de seguridad). Desde la app, el administrador
-- solo puede cambiar el nombre (y el registro M.S.P., cuando se habilite en pantalla). La politica RLS de 'users' permitia
-- editar cualquier columna; aqui se limita a nivel de columna para que ni una llamada directa pueda cambiar rol o activo.
-- Se puede ejecutar varias veces.
revoke update on public.users from authenticated;
grant update (nombre, registro_msp) on public.users to authenticated;
