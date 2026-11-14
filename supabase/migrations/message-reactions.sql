create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null check (
    char_length(emoji) between 1 and 64
    and char_length(btrim(emoji)) > 0
  ),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

alter table public.message_reactions enable row level security;

drop policy if exists "Read reactions in own conversations"
  on public.message_reactions;
create policy "Read reactions in own conversations"
  on public.message_reactions for select
  to authenticated
  using (
    exists (
      select 1
      from public.messages m
      where m.id = message_reactions.message_id
        and public.is_conversation_member(m.conversation_id, (select auth.uid()))
    )
  );

drop policy if exists "React to other members' messages"
  on public.message_reactions;
create policy "React to other members' messages"
  on public.message_reactions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.messages m
      where m.id = message_reactions.message_id
        and m.sender_id <> (select auth.uid())
        and public.is_conversation_member(m.conversation_id, (select auth.uid()))
    )
  );

drop policy if exists "Delete own reactions"
  on public.message_reactions;
create policy "Delete own reactions"
  on public.message_reactions for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.messages m
      where m.id = message_reactions.message_id
        and public.is_conversation_member(m.conversation_id, (select auth.uid()))
    )
  );

grant select, insert, delete on public.message_reactions to authenticated;

alter table public.message_reactions replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.message_reactions;
exception
  when duplicate_object then null;
end
$$;
