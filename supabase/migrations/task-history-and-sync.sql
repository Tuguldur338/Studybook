-- Keep completed tasks independently of the editable to-do list and merge
-- cross-device snapshots while holding a per-user transaction lock.
-- Run after sync.sql and border-drops.sql.

create table if not exists public.profile_completed_tasks (
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id text not null,
  title text not null,
  course text not null default '',
  due_date text not null default '',
  priority text not null check (priority in ('low', 'medium', 'high')),
  completed_late boolean not null default false,
  completed_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, task_id)
);

alter table public.profile_completed_tasks enable row level security;

drop policy if exists "Read own completed task history"
  on public.profile_completed_tasks;
create policy "Read own completed task history"
  on public.profile_completed_tasks for select
  to authenticated
  using (user_id = (select auth.uid()));

grant select on public.profile_completed_tasks to authenticated;

insert into public.profile_completed_tasks (
  user_id,
  task_id,
  title,
  course,
  due_date,
  priority,
  completed_late
)
select
  snapshot.user_id,
  task.value ->> 'id',
  task.value ->> 'title',
  coalesce(task.value ->> 'course', ''),
  coalesce(task.value ->> 'dueDate', ''),
  task.value ->> 'priority',
  coalesce((task.value ->> 'completedLate')::boolean, false)
from public.studybook_snapshots snapshot
cross join lateral pg_catalog.jsonb_array_elements(
  case
    when pg_catalog.jsonb_typeof(snapshot.data -> 'tasks') = 'array'
      then snapshot.data -> 'tasks'
    else '[]'::jsonb
  end
) as task(value)
where task.value ->> 'completed' = 'true'
  and task.value ->> 'id' is not null
  and task.value ->> 'title' is not null
  and task.value ->> 'priority' in ('low', 'medium', 'high')
on conflict (user_id, task_id) do nothing;

