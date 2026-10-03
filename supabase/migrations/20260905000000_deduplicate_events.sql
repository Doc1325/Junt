-- Eliminar duplicados exactos por título+provincia+fecha, quedándonos con el más antiguo
delete from public.events
where id not in (
  select distinct on (title, province, start_date) id
  from public.events
  order by title, province, start_date, created_at asc
);
-- Asegurar índice único parcial para evitar futuros duplicados exactos (opcional, no bloquea slugs distintos pero mismo título+fecha)
create unique index if not exists events_title_province_date_unique on public.events (title, province, start_date);
