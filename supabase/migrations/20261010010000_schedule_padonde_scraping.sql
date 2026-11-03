-- Automatiza Pa' Dónde con lotes pequeños para respetar los límites de Edge Functions.
-- pg_cron usa UTC: 10:00 UTC = 06:00 America/Santo_Domingo todo el año.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create table if not exists public.scrape_event_queue (
  slug text primary key,
  discovered_at timestamptz not null default now()
);

alter table public.scrape_event_queue enable row level security;

create table if not exists public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('full', 'discover', 'catalog', 'prices')),
  batch_offset integer not null default 0,
  batch_limit integer not null default 40,
  status text not null check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  error text
);

create index if not exists scrape_runs_started_at_idx on public.scrape_runs (started_at desc);
alter table public.scrape_runs enable row level security;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'scrape_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'scrape_cron_secret', 'Authenticates scheduled scrape-padonde calls');
  end if;
  if not exists (select 1 from vault.secrets where name = 'scrape_project_url') then
    perform vault.create_secret('https://qyvawuzuumlammtqxljd.supabase.co', 'scrape_project_url', 'Junt Supabase project URL');
  end if;
end
$$;

create or replace function public.verify_scrape_cron_secret(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    candidate = (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'scrape_cron_secret'
      limit 1
    ),
    false
  );
$$;

revoke all on function public.verify_scrape_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_scrape_cron_secret(text) to service_role;

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid from cron.job
    where jobname in ('junt-padonde-discover', 'junt-padonde-catalog', 'junt-padonde-prices')
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end
$$;

-- 06:00 Santo Domingo: descubre slugs y actualiza películas una sola vez.
select cron.schedule(
  'junt-padonde-discover',
  '0 10 * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'scrape_project_url') || '/functions/v1/scrape-padonde?mode=discover',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-scrape-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'scrape_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    ) as request_id;
  $job$
);

-- 06:05–06:41: procesa hasta 520 eventos en lotes estables de 40.
select cron.schedule(
  'junt-padonde-catalog',
  '5-41/3 10 * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'scrape_project_url')
        || '/functions/v1/scrape-padonde?mode=catalog&limit=40&offset='
        || (((extract(minute from now())::integer - 5) / 3) * 40)::text,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-scrape-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'scrape_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    ) as request_id;
  $job$
);

-- 07:00–07:36: vuelve a comprobar precios/categorías de hasta 520 filas.
select cron.schedule(
  'junt-padonde-prices',
  '0-36/3 11 * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'scrape_project_url')
        || '/functions/v1/scrape-padonde?mode=prices&only=all&limit=40&offset='
        || (((extract(minute from now())::integer) / 3) * 40)::text,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-scrape-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'scrape_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    ) as request_id;
  $job$
);
