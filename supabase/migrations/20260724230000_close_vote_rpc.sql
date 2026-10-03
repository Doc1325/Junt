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
  if not exists (select 1 from public.plans where id = target_plan_id and created_by = auth.uid()) then
    raise exception 'Only the plan creator can close the vote';
  end if;
  update public.plans set status = 'confirmed', selected_option_id = selected_option, updated_at = now()
  where id = target_plan_id;
end;
$$;

revoke all on function public.close_vote(uuid, uuid) from public;
grant execute on function public.close_vote(uuid, uuid) to authenticated;