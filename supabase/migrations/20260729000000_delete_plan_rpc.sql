create or replace function public.delete_plan(target_plan_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not exists (
    select 1 from public.plans p
    join public.groups g on g.id = p.group_id
    where p.id = target_plan_id
    and (p.created_by = auth.uid() or g.created_by = auth.uid())
  ) then
    raise exception 'Only the plan creator or group creator can delete the plan';
  end if;
  delete from public.plans where id = target_plan_id;
end;
$$;

revoke all on function public.delete_plan(uuid) from public;
grant execute on function public.delete_plan(uuid) to authenticated;
