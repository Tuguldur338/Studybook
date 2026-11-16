-- Include every accepted friend in the leaderboard, including friends who
-- have not earned any points yet.

create index if not exists profiles_points_all_idx
  on public.profiles (points desc, username asc nulls last);

create or replace function public.get_leaderboard(max_rows integer default 20)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  points integer,
  equipped_border text
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
    p.points,
    p.equipped_border
  from public.profiles p
  where (
    p.id = auth.uid()
    or public.are_friends(auth.uid(), p.id)
  )
  order by p.points desc, p.username asc nulls last
  limit least(greatest(coalesce(max_rows, 20), 1), 100);
$$;

revoke all on function public.get_leaderboard(integer) from public, anon;
grant execute on function public.get_leaderboard(integer) to authenticated;
