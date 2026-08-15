-- Season Score (docs/season-score-spec.md): cumulative daily-drill score per
-- player across the season, the returning-user hook. Read-only view over
-- scores -- no new writes, no new RLS surface (a view inherits the
-- underlying table's public-select policy via security_invoker).
--
-- Season window is a constant here (opening day .. season end); pre-season
-- dailies are warmup and deliberately excluded (owner call 2026-08-08: ONE
-- table, starting opening day). Losses count their marginal points (every
-- play adds). One score per (user, day): the daily is one-shot, but replays
-- of the same challenge from a stale tab could double-post -- take the max.
-- The name is the player's most recent submitted name.

create or replace view public.season_totals
with (security_invoker = true) as
with per_day as (
  select user_id, challenge_date, max(score) as day_score, max(created_at) as last_at
  from public.scores
  where challenge_date is not null
    and challenge_date >= '2026-09-10'  -- text ISO dates compare correctly
    and challenge_date <= '2027-01-05'
    and user_id is not null
  group by user_id, challenge_date
),
latest_name as (
  select distinct on (user_id) user_id, name
  from public.scores
  where challenge_date is not null and user_id is not null
  order by user_id, created_at desc
)
select
  p.user_id,
  n.name,
  sum(p.day_score)::int as season_points,
  count(*)::int as days_played,
  max(p.last_at) as last_played_at
from per_day p
join latest_name n using (user_id)
group by p.user_id, n.name;

grant select on public.season_totals to anon, authenticated;
