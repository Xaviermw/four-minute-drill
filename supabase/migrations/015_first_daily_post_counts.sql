-- One daily entry per device per day, and it is the FIRST post (owner call
-- 2026-09-11).
--
-- The daily is one-shot, but the gate was device-local and read once at page
-- load: a tab opened before another tab finished the drill could play and post
-- it again. By Sep 11, 9 device/days had two posts -- and season_totals (011)
-- took the MAX, so a second try could only help. The client now closes that
-- gap (storage sync across tabs, a re-check at "Run the Drive", first finish
-- wins at the result); this makes any post that still slips through inert
-- everywhere a daily is counted.
--
-- daily_entries is the board every daily surface reads: today's board, rank,
-- field summary/percentile, pick rates (014), the season table (011), and the
-- recap bot. DISTINCT ON keeps it non-updatable (no write path). Its `*` is
-- expanded when the view is created -- after adding a scores column, re-run
-- this create or replace or daily surfaces won't see it. user_id is never null
-- on daily rows (the insert policy requires auth.uid() = user_id).

create or replace view public.daily_entries
with (security_invoker = true) as
select distinct on (user_id, challenge_date) *
from public.scores
where challenge_date is not null
  and user_id is not null
order by user_id, challenge_date, created_at, id;

grant select on public.daily_entries to anon, authenticated;

-- 011 rebased onto daily_entries: each day's first post, not the day's max.
-- The name is still the player's most recent submitted name.
create or replace view public.season_totals
with (security_invoker = true) as
with per_day as (
  select user_id, challenge_date, score as day_score, created_at as last_at
  from public.daily_entries
  where challenge_date >= '2026-09-10'  -- text ISO dates compare correctly
    and challenge_date <= '2027-01-05'
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

-- 014 rebased: a second post no longer counts its picks (or its entry) twice.
create or replace view public.daily_picks
with (security_invoker = true) as
select
  s.challenge_date,
  p ->> 'gsisId' as gsis_id,
  count(*)::int as picks
from public.daily_entries s,
     lateral jsonb_array_elements(s.roster) p
group by 1, 2;

create or replace view public.daily_entry_counts
with (security_invoker = true) as
select challenge_date, count(*)::int as entries
from public.daily_entries
group by 1;
