-- Weekly winners (owner call 2026-09-16). The season table only rewards the
-- day-one regulars; NFL weeks -- Thursday to Wednesday, opening night included
-- -- give every newcomer a fresh race within a week, and Coach Bot announces
-- each week's winner on Thursday morning. In the app this replaces the
-- all-time (free play) tab; free-play scores keep the win-streak board.
--
-- weekly_totals: one row per (player, week) inside the season window -- the
-- sum of each day's FIRST post (daily_entries, 015), days played, total cap
-- spend (the tie-break: a cheaper squad outranks, as on the daily board) and
-- the player's latest name. Week boundaries are lockstep with weekStartFor()
-- in app/src/daily/season.ts; the season window with season_totals (011).
--
-- weekly_winners: the #1 named player of every week; the client hides the
-- week still in progress. Both read-only, no new write path.

create or replace view public.weekly_totals
with (security_invoker = true) as
with per_day as (
  select user_id, score, spend, created_at,
         to_char(date '2026-09-10' + ((challenge_date::date - date '2026-09-10') / 7) * 7, 'YYYY-MM-DD') as week_start
  from public.daily_entries
  where challenge_date >= '2026-09-10'
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
  p.week_start,
  sum(p.score)::int as week_points,
  count(*)::int as days_played,
  sum(p.spend)::int as total_spend,
  max(p.created_at) as last_played_at
from per_day p
join latest_name n using (user_id)
group by p.user_id, n.name, p.week_start;

create or replace view public.weekly_winners
with (security_invoker = true) as
select distinct on (week_start) *
from public.weekly_totals
where name <> 'Anonymous'
order by week_start, week_points desc, total_spend asc nulls last, last_played_at asc;

grant select on public.weekly_totals, public.weekly_winners to anon, authenticated;
