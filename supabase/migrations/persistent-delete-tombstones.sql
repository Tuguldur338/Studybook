-- Preserve deletions of schedule classes, saved classes, and notes across
-- snapshot merges so stale devices cannot restore removed entries.

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
  deleted_classes jsonb;
  deleted_saved_classes jsonb;
  deleted_notes jsonb;
  class_items jsonb;
  saved_class_items jsonb;
  note_items jsonb;
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

  deleted_classes := public.merge_studybook_object(
    case when current_data is null then null else current_data -> 'deletedClasses' end,
    p_data -> 'deletedClasses'
  );
  deleted_saved_classes := public.merge_studybook_object(
    case when current_data is null then null else current_data -> 'deletedSavedClasses' end,
    p_data -> 'deletedSavedClasses'
  );
  deleted_notes := public.merge_studybook_object(
    case when current_data is null then null else current_data -> 'deletedNotes' end,
    p_data -> 'deletedNotes'
  );

  select coalesce(
    pg_catalog.jsonb_agg(item.value order by item.value ->> 'id'),
    '[]'::jsonb
  )
  into class_items
  from pg_catalog.jsonb_array_elements(
    case when pg_catalog.jsonb_typeof(merged_data -> 'classes') = 'array'
      then merged_data -> 'classes' else '[]'::jsonb end
  ) as item(value)
  where not (deleted_classes ? (item.value ->> 'id'));

  select coalesce(
    pg_catalog.jsonb_agg(item.value order by item.value ->> 'id'),
    '[]'::jsonb
  )
  into saved_class_items
  from pg_catalog.jsonb_array_elements(
    case when pg_catalog.jsonb_typeof(merged_data -> 'savedClasses') = 'array'
      then merged_data -> 'savedClasses' else '[]'::jsonb end
  ) as item(value)
  where not (deleted_saved_classes ? (item.value ->> 'id'));

  select coalesce(
    pg_catalog.jsonb_agg(item.value order by item.value ->> 'id'),
    '[]'::jsonb
  )
  into note_items
  from pg_catalog.jsonb_array_elements(
    case when pg_catalog.jsonb_typeof(merged_data -> 'notes') = 'array'
      then merged_data -> 'notes' else '[]'::jsonb end
  ) as item(value)
  where not (deleted_notes ? (item.value ->> 'id'));

  merged_data := merged_data || pg_catalog.jsonb_build_object(
    'classes', class_items,
    'savedClasses', saved_class_items,
    'notes', note_items,
    'deletedClasses', deleted_classes,
    'deletedSavedClasses', deleted_saved_classes,
    'deletedNotes', deleted_notes
  );

  insert into public.studybook_snapshots (user_id, data)
  values (me, merged_data)
  on conflict (user_id) do update
  set data = excluded.data;

  return merged_data;
end;
$$;

revoke all on function public.merge_studybook_snapshot(jsonb)
  from public, anon;
grant execute on function public.merge_studybook_snapshot(jsonb)
  to authenticated;

notify pgrst, 'reload schema';
