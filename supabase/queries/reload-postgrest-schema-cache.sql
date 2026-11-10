-- Manual cache refresh; keep outside supabase/migrations so db push won't apply it.
notify pgrst, 'reload schema';
