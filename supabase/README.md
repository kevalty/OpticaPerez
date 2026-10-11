# Base de datos (Supabase)

## Aplicar el esquema (una sola vez)
1. Supabase -> **SQL Editor** -> *New query*.
2. Pega todo `migrations/0001_schema.sql` y pulsa **Run**.
3. Debe terminar sin errores. Crea tablas, roles, politicas RLS y auditoria.

## Migraciones posteriores
Aplica en orden, una vez cada una, en el SQL Editor:
- `0001_schema.sql` (Semana 1)
- `0002_semana2.sql` (Semana 2: directorio de optometristas y candado de archivado)
- `0003_estados.sql` (Semana 3: nuevos estados de turno; **ejecutar solo, antes de la 0004**)
- `0004_ficha_turnos.sql` (Semana 3: documento del paciente, reglas del flujo de turnos, ficha medica, receta para recepcion, cancelar turno)

- `0005_certificado.sql` (certificado: campos nuevos de la ficha y registro M.S.P. del doctor; reemplaza `receta_recepcion` por `certificado_recepcion`)
- `0006_correo_recetario.sql` (correo del paciente, recetario de lentes dentro de la ficha; actualiza `guardar_ficha` y `certificado_recepcion`). **Aplicarla ANTES de publicar la version nueva de la app.**

## Datos del doctor que salen en el certificado
El nombre y el registro del Ministerio de Salud Publica se imprimen bajo la firma. Hasta que exista la
pantalla de usuarios (semana 8), se cargan asi (cambia el correo, el nombre y el registro):
```sql
update public.users
set nombre = 'Juan Carlos Pérez O.', registro_msp = '039'
where email = 'correo-del-doctor@ejemplo.com';
```

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
