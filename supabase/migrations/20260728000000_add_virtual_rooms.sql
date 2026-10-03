create table if not exists public.virtual_rooms (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade unique,
  host_id uuid not null references public.profiles(id),
  room_name text not null unique,
  provider text not null default 'livekit',
  created_at timestamptz default now()
);

create table if not exists public.virtual_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.virtual_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  joined_at timestamptz default now(),
  unique(room_id, user_id)
);

alter table public.virtual_rooms enable row level security;
alter table public.virtual_room_members enable row level security;

create policy "members read virtual rooms" on public.virtual_rooms
  for select using (
    exists (select 1 from public.plans p join public.group_members gm on gm.group_id = p.group_id where p.id = plan_id and gm.user_id = auth.uid())
  );

create policy "plan creator inserts virtual room" on public.virtual_rooms
  for insert with check (
    exists (select 1 from public.plans p where p.id = plan_id and p.created_by = auth.uid())
  );

create policy "members manage room members" on public.virtual_room_members
  for all using (
    exists (select 1 from public.virtual_rooms vr join public.plans p on p.id = vr.plan_id join public.group_members gm on gm.group_id = p.group_id where vr.id = room_id and gm.user_id = auth.uid())
  );

create or replace function public.create_virtual_plan(
  target_group_id uuid,
  plan_title text,
  plan_scheduled_at timestamptz
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  new_plan_id uuid;
  new_room_name text;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not exists (select 1 from public.group_members where group_id = target_group_id and user_id = auth.uid()) then
    raise exception 'You are not a member of this group';
  end if;
  if char_length(trim(plan_title)) = 0 then raise exception 'A plan title is required'; end if;

  new_room_name := 'room_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.plans (group_id, title, scheduled_at, status, created_by, plan_type)
  values (target_group_id, trim(plan_title), plan_scheduled_at, 'confirmed', auth.uid(), 'watch_party')
  returning id into new_plan_id;

  insert into public.virtual_rooms (plan_id, host_id, room_name)
  values (new_plan_id, auth.uid(), new_room_name);

  return new_plan_id;
end;
$$;

revoke all on function public.create_virtual_plan(uuid, text, timestamptz) from public;
grant execute on function public.create_virtual_plan(uuid, text, timestamptz) to authenticated;
