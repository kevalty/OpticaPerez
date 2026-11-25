-- Optica Perez: calcula la edad de los pacientes que tienen fecha de nacimiento pero no edad (cargados antes de que la edad se calculara sola).
-- Se puede ejecutar varias veces; no toca a quien ya tiene edad.
update public.patients
   set edad = least(130, greatest(0, date_part('year', age((now() at time zone 'America/Guayaquil')::date, fecha_nacimiento))::int))
 where edad is null and fecha_nacimiento is not null and deleted_at is null;
