-- Allows group members to see each other's profiles (name + avatar only).
create policy "members see group profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid() and gm2.user_id = profiles.id
    )
  );