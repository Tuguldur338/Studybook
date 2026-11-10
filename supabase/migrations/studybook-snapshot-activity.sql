select u.email, s.updated_at,
       jsonb_array_length(coalesce(s.data->'classes', '[]'::jsonb)) as classes,
       jsonb_array_length(coalesce(s.data->'tasks', '[]'::jsonb)) as tasks
from public.studybook_snapshots s
join auth.users u on u.id = s.user_id
order by s.updated_at desc;