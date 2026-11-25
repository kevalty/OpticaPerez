# Seguridad, permisos y recuperación — Óptica Pérez

Documento de la Semana 10. Resume qué protege el sistema, quién puede hacer qué, cómo se audita y cómo se recupera la información.

## 1. Qué protege el sistema

| Capa | Qué hace |
|---|---|
| Acceso | Supabase Auth; sesión en cookie `HttpOnly` (el JavaScript de la página no la lee); cierre por inactividad a los 20 min; bloqueo progresivo de intentos fallidos (5 fallos: 1 min, el doble por cada fallo extra, máximo 30 min). |
| Base de datos | **RLS activo en todas las tablas**; los permisos se deciden en la base, no solo en la pantalla. Funciones con permisos especiales con `search_path` fijo. Reglas de negocio forzadas en la base (estados del turno y del pedido, descuentos, stock, pagos). |
| Datos clínicos | La recepcionista nunca lee la ficha: recibe de la base solo lo que lleva el certificado y la hoja RX. Nada clínico va en URLs, logs ni mensajes de error. |
| Archivos | Buckets privados (`productos`, `recetas`, `entregas`); el navegador nunca habla con Storage; las fotos se sirven por rutas con sesión o por el enlace exclusivo del pedido. |
| Cliente sin cuenta | Solo ve su pedido con un token de 64 caracteres; no se muestran cédula, correo ni medidas; la página no se indexa. |
| Web | HTTPS obligatorio (HSTS), CSP restrictiva, sin iframes, `nosniff`, referrer controlado. |
| Secretos | Solo en variables de entorno de Vercel (tipo *Sensitive*); nunca en el repositorio. |
| Bitácora | Quién vio, creó o editó fichas, pacientes, ventas, pagos, pedidos, productos, usuarios, fotos y confirmaciones de entrega. Solo se agrega; nadie la edita ni la borra desde la aplicación. Se consulta en **Auditoría** (solo administrador). |

## 2. Matriz de permisos

| Módulo / dato | Recepcionista | Doctor | Administrador |
|---|---|---|---|
| Pacientes | ver, crear, editar | ver, crear, editar | todo (archivar) |
| Turnos | dar turno, «Llegó», finalizar | «En consultorio», guardar ficha | todo |
| Fichas médicas (contenido clínico) | **no** | sí | sí |
| Certificado / hoja RX (solo lo que lleva la hoja) | sí | sí | sí |
| Ventas | crear (descuento hasta 20 %), cobrar; ve las suyas y las que aún tienen saldo | **no** | todo (anular, descuentos mayores) |
| Productos y precios | solo lectura en venta | **no** | crear, editar, fotos |
| Inventario | solo lectura | **no** | ver y ajustar (con motivo) |
| Pedidos | cambiar estado, fecha de entrega, fotos de entrega | ver (sin dinero) | todo (corregir un paso atrás) |
| WhatsApp | enviar, ver historial | **no** | además plantillas |
| Reportes | **no** | **no** | sí (CSV y PDF) |
| Auditoría y revisión de seguridad | **no** | **no** | sí |
| Usuarios | **no** | **no** | solo corregir nombres; crear, activar y cambiar rol **solo desde Supabase** |

La prueba `supabase/tests/permisos.sql` verifica esta matriz con usuarios reales (no modifica datos). La **Revisión de seguridad** de la pantalla Auditoría comprueba el estado de la base en tiempo real.

## 3. Decisiones y riesgos aceptados

- **Bloqueo de inicio de sesión:** la función `login_fallo` es pública (se usa antes de tener sesión). Un atacante podría bloquear a un usuario hasta 30 minutos enviando intentos fallidos con su correo. Se acepta a cambio de frenar la adivinanza de contraseñas; si ocurre, el administrador puede limpiar la tabla `login_attempts` desde Supabase.
- **Enlace del pedido:** quien tenga el enlace puede ver el estado, las fotos de la entrega y confirmar la entrega. No debe compartirse en público.
- **Confirmación de entrega:** el nombre que escribe el cliente no se verifica; queda con fecha, hora y vía (celular o iPad). Si se necesita más peso legal, agregar firma manuscrita o cédula.
- **Cuentas con acceso a Supabase:** quien entra al panel de Supabase puede leer y modificar todo (incluida la bitácora). Activar **verificación en dos pasos** en todas las cuentas con acceso y no compartir la contraseña.
- **Token de WhatsApp:** el temporal vence cada 24 h. Para producción usar un token permanente de usuario del sistema y rotarlo si alguien con acceso deja de trabajar en el proyecto.

## 4. Respaldos y plan de recuperación

**Respaldo.** Contratar Supabase **Pro** (25 USD/mes): respaldos diarios automáticos con retención de 7 días. Los archivos (fotos) están en Storage y **no** van incluidos en el respaldo de la base: una vez al mes exportar el contenido de los buckets `productos`, `recetas` y `entregas` (Supabase → Storage → descargar) y guardarlo fuera de Supabase.

**Verificación mensual (10 minutos).**
1. Supabase → Database → Backups: ver que hay un respaldo de cada uno de los últimos 7 días.
2. Ejecutar `supabase/tests/permisos.sql` y revisar la pantalla **Auditoría → Revisión de seguridad**: todo en verde.
3. Guardar una copia de las migraciones (`supabase/migrations`, están en GitHub).

**Si se pierden o dañan datos.**
1. No seguir usando el sistema; avisar a todos.
2. Supabase → Database → Backups → elegir el respaldo más reciente anterior al problema → *Restore* (el sistema vuelve al estado de ese día; se pierde lo posterior).
3. Si el proyecto de Supabase se perdió por completo: crear un proyecto nuevo, ejecutar en orden las migraciones de `supabase/migrations` (la `0003`, `0009`, `0011` y `0019` solas), restaurar el respaldo, crear de nuevo los buckets (lo hacen las migraciones) y subir las fotos exportadas.
4. Actualizar en Vercel las variables `NEXT_PUBLIC_SUPABASE_URL`, la llave pública y las de WhatsApp, y hacer *Redeploy*.
5. Probar: iniciar sesión con cada rol, abrir una venta, un pedido y una foto.

**Qué se pierde en el peor caso.** Con el respaldo diario, como máximo las últimas 24 horas. El historial de la bitácora vuelve al estado del respaldo.

**Si se filtra una clave.** Cambiarla de inmediato en su servicio (Supabase, Meta, Vercel), actualizarla en Vercel, hacer *Redeploy* y revisar la bitácora y el historial de WhatsApp de esos días.

## 5. Lista antes de entregar al cliente

- [ ] Supabase Pro contratado y primer respaldo visible.
- [ ] Verificación en dos pasos en Supabase, Vercel, GitHub y Meta.
- [ ] Token permanente de WhatsApp y número propio de la óptica (no el de prueba).
- [ ] `NEXT_PUBLIC_SITE_URL` con la dirección real; dominio propio con HTTPS.
- [ ] Usuarios reales creados en Supabase con nombre completo y rol correcto; usuarios de prueba desactivados.
- [ ] Datos «PRUEBA QA» archivados o eliminados.
- [ ] `supabase/tests/permisos.sql` y la Revisión de seguridad en verde.
- [ ] Texto real de la garantía y descuentos definidos por el cliente (`lib/negocio.ts`).
