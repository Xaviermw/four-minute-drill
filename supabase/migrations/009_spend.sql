-- Cap-draft economy: record the team's total salary ($0-$60ish under a $25 cap;
-- bounded to 100 defensively). Null on legacy rows submitted before the cap,
-- which the board falls back to rendering with the old payout multiplier.
alter table public.scores add column spend int;

-- Re-bound the insert policy to accept spend, preserving the 005 name filter and
-- the 008 final_field_position bounds (both silently regress if omitted here).
drop policy "authed can submit bounded scores" on public.scores;

create policy "authed can submit bounded scores"
  on public.scores for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and score >= 0 and score <= 1000
    and final_field_position >= 0 and final_field_position <= 100
    and (spend is null or (spend >= 0 and spend <= 100))
    and char_length(name) between 1 and 20
    and public.name_ok(name)
    and jsonb_typeof(roster) = 'array'
    and jsonb_array_length(roster) = 6
  );
