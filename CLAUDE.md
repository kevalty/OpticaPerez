@AGENTS.md

# CLAUDE.md - Sistema de Gestión Óptica Pérez

## Resumen
Sistema de gestión integral para Óptica Pérez (optometría y contactología): fichas médicas, turnos, ventas, seguimiento de pedidos, inventario y fidelización por WhatsApp. Alcance según contrato: 1,500 USD, 12 semanas.

## Stack
- Frontend: Next.js (App Router) + TypeScript + React + Tailwind
- Backend: Next.js Route Handlers + Node.js
- BD: PostgreSQL vía Supabase (Auth con roles, Storage para fotos/documentos)
- Mensajería: WhatsApp Business API (Meta Cloud API / Twilio)
- Despliegue: Vercel + Supabase. Docker para desarrollo local.
- Convenciones como en GestorClub / AroStats: Next.js + Supabase, roles bien separados, multi-tenant si se replica a otras ópticas.
- Gestor de paquetes: npm. Idioma de la UI: español. Marca: azul marino (#262d7a) y azul iris (#2f86d6), ver `app/globals.css`.

## Módulos
1. **Fichas médicas**: paciente, observaciones, Rx anterior, Add, A.V.C.C./A.V.S.C., P.P.C., queratometría, oftalmoscopia, retinoscopia, lectura de computador (todo OD/OI), tabla RX (esfera, cilindro, eje, A.V., ADD, D.P.), color de lente, bifocal, lente de contacto (prueba y A.V.), recomendaciones, optometrista responsable. Historial por paciente ordenado por fecha.
2. **Turnos**: registro en mostrador, paso directo al consultorio, agenda diaria, estados: en espera / en consulta / atendido.
3. **Estado del pedido**: enviado a hacer → procesando → listo para entrega. Cada cambio guarda fecha y usuario y puede disparar WhatsApp.
4. **Recordatorios WhatsApp**: pedido listo, control/adaptación, fidelización (control anual). Panel de plantillas e historial de envíos.
5. **Roles (RBAC en cada endpoint y vista)**: recepcionista (turnos, pacientes, pedidos), doctor/optometrista (fichas y recetas), administrador (todo), rol adicional a definir.
6. **Panel administrativo**: usuarios y roles, configuración, turnos del día, pedidos pendientes, alertas de stock bajo.
7. **Reportes de ventas**: por periodo, producto/tipo de lente, vendedor; exportar CSV o PDF.
8. **Inventario**: productos (monturas, lentes, insumos), stock con alertas, movimientos ligados a ventas y pedidos.

## Flujo de la consulta (definido con el cliente)
1. Recepción registra al paciente (nombre, cédula o pasaporte, celular...) y da turno. Se puede agendar para otro día/mes con fecha y hora (`agendado`); si el paciente está en el local, entra directo `en_espera`.
2. El día del turno, recepción marca "Llegó" (`agendado` → `en_espera`). Recepción NO puede pasar al consultorio.
3. Solo el **doctor** pulsa "En consultorio" (`en_espera` → `en_consulta`): se abre un pop-up con los datos del paciente en una línea, la ficha anterior como franja de una línea (se expande) y la ficha nueva (`app/dashboard/turnos/ficha-form.tsx`): **Consulta rápida** (observaciones, Rx final, certificado y cierre en una pantalla) o **Ficha completa** (6 secciones de a una; menú lateral en pantalla grande, pasos arriba en tablet/celular). Todos los campos siguen en el formulario aunque estén ocultos; borrador automático en `sessionStorage`. Si es primera vez, ficha en blanco.
4. Al guardar la ficha (`guardar_ficha`, todo o nada en la BD) el turno pasa a `atendido` y recepción lo ve resaltado ("Pasar por recepción", la agenda se refresca sola).
5. Recepción imprime el **certificado** (formato de la hoja de Óptica Perez: `components/certificado-doc.tsx`) y pulsa "Finalizar" (`atendido` → `finalizado`). Recibe de la BD solo lo que lleva el certificado (`certificado_recepcion`: AVH, Rx final, DP, CIE, test de colores, necesita lentes, control) + las indicaciones del doctor; nunca la ficha completa. Lo que está vacío no se imprime.
- Estados y quién puede cambiarlos están forzados en la BD (trigger `guard_appointment`), no solo en la UI.
- Nombre y registro M.S.P. del doctor (`users.nombre`, `users.registro_msp`) y la ciudad/locales del encabezado (`lib/negocio.ts`) salen en el certificado.
- Pendiente: importar datos de los equipos de optometría conectados (autorrefractómetro, etc.) cuando el cliente entregue un ejemplo de exportación.

## Modelo de datos
patients, medical_records, rx_prescriptions, contact_lens_trials, appointments, orders, order_status_history, users, whatsapp_reminders, sales, products, inventory_movements.
Todas en PostgreSQL/Supabase con llaves foráneas, `created_at`/`updated_at` y soft delete donde aplique (obligatorio en pacientes y fichas médicas).

## Seguridad (obligatoria desde el primer sprint)
- Supabase Auth con JWT de corta duración; bloqueo progresivo de logins fallidos; cierre de sesión por inactividad en el panel admin.
- **RLS activo en todas las tablas, sin excepciones**, con políticas por rol (un recepcionista no lee el contenido clínico completo; un doctor no modifica reportes de ventas). La UI nunca es la única barrera: validar permisos también en backend.
- Datos clínicos sensibles: HTTPS obligatorio; nunca en logs, errores ni URLs; bitácora de auditoría de quién vio/editó cada ficha.
- Validación de inputs en servidor, consultas parametrizadas (nunca concatenar SQL), sanitizar texto libre (XSS), CORS restrictivo.
- Next.js 16: el archivo de interceptación se llama `proxy.ts` (no `middleware.ts`) y `cookies()` es asíncrono. Leer `node_modules/next/dist/docs/` antes de usar APIs nuevas.
- Zona horaria del negocio: `America/Guayaquil` (variable `APP_TIMEZONE`). "Hoy" se calcula con `lib/time.ts`, nunca con la fecha UTC del servidor.
- Secretos solo en variables de entorno (ver `.env.example`), nunca en el repo.
- Backups diarios confirmados y plan de recuperación documentado.

## Plan de fases
| Semana | Entregable |
|---|---|
| 1 | Proyecto base Next.js + Supabase, modelo de datos, autenticación y roles iniciales. **Estado: completada y verificada en producción (login con rol administrador).** |
| 2 | Pacientes y turnos. **Estado: completada; ajustada en la semana 3 (cédula, turnos con fecha/hora, flujo doctor → recepción).** |
| 3 | Ficha médica digital completa con RLS por rol. **Estado: código listo; falta aplicar `0003` a `0006` (ver `supabase/README.md`).** Incluye la hoja **RX** (así la llama el doctor; formato Essilor para el laboratorio) dentro de la ficha, módulo **Fichas médicas** (`/dashboard/fichas`, solo doctor/administrador), correo del paciente (obligatorio, puede repetirse), cédula sin dígito verificador obligatorio, inicio con iconos estilo app y atajos de teclado (`components/atajos.tsx`, `components/modal-shell.tsx`). |
| 4 | Ventas y órdenes de trabajo. **Estado: código listo; falta aplicar `0008` (ver `supabase/README.md`).** Catálogo de productos con stock (`/dashboard/productos`, solo administrador), venta rápida para recepción en una sola pantalla (`components/pos-venta.tsx`: paciente, productos, descuentos por renglón y global —recepción hasta 20 %, más solo administrador—, cobro completo/abono/sin pago, orden de trabajo), abonos y saldos pendientes, comprobante interno (NO es factura SRI) y orden de trabajo + hoja RX imprimibles, anulación (solo administrador, devuelve stock). El dinero y el stock se calculan en la base (`crear_venta`), nunca en el navegador. Recepción solo ve sus propias ventas (RLS). |
| 5 | Seguimiento de pedidos e historial. **Estado: código listo; falta aplicar `0011` (sola) y `0012`.** Estados: enviado a hacer → recibido en el laboratorio → enviado a Riobamba → listo para recibir → entregado (`lib/pedidos.ts`, `cambiar_estado_pedido` en la BD: un paso a la vez, entregar exige saldo en cero). Pantalla Pedidos (`/dashboard/pedidos`), detalle con historial y fecha de entrega editable por recepción. **Enlace de seguimiento para el cliente sin cuenta** (`/seguimiento/[token]`, token de 64 hex por pedido, `seguimiento_publico`; no muestra cédula, correo ni medidas de la Rx). WhatsApp manual (`wa.me`, `lib/whatsapp.ts`): recibo al cerrar la venta («enviado a hacer») y aviso «listo para recibir». Variable `NEXT_PUBLIC_SITE_URL`. |
| 6 | Recordatorios por WhatsApp. **Estado: código listo; falta aplicar `0013` (ver `supabase/README.md`) y que Meta apruebe las plantillas.** Envío automático por Meta Cloud API (`lib/whatsapp-api.ts`, `lib/whatsapp-envios.ts`): recibo al cerrar la venta y aviso «listo para recibir»; módulo WhatsApp (`/dashboard/whatsapp`: pendientes de turno/saldo/control de adaptación/control anual, historial, plantillas, prueba). Consentimiento por paciente (`acepta_whatsapp`). Si no hay claves o la plantilla no está activa, queda el modo manual `wa.me`. Variables `WHATSAPP_*` en Vercel (el token de prueba vence cada 24 h). |
| 7 | Inventario. **Estado: código listo; falta aplicar `0015` y `0016` (ver `supabase/README.md`).** Módulo Inventario (`/dashboard/inventario`, recepción y administrador): stock con alertas (agotado / stock bajo), filtros por tipo y búsqueda, e historial de movimientos (`/dashboard/inventario/movimientos`, función `inventario_movimientos`, enlaza a la venta). Los ajustes manuales (solo administrador, en Productos) exigen un motivo que queda en el historial (`ajustar_stock` con nota). Las ventas y anulaciones ya mueven el stock desde la semana 4. **Fotos desde el celular:** cada producto lleva foto (bucket privado `productos`; `components/foto-campo.tsx` abre la cámara y reduce la imagen en el navegador; el servidor valida el contenido y la sube; se ve por `/dashboard/fotos/[tipo]/[id]`, nunca pública, el navegador no habla con Storage). Al vender, un trigger copia la foto al renglón (`sale_items.foto_path`) como evidencia de lo entregado; esa copia no se borra aunque se cambie la foto del producto. Solo el administrador sube fotos. |
| 8 | Panel administrativo. **Estado: código listo; falta aplicar `0017` (ver `supabase/README.md`).** `/dashboard/admin` (solo administrador): resumen del día (turnos por estado, pedidos pendientes y atrasados, ventas de hoy y saldos pendientes, alertas de stock, WhatsApp: envíos fallidos y plantillas inactivas) y lista de usuarios con edición del nombre. Los usuarios se crean, activan y cambian de rol **solo desde Supabase**; la migración `0017` además quita a nivel de columna el permiso de cambiar rol/activo desde la app. Sin rol adicional (decisión del cliente). Registro M.S.P. en pantalla: pendiente para otro día. |
| 9 | Reportes y exportación |
| 10 | Auditoría, endurecimiento de seguridad y revisión de permisos |
| 11 | Pruebas integrales con la óptica |
| 12 | Ajustes finales, capacitación y entrega |

Mantener esta tabla actualizada conforme avance el desarrollo.

## ECC (everything-claude-code) — instalación mínima
De `affaan-m/ecc` v2.2.3 (MIT, ver `.claude/ECC-LICENSE`) solo se copió lo útil, sin hooks y sin MCP, para gastar pocos tokens:
- Skills (`.claude/skills/`): `tdd-workflow`, `verification-loop`, `postgres-patterns`, `token-budget-advisor`, `strategic-compact`, `context-budget`.
- Reglas (`.claude/rules/ecc-*.md`): seguridad común, seguridad TypeScript y pruebas.
No instalar además el plugin completo (`ecc@ecc`): duplicaría skills. La revisión de seguridad la hace Claude directamente, sin ECC.
