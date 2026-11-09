-- Persistent celebration and exclusive border collection.
-- Run after sync.sql and monthly-borders.sql.

create table if not exists public.border_catalog (
  border_id text primary key
);

alter table public.border_catalog enable row level security;

insert into public.border_catalog (border_id)
select unnest(array[
  'exclusive-blackhole',
  'exclusive-sea',
  'exclusive-animal',
  'exclusive-war',
  'exclusive-gun',
  'celebration-newyear',
  'celebration-constitution',
  'celebration-tsagaansar',
  'celebration-womensday',
  'celebration-soldiersday',
  'celebration-childrensday',
  'celebration-naadam',
  'celebration-halloween',
  'celebration-genghis',
  'celebration-republic',
  'celebration-christmas',
  'celebration-independence',
  'celebration-newyearseve'
])
on conflict (border_id) do nothing;

insert into public.border_catalog (border_id)
select 'champion-style-' || lpad(month_number::text, 2, '0')
from generate_series(1, 12) as months(month_number)
on conflict (border_id) do nothing;

create table if not exists public.profile_owned_borders (
  user_id uuid not null references auth.users (id) on delete cascade,
  border_id text not null references public.border_catalog (border_id),
  source text not null check (source in ('daily', 'task', 'celebration', 'admin')),
  earned_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, border_id)
);

alter table public.profile_owned_borders enable row level security;

drop policy if exists "Read own earned collection borders"
  on public.profile_owned_borders;
create policy "Read own earned collection borders"
  on public.profile_owned_borders for select
  to authenticated
  using (user_id = (select auth.uid()));

grant select on public.profile_owned_borders to authenticated;

create table if not exists public.profile_border_all_access (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default timezone('utc', now())
);

alter table public.profile_border_all_access enable row level security;

create table if not exists public.border_drop_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  event_key text not null,
  attempted_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, event_key)
);

alter table public.border_drop_attempts enable row level security;

