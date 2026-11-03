-- Repite discovery una vez con el filtro temporal ya desplegado para retirar
-- de la cola inicial los slugs históricos heredados del sitemap completo.
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'scrape_project_url')
    || '/functions/v1/scrape-padonde?mode=discover',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-scrape-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'scrape_cron_secret')
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 120000
) as request_id;
