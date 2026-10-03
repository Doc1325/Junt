create or replace function public.leave_group(
  target_group_id uuid
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not exists (select 1 from public.group_members where group_id = target_group_id and user_id = auth.uid()) then
    raise exception 'You are not a member of this group';
  end if;
  if exists (select 1 from public.group_members where group_id = target_group_id and user_id = auth.uid() and role = 'owner') then
    raise exception 'The group owner cannot leave. Transfer ownership first.';
  end if;
  delete from public.group_members where group_id = target_group_id and user_id = auth.uid();
end;
$$;

revoke all on function public.leave_group(uuid) from public;
grant execute on function public.leave_group(uuid) to authenticated;