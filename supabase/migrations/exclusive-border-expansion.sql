-- Add individually styled exclusive borders to existing collections.
-- Run after border-drops.sql and task-history-and-sync.sql.

insert into public.border_catalog (border_id)
select unnest(array[
  'exclusive-sun',
  'exclusive-angel',
  'exclusive-nature',
  'exclusive-dragon',
  'exclusive-phoenix',
  'exclusive-ice',
  'exclusive-lightning',
  'exclusive-fire',
  'exclusive-crystal',
  'exclusive-galaxy',
  'exclusive-shadow',
  'exclusive-royal',
  'exclusive-cyber',
  'exclusive-storm',
  'exclusive-desert',
  'exclusive-music',
  'exclusive-time',
  'exclusive-rainbow'
])
on conflict (border_id) do nothing;

notify pgrst, 'reload schema';
