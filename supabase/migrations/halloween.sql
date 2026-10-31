-- Halloween trick-or-treat claims, one per account per year.
-- Run after schema.sql and leaderboard.sql.
-- Keeping the claim on the server stops the same account from claiming again
-- on another device.

create table if not exists public.halloween_claims (
  user_id uuid not null references auth.users (id) on delete cascade,
  year integer not null,
  choice text not null check (choice in ('treat', 'trick')),
  points integer not null check (points in (0, 10, 20, 30)),
  claimed_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, year)
);

alter table public.halloween_claims enable row level security;

drop policy if exists "Read own halloween claim" on public.halloween_claims;
create policy "Read own halloween claim"
  on public.halloween_claims for select
  to authenticated
  using (user_id = (select auth.uid()));

grant select on public.halloween_claims to authenticated;

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

  return new_total;
end;
$$;

revoke all on function public.claim_halloween(text, integer) from public, anon;
grant execute on function public.claim_halloween(text, integer) to authenticated;

-- Used only to move a claim that was stored on-device before the server claim
-- existed. It records the row without awarding points again.
create or replace function public.record_halloween_claim(
  choice text,
  point_value integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  claim_year integer := extract(year from current_date)::integer;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  if choice not in ('treat', 'trick') then
    raise exception 'Invalid Halloween choice' using errcode = '22023';
  end if;

  if point_value not in (0, 10, 20, 30) then
    raise exception 'Invalid Halloween points' using errcode = '22023';
  end if;

  insert into public.halloween_claims (user_id, year, choice, points)
  values (me, claim_year, choice, point_value)
  on conflict (user_id, year) do nothing;
end;
$$;

revoke all on function public.record_halloween_claim(text, integer)
  from public, anon;
grant execute on function public.record_halloween_claim(text, integer)
  to authenticated;
