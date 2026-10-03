-- Creates the group and its owner membership atomically.
create or replace function public.create_group(group_name text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  new_group_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if char_length(trim(group_name)) = 0 then
    raise exception 'A group name is required';
  end if;

  insert into public.groups (name, created_by)
  values (trim(group_name), auth.uid())
  returning id into new_group_id;

  insert into public.group_members (group_id, user_id, role)
  values (new_group_id, auth.uid(), 'owner');

  return new_group_id;
end;
$$;

revoke all on function public.create_group(text) from public;
grant execute on function public.create_group(text) to authenticated;