create or replace function public.record_completed_task(
  p_task_id text,
  p_title text,
  p_course text,
  p_due_date text,
  p_priority text,
  p_completed_late boolean,
  p_completed_at timestamptz
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  inserted_count integer;
  awarded_border text;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  if p_task_id is null or length(p_task_id) = 0 or length(p_task_id) > 160
    or p_title is null or length(p_title) = 0 or length(p_title) > 500
    or p_course is null or length(p_course) > 200
    or p_due_date is null or length(p_due_date) > 32
    or p_priority not in ('low', 'medium', 'high')
    or p_completed_at is null
  then
    raise exception 'Invalid completed task details' using errcode = '22023';
  end if;

  insert into public.profile_completed_tasks (
    user_id,
    task_id,
    title,
    course,
    due_date,
    priority,
    completed_late,
    completed_at
  )
  values (
    me,
    p_task_id,
    p_title,
    p_course,
    p_due_date,
    p_priority,
    coalesce(p_completed_late, false),
    p_completed_at
  )
  on conflict (user_id, task_id) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    return array[]::text[];
  end if;

  if pg_catalog.random() >= 0.40 or exists (
    select 1
    from public.profile_border_all_access access
    where access.user_id = me
  ) then
    return array[]::text[];
  end if;

  select catalog.border_id
  into awarded_border
  from public.border_catalog catalog
  where not exists (
      select 1
      from public.profile_owned_borders owned
      where owned.user_id = me
        and owned.border_id = catalog.border_id
    )
  order by pg_catalog.random()
  limit 1;

  if awarded_border is null then
    return array[]::text[];
  end if;

  insert into public.profile_owned_borders (user_id, border_id, source)
  values (me, awarded_border, 'task')
  on conflict (user_id, border_id) do nothing;

  if not found then
    return array[]::text[];
  end if;

  return array[awarded_border];
end;
$$;

revoke all on function public.record_completed_task(
  text, text, text, text, text, boolean, timestamptz
) from public, anon;
grant execute on function public.record_completed_task(
  text, text, text, text, text, boolean, timestamptz
) to authenticated;

create or replace function public.merge_studybook_array(
  p_cloud jsonb,
  p_incoming jsonb,
  p_mode text
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  items jsonb := '{}'::jsonb;
  item jsonb;
  existing jsonb;
  item_key text;
  old_time text;
  new_time text;
begin
  for item in
    select value
    from pg_catalog.jsonb_array_elements(
      case when pg_catalog.jsonb_typeof(p_cloud) = 'array'
        then p_cloud else '[]'::jsonb end
    )
  loop
    item_key := case p_mode
      when 'saved' then pg_catalog.concat_ws(
        '|', item ->> 'subject', item ->> 'day', item ->> 'startTime',
        item ->> 'endTime', item ->> 'location', item ->> 'instructor'
      )
      else item ->> 'id'
    end;
    if item_key is not null then
      items := items || pg_catalog.jsonb_build_object(item_key, item);
    end if;
  end loop;

  for item in
    select value
    from pg_catalog.jsonb_array_elements(
      case when pg_catalog.jsonb_typeof(p_incoming) = 'array'
        then p_incoming else '[]'::jsonb end
    )
  loop
    item_key := case p_mode
      when 'saved' then pg_catalog.concat_ws(
        '|', item ->> 'subject', item ->> 'day', item ->> 'startTime',
        item ->> 'endTime', item ->> 'location', item ->> 'instructor'
      )
      else item ->> 'id'
    end;
    if item_key is null then
      continue;
    end if;

    existing := items -> item_key;
    if existing is null or p_mode not in ('task', 'updated') then
      items := items || pg_catalog.jsonb_build_object(item_key, item);
      continue;
    end if;

    old_time := nullif(existing ->> 'updatedAt', '');
    new_time := nullif(item ->> 'updatedAt', '');
    if old_time is null and new_time is null then
      if p_mode = 'updated'
        or (item ->> 'completed' = 'true'
          and existing ->> 'completed' is distinct from 'true')
      then
        items := items || pg_catalog.jsonb_build_object(item_key, item);
      end if;
    elsif old_time is null or (new_time is not null and new_time >= old_time) then
      items := items || pg_catalog.jsonb_build_object(item_key, item);
    end if;
  end loop;

  return coalesce(
    (select pg_catalog.jsonb_agg(value order by key)
      from pg_catalog.jsonb_each(items)),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.merge_studybook_object(
  p_cloud jsonb,
  p_incoming jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  items jsonb := case
    when pg_catalog.jsonb_typeof(p_cloud) = 'object' then p_cloud
    else '{}'::jsonb
  end;
  entry record;
  previous_value text;
  incoming_value text;
begin
  for entry in
    select key, value
    from pg_catalog.jsonb_each(
      case when pg_catalog.jsonb_typeof(p_incoming) = 'object'
        then p_incoming else '{}'::jsonb end
    )
  loop
    previous_value := items ->> entry.key;
    incoming_value := entry.value #>> '{}';
    if previous_value is null or incoming_value >= previous_value then
      items := items || pg_catalog.jsonb_build_object(entry.key, entry.value);
    end if;
  end loop;
  return items;
end;
$$;

create or replace function public.merge_studybook_data(
  p_cloud jsonb,
  p_incoming jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  cloud jsonb := case
    when pg_catalog.jsonb_typeof(p_cloud) = 'object' then p_cloud
    else '{}'::jsonb
  end;
  incoming jsonb := case
    when pg_catalog.jsonb_typeof(p_incoming) = 'object' then p_incoming
    else '{}'::jsonb
  end;
  deleted_tasks jsonb;
  deleted_exams jsonb;
  deleted_tracks jsonb;
  task_items jsonb;
  exam_items jsonb;
  music_tracks jsonb;
  music jsonb;
begin
  deleted_tasks := public.merge_studybook_object(
    cloud -> 'deletedTasks', incoming -> 'deletedTasks'
  );
  deleted_exams := public.merge_studybook_object(
    cloud -> 'deletedExams', incoming -> 'deletedExams'
  );

  task_items := public.merge_studybook_array(
    cloud -> 'tasks', incoming -> 'tasks', 'task'
  );
  select coalesce(
    pg_catalog.jsonb_agg(item.value order by item.value ->> 'id'),
    '[]'::jsonb
  )
  into task_items
  from pg_catalog.jsonb_array_elements(task_items) as item(value)
  where not (deleted_tasks ? (item.value ->> 'id'));

  exam_items := public.merge_studybook_array(
    cloud -> 'exams', incoming -> 'exams', 'id'
  );
  select coalesce(
    pg_catalog.jsonb_agg(item.value order by item.value ->> 'id'),
    '[]'::jsonb
  )
  into exam_items
  from pg_catalog.jsonb_array_elements(exam_items) as item(value)
  where not (deleted_exams ? (item.value ->> 'id'));

  deleted_tracks := public.merge_studybook_object(
    cloud #> '{music,deletedTracks}', incoming #> '{music,deletedTracks}'
  );
  music := case
    when pg_catalog.jsonb_typeof(incoming -> 'music') = 'object'
      then coalesce(cloud -> 'music', '{}'::jsonb) || (incoming -> 'music')
    else coalesce(cloud -> 'music', 'null'::jsonb)
  end;
  if pg_catalog.jsonb_typeof(music) = 'object' then
    select coalesce(
      pg_catalog.jsonb_agg(item.value order by item.value ->> 'id'),
      '[]'::jsonb
    )
    into music_tracks
    from pg_catalog.jsonb_array_elements(
      public.merge_studybook_array(
        cloud #> '{music,tracks}', incoming #> '{music,tracks}', 'id'
      )
    ) as item(value)
    where not (deleted_tracks ? (item.value ->> 'id'));
    music := music || pg_catalog.jsonb_build_object(
      'tracks', music_tracks,
      'deletedTracks', deleted_tracks
    );
  end if;

  return cloud || incoming || pg_catalog.jsonb_build_object(
    'classes', public.merge_studybook_array(
      cloud -> 'classes', incoming -> 'classes', 'id'
    ),
    'classChecks', coalesce(cloud -> 'classChecks', '{}'::jsonb) ||
      coalesce(incoming -> 'classChecks', '{}'::jsonb),
    'savedClasses', public.merge_studybook_array(
      cloud -> 'savedClasses', incoming -> 'savedClasses', 'saved'
    ),
    'tasks', task_items,
    'deletedTasks', deleted_tasks,
    'notes', public.merge_studybook_array(
      cloud -> 'notes', incoming -> 'notes', 'updated'
    ),
    'exams', exam_items,
    'deletedExams', deleted_exams,
    'routine', public.merge_studybook_array(
      cloud -> 'routine', incoming -> 'routine', 'id'
    ),
    'routineChecks', coalesce(cloud -> 'routineChecks', '{}'::jsonb) ||
      coalesce(incoming -> 'routineChecks', '{}'::jsonb),
    'profileAvatar', coalesce(
      nullif(incoming ->> 'profileAvatar', ''),
      cloud ->> 'profileAvatar',
      ''
    ),
    'music', music
  );
end;
$$;

create or replace function public.merge_studybook_snapshot(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  current_data jsonb;
  merged_data jsonb;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if pg_catalog.jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'Snapshot data must be an object' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(me::text, 0)
  );

  select snapshot.data
  into current_data
  from public.studybook_snapshots snapshot
  where snapshot.user_id = me
  for update;

  merged_data := case
    when current_data is null then p_data
    else public.merge_studybook_data(current_data, p_data)
  end;

  insert into public.studybook_snapshots (user_id, data)
  values (me, merged_data)
  on conflict (user_id) do update
  set data = excluded.data;

  return merged_data;
end;
$$;

revoke all on function public.merge_studybook_array(jsonb, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.merge_studybook_object(jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.merge_studybook_data(jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.merge_studybook_snapshot(jsonb)
  from public, anon;
grant execute on function public.merge_studybook_snapshot(jsonb)
  to authenticated;

notify pgrst, 'reload schema';
