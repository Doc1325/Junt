-- Don Miguelo FestivalPlayero muestra badge "Hasta RD$3,000" pero se guardó como Gratis
-- (LD offers.price = 0 tratado como definitivo + fila existente nunca actualizada por dedup-skip).
update public.events
set price_tag = 'De pago', price = 'Hasta RD$3,000'
where slug = 'don-miguelo-caribbean-lake-park-pc-festivalplayero-caribbean-lake-park-septiembr'
  and (price_tag = 'Gratis' or price is null or price = 'Gratis');
