-- Semana 6 (ajuste): descripciones de las plantillas con tildes. Se puede ejecutar varias veces.
update public.whatsapp_plantillas set descripcion = 'Recibo al cerrar la venta: pedido enviado a hacer (con el enlace de seguimiento).' where tipo = 'pedido_recibo';
update public.whatsapp_plantillas set descripcion = 'Aviso cuando el pedido está listo para recibir en Riobamba.' where tipo = 'pedido_listo';
update public.whatsapp_plantillas set descripcion = 'Recordatorio de la cita agendada para mañana.' where tipo = 'turno';
update public.whatsapp_plantillas set descripcion = 'Recordatorio de saldo pendiente (ventas con más de 7 días).' where tipo = 'saldo';
update public.whatsapp_plantillas set descripcion = 'Control de adaptación: 15 a 45 días después de entregar el pedido.' where tipo = 'control_adaptacion';
update public.whatsapp_plantillas set descripcion = 'Fidelización: control visual anual (según los meses de control de la última ficha).' where tipo = 'control_anual';
