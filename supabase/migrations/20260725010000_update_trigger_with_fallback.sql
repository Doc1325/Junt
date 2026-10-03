-- Updates the trigger to fallback to email prefix when name is not provided by OAuth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  extracted_name text;
  email_prefix text;
begin
  -- Try OAuth metadata first
  extracted_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'given_name'
  );

  -- Fallback: extract from email
  if extracted_name is null or char_length(trim(extracted_name)) = 0 then
    if new.email is not null then
      email_prefix := split_part(new.email, '@', 1);
      -- Capitalize first letter
      extracted_name := upper(left(email_prefix, 1)) || substring(email_prefix from 2);
    else
      extracted_name := 'Sin nombre';
    end if;
  end if;

  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, extracted_name, coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'))
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  return new;
end;
$$;