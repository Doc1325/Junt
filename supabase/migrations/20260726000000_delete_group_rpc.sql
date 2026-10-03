create or replace function public.delete_group(target_group_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not exists (select 1 from public.groups where id = target_group_id and created_by = auth.uid()) then
    raise exception 'Only the group creator can delete the group';
  end if;
  delete from public.groups where id = target_group_id;
end;
$$;

revoke all on function public.delete_group(uuid) from public;
grant execute on function public.delete_group(uuid) to authenticated;
