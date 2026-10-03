create or replace function public.cancel_plan(
  target_plan_id uuid
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not exists (select 1 from public.plans where id = target_plan_id and created_by = auth.uid()) then
    raise exception 'Only the plan creator can cancel the plan';
  end if;
  update public.plans set status = 'cancelled', updated_at = now() where id = target_plan_id;
end;
$$;

revoke all on function public.cancel_plan(uuid) from public;
grant execute on function public.cancel_plan(uuid) to authenticated;