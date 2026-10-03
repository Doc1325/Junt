-- Precio real para padonde: Gratis o RD$X,XXX (antes solo price_tag)
alter table public.events add column if not exists price text;
-- Migrar price_tag Gratis -> price Gratis, y dejar De pago como null hasta re-scrape
update public.events set price = 'Gratis' where price_tag = 'Gratis' and price is null;
-- Corregir caso J-ROD y similares que se guardaron como Gratis por bug de badge global
update public.events set price_tag = 'De pago', price = 'RD$2,000' where slug = 'j-rod-sullivan-the-green-room-the-green-room-diciembre-2026' and price_tag = 'Gratis';
-- Índice para filtro por precio
create index if not exists events_price_idx on public.events (price_tag);
create index if not exists events_price_text_idx on public.events (price);
