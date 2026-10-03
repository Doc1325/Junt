-- Limpiar categorías inválidas capturadas como badge de fecha (¡Hoy!, ¡Mañana!, En 5 días, En 7 días) -> mover a Otros
update public.events set category = 'Otros' where category in ('¡Hoy!', '¡Mañana!', 'En 5 días', 'En 7 días');
-- Normalizar Familia (no existe en padonde) -> Otros
update public.events set category = 'Otros' where category = 'Familia';
