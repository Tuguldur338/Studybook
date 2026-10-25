-- Usernames: capture one at sign-up, keep it unique, and look people up by
-- either email or @username.
--
-- The profiles table already has a `username` column, a format check, and a
-- unique index on lower(username); this migration wires them into sign-up and
-- friend lookup.

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  handle text;
begin
  handle := nullif(
    pg_catalog.lower(
      pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'username', ''))
    ),
    ''
  );

  -- Ignore malformed usernames instead of blocking the whole sign-up.
  if handle is not null and handle !~ '^[a-z0-9][a-z0-9_-]{2,29}$' then
    handle := null;
  end if;

  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(
      nullif(
        pg_catalog.left(
          pg_catalog.btrim(
            coalesce(new.raw_user_meta_data ->> 'display_name', '')
          ),
          80
        ),
        ''
      ),
      'Student'
    ),
    handle
  )
  on conflict (id) do nothing;

  return new;
end
$$;

revoke all on function public.create_profile_for_new_user()
  from public, anon, authenticated;

-- Called while signed out, right before signUp, so the form can say
-- "that username is taken" instead of surfacing a database error.
create or replace function public.is_username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.profiles p
    where pg_catalog.lower(p.username) =
      pg_catalog.lower(pg_catalog.btrim(candidate))
  );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text)
  to anon, authenticated;

-- Friend requests accept either the sign-up email or the @username.
create or replace function public.find_user_by_login(login text)
returns table (
  id uuid,
  display_name text,
  username text,
  avatar_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.username, p.avatar_url
  from public.profiles p
  join auth.users u on u.id = p.id
  where pg_catalog.lower(u.email) = pg_catalog.lower(pg_catalog.btrim(login))
     or pg_catalog.lower(p.username) = pg_catalog.lower(
       pg_catalog.btrim(pg_catalog.btrim(login), '@')
     )
  limit 1;
$$;

revoke all on function public.find_user_by_login(text) from public, anon;
grant execute on function public.find_user_by_login(text) to authenticated;
