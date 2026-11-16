-- Persist completed checklist occurrences and the 50-completion achievement
-- on the user's account so the progress is shared across devices.
-- Run after task-history-and-sync.sql.

create table if not exists public.profile_completion_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  event_key text not null check (char_length(event_key) between 1 and 320),
  source text not null check (source in ('todo', 'routine', 'schedule')),
  completed_at timestamptz not null default now(),
  primary key (user_id, event_key)
);

create index if not exists profile_completion_events_user_time_idx
  on public.profile_completion_events (user_id, completed_at, event_key);

alter table public.profile_completion_events enable row level security;

drop policy if exists "Read own completion events"
  on public.profile_completion_events;
create policy "Read own completion events"
  on public.profile_completion_events for select
  to authenticated
  using (user_id = (select auth.uid()));

grant select on public.profile_completion_events to authenticated;

create table if not exists public.profile_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null
    check (achievement_id in ('task_completion_50')),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.profile_achievements enable row level security;

drop policy if exists "Read own achievements" on public.profile_achievements;
create policy "Read own achievements"
  on public.profile_achievements for select
  to authenticated
  using (user_id = (select auth.uid()));

grant select on public.profile_achievements to authenticated;

create or replace function public.record_completion_event(
  p_event_key text,
  p_source text
)
returns table (
  completion_count bigint,
  achievement_unlocked text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  v_count bigint;
  v_unlocked text;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_event_key is null
    or char_length(p_event_key) < 1
    or char_length(p_event_key) > 320
    or p_source is null
    or p_source not in ('todo', 'routine', 'schedule')
  then
    raise exception 'Invalid completion event' using errcode = '22023';
  end if;

  insert into public.profile_completion_events (user_id, event_key, source)
  values (me, p_event_key, p_source)
  on conflict (user_id, event_key) do nothing;

  select count(*)
  into v_count
  from public.profile_completion_events
  where user_id = me;

  if v_count >= 50 then
    insert into public.profile_achievements (user_id, achievement_id)
    values (me, 'task_completion_50')
    on conflict (user_id, achievement_id) do nothing;
    if found then
      v_unlocked := 'task_completion_50';
    end if;
  end if;

  return query select v_count, v_unlocked;
end;
$$;

revoke all on function public.record_completion_event(text, text)
  from public, anon;
grant execute on function public.record_completion_event(text, text)
  to authenticated;

create or replace function public.record_task_completion_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profile_completion_events (
    user_id,
    event_key,
    source,
    completed_at
  )
  values (
    new.user_id,
    'todo:' || new.task_id,
    'todo',
    new.completed_at
  )
  on conflict (user_id, event_key) do nothing;
  return new;
end;
$$;

revoke all on function public.record_task_completion_event()
  from public, anon, authenticated;

drop trigger if exists profile_completed_task_progress
  on public.profile_completed_tasks;
create trigger profile_completed_task_progress
  after insert on public.profile_completed_tasks
  for each row execute function public.record_task_completion_event();

insert into public.profile_completion_events (
  user_id,
  event_key,
  source,
  completed_at
)
select
  user_id,
  'todo:' || task_id,
  'todo',
  completed_at
from public.profile_completed_tasks
on conflict (user_id, event_key) do nothing;

insert into public.profile_completion_events (
  user_id,
  event_key,
  source,
  completed_at
)
select
  snapshot.user_id,
  'routine:' || check_entry.key,
  'routine',
  now()
from public.studybook_snapshots snapshot
cross join lateral pg_catalog.jsonb_each(
  case
    when pg_catalog.jsonb_typeof(snapshot.data -> 'routineChecks') = 'object'
      then snapshot.data -> 'routineChecks'
    else '{}'::jsonb
  end
) as check_entry
where check_entry.value = 'true'::jsonb
on conflict (user_id, event_key) do nothing;

insert into public.profile_completion_events (
  user_id,
  event_key,
  source,
  completed_at
)
select
  snapshot.user_id,
  'schedule:' || week_entry.key || ':' || completion_entry.key,
  'schedule',
  now()
from public.studybook_snapshots snapshot
cross join lateral pg_catalog.jsonb_each(
  case
    when pg_catalog.jsonb_typeof(snapshot.data -> 'classChecks') = 'object'
      then snapshot.data -> 'classChecks'
    else '{}'::jsonb
  end
) as week_entry
cross join lateral pg_catalog.jsonb_each(
  case
    when pg_catalog.jsonb_typeof(week_entry.value) = 'object'
      then week_entry.value
    else '{}'::jsonb
  end
) as completion_entry
where completion_entry.key in ('classwork', 'homework')
  and completion_entry.value = 'true'::jsonb
on conflict (user_id, event_key) do nothing;

with ranked_completions as (
  select
    user_id,
    completed_at,
    row_number() over (
      partition by user_id
      order by completed_at, event_key
    ) as completion_number
  from public.profile_completion_events
)
insert into public.profile_achievements (
  user_id,
  achievement_id,
  unlocked_at
)
select user_id, 'task_completion_50', completed_at
from ranked_completions
where completion_number = 50
on conflict (user_id, achievement_id) do nothing;

create or replace function public.get_profile_achievement_summary(
  p_profile_id uuid
)
returns table (
  completion_count bigint,
  achievements text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  v_count bigint;
  v_achievements text[];
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_profile_id is null
    or (
      p_profile_id <> me
      and not public.are_friends(me, p_profile_id)
    )
  then
    raise exception 'Profile is not available' using errcode = '42501';
  end if;

  select count(*)
  into v_count
  from public.profile_completion_events
  where user_id = p_profile_id;

  select coalesce(
    pg_catalog.array_agg(achievement_id order by achievement_id),
    array[]::text[]
  )
  into v_achievements
  from public.profile_achievements
  where user_id = p_profile_id;

  return query select v_count, v_achievements;
end;
$$;

revoke all on function public.get_profile_achievement_summary(uuid)
  from public, anon;
grant execute on function public.get_profile_achievement_summary(uuid)
  to authenticated;

notify pgrst, 'reload schema';
