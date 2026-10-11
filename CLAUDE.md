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
3. Solo el **doctor** pulsa "En consultorio" (`en_espera` → `en_consulta`): se abre un pop-up con los datos del paciente, la ficha anterior (si existe) y la ficha nueva a llenar. Si es primera vez, ficha en blanco.
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
| 3 | Ficha médica digital completa con RLS por rol. **Estado: código listo; falta aplicar `0003` a `0006` (ver `supabase/README.md`).** Incluye recetario de lentes (formato Essilor) dentro de la ficha, correo del paciente (obligatorio, puede repetirse), cédula sin dígito verificador obligatorio, inicio con iconos estilo app y atajos de teclado (`components/atajos.tsx`, `components/modal-shell.tsx`). |
| 4 | Ventas y órdenes de trabajo |
| 5 | Seguimiento de pedidos e historial |
| 6 | Recordatorios por WhatsApp |
| 7 | Inventario |
| 8 | Panel administrativo y rol adicional |
| 9 | Reportes y exportación |
| 10 | Auditoría, endurecimiento de seguridad y revisión de permisos |
| 11 | Pruebas integrales con la óptica |
| 12 | Ajustes finales, capacitación y entrega |

Mantener esta tabla actualizada conforme avance el desarrollo.
