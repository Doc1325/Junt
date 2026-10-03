-- Add plan_type to plans (optional, safe default)
alter table public.plans add column if not exists plan_type text not null default 'physical' check (plan_type in ('physical', 'watch_party'));

-- Watch rooms
create table if not exists public.watch_rooms (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade unique,
  host_id uuid not null references public.profiles(id),
  video_url text not null,
  video_provider text not null default 'direct_mp4' check (video_provider in ('direct_mp4', 'google_drive', 'youtube', 'dropbox', 'onedrive')),
  created_at timestamptz default now()
);

-- Watch room state (playback position)
create table if not exists public.watch_room_state (
  room_id uuid primary key references public.watch_rooms(id) on delete cascade,
  is_playing boolean not null default false,
  position numeric not null default 0,
  updated_at timestamptz default now()
);

-- Watch chat messages
create table if not exists public.watch_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.watch_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  message text not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.watch_rooms enable row level security;
alter table public.watch_room_state enable row level security;
alter table public.watch_messages enable row level security;

-- watch_rooms: group members can read
create policy "group members read watch rooms" on public.watch_rooms
  for select using (
    exists (select 1 from public.plans p join public.group_members gm on gm.group_id = p.group_id where p.id = plan_id and gm.user_id = auth.uid())
  );

-- watch_rooms: plan creator can insert
create policy "plan creator inserts watch room" on public.watch_rooms
  for insert with check (
    exists (select 1 from public.plans p where p.id = plan_id and p.created_by = auth.uid())
  );

-- watch_rooms: host can update
create policy "host updates watch room" on public.watch_rooms
  for update using (
    exists (select 1 from public.watch_rooms wr where wr.id = id and wr.host_id = auth.uid())
  );

-- watch_room_state: group members can read
create policy "group members read room state" on public.watch_room_state
  for select using (
    exists (select 1 from public.watch_rooms wr join public.plans p on p.id = wr.plan_id join public.group_members gm on gm.group_id = p.group_id where wr.id = room_id and gm.user_id = auth.uid())
  );

-- watch_room_state: host can update
create policy "host updates room state" on public.watch_room_state
  for insert with check (
    exists (select 1 from public.watch_rooms wr where wr.id = room_id and wr.host_id = auth.uid())
  );
create policy "host updates room state 2" on public.watch_room_state
  for update using (
    exists (select 1 from public.watch_rooms wr where wr.id = room_id and wr.host_id = auth.uid())
  ) with check (
    exists (select 1 from public.watch_rooms wr where wr.id = room_id and wr.host_id = auth.uid())
  );

-- watch_messages: group members can read
create policy "group members read messages" on public.watch_messages
  for select using (
    exists (select 1 from public.watch_rooms wr join public.plans p on p.id = wr.plan_id join public.group_members gm on gm.group_id = p.group_id where wr.id = room_id and gm.user_id = auth.uid())
  );

-- watch_messages: group members can insert
create policy "group members insert messages" on public.watch_messages
  for insert with check (
    exists (select 1 from public.watch_rooms wr join public.plans p on p.id = wr.plan_id join public.group_members gm on gm.group_id = p.group_id where wr.id = room_id and gm.user_id = auth.uid())
  );

-- RPC: create a watch party plan
create or replace function public.create_watch_plan(
  target_group_id uuid,
  plan_title text,
  plan_scheduled_at timestamptz,
  video_url text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  new_plan_id uuid;
  new_room_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not exists (select 1 from public.group_members where group_id = target_group_id and user_id = auth.uid()) then
    raise exception 'You are not a member of this group';
  end if;
  if char_length(trim(plan_title)) = 0 then raise exception 'A plan title is required'; end if;
  if char_length(trim(video_url)) = 0 then raise exception 'A video URL is required'; end if;

  insert into public.plans (group_id, title, scheduled_at, status, created_by, plan_type)
  values (target_group_id, trim(plan_title), plan_scheduled_at, 'confirmed', auth.uid(), 'watch_party')
  returning id into new_plan_id;

  insert into public.watch_rooms (plan_id, host_id, video_url)
  values (new_plan_id, auth.uid(), trim(video_url))
  returning id into new_room_id;

  insert into public.watch_room_state (room_id) values (new_room_id);

  return new_plan_id;
end;
$$;

revoke all on function public.create_watch_plan(uuid, text, timestamptz, text) from public;
grant execute on function public.create_watch_plan(uuid, text, timestamptz, text) to authenticated;
