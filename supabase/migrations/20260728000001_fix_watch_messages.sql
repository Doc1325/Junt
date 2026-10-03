-- First, drop the old FK constraint on watch_messages
alter table public.watch_messages
  drop constraint if exists watch_messages_room_id_fkey;

-- Now migrate existing watch_rooms data to virtual_rooms
do $$
declare
  wr record;
  new_vr_id uuid;
  new_room_name text;
begin
  for wr in select * from watch_rooms loop
    new_room_name := 'room_' || replace(gen_random_uuid()::text, '-', '');

    insert into public.virtual_rooms (plan_id, host_id, room_name)
    values (wr.plan_id, wr.host_id, new_room_name)
    returning id into new_vr_id;

    -- Update watch_messages to point to the new virtual_rooms id
    update watch_messages set room_id = new_vr_id where room_id = wr.id;
  end loop;
end;
$$;

-- Add the new FK constraint to virtual_rooms
alter table public.watch_messages
  add constraint watch_messages_room_id_fkey
  foreign key (room_id) references public.virtual_rooms(id) on delete cascade;

-- Drop old RLS policies on watch_messages
drop policy if exists "group members read messages" on public.watch_messages;
drop policy if exists "group members insert messages" on public.watch_messages;

-- Recreate policies referencing virtual_rooms
create policy "group members read messages" on public.watch_messages
  for select using (
    exists (
      select 1 from public.virtual_rooms vr
      join public.plans p on p.id = vr.plan_id
      join public.group_members gm on gm.group_id = p.group_id
      where vr.id = room_id and gm.user_id = auth.uid()
    )
  );

create policy "group members insert messages" on public.watch_messages
  for insert with check (
    exists (
      select 1 from public.virtual_rooms vr
      join public.plans p on p.id = vr.plan_id
      join public.group_members gm on gm.group_id = p.group_id
      where vr.id = room_id and gm.user_id = auth.uid()
    )
  );
