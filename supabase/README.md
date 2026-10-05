# Base de datos (Supabase)

## Aplicar el esquema (una sola vez)
1. Supabase -> **SQL Editor** -> *New query*.
2. Pega todo `migrations/0001_schema.sql` y pulsa **Run**.
3. Debe terminar sin errores. Crea tablas, roles, politicas RLS y auditoria.

## Crear el primer administrador
1. Supabase -> **Authentication -> Users -> Add user** (correo + contrasena, marca *Auto Confirm*).
2. En el SQL Editor ejecuta (cambia el correo):
   ```sql
   update public.users set rol = 'administrador', activo = true, nombre = 'Tu nombre'
   where email = 'tu-correo@ejemplo.com';
   ```
3. Entra en `/login` con ese usuario.

Todo usuario nuevo nace **inactivo** y con rol `otro`: un administrador debe activarlo y asignarle rol.

## Recomendado en Supabase (Authentication -> Sign In / Providers)
- Desactiva **Allow new users to sign up** (los usuarios los crea el administrador).
- Activa contrasenas robustas y revisa los limites de intentos (rate limits).

## Reglas
- RLS activo en todas las tablas; sin politica = sin acceso.
- Nunca borrar pacientes ni fichas: usar `deleted_at` (soft delete).
- `audit_log`, `order_status_history` e `inventory_movements` son solo-anadir.
