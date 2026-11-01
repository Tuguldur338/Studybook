-- Type-ahead search for people you may want to add as friends.
-- Only public profile fields are exposed; emails stay private.
create or replace function public.search_users(term text, max_rows integer default 6)
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
  with q as (
    select
      pg_catalog.btrim(coalesce(term, '')) as raw,
      pg_catalog.replace(pg_catalog.btrim(coalesce(term, '')), '@', '') as handle
  )
  select
    p.id,
    p.display_name,
    p.username,
    p.avatar_url
  from public.profiles p
  cross join q
  where p.id <> auth.uid()
    and pg_catalog.length(q.raw) >= 1
    and (
      p.display_name ilike '%' || q.raw || '%'
      or p.username ilike '%' || q.handle || '%'
    )
  order by
    case
      when pg_catalog.lower(p.username) = pg_catalog.lower(q.handle) then 0
      when pg_catalog.lower(p.username) like pg_catalog.lower(q.handle) || '%' then 1
      when pg_catalog.lower(p.display_name) like pg_catalog.lower(q.raw) || '%' then 2
      else 3
    end,
    p.display_name asc
  limit least(greatest(coalesce(max_rows, 6), 1), 12);
$$;

revoke all on function public.search_users(text, integer) from public, anon;
grant execute on function public.search_users(text, integer) to authenticated;
