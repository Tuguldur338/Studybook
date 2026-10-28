-- Chat customization: rename groups, add friends, and leave conversations.
-- Run after messaging.sql and messaging-v2.sql.

create or replace function public.rename_group(
  target_conversation uuid,
  new_title text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  clean_title text := pg_catalog.btrim(coalesce(new_title, ''));
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  if char_length(clean_title) < 1 or char_length(clean_title) > 80 then
    raise exception 'Group names are 1-80 characters.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.conversation_members m
    join public.conversations c on c.id = m.conversation_id
    where m.conversation_id = target_conversation
      and m.user_id = me
      and c.kind = 'group'
  ) then
    raise exception 'Only group members can rename this chat.' using errcode = '42501';
  end if;

  update public.conversations
     set title = clean_title
   where id = target_conversation;
end;
$$;

revoke all on function public.rename_group(uuid, text) from public, anon;
grant execute on function public.rename_group(uuid, text) to authenticated;

create or replace function public.add_group_members(
  target_conversation uuid,
  member_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  member uuid;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.conversation_members m
    join public.conversations c on c.id = m.conversation_id
    where m.conversation_id = target_conversation
      and m.user_id = me
      and c.kind = 'group'
  ) then
    raise exception 'Only group members can add people.' using errcode = '42501';
  end if;

  foreach member in array coalesce(member_ids, array[]::uuid[]) loop
    if member = me then
      continue;
    end if;
    if not public.are_friends(me, member) then
      raise exception 'You can only add friends to a group.' using errcode = '42501';
    end if;
    insert into public.conversation_members (conversation_id, user_id)
    values (target_conversation, member)
    on conflict do nothing;
  end loop;
end;
$$;

revoke all on function public.add_group_members(uuid, uuid[]) from public, anon;
grant execute on function public.add_group_members(uuid, uuid[]) to authenticated;

create or replace function public.leave_conversation(target_conversation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  remaining integer;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.conversation_members
    where conversation_id = target_conversation
      and user_id = me
  ) then
    raise exception 'You are not in this chat.' using errcode = '42501';
  end if;

  delete from public.conversation_members
  where conversation_id = target_conversation
    and user_id = me;

  select count(*) into remaining
  from public.conversation_members
  where conversation_id = target_conversation;

  if remaining = 0 then
    delete from public.conversations where id = target_conversation;
  end if;
end;
$$;

revoke all on function public.leave_conversation(uuid) from public, anon;
grant execute on function public.leave_conversation(uuid) to authenticated;
