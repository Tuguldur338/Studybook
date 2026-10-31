-- Monthly leaderboard seasons and champion borders.
-- Run after leaderboard.sql and halloween.sql.
--
-- points in profiles remains the all-time total. leaderboard_monthly is the
-- current-month score used by get_leaderboard(). Each past month's top scorer
-- earns a champion border, and equipped_border is stored on the profile so it
-- follows the account across devices.

create table if not exists public.leaderboard_monthly (
  user_id uuid not null references auth.users (id) on delete cascade,
  month_start date not null,
  points integer not null default 0 check (points >= 0),
  primary key (user_id, month_start)
);

alter table public.leaderboard_monthly enable row level security;

alter table public.profiles
  add column if not exists equipped_border text;

grant update (equipped_border) on public.profiles to authenticated;

create or replace function public.award_points(amount integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_total integer;
  me uuid := auth.uid();
  current_month date := date_trunc('month', current_date)::date;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  if amount is null or amount not in (-30, -20, -10, 10, 20, 30) then
    raise exception 'Invalid points amount' using errcode = '22023';
  end if;

  update public.profiles
     set points = case
       when points + amount < 0 then 0
       else points + amount
     end
   where id = me
   returning points into new_total;

  if new_total is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  insert into public.leaderboard_monthly (user_id, month_start, points)
  values (me, current_month, amount)
  on conflict (user_id, month_start) do update
  set points = case
    when public.leaderboard_monthly.points + amount < 0 then 0
    else public.leaderboard_monthly.points + amount
  end;

  return new_total;
end;
$$;

revoke all on function public.award_points(integer) from public, anon;
grant execute on function public.award_points(integer) to authenticated;

-- Replace the old five-column function so the leaderboard can show the
-- equipped champion border.
drop function if exists public.get_leaderboard(integer);

create function public.get_leaderboard(max_rows integer default 20)
returns table (
  id uuid,
  display_name text,
  username text,
  avatar_url text,
  points integer,
  equipped_border text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    p.id,
    p.display_name,
    p.username,
    p.avatar_url,
    coalesce(m.points, 0)::integer as points,
    p.equipped_border
  from public.profiles p
  left join public.leaderboard_monthly m
    on m.user_id = p.id
   and m.month_start = date_trunc('month', current_date)::date
  where coalesce(m.points, 0) > 0
    and (
      p.id = auth.uid()
      or public.are_friends(auth.uid(), p.id)
    )
  order by coalesce(m.points, 0) desc, p.display_name asc
  limit least(greatest(coalesce(max_rows, 20), 1), 100);
$$;

revoke all on function public.get_leaderboard(integer) from public, anon;
grant execute on function public.get_leaderboard(integer) to authenticated;

-- Returns one row per past month this user won (or tied for first).
create or replace function public.get_my_borders()
returns table (month text, points integer)
language sql
security definer
set search_path = ''
stable
as $$
  select
    to_char(m.month_start, 'YYYY-MM') as month,
    m.points
  from public.leaderboard_monthly m
  where m.user_id = auth.uid()
    and m.month_start < date_trunc('month', current_date)::date
    and m.points > 0
    and m.points = (
      select max(x.points)
      from public.leaderboard_monthly x
      where x.month_start = m.month_start
        and (
          x.user_id = auth.uid()
          or public.are_friends(auth.uid(), x.user_id)
        )
    )
  order by m.month_start desc;
$$;

revoke all on function public.get_my_borders() from public, anon;
grant execute on function public.get_my_borders() to authenticated;

-- Keep the Halloween claim in the monthly season as well. This replaces the
-- version from halloween.sql, so run that migration first.
create or replace function public.claim_halloween(
  choice text,
  point_value integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  claim_year integer := extract(year from current_date)::integer;
  new_total integer;
  inserted integer;
  current_month date := date_trunc('month', current_date)::date;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  if choice not in ('treat', 'trick') then
    raise exception 'Invalid Halloween choice' using errcode = '22023';
  end if;

  if choice = 'treat' and point_value <> 10 then
    raise exception 'A treat is worth 10 points' using errcode = '22023';
  end if;

  if choice = 'trick' and point_value not in (0, 10, 20, 30) then
    raise exception 'Invalid riddle points' using errcode = '22023';
  end if;

  insert into public.halloween_claims (user_id, year, choice, points)
  values (me, claim_year, choice, point_value)
  on conflict (user_id, year) do nothing;

  get diagnostics inserted = row_count;

  if inserted = 0 then
    raise exception 'Halloween was already claimed this year.'
      using errcode = '23505';
  end if;

  update public.profiles
     set points = case
       when points + point_value < 0 then 0
       else points + point_value
     end
   where id = me
   returning points into new_total;

  if new_total is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  insert into public.leaderboard_monthly (user_id, month_start, points)
  values (me, current_month, point_value)
  on conflict (user_id, month_start) do update
  set points = case
    when public.leaderboard_monthly.points + point_value < 0 then 0
    else public.leaderboard_monthly.points + point_value
  end;

  return new_total;
end;
$$;

revoke all on function public.claim_halloween(text, integer) from public, anon;
grant execute on function public.claim_halloween(text, integer) to authenticated;
