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
[`migrations/schema.sql`](./migrations/schema.sql)
into the Supabase Dashboard SQL Editor and run it against your project.

> **Already have the tables?** Do not rerun the base schema — `create table` is
> not idempotent, and `ERROR 42P07: relation "profiles" already exists` means it
> has already been applied. Skip to the incremental migrations below; in
> particular, `sync.sql` is the one that creates the cloud-sync table.

The Studybook app's registration and sign-in forms use Supabase Auth when the
project credentials below are configured. With the `sync.sql` migration
applied, classes, checks, saved classes, tasks, notes, exams, routine steps,
routine checks, and the profile picture are synchronized through the private
`studybook_snapshots` table. Theme, font, music, and widget preferences stay in
the browser. Avatar uploads still use a browser data URL inside that snapshot;
a dedicated Storage bucket is optional.

## Cross-device sync

Apply [`migrations/sync.sql`](./migrations/sync.sql) to create the private
`studybook_snapshots` table (one JSON snapshot per account, protected by RLS).

How it behaves:

- When you sign in, the app loads your account snapshot.
- If the account has no snapshot yet, the current browser's local data is
  uploaded, so the first signed-in device seeds the account.
- After that, changes are saved after a short debounce.
- If both the cloud and local data have content, the app merges the lists by id.
  Tasks use their latest `updatedAt` so a completed/unchecked task from another
  device wins over a stale copy; other lists keep the local entry for the same
  id. The app also pulls the cloud snapshot every 15 seconds and when the tab
  regains focus, so simultaneous devices converge without a reload. Deletions
  made only on one stale device can reappear until that device syncs.
- Local data is now stored per account (`studybook-data-v1:<user id>`), so two
  accounts on the same browser keep separate schedules and to-dos. The older
  shared key is claimed only by an account whose email matches the saved
  profile; other accounts use their own local data or the cloud snapshot.

Theme, font, holiday effects, the music library/audio files, and the messages
widget position remain device-local. Messages, friendships, and leaderboard
points already live on the server.

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
4. [`migrations/chat-customization.sql`](./migrations/chat-customization.sql) —
   `rename_group()`, `add_group_members()`, and `leave_conversation()` for the
   chat settings panel.
5. [`migrations/leaderboard.sql`](./migrations/leaderboard.sql) — adds
   `profiles.points`, the `award_points()` function that checks off tasks call,
   and `get_leaderboard()` for the friends-only top list.
6. [`migrations/sync.sql`](./migrations/sync.sql) — cross-device
   `studybook_snapshots` for the schedule, tasks, notes, exams, routine, and
   profile picture.
7. [`migrations/halloween.sql`](./migrations/halloween.sql) — the
   `halloween_claims` table and `claim_halloween()` function, so a trick-or-treat
   can only be claimed once per account each year, on any device.
8. [`migrations/monthly-borders.sql`](./migrations/monthly-borders.sql) — the
   monthly leaderboard points table, `equipped_border` on profiles,
   `get_my_borders()`, and the updated `award_points()`, `get_leaderboard()`,
   and `claim_halloween()` for monthly seasons and champion borders.

These migration files are meant for a **fresh project**. If the base schema,
messaging, or usernames are already working, do not rerun them. Expected errors
when rerunning are:

- `42P07: relation "profiles" already exists` — base schema is already applied.
- `42710: constraint "messages_body_check" ... already exists` — messaging-v2
  is already applied.
- `42703: column "recipient_id" does not exist` — you are running the old
  pre-v2 `messaging.sql` after `messaging-v2.sql`; the direct-message schema was
  replaced. Skip it.

If sign-in and messaging already work, apply only the **missing** newer
migrations: `chat-customization.sql` (group settings), `leaderboard.sql`
(points), `sync.sql` (cross-device data), `halloween.sql` (the Halloween
claim), and `monthly-borders.sql` (monthly seasons and borders).

## Monthly leaderboard and borders

Apply [`migrations/monthly-borders.sql`](./migrations/monthly-borders.sql) after
`leaderboard.sql` and `halloween.sql`. It:

- adds `leaderboard_monthly` (one row per user per month) and keeps
  `profiles.points` as the all-time total;
- updates `award_points()` and `claim_halloween()` so task and Halloween points
  also count toward the current month;
- makes `get_leaderboard()` return the current month's points plus the user's
  equipped border;
- adds `get_my_borders()`, which reads the permanently stored borders; a border
  is copied into `profile_borders` once by `sync_my_borders()`, so later friend
  changes cannot remove it;
- adds `profiles.equipped_border`, which stores the chosen border on the account
  so it follows the user to other devices.

The leaderboard resets to zero at the start of each month. When a month ends,
the top scorer earns that month's champion border (the palette changes by
month), which can be equipped on the Profile tab. Run:

```sql
notify pgrst, 'reload schema';
```

after the migration.

## Halloween claim

Apply [`migrations/halloween.sql`](./migrations/halloween.sql) to create the
private `halloween_claims` table and the `claim_halloween(choice, point_value)`
function. A claim is unique per account and year, so choosing a treat or riddle
on one device hides the challenge on every other device for that account.
`claim_halloween` records the choice and adds the points atomically; a second
claim raises `23505` and the app shows “Already claimed”.

The riddle bank rotates by year in [`lib/halloween.ts`](../lib/halloween.ts), so
next Halloween uses a different question and difficulty.

## Leaderboard

Completing a to-do task awards leaderboard points by priority:
**high +30, medium +20, low +10**. Un-checking the same task automatically
deducts the same amount (never below zero). The points are stored on the user's
profile, and the Leaderboard page only shows the signed-in user and their
**accepted friends** — add friends from Messages to compare.

Points are awarded while signed in when the task checkbox is toggled (from the
To-do list or the Overview's Next up card). The browser's task list is local, so
the server cannot independently verify a completion; the database functions
only validate the amount, not the task itself.

The migrations add the tables to the `supabase_realtime` publication; if you
prefer the dashboard, make sure everything is toggled on under
**Database → Publications → supabase_realtime**. The `chat-images` bucket is
public-readable with 5 MB image uploads; tighten its policies if you need
private media.

To start a chat, open **Messages** in the sidebar, sign in, and send a friend
request using the other person's email or `@username`. Once they accept, click
their name under **Friends** to open a direct chat, or use **+ New group** to
create a group with two or more friends. Open the gear in a chat to rename a
group, add friends, leave the chat, and pick a chat colour; the emoji button in
the composer inserts emoji into a message. Messages, group invites, and friend
requests arrive live; pictures are uploaded when you press Send, and pasted
links (TikTok, Instagram, YouTube, and any other URL) render as tappable link
cards.
