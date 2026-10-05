-- Optica Perez - Semana 3 (parte 1): nuevos estados de turno.
-- Se ejecuta APARTE y primero: Postgres no permite usar un valor nuevo de un enum
-- en la misma transaccion en que se crea.
alter type public.appointment_status add value if not exists 'agendado' before 'en_espera';
alter type public.appointment_status add value if not exists 'finalizado';
