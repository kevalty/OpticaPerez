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

## Modelo de datos
patients, medical_records, rx_prescriptions, contact_lens_trials, appointments, orders, order_status_history, users, whatsapp_reminders, sales, products, inventory_movements.
Todas en PostgreSQL/Supabase con llaves foráneas, `created_at`/`updated_at` y soft delete donde aplique (obligatorio en pacientes y fichas médicas).

## Seguridad (obligatoria desde el primer sprint)
- Supabase Auth con JWT de corta duración; bloqueo progresivo de logins fallidos; cierre de sesión por inactividad en el panel admin.
- **RLS activo en todas las tablas, sin excepciones**, con políticas por rol (un recepcionista no lee el contenido clínico completo; un doctor no modifica reportes de ventas). La UI nunca es la única barrera: validar permisos también en backend.
- Datos clínicos sensibles: HTTPS obligatorio; nunca en logs, errores ni URLs; bitácora de auditoría de quién vio/editó cada ficha.
- Validación de inputs en servidor, consultas parametrizadas (nunca concatenar SQL), sanitizar texto libre (XSS), CORS restrictivo.
- Next.js 16: el archivo de interceptación se llama `proxy.ts` (no `middleware.ts`) y `cookies()` es asíncrono. Leer `node_modules/next/dist/docs/` antes de usar APIs nuevas.
- Secretos solo en variables de entorno (ver `.env.example`), nunca en el repo.
- Backups diarios confirmados y plan de recuperación documentado.

## Plan de fases
| Semana | Entregable |
|---|---|
| 1 | Proyecto base Next.js + Supabase, modelo de datos, autenticación y roles iniciales. **Estado: código listo; falta aplicar `supabase/migrations/0001_schema.sql` y configurar variables en Vercel.** |
| 2 | Pacientes y turnos |
| 3 | Ficha médica digital completa con RLS por rol |
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
