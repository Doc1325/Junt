-- Updates create_plan to allow 0 options (plan starts confirmed if no options).
create or replace function public.create_plan(
  target_group_id uuid,
  plan_title text,
  plan_scheduled_at timestamptz,
  option_titles text[]
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  new_plan_id uuid;
  option_title text;
  valid_option_count integer;
  initial_status text;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not exists (select 1 from public.group_members where group_id = target_group_id and user_id = auth.uid()) then
    raise exception 'You are not a member of this group';
  end if;
  if char_length(trim(plan_title)) = 0 then raise exception 'A plan title is required'; end if;

  select count(*) into valid_option_count from unnest(option_titles) as options(value) where char_length(trim(value)) > 0;

  if valid_option_count = 0 then
    initial_status := 'confirmed';
  else
    initial_status := 'voting';
  end if;

  insert into public.plans (group_id, title, scheduled_at, status, created_by)
  values (target_group_id, trim(plan_title), plan_scheduled_at, initial_status, auth.uid())
  returning id into new_plan_id;

  foreach option_title in array option_titles loop
    if char_length(trim(option_title)) > 0 then
      insert into public.plan_options (plan_id, title, created_by)
      values (new_plan_id, trim(option_title), auth.uid());
    end if;
  end loop;
  return new_plan_id;
end;
$$;