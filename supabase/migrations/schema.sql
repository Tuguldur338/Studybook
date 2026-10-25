create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Student'
    check (char_length(display_name) between 1 and 80),
  username text
    check (
      username is null
      or username ~ '^[a-z0-9][a-z0-9_-]{2,29}$'
    ),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null;

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  subject text not null
    check (char_length(pg_catalog.btrim(subject)) between 1 and 120),
  day smallint not null check (day between 0 and 4),
  start_time time not null,
  end_time time not null,
  location text not null default ''
    check (char_length(location) <= 120),
  instructor text not null default ''
    check (char_length(instructor) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index class_sessions_user_day_start_idx
  on public.class_sessions (user_id, day, start_time);

create table public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  title text not null
    check (char_length(pg_catalog.btrim(title)) between 1 and 240),
  course text not null default ''
    check (char_length(course) <= 120),
  due_date date,
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index study_tasks_user_due_date_idx
  on public.study_tasks (user_id, due_date)
  where completed = false;

create table public.study_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  title text not null
    check (char_length(pg_catalog.btrim(title)) between 1 and 160),
  content text not null default ''
    check (char_length(content) <= 50000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index study_notes_user_updated_at_idx
  on public.study_notes (user_id, updated_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger class_sessions_set_updated_at
  before update on public.class_sessions
  for each row execute function public.set_updated_at();

create trigger study_tasks_set_updated_at
  before update on public.study_tasks
  for each row execute function public.set_updated_at();

create trigger study_notes_set_updated_at
  before update on public.study_notes
  for each row execute function public.set_updated_at();

create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
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
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.create_profile_for_new_user()
  from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.class_sessions enable row level security;
alter table public.study_tasks enable row level security;
alter table public.study_notes enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can manage their own class sessions"
  on public.class_sessions for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can manage their own study tasks"
  on public.study_tasks for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can manage their own study notes"
  on public.study_notes for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select on public.profiles to authenticated;
grant update (display_name, username, avatar_url)
  on public.profiles to authenticated;

grant select, insert, update, delete
  on public.class_sessions, public.study_tasks, public.study_notes
  to authenticated;
