-- Adds onboarded flag to profiles to track first-time setup.
alter table public.profiles add column if not exists onboarded boolean not null default false;

-- Existing users are considered onboarded
update public.profiles set onboarded = true where onboarded = false and full_name is not null and full_name != 'Sin nombre';