-- Leaderboard: points for completed to-do tasks, and a public top list.
--
-- Tasks live in the browser, so the client awards points when a task is
-- checked off. The allowlist below ties an amount to a priority:
--   high +30, medium +20, low +10 (and the matching negatives when un-checked).
--
-- The profiles table only lets a user read their own row, so the leaderboard
-- is exposed through a security-definer function that returns just the public
-- fields (username, display name, avatar, points).

alter table public.profiles
  add column if not exists points integer not null default 0;

create index if not exists profiles_points_idx
  on public.profiles (points desc)
  where points > 0;

create or replace function public.award_points(amount integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_total integer;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  if amount is null or amount not in (-30, -20, -10, 10, 20, 30) then
    raise exception 'Invalid points amount' using errcode = '22023';
  end if;

  update public.profiles
     set points = pg_catalog.greatest(0, points + amount)
   where id = auth.uid()
   returning points into new_total;

  if new_total is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  return new_total;
end;
$$;

revoke all on function public.award_points(integer) from public, anon;
grant execute on function public.award_points(integer) to authenticated;

create or replace function public.get_leaderboard(max_rows integer default 20)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  points integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.points
  from public.profiles p
  where p.points > 0
  order by p.points desc, p.username asc nulls last
  limit least(greatest(coalesce(max_rows, 20), 1), 100);
$$;

revoke all on function public.get_leaderboard(integer) from public, anon;
grant execute on function public.get_leaderboard(integer) to authenticated;
