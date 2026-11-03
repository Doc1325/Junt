-- Primera ejecución inmediata para validar Vault y dejar preparada la cola
-- antes del primer ciclo automático diario.
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
