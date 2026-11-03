begin;

select plan(28);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'owner@juntapp.test', '',
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Owner Test"}',
    now(), now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'member@juntapp.test', '',
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Member Test"}',
    now(), now()
  );

select is(
  (select count(*)::integer from public.profiles where id in (
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002'
  )),
  2,
  'signup trigger creates both profiles'
);

create temporary table workflow_state (
  key text primary key,
  uuid_value uuid,
  text_value text
);
grant all on table workflow_state to authenticated;
grant all on table workflow_state to service_role;
grant all on table workflow_state to anon;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$ insert into workflow_state (key, uuid_value) values ('group', public.create_group('Viernes de prueba')) $$,
  'owner can create a group through the RPC'
);

select is(
  (select name from public.groups where id = (select uuid_value from workflow_state where key = 'group')),
  'Viernes de prueba',
  'group is persisted'
);

select is(
  (select role from public.group_members
    where group_id = (select uuid_value from workflow_state where key = 'group')
      and user_id = '10000000-0000-0000-0000-000000000001'),
  'owner',
  'creator is the group owner'
);

select lives_ok(
  $$ insert into workflow_state (key, text_value)
     values ('invite', public.create_invite((select uuid_value from workflow_state where key = 'group'))) $$,
  'owner can create an invite'
);

select is(
  public.create_invite((select uuid_value from workflow_state where key = 'group')),
  (select text_value from workflow_state where key = 'invite'),
  'creating an invite again returns the existing active link'
);

select is(
  (select max_uses from public.get_group_invite(
    (select uuid_value from workflow_state where key = 'group')
  )),
  25,
  'new invitations have a bounded use count'
);

select ok(
  (select expires_at is not null from public.get_group_invite(
    (select uuid_value from workflow_state where key = 'group')
  )),
  'new invitations have an expiration date'
);

reset role;
set local role anon;

select is(
  (select invite_status from public.get_invite_preview(
    (select text_value from workflow_state where key = 'invite')
  )),
  'active',
  'anonymous visitors can validate an active invite'
);

select is(
  (select group_name from public.get_invite_preview(
    (select text_value from workflow_state where key = 'invite')
  )),
  'Viernes de prueba',
  'public preview exposes only the invited group identity'
);

select is(
  (select count(*)::integer from public.groups),
  0,
  'anonymous invite visitors still cannot query group records'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select lives_ok(
  $$ select public.accept_invite((
       select text_value from workflow_state where key = 'invite'
     )) $$,
  'second user can accept the invite'
);

select is(
  (select role from public.group_members
    where group_id = (select uuid_value from workflow_state where key = 'group')
      and user_id = '10000000-0000-0000-0000-000000000002'),
  'member',
  'invite creates a member membership'
);

reset role;

select is(
  (select uses_count from public.group_invites where token = (select text_value from workflow_state where key = 'invite')),
  1,
  'accepting the invite increments its use count'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select lives_ok(
  $$ insert into workflow_state (key, uuid_value) values (
       'plan',
       public.create_plan(
         (select uuid_value from workflow_state where key = 'group'),
         'Cena de integración',
         now() + interval '2 days',
         array['Pizza', 'Sushi'],
         'physical'
       )
     ) $$,
  'member can create a plan with options'
);

select is(
  (select status from public.plans where id = (select uuid_value from workflow_state where key = 'plan')),
  'voting',
  'plan with options starts in voting state'
);

select is(
  (select count(*)::integer from public.plan_options where plan_id = (select uuid_value from workflow_state where key = 'plan')),
  2,
  'plan options are created atomically'
);

reset role;

select is(
  (select count(*)::integer from public.notification_outbox
    where aggregate_id = (select uuid_value from workflow_state where key = 'plan')
      and event_type = 'plan.created'),
  1,
  'plan creation enqueues exactly one notification event'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

insert into public.votes (option_id, user_id)
select id, '10000000-0000-0000-0000-000000000002'
from public.plan_options
where plan_id = (select uuid_value from workflow_state where key = 'plan')
order by created_at
limit 1;

select is(
  (select count(*)::integer from public.votes
    where user_id = '10000000-0000-0000-0000-000000000002'),
  1,
  'member can vote on an option'
);

insert into public.plan_participants (plan_id, user_id, attendance_status)
values (
  (select uuid_value from workflow_state where key = 'plan'),
  '10000000-0000-0000-0000-000000000002',
  'going'
);

select is(
  (select attendance_status from public.plan_participants
    where plan_id = (select uuid_value from workflow_state where key = 'plan')
      and user_id = '10000000-0000-0000-0000-000000000002'),
  'going',
  'member can confirm attendance'
);

insert into public.plan_participants (plan_id, user_id, attendance_status)
values (
  (select uuid_value from workflow_state where key = 'plan'),
  '10000000-0000-0000-0000-000000000002',
  'maybe'
)
on conflict (plan_id, user_id) do update
set attendance_status = excluded.attendance_status;

select is(
  (select attendance_status from public.plan_participants
    where plan_id = (select uuid_value from workflow_state where key = 'plan')
      and user_id = '10000000-0000-0000-0000-000000000002'),
  'maybe',
  'member can change attendance without creating a duplicate'
);

select is(
  (select count(*)::integer from public.plan_participants
    where plan_id = (select uuid_value from workflow_state where key = 'plan')
      and user_id = '10000000-0000-0000-0000-000000000002'),
  1,
  'attendance remains idempotent by plan and user'
);

reset role;

select throws_ok(
  $$ insert into public.notification_outbox (event_type, aggregate_id)
     values ('plan.created', (select uuid_value from workflow_state where key = 'plan')) $$,
  '23505',
  'duplicate key value violates unique constraint "notification_outbox_event_type_aggregate_id_key"',
  'outbox rejects a duplicate event for the same plan'
);

set local role service_role;

select is(
  (select count(*)::integer from public.claim_plan_notification(
    (select uuid_value from workflow_state where key = 'plan')
  )),
  1,
  'worker claims the queued notification once'
);

select is(
  (select count(*)::integer from public.claim_plan_notification(
    (select uuid_value from workflow_state where key = 'plan')
  )),
  0,
  'a concurrent retry cannot claim the same notification again'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$ select public.revoke_group_invite((select uuid_value from workflow_state where key = 'group')) $$,
  'owner can revoke the active invitation'
);

reset role;
set local role anon;

select is(
  (select invite_status from public.get_invite_preview(
    (select text_value from workflow_state where key = 'invite')
  )),
  'revoked',
  'public preview reports a revoked invitation'
);

select is(
  (select group_name from public.get_invite_preview(
    (select text_value from workflow_state where key = 'invite')
  )),
  null::text,
  'revoked invitations no longer expose the group name'
);

select is(
  (select inviter_name from public.get_invite_preview(
    (select text_value from workflow_state where key = 'invite')
  )),
  null::text,
  'revoked invitations no longer expose the inviter identity'
);

reset role;

select * from finish();
rollback;
