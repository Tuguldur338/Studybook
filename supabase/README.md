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

The Studybook app's registration and sign-in forms use Supabase Auth when the
project credentials below are configured. Class schedules, tasks, and notes
are still stored in the browser and are not yet synchronized with these
database tables. Avatar storage also needs a Storage bucket and its own access
policies; `avatar_url` stores the resulting image URL.

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
`service_role` key in a `NEXT_PUBLIC_` variable or browser code. The app uses
these variables for browser-based Auth.

## Messaging and friend requests

Messaging uses Supabase Realtime on top of two extra tables:

- `friendships` stores a pending request between two users. Accepting it makes
  the pair friends; declining removes the request so either person can ask
  again later.
- `messages` stores direct messages with a `read_at` timestamp used for the
  unread badge.

Only accepted friends can insert messages — this is enforced in RLS, not just
in the UI. Attachments and group chats are not supported yet.

Apply [`migrations/messaging.sql`](./migrations/messaging.sql) after the base
schema (either with `supabase db push` or by pasting it into the SQL Editor).
The migration adds both tables to the `supabase_realtime` publication; if you
prefer the dashboard, make sure both tables are toggled on under
**Database → Publications → supabase_realtime**.

To start a chat, open **Messages** in the sidebar, sign in, and send a friend
request to the email address the other person used to register. Once they
accept, the conversation appears in both sidebars and new messages arrive live.