create or replace function public.grant_all_borders(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_user_id is null then
    raise exception 'A target user is required' using errcode = '22023';
  end if;

  insert into public.profile_border_all_access (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.grant_all_borders(uuid) from public, anon, authenticated;
grant execute on function public.grant_all_borders(uuid) to service_role;

drop function if exists public.get_my_borders();

create function public.get_my_borders()
returns table (border_id text)
language sql
security definer
set search_path = ''
stable
as $$
  select owned.border_id
  from public.profile_owned_borders owned
  where owned.user_id = auth.uid()

  union

  select catalog.border_id
  from public.border_catalog catalog
  where exists (
    select 1
    from public.profile_border_all_access access
    where access.user_id = auth.uid()
  )

  union

  select 'champion-' || to_char(earned.month_start, 'YYYY-MM')
  from public.profile_borders earned
  where earned.user_id = auth.uid();
$$;

revoke all on function public.get_my_borders() from public, anon;
grant execute on function public.get_my_borders() to authenticated;

create or replace function public.roll_border_drop(
  p_source text,
  p_reference text default null
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  v_event_key text;
  exclusive_border text;
  celebration_border text;
  chosen_borders text[] := array[]::text[];
  awarded_borders text[] := array[]::text[];
  roll double precision;
  task_list jsonb;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  if p_source = 'daily' then
    if p_reference is not null then
      raise exception 'Daily drops do not accept a reference' using errcode = '22023';
    end if;
    v_event_key := 'daily:' || current_date::text;
  elsif p_source = 'task' then
    if p_reference is null or length(p_reference) > 80 then
      raise exception 'Invalid task reference' using errcode = '22023';
    end if;

    select case
      when jsonb_typeof(snapshot.data -> 'tasks') = 'array'
        then snapshot.data -> 'tasks'
      else '[]'::jsonb
    end
    into task_list
    from public.studybook_snapshots snapshot
    where snapshot.user_id = me;

    if not exists (
      select 1
      from jsonb_array_elements(coalesce(task_list, '[]'::jsonb)) task
      where task ->> 'id' = p_reference
        and task ->> 'completed' = 'true'
    ) then
      raise exception 'Task must be synced as completed before its border roll'
        using errcode = '22023';
    end if;
    v_event_key := 'task:' || p_reference;
  elsif p_source = 'celebration' then
    if p_reference not in (
      'newyear',
      'constitution',
      'tsagaansar',
      'womensday',
      'soldiersday',
      'childrensday',
      'naadam',
      'halloween',
      'genghis',
      'republic',
      'christmas',
      'independence',
      'newyearseve'
    ) then
      raise exception 'Invalid celebration border' using errcode = '22023';
    end if;

    if not (
      case p_reference
      when 'newyear' then (
        extract(month from current_date)::integer = 1
        and extract(day from current_date)::integer in (1, 2)
      ) or (
        extract(month from current_date)::integer = 12
        and extract(day from current_date)::integer = 31
      )
      when 'constitution' then current_date between
        make_date(extract(year from current_date)::integer, 1, 13) - 1
        and make_date(extract(year from current_date)::integer, 1, 13) + 1
      when 'tsagaansar' then current_date in (
        date '2025-02-28', date '2025-03-01', date '2025-03-02',
        date '2026-02-16', date '2026-02-17', date '2026-02-18',
        date '2027-02-05', date '2027-02-06', date '2027-02-07'
      )
      when 'womensday' then current_date between
        make_date(extract(year from current_date)::integer, 3, 8) - 1
        and make_date(extract(year from current_date)::integer, 3, 8) + 1
      when 'soldiersday' then current_date between
        make_date(extract(year from current_date)::integer, 3, 18) - 1
        and make_date(extract(year from current_date)::integer, 3, 18) + 1
      when 'childrensday' then current_date between
        make_date(extract(year from current_date)::integer, 6, 1) - 1
        and make_date(extract(year from current_date)::integer, 6, 1) + 1
      when 'naadam' then current_date between
        make_date(extract(year from current_date)::integer, 7, 10)
        and make_date(extract(year from current_date)::integer, 7, 16)
      when 'halloween' then current_date between
        make_date(extract(year from current_date)::integer, 10, 31) - 1
        and make_date(extract(year from current_date)::integer, 10, 31) + 1
      when 'genghis' then current_date between
        make_date(extract(year from current_date)::integer, 11, 14) - 1
        and make_date(extract(year from current_date)::integer, 11, 14) + 1
      when 'republic' then current_date between
        make_date(extract(year from current_date)::integer, 11, 26) - 1
        and make_date(extract(year from current_date)::integer, 11, 26) + 1
      when 'christmas' then current_date between
        make_date(extract(year from current_date)::integer, 12, 25) - 1
        and make_date(extract(year from current_date)::integer, 12, 25) + 1
      when 'independence' then current_date between
        make_date(extract(year from current_date)::integer, 12, 29) - 1
        and make_date(extract(year from current_date)::integer, 12, 29) + 1
      when 'newyearseve' then (
        extract(month from current_date)::integer = 12
        and extract(day from current_date)::integer between 30 and 31
      ) or (
        extract(month from current_date)::integer = 1
        and extract(day from current_date)::integer = 1
      )
        else false
      end
    ) then
      raise exception 'This celebration is not active today' using errcode = '22023';
    end if;

    v_event_key := 'celebration:' || p_reference || ':' ||
      extract(year from current_date)::integer::text;
  else
    raise exception 'Invalid border drop source' using errcode = '22023';
  end if;

  insert into public.border_drop_attempts (user_id, event_key)
  values (me, v_event_key)
  on conflict (user_id, event_key) do nothing;

  if not found then
    return awarded_borders;
  end if;

  select catalog.border_id
  into exclusive_border
  from public.border_catalog catalog
  where catalog.border_id like 'exclusive-%'
    and not exists (
      select 1
      from public.profile_owned_borders owned
      where owned.user_id = me
        and owned.border_id = catalog.border_id
    )
    and not exists (
      select 1
      from public.profile_border_all_access access
      where access.user_id = me
    )
  order by pg_catalog.random()
  limit 1;

  if p_source = 'daily' then
    if pg_catalog.random() < 0.05 and exclusive_border is not null then
      chosen_borders := array[exclusive_border];
    end if;
  elsif p_source = 'task' then
    if pg_catalog.random() < 0.01 and exclusive_border is not null then
      chosen_borders := array[exclusive_border];
    end if;
  else
    celebration_border := 'celebration-' || p_reference;
    roll := pg_catalog.random();
    if roll < 0.02 then
      chosen_borders := array[exclusive_border, celebration_border];
    elsif pg_catalog.random() < 0.40 then
      chosen_borders := array[exclusive_border];
    else
      chosen_borders := array[celebration_border];
    end if;
  end if;

  foreach exclusive_border in array chosen_borders loop
    if exclusive_border is null then
      continue;
    end if;

    insert into public.profile_owned_borders (user_id, border_id, source)
    values (me, exclusive_border, p_source)
    on conflict (user_id, border_id) do nothing;

    if found then
      awarded_borders := array_append(awarded_borders, exclusive_border);
    end if;
  end loop;

  return awarded_borders;
end;
$$;

revoke all on function public.roll_border_drop(text, text) from public, anon;
grant execute on function public.roll_border_drop(text, text) to authenticated;

create or replace function public.validate_equipped_border()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.equipped_border is null then
    return new;
  end if;

  if exists (
    select 1
    from public.profile_owned_borders owned
    where owned.user_id = new.id
      and owned.border_id = new.equipped_border
  ) or exists (
    select 1
    from public.profile_border_all_access access
    join public.border_catalog catalog on true
    where access.user_id = new.id
      and catalog.border_id = new.equipped_border
  ) or (
    new.equipped_border ~ '^champion-[0-9]{4}-(0[1-9]|1[0-2])$'
    and exists (
      select 1
      from public.profile_borders earned
      where earned.user_id = new.id
        and to_char(earned.month_start, 'YYYY-MM') =
          substring(new.equipped_border from 10)
    )
  ) then
    return new;
  end if;

  raise exception 'You do not own this border' using errcode = '42501';
end;
$$;

drop trigger if exists profiles_validate_equipped_border on public.profiles;
create trigger profiles_validate_equipped_border
  before update of equipped_border on public.profiles
  for each row
  when (new.equipped_border is distinct from old.equipped_border)
  execute function public.validate_equipped_border();

notify pgrst, 'reload schema';
