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

## Usernames

New accounts choose a username on the register form. Usernames are lowercase,
3–30 characters (`a-z`, `0-9`, `_`, `-`), and unique case-insensitively through
the existing `profiles_username_lower_unique` index.

Apply [`migrations/usernames.sql`](./migrations/usernames.sql) to:

- teach the sign-up trigger to copy `username` from the auth metadata,
- add `is_username_available()` so the register form can check before creating
  the account, and
- add `find_user_by_login()` so friend requests accept either a sign-up email
  or an `@username`.

Accounts created before this migration can set a username from **My account →
Sign-in details**. That section also changes the password (the current password
is verified first) alongside the profile picture that was already editable.

## Messaging and friend requests

Messaging uses Supabase Realtime on top of these tables:

- `friendships` stores a pending request between two users. Accepting it makes
  the pair friends; declining removes the request so either person can ask
  again later.
- `conversations` and `conversation_members` hold both direct chats and group
  chats. A direct chat is a two-person conversation keyed by the two user ids;
  a group has a title and any number of members.
- `messages` stores text and one image attachment per message
  (`attachment_url` / `attachment_type`). Read state is kept per member with
  `conversation_members.last_read_at`, which powers the unread badge.

Only members can read or insert messages, and direct chats can only be opened
with accepted friends — enforced in RLS and in the `start_direct_conversation`
function, not just in the UI. Group creation is limited to friends of the
creator.

Apply the migrations in order after the base schema:

1. [`migrations/messaging.sql`](./migrations/messaging.sql) — friendships,
   direct messages, the email lookup helper.
2. [`migrations/messaging-v2.sql`](./migrations/messaging-v2.sql) — converts
   direct messages into conversations, adds group chats and attachments, and
   creates the `chat-images` Storage bucket.
3. [`migrations/usernames.sql`](./migrations/usernames.sql) — usernames at
   sign-up, uniqueness checks, and lookup by email or `@username`.

The migrations add the tables to the `supabase_realtime` publication; if you
prefer the dashboard, make sure everything is toggled on under
**Database → Publications → supabase_realtime**. The `chat-images` bucket is
public-readable with 5 MB image uploads; tighten its policies if you need
private media.

To start a chat, open **Messages** in the sidebar, sign in, and send a friend
request using the other person's email or `@username`. Once they accept, click
their name under **Friends** to open a direct chat, or use **+ New group** to
create a group with two or more friends. Messages, group invites, and friend
requests arrive live; pictures are uploaded when you press Send, and pasted
links (TikTok, Instagram, YouTube, and any other URL) render as tappable link
cards.
