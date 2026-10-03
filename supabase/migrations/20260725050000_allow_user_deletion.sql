-- Allows user deletion by making created_by nullable and setting NULL on delete.
-- Groups and plans remain but lose their creator reference.

-- Groups
ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_created_by_fkey;
ALTER TABLE public.groups ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.groups ADD CONSTRAINT groups_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Plans
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_created_by_fkey;
ALTER TABLE public.plans ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.plans ADD CONSTRAINT plans_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Group invites
ALTER TABLE public.group_invites DROP CONSTRAINT IF EXISTS group_invites_created_by_fkey;
ALTER TABLE public.group_invites ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.group_invites ADD CONSTRAINT group_invites_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Plan options
ALTER TABLE public.plan_options DROP CONSTRAINT IF EXISTS plan_options_created_by_fkey;
ALTER TABLE public.plan_options ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.plan_options ADD CONSTRAINT plan_options_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;