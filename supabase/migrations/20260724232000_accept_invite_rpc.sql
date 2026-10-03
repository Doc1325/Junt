create or replace function public.accept_invite(
  invite_token text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  target_group_id uuid;
  invite_record record;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;

  select * into invite_record from public.group_invites
  where token = invite_token
  and (expires_at is null or expires_at > now())
  and (max_uses is null or uses_count < max_uses)
  for update;

  if not found then raise exception 'Invalid or expired invite token'; end if;

  target_group_id := invite_record.group_id;

  if exists (select 1 from public.group_members where group_id = target_group_id and user_id = auth.uid()) then
    return target_group_id;
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (target_group_id, auth.uid(), 'member');

  update public.group_invites set uses_count = uses_count + 1
  where id = invite_record.id;

  return target_group_id;
end;
$$;

revoke all on function public.accept_invite(text) from public;
grant execute on function public.accept_invite(text) to authenticated;