-- Own each score by the (anonymous) auth user, and require an authed session.
-- Also enable Anonymous sign-ins in the dashboard: Authentication -> Sign In /
-- Providers -> Anonymous sign-ins -> Enable.
alter table public.scores add column user_id uuid default auth.uid();

drop policy "anon can submit bounded scores" on public.scores;

create policy "authed can submit bounded scores"
  on public.scores for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and score >= 0 and score <= 1000
    and char_length(name) between 1 and 20
    and jsonb_typeof(roster) = 'array'
    and jsonb_array_length(roster) = 6
  );
