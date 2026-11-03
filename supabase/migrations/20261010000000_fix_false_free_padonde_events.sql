-- Pa' Dónde puede publicar offers.price = 'Gratis' aunque la descripción exija
-- consumo mínimo o muestre un precio de entrada. Corrige las filas ya almacenadas;
-- el scraper aplica la misma precedencia para eventos futuros.
update public.events
set
  price_tag = 'De pago',
  price = case
    when coalesce(description, '') ~* 'consumo[[:space:]]+m(i|í)nimo'
      then 'Consumo mínimo'
    else 'De pago'
  end
where source = 'padonde.do'
  and price_tag = 'Gratis'
  and (
    coalesce(description, '') ~* 'consumo[[:space:]]+m(i|í)nimo'
    or coalesce(description, '') ~* '(cover|boletas?|tickets?|preventa|admisi(o|ó)n|entrada)[^\n.]{0,60}(RD\$|US\$|DOP|\$)[[:space:]]*[0-9]'
  );
