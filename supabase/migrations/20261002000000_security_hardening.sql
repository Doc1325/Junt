-- Priority-zero authorization hardening.
-- All multi-table mutations are performed through SECURITY DEFINER RPCs.

drop policy if exists "group creator adds owner" on public.group_members;
drop policy if exists "users create groups" on public.groups;
drop policy if exists "members create plans" on public.plans;
drop policy if exists "members create options" on public.plan_options;

drop policy if exists "member manages own votes" on public.votes;
create policy "members insert own votes while voting"
on public.votes for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.plan_options o
    join public.plans p on p.id = o.plan_id
    join public.group_members gm on gm.group_id = p.group_id
    where o.id = option_id
      and gm.user_id = auth.uid()
      and p.status = 'voting'
  )
);

create policy "members delete own votes while voting"
on public.votes for delete
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.plan_options o
    join public.plans p on p.id = o.plan_id
    join public.group_members gm on gm.group_id = p.group_id
    where o.id = option_id
      and gm.user_id = auth.uid()
      and p.status = 'voting'
  )
);

drop policy if exists "member manages attendance" on public.plan_participants;
create policy "members insert own attendance"
on public.plan_participants for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.plans p
    join public.group_members gm on gm.group_id = p.group_id
    where p.id = plan_id
      and gm.user_id = auth.uid()
      and p.status in ('voting', 'confirmed')
  )
);

create policy "members update own attendance"
on public.plan_participants for update
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.plans p
    join public.group_members gm on gm.group_id = p.group_id
    where p.id = plan_id
      and gm.user_id = auth.uid()
      and p.status in ('voting', 'confirmed')
  )
);

create policy "members delete own attendance"
on public.plan_participants for delete
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.plans p
    join public.group_members gm on gm.group_id = p.group_id
    where p.id = plan_id and gm.user_id = auth.uid()
  )
);

drop policy if exists "origins private" on public.plan_origins;
create policy "users read own origins"
on public.plan_origins for select
using (user_id = auth.uid());

create policy "members insert own origins"
on public.plan_origins for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.plans p
    join public.group_members gm on gm.group_id = p.group_id
    where p.id = plan_id and gm.user_id = auth.uid()
  )
  and (
    saved_location_id is null
    or exists (
      select 1 from public.saved_locations sl
      where sl.id = saved_location_id and sl.user_id = auth.uid()
    )
  )
);

create policy "members update own origins"
on public.plan_origins for update
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.plans p
    join public.group_members gm on gm.group_id = p.group_id
    where p.id = plan_id and gm.user_id = auth.uid()
  )
  and (
    saved_location_id is null
    or exists (
      select 1 from public.saved_locations sl
      where sl.id = saved_location_id and sl.user_id = auth.uid()
    )
  )
);

create policy "users delete own origins"
on public.plan_origins for delete
using (user_id = auth.uid());

-- Closing a vote must select an option from that same open plan.
create or replace function public.close_vote(
  target_plan_id uuid,
  selected_option uuid
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not exists (
    select 1 from public.plans
    where id = target_plan_id and created_by = auth.uid() and status = 'voting'
  ) then
    raise exception 'Only the plan creator can close an open vote';
  end if;
  if not exists (
    select 1 from public.plan_options
    where id = selected_option and plan_id = target_plan_id
  ) then
    raise exception 'The selected option does not belong to this plan';
  end if;

  update public.plans
  set status = 'confirmed', selected_option_id = selected_option, updated_at = now()
  where id = target_plan_id;
end;
$$;

revoke all on function public.close_vote(uuid, uuid) from public;
grant execute on function public.close_vote(uuid, uuid) to authenticated;
