-- Zona Colonial's generic /actividades page also exposes sponsor cards. Pa' Dónde
-- imported four of those cards as events. Specific /actividad/<slug> URLs remain valid.
delete from public.events
where source = 'padonde.do'
  and source_url ~* '^https?://(www\.)?zonacolonial\.do/actividades/?([?#].*)?$';
