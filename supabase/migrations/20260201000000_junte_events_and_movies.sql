-- junte: catálogo de salidas basado en padonde.do (eventos + cine)
-- Fuentes verificadas: HAR 2026-09-02 (/api/moviesWeek, /api/moviesSoon, LD+JSON Event)
create extension if not exists "pgcrypto";

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  slug text unique not null,
  title text not null,
  description text,
  category text not null,
  province text not null,
  venue text not null,
  start_date date not null,
  end_date date,
  hour_start time,
  hour_end time,
  price_tag text not null default 'De pago',
  image text,
  source_url text,
  source text default 'padonde.do',
  city text generated always as (province) stored,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists events_province_idx on public.events (province);
create index if not exists events_price_idx on public.events (price_tag);
create index if not exists events_start_date_idx on public.events (start_date);
create index if not exists events_category_idx on public.events (category);

create table if not exists public.movies (
  id uuid primary key default gen_random_uuid(),
  external_id text unique not null,
  title text not null,
  genres text[] not null default '{}',
  rating float,
  start_date date,
  synopsis text,
  slug text,
  image text,
  tmdb_id bigint,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists movies_start_date_idx on public.movies (start_date);
create index if not exists movies_genres_idx on public.movies using gin (genres);

create or replace function public.handle_junte_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists events_junte_updated_at on public.events;
create trigger events_junte_updated_at before update on public.events for each row execute function public.handle_junte_updated_at();
drop trigger if exists movies_junte_updated_at on public.movies;
create trigger movies_junte_updated_at before update on public.movies for each row execute function public.handle_junte_updated_at();

alter table public.events enable row level security;
alter table public.movies enable row level security;
drop policy if exists "events_select_all" on public.events;
create policy "events_select_all" on public.events for select using (true);
drop policy if exists "movies_select_all" on public.movies;
create policy "movies_select_all" on public.movies for select using (true);
