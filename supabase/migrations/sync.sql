-- Cross-device Studybook data.
--
-- The whole browser studybook (classes, checks, saved classes, tasks, notes,
-- exams, routine, and the profile picture) is stored as one private JSON
-- snapshot per account. Theme, fonts, music, and widget preferences stay on
-- the device.

create table if not exists public.studybook_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.studybook_snapshots enable row level security;

drop policy if exists "Users can manage their own studybook snapshot"
  on public.studybook_snapshots;

create policy "Users can manage their own studybook snapshot"
  on public.studybook_snapshots for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop trigger if exists studybook_snapshots_set_updated_at
  on public.studybook_snapshots;

create trigger studybook_snapshots_set_updated_at
  before update on public.studybook_snapshots
  for each row execute function public.set_updated_at();

grant select, insert, update, delete
  on public.studybook_snapshots to authenticated;
