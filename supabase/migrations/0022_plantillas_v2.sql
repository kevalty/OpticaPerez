-- Optica Perez - Plantillas de WhatsApp aprobadas por Meta (nov. 2026).
-- Las 6 plantillas existentes pasan a su version "_v2" (textos mas calidos) y las 3 nuevas (entrega, cumpleanos, renovacion)
-- se activan. Ejecutar SOLO cuando Meta ya aprobo las 9 (si alguna no esta aprobada, su envio falla con un aviso claro).
-- Se puede ejecutar varias veces. Los nombres tambien se pueden cambiar a mano en WhatsApp > Plantillas.
update public.whatsapp_plantillas set nombre = 'pedido_enviado_a_hacer_v2', activa = true,
  texto_sugerido = 'Hola {{1}} 👋, gracias por confiar en Óptica Pérez. Recibimos tu pedido N.º {{2}} y ya lo estamos preparando con mucho cuidado. Puedes seguir cada paso desde aquí.  [Botón «Ver mi pedido», URL dinámica: https://optica-perez.vercel.app/seguimiento/{{1}}]'
 where tipo = 'pedido_recibo';
update public.whatsapp_plantillas set nombre = 'pedido_listo_para_recibir_v2', activa = true,
  texto_sugerido = 'Hola {{1}} 😊, ¡buenas noticias! Tu pedido N.º {{2}} ya está listo y te espera en nuestro local de Riobamba. Saldo pendiente: {{3}}. Pasa cuando gustes para entregártelo y dejarlo perfecto para ti.  [Botón «Ver mi pedido», URL dinámica: https://optica-perez.vercel.app/seguimiento/{{1}}]'
 where tipo = 'pedido_listo';
update public.whatsapp_plantillas set nombre = 'recordatorio_turno_v2', activa = true,
  texto_sugerido = 'Hola {{1}}, te esperamos en Óptica Pérez el {{2}} a las {{3}} para cuidar tu salud visual. Si necesitas cambiar tu cita, respóndenos y con gusto la reprogramamos.'
 where tipo = 'turno';
update public.whatsapp_plantillas set nombre = 'recordatorio_saldo_v2', activa = true,
  texto_sugerido = 'Hola {{1}}, tu pedido N.º {{2}} está casi completo: solo queda un saldo de {{3}}. Pasa por nuestro local de Riobamba cuando puedas y déjalo listo para estrenarlo cuanto antes. ¡Te esperamos!'
 where tipo = 'saldo';
update public.whatsapp_plantillas set nombre = 'recordatorio_control_adaptacion_v2', activa = true,
  texto_sugerido = 'Hola {{1}}, ¿cómo te estás sintiendo con tus lentes nuevos? Queremos que veas perfecto: si notas alguna molestia, pasa por Óptica Pérez y los ajustamos sin costo.'
 where tipo = 'control_adaptacion';
update public.whatsapp_plantillas set nombre = 'recordatorio_control_anual_v2', activa = true,
  texto_sugerido = 'Hola {{1}} 👓, tu última consulta fue el {{2}} y tus ojos merecen su control anual. Agenda tu cita en Óptica Pérez cuando quieras; estaremos felices de atenderte.'
 where tipo = 'control_anual';
update public.whatsapp_plantillas set activa = true where tipo in ('entrega', 'cumpleanos', 'renovacion');
