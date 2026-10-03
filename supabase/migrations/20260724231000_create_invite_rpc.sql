create or replace function public.create_invite(
  target_group_id uuid
)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  new_token text;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not exists (select 1 from public.group_members where group_id = target_group_id and user_id = auth.uid() and role = 'owner') then
    raise exception 'Only group owners can create invites';
  end if;
  insert into public.group_invites (group_id, created_by)
  values (target_group_id, auth.uid())
  returning token into new_token;
  return new_token;
end;
$$;

revoke all on function public.create_invite(uuid) from public;
grant execute on function public.create_invite(uuid) to authenticated;