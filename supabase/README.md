# Supabase migrations

Numbered SQL files capturing the leaderboard schema, in the order it was applied
to the live project. They are the source of truth for the DB shape; the app code
depends on it, and `app/SUPABASE_SETUP.md` is the narrative walkthrough.

**These are applied manually** — the Supabase CLI is not wired up. To provision a
fresh project, run `001`…`005` in order in the SQL editor (or via a Postgres
client), and enable **Anonymous sign-ins** in the dashboard (see `002`).

| File | What it adds |
|------|--------------|
| `001_scores.sql` | `scores` table, RLS, public read + bounded anon insert |
| `002_anon_auth.sql` | `user_id` ownership, authed-only insert (needs anon sign-ins) |
| `003_time_remaining.sql` | `time_remaining` column |
| `004_streaks.sql` | `streaks` table + atomic `record_drive` RPC |
| `005_name_filter.sql` | `name_ok` filter, applied to score inserts + `record_drive` |

Later files supersede earlier definitions of the same object (e.g. `005`
re-creates the `record_drive` from `004` and the insert policy from `002`); the
combined end state matches the live database.
