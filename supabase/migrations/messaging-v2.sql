-- Messaging v2: conversations (direct + group chats) and image attachments.
-- Run this after messaging.sql.
--
-- Existing direct messages are migrated into direct conversations, so no chat
-- history is lost.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct'
    check (kind in ('direct', 'group')),
  title text
    check (title is null or char_length(pg_catalog.btrim(title)) between 1 and 80),
  direct_key text unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint conversations_shape check (
    (kind = 'direct' and direct_key is not null and title is null)
    or (kind = 'group' and direct_key is null and title is not null)
  )
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_user_idx
  on public.conversation_members (user_id);

alter table public.messages
  add column if not exists conversation_id uuid
    references public.conversations (id) on delete cascade;
alter table public.messages add column if not exists attachment_url text;
alter table public.messages add column if not exists attachment_type text;

-- Move the old direct-message rows into direct conversations.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'messages'
      and column_name = 'recipient_id'
  ) then
    insert into public.conversations (kind, direct_key, created_by, created_at)
    select
      'direct',
      pairs.pair,
      split_part(pairs.pair, ':', 1)::uuid,
      min(pairs.created_at)
    from (
      select
        least(sender_id, recipient_id)::text || ':' ||
          greatest(sender_id, recipient_id)::text as pair,
        created_at
      from public.messages
      where conversation_id is null
    ) as pairs
    group by pairs.pair
    on conflict (direct_key) do nothing;

    insert into public.conversation_members (conversation_id, user_id)
    select c.id, split_part(c.direct_key, ':', 1)::uuid
    from public.conversations c
    where c.kind = 'direct'
    on conflict do nothing;

    insert into public.conversation_members (conversation_id, user_id)
    select c.id, split_part(c.direct_key, ':', 2)::uuid
    from public.conversations c
    where c.kind = 'direct'
    on conflict do nothing;

    update public.messages m
    set conversation_id = c.id
    from public.conversations c
    where m.conversation_id is null
      and c.direct_key =
        least(m.sender_id, m.recipient_id)::text || ':' ||
        greatest(m.sender_id, m.recipient_id)::text;
  end if;
end
$$;

alter table public.messages alter column conversation_id set not null;

-- Direct chats start as read so the migration doesn't create a wall of unread.
update public.conversation_members
set last_read_at = now()
where last_read_at is null;

drop index if exists public.messages_conversation_idx;
drop index if exists public.messages_unread_idx;

drop policy if exists "Read own messages" on public.messages;
drop policy if exists "Send messages to friends" on public.messages;
drop policy if exists "Mark messages as read" on public.messages;

alter table public.messages drop constraint if exists messages_not_self;
alter table public.messages drop column if exists recipient_id;
alter table public.messages drop column if exists read_at;
alter table public.messages alter column body drop not null;

-- Remove any check constraint that still requires a non-empty body, whatever
-- name it was given in the base schema.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.messages'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%btrim(body)%'
  loop
    execute format(
      'alter table public.messages drop constraint %I',
      constraint_name
    );
  end loop;
end
$$;

alter table public.messages
  add constraint messages_body_check check (
    char_length(pg_catalog.btrim(coalesce(body, ''))) <= 2000
    and (
      char_length(pg_catalog.btrim(coalesce(body, ''))) > 0
      or attachment_url is not null
    )
  );
alter table public.messages
  add constraint messages_attachment_type_check check (
    attachment_type is null or attachment_type in ('image')
  );

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

create or replace function public.is_conversation_member(
  target_conversation uuid,
  target_user uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members m
    where m.conversation_id = target_conversation
      and m.user_id = target_user
  );
$$;

revoke all on function public.is_conversation_member(uuid, uuid)
  from public, anon;
grant execute on function public.is_conversation_member(uuid, uuid)
  to authenticated;

-- Opens (or reuses) the direct conversation with a friend.
create or replace function public.start_direct_conversation(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  pair_key text;
  conversation_id uuid;
begin
  if me is null then
    raise exception 'You must be signed in.';
  end if;
  if other_user = me then
    raise exception 'You cannot message yourself.';
  end if;
  if not public.are_friends(me, other_user) then
    raise exception 'You can only message friends.';
  end if;

  pair_key := least(me, other_user)::text || ':' || greatest(me, other_user)::text;

  insert into public.conversations (kind, direct_key, created_by)
  values ('direct', pair_key, me)
  on conflict (direct_key) do update set direct_key = excluded.direct_key
  returning id into conversation_id;

  insert into public.conversation_members (conversation_id, user_id)
  values (conversation_id, me), (conversation_id, other_user)
  on conflict do nothing;

  return conversation_id;
end
$$;

revoke all on function public.start_direct_conversation(uuid)
  from public, anon;
grant execute on function public.start_direct_conversation(uuid)
  to authenticated;

-- Creates a group and adds friends chosen by the creator.
create or replace function public.create_group_conversation(
  group_title text,
  member_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  conversation_id uuid;
  member uuid;
  clean_title text := pg_catalog.btrim(coalesce(group_title, ''));
begin
  if me is null then
    raise exception 'You must be signed in.';
  end if;
  if char_length(clean_title) < 1 or char_length(clean_title) > 80 then
    raise exception 'Give the group a name between 1 and 80 characters.';
  end if;

  insert into public.conversations (kind, title, created_by)
  values ('group', clean_title, me)
  returning id into conversation_id;

  insert into public.conversation_members (conversation_id, user_id)
  values (conversation_id, me)
  on conflict do nothing;

  foreach member in array coalesce(member_ids, array[]::uuid[]) loop
    if member <> me then
      if not public.are_friends(me, member) then
        raise exception 'You can only add friends to a group.';
      end if;
      insert into public.conversation_members (conversation_id, user_id)
      values (conversation_id, member)
      on conflict do nothing;
    end if;
  end loop;

  return conversation_id;
end
$$;

revoke all on function public.create_group_conversation(text, uuid[])
  from public, anon;
grant execute on function public.create_group_conversation(text, uuid[])
  to authenticated;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Read own conversations" on public.conversations;
create policy "Read own conversations"
  on public.conversations for select
  to authenticated
  using (public.is_conversation_member(id, (select auth.uid())));

drop policy if exists "Read conversation members" on public.conversation_members;
create policy "Read conversation members"
  on public.conversation_members for select
  to authenticated
  using (
    public.is_conversation_member(conversation_id, (select auth.uid()))
  );

drop policy if exists "Update own membership" on public.conversation_members;
create policy "Update own membership"
  on public.conversation_members for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Read conversation messages" on public.messages;
create policy "Read conversation messages"
  on public.messages for select
  to authenticated
  using (
    public.is_conversation_member(conversation_id, (select auth.uid()))
  );

drop policy if exists "Send conversation messages" on public.messages;
create policy "Send conversation messages"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_conversation_member(conversation_id, (select auth.uid()))
  );

grant select on public.conversations to authenticated;
grant select on public.conversation_members to authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;
grant select, insert on public.messages to authenticated;

alter table public.conversations replica identity full;
alter table public.conversation_members replica identity full;
alter table public.messages replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.conversation_members;
exception
  when duplicate_object then null;
end
$$;

-- Image attachments live in a public Storage bucket with unguessable paths.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images',
  'chat-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Chat images are publicly readable" on storage.objects;
create policy "Chat images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'chat-images');

drop policy if exists "Signed-in users can upload chat images" on storage.objects;
create policy "Signed-in users can upload chat images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-images');
