-- "How the field drafted" (owner call 2026-08-30): for a given daily, what
-- share of players took each of the three offered cards at every slot.
--
-- Only the daily can do this honestly: its board is deterministic from the
-- challenge date, so the client reconstructs the three options for free and
-- this view supplies the counts. (Free play boards are random and unstored,
-- so its equivalent needs per-draft logging -- deliberately not built yet.)
--
-- Read-only view over scores; no new write path, no new RLS surface.
create or replace view public.daily_picks
with (security_invoker = true) as
select
  s.challenge_date,
  p ->> 'gsisId' as gsis_id,
  count(*)::int as picks
from public.scores s,
     lateral jsonb_array_elements(s.roster) p
where s.challenge_date is not null
group by 1, 2;

-- Players per day, the denominator for the percentages.
create or replace view public.daily_entry_counts
with (security_invoker = true) as
select challenge_date, count(*)::int as entries
from public.scores
where challenge_date is not null
group by 1;

grant select on public.daily_picks, public.daily_entry_counts to anon, authenticated;
