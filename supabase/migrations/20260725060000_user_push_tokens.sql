create table public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(token)
);

alter table public.user_push_tokens enable row level security;

create policy "users manage own tokens" on public.user_push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- edge function can read tokens of group members (via SECURITY DEFINER)
