-- Opening-day reminders (owner call 2026-08-24): a player types an email on
-- the pre-season countdown strip and gets ONE email on opening day. That's
-- the entire contract -- no list, no newsletter.
--
-- PRIVATE by construction: RLS with an insert policy only. There is
-- deliberately NO select policy, so the anon/publishable key can never read
-- addresses; the send is done from the pooler (see SUPABASE_SETUP.md).
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid default auth.uid(),
  source text check (source is null or char_length(source) <= 24),
  created_at timestamptz not null default now(),
  constraint reminders_email_shape check (
    char_length(email) between 5 and 254
    and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
  ),
  constraint reminders_email_unique unique (email)
);

alter table public.reminders enable row level security;
create policy "anyone signed in can ask for a reminder" on public.reminders
  for insert to authenticated with check (auth.uid() = user_id);
-- No select/update/delete policies: write-only from the client.

grant insert on public.reminders to authenticated;
-- Belt and suspenders: Supabase's default privileges grant select to the
-- client roles; RLS already yields zero rows, but revoke it outright.
revoke select, update, delete on public.reminders from anon, authenticated;
