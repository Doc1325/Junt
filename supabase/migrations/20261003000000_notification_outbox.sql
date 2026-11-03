-- Transactional notification outbox.
-- Creating a plan and enqueueing its notification now happen in the same transaction.

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('plan.created')),
  aggregate_id uuid not null references public.plans(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_type, aggregate_id)
);

create index notification_outbox_ready_idx
  on public.notification_outbox (next_attempt_at, created_at)
  where status in ('pending', 'failed');

alter table public.notification_outbox enable row level security;

-- There are intentionally no client policies. Only service_role can claim or
-- update outbox rows. This also keeps notification metadata out of the API.
revoke all on table public.notification_outbox from anon, authenticated;
grant select, insert, update, delete on table public.notification_outbox to service_role;

create or replace function public.enqueue_plan_created_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_outbox (event_type, aggregate_id, payload)
  values (
    'plan.created',
    new.id,
    jsonb_build_object(
      'planId', new.id,
      'groupId', new.group_id,
      'creatorId', new.created_by
    )
  )
  on conflict (event_type, aggregate_id) do nothing;

  return new;
end;
$$;

revoke all on function public.enqueue_plan_created_notification() from public, anon, authenticated;

drop trigger if exists enqueue_plan_created_notification on public.plans;
create trigger enqueue_plan_created_notification
after insert on public.plans
for each row execute function public.enqueue_plan_created_notification();

-- Atomically claims one event. SKIP LOCKED lets multiple function instances run
-- without delivering the same event concurrently. A stale processing lock can
-- be recovered after five minutes if a worker terminates unexpectedly.
create or replace function public.claim_plan_notification(target_plan_id uuid)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.notification_outbox as outbox
  set
    status = 'processing',
    attempts = outbox.attempts + 1,
    locked_at = now(),
    updated_at = now(),
    last_error = null
  where outbox.id = (
    select candidate.id
    from public.notification_outbox as candidate
    where candidate.event_type = 'plan.created'
      and candidate.aggregate_id = target_plan_id
      and candidate.attempts < 5
      and (
        (candidate.status in ('pending', 'failed') and candidate.next_attempt_at <= now())
        or (candidate.status = 'processing' and candidate.locked_at < now() - interval '5 minutes')
      )
    order by candidate.created_at
    for update skip locked
    limit 1
  )
  returning outbox.*;
end;
$$;

revoke all on function public.claim_plan_notification(uuid) from public, anon, authenticated;
grant execute on function public.claim_plan_notification(uuid) to service_role;
