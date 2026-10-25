# Supabase database setup

This migration creates the Studybook tables for profiles, weekly classes, to-do
items, and notes:

- `profiles` stores a display name, optional username, and avatar URL. A profile
  is created automatically when a Supabase Auth user signs up. Email addresses
  and passwords remain in Supabase Auth rather than being copied into this
  table.
- `class_sessions` stores weekday classes. `day` uses `0` for Monday through
  `4` for Friday, matching the current schedule form.
- `study_tasks` stores tasks, due dates, priorities, and completion state.
- `study_notes` stores notes and their content.

Each user's rows are protected by row-level security (RLS). The profile policies
allow users to read and update their own profile; the other tables allow
authenticated users to manage only their own rows.

## Apply the migration

With the Supabase CLI linked to your project, run this from the repository root:

```bash
supabase db push
```

Alternatively, copy
[`migrations/20261025093000_create_studybook_schema.sql`](./migrations/20261025093000_create_studybook_schema.sql)
into the Supabase Dashboard SQL Editor and run it against your project.

This creates the database schema only. The Studybook app still needs Supabase
project credentials, a Supabase client, and authentication/data-access code
before the sign-in form or browser-stored data will use these tables. Avatar
storage also needs a Storage bucket and its own access policies; `avatar_url`
stores the resulting image URL.

## Configure local app credentials

Copy the repository's `.env.example` to `.env.local`, then fill in the project
URL and publishable key from your Supabase project's API settings:

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Next.js loads `.env.local` for local development. It is ignored by Git so your
project credentials are not committed. The example file is safe to commit, but
do not put real keys in it. Never expose a Supabase secret key or legacy
`service_role` key in a `NEXT_PUBLIC_` variable or browser code. The app does
not read these variables until Supabase client and authentication integration
is implemented.
