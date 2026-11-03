-- Persistent, revocable invitations with a privacy-safe public preview.

alter table public.group_invites
  add column if not exists revoked_at timestamptz;

-- Older versions could create several permanent links. Keep only the newest
-- non-revoked link per group before enforcing the invariant.
with ranked_invites as (
  select
    id,
    row_number() over (partition by group_id order by created_at desc, id desc) as position
  from public.group_invites
  where revoked_at is null
)
update public.group_invites as invite
set revoked_at = now()
from ranked_invites
where invite.id = ranked_invites.id
  and ranked_invites.position > 1;

-- Bring the surviving legacy link into the new bounded lifecycle.
update public.group_invites
set
  expires_at = coalesce(expires_at, now() + interval '7 days'),
  max_uses = coalesce(max_uses, 25)
where revoked_at is null;

create unique index if not exists group_invites_one_unrevoked_per_group
  on public.group_invites (group_id)
  where revoked_at is null;

create or replace function public.create_invite(target_group_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  active_token text;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not exists (
    select 1 from public.group_members
    where group_id = target_group_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only group owners can create invites';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_group_id::text, 0));

  select invite.token into active_token
  from public.group_invites as invite
  where invite.group_id = target_group_id
    and invite.revoked_at is null
    and (invite.expires_at is null or invite.expires_at > now())
    and (invite.max_uses is null or invite.uses_count < invite.max_uses)
  order by invite.created_at desc
  limit 1;

  if active_token is not null then return active_token; end if;

  update public.group_invites
  set revoked_at = now()
  where group_id = target_group_id and revoked_at is null;

  insert into public.group_invites (
    group_id, created_by, expires_at, max_uses
  ) values (
    target_group_id, auth.uid(), now() + interval '7 days', 25
  )
  returning token into active_token;

  return active_token;
end;
$$;

revoke all on function public.create_invite(uuid) from public, anon;
grant execute on function public.create_invite(uuid) to authenticated;

create or replace function public.get_group_invite(target_group_id uuid)
returns table (
  token text,
  expires_at timestamptz,
  uses_count integer,
  max_uses integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not exists (
    select 1 from public.group_members
    where group_id = target_group_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only group owners can view invites';
  end if;

  return query
  select invite.token, invite.expires_at, invite.uses_count, invite.max_uses
  from public.group_invites as invite
  where invite.group_id = target_group_id
    and invite.revoked_at is null
    and (invite.expires_at is null or invite.expires_at > now())
    and (invite.max_uses is null or invite.uses_count < invite.max_uses)
  order by invite.created_at desc
  limit 1;
end;
$$;

revoke all on function public.get_group_invite(uuid) from public, anon;
grant execute on function public.get_group_invite(uuid) to authenticated;

create or replace function public.revoke_group_invite(target_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not exists (
    select 1 from public.group_members
    where group_id = target_group_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only group owners can revoke invites';
  end if;

  update public.group_invites
  set revoked_at = now()
  where group_id = target_group_id and revoked_at is null;
end;
$$;

revoke all on function public.revoke_group_invite(uuid) from public, anon;
grant execute on function public.revoke_group_invite(uuid) to authenticated;

create or replace function public.get_invite_preview(invite_token text)
returns table (
  invite_status text,
  group_name text,
  inviter_name text,
  inviter_avatar text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record record;
  resolved_status text;
begin
  select
    invite.revoked_at,
    invite.expires_at,
    invite.max_uses,
    invite.uses_count,
    target_group.name as resolved_group_name,
    inviter.full_name as resolved_inviter_name,
    inviter.avatar_url as resolved_inviter_avatar
  into invite_record
  from public.group_invites as invite
  join public.groups as target_group on target_group.id = invite.group_id
  join public.profiles as inviter on inviter.id = invite.created_by
  where invite.token = invite_token;

  if not found then
    return query select 'invalid'::text, null::text, null::text, null::text;
    return;
  end if;

  resolved_status := case
    when invite_record.revoked_at is not null then 'revoked'
    when invite_record.expires_at is not null and invite_record.expires_at <= now() then 'expired'
    when invite_record.max_uses is not null and invite_record.uses_count >= invite_record.max_uses then 'limit_reached'
    else 'active'
  end;

  if resolved_status <> 'active' then
    return query select resolved_status, null::text, null::text, null::text;
    return;
  end if;

  return query select
    resolved_status,
    invite_record.resolved_group_name::text,
    invite_record.resolved_inviter_name::text,
    invite_record.resolved_inviter_avatar::text;
end;
$$;

revoke all on function public.get_invite_preview(text) from public;
grant execute on function public.get_invite_preview(text) to anon, authenticated;

create or replace function public.accept_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group_id uuid;
  invite_record record;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;

  select * into invite_record
  from public.group_invites
  where token = invite_token
  for update;

  if not found then raise exception 'INVITE_INVALID'; end if;
  if invite_record.revoked_at is not null then raise exception 'INVITE_REVOKED'; end if;
  if invite_record.expires_at is not null and invite_record.expires_at <= now() then raise exception 'INVITE_EXPIRED'; end if;
  if invite_record.max_uses is not null and invite_record.uses_count >= invite_record.max_uses then
    raise exception 'INVITE_LIMIT_REACHED';
  end if;

  target_group_id := invite_record.group_id;

  if exists (
    select 1 from public.group_members
    where group_id = target_group_id and user_id = auth.uid()
  ) then
    return target_group_id;
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (target_group_id, auth.uid(), 'member');

  update public.group_invites
  set uses_count = uses_count + 1
  where id = invite_record.id;

  return target_group_id;
end;
$$;

revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;
