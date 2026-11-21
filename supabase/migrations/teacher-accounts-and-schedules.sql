-- Teacher accounts and signed-in teacher timetable pages.
-- Run after usernames.sql.

alter table public.profiles
  add column if not exists account_type text not null default 'student';

alter table public.profiles
  drop constraint if exists profiles_account_type_check;

alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('student', 'teacher'));

revoke update (account_type)
  on public.profiles from public, anon, authenticated;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  handle text;
  selected_account_type text;
begin
  handle := nullif(
    pg_catalog.lower(
      pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'username', ''))
    ),
    ''
  );

  if handle is not null and handle !~ '^[a-z0-9][a-z0-9_-]{2,29}$' then
    handle := null;
  end if;

  selected_account_type := case
    when new.raw_user_meta_data ->> 'account_type' = 'teacher' then 'teacher'
    else 'student'
  end;

  insert into public.profiles (id, display_name, username, account_type)
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
    handle,
    selected_account_type
  )
  on conflict (id) do nothing;

  return new;
end
$$;

create index if not exists profiles_teacher_directory_idx
  on public.profiles (display_name, username)
  where account_type = 'teacher' and username is not null;

create table if not exists public.teacher_schedule_entries (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  class_title text not null
    check (char_length(pg_catalog.btrim(class_title)) between 1 and 40),
  day smallint not null check (day between 0 and 4),
  start_time time not null,
  end_time time not null,
  location text not null default ''
    check (char_length(location) <= 120),
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists teacher_schedule_entries_teacher_day_idx
  on public.teacher_schedule_entries (teacher_id, day, start_time);

alter table public.teacher_schedule_entries enable row level security;

drop policy if exists "Signed-in users can read teacher schedules"
  on public.teacher_schedule_entries;
create policy "Signed-in users can read teacher schedules"
  on public.teacher_schedule_entries for select
  to authenticated
  using (true);

drop policy if exists "Teachers can add their own schedule entries"
  on public.teacher_schedule_entries;
create policy "Teachers can add their own schedule entries"
  on public.teacher_schedule_entries for insert
  to authenticated
  with check (
    teacher_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.account_type = 'teacher'
    )
  );

drop policy if exists "Teachers can update their own schedule entries"
  on public.teacher_schedule_entries;
create policy "Teachers can update their own schedule entries"
  on public.teacher_schedule_entries for update
  to authenticated
  using (
    teacher_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.account_type = 'teacher'
    )
  )
  with check (
    teacher_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.account_type = 'teacher'
    )
  );

drop policy if exists "Teachers can delete their own schedule entries"
  on public.teacher_schedule_entries;
create policy "Teachers can delete their own schedule entries"
  on public.teacher_schedule_entries for delete
  to authenticated
  using (
    teacher_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.account_type = 'teacher'
    )
  );

grant select, insert, update, delete
  on public.teacher_schedule_entries to authenticated;

create or replace function public.list_teachers()
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from public.profiles p
  where auth.uid() is not null
    and p.account_type = 'teacher'
    and p.username is not null
  order by p.display_name, p.username;
$$;

revoke all on function public.list_teachers() from public, anon;
grant execute on function public.list_teachers() to authenticated;
