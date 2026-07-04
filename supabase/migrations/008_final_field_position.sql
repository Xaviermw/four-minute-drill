-- Where the drive came to rest (yards to the end zone, 0 = reached it). Lets the
-- Daily board rank "Longest drives" -- so even a scoreless drive that marched
-- deep has something to show for it, and losses are worth submitting.
alter table public.scores add column final_field_position int not null default 100;

-- Longest-drive board query: within a day, smallest final_field_position first.
create index scores_daily_drive_idx on public.scores (challenge_date, final_field_position asc);

-- Re-bound the insert policy to include the new field (0-100), preserving the
-- 005 name filter. A loss submits score 0, which the policy already allows
-- (score >= 0), so no score-bound change is needed to score-the-loss.
drop policy "authed can submit bounded scores" on public.scores;

create policy "authed can submit bounded scores"
  on public.scores for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and score >= 0 and score <= 1000
    and final_field_position >= 0 and final_field_position <= 100
    and char_length(name) between 1 and 20
    and public.name_ok(name)
    and jsonb_typeof(roster) = 'array'
    and jsonb_array_length(roster) = 6
  );
