-- Friendships and direct messages for Studybook.
-- Run this after the base schema, then make sure Realtime is enabled for the
-- tables at the bottom of this file.

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id)
);

create unique index if not exists friendships_unique_pair
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

create index if not exists friendships_addressee_status_idx
  on public.friendships (addressee_id, status);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  body text not null
    check (char_length(pg_catalog.btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint messages_not_self check (sender_id <> recipient_id)
);

create index if not exists messages_conversation_idx
  on public.messages (sender_id, recipient_id, created_at desc);

create index if not exists messages_unread_idx
  on public.messages (recipient_id, created_at desc)
  where read_at is null;

create or replace function public.are_friends(
  first_user uuid,
  second_user uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = first_user and f.addressee_id = second_user)
        or (f.requester_id = second_user and f.addressee_id = first_user)
      )
  );
$$;

revoke all on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- Looks up exactly one account by email so the sender does not need to know
-- the other person's user id. Returns only public profile fields.
create or replace function public.find_user_by_email(target_email text)
returns table (id uuid, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.avatar_url
  from auth.users u
  join public.profiles p on p.id = u.id
  where pg_catalog.lower(u.email) = pg_catalog.lower(pg_catalog.btrim(target_email))
  limit 1;
$$;

revoke all on function public.find_user_by_email(text) from public, anon;
grant execute on function public.find_user_by_email(text) to authenticated;

alter table public.friendships enable row level security;
alter table public.messages enable row level security;

-- Lets realtime DELETE events carry enough data for subscribers to react.
alter table public.friendships replica identity full;
alter table public.messages replica identity full;

drop policy if exists "Read own friendships" on public.friendships;
create policy "Read own friendships"
  on public.friendships for select
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

drop policy if exists "Send friend requests" on public.friendships;
create policy "Send friend requests"
  on public.friendships for insert
  to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'pending'
  );

drop policy if exists "Respond to friend requests" on public.friendships;
create policy "Respond to friend requests"
  on public.friendships for update
  to authenticated
  using (addressee_id = (select auth.uid()))
  with check (
    addressee_id = (select auth.uid())
    and status in ('accepted', 'declined')
  );

drop policy if exists "Cancel own friend requests" on public.friendships;
drop policy if exists "Remove own friend requests" on public.friendships;
create policy "Remove own friend requests"
  on public.friendships for delete
  to authenticated
  using (
    (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()))
    and status = 'pending'
  );

drop policy if exists "Read own messages" on public.messages;
create policy "Read own messages"
  on public.messages for select
  to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));

drop policy if exists "Send messages to friends" on public.messages;
create policy "Send messages to friends"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.are_friends(sender_id, recipient_id)
  );

drop policy if exists "Mark messages as read" on public.messages;
create policy "Mark messages as read"
  on public.messages for update
  to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

grant select, insert, delete on public.friendships to authenticated;
grant update (status, responded_at) on public.friendships to authenticated;

grant select, insert on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

-- People can find each other by name in the messaging panel.
drop policy if exists "Authenticated users can view profiles"
  on public.profiles;
create policy "Authenticated users can view profiles"
  on public.profiles for select
  to authenticated
  using (true);

-- Live updates: new messages and friend requests.
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.friendships;
exception
  when duplicate_object then null;
end
$$;
