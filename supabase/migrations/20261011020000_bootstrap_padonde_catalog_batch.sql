-- Valida inmediatamente un lote real de catálogo; los lotes restantes serán
-- procesados por la ventana automática diaria.
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'scrape_project_url')
    || '/functions/v1/scrape-padonde?mode=catalog&limit=40&offset=0',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-scrape-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'scrape_cron_secret')
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 120000
) as request_id;
