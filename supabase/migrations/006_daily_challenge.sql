-- Daily Challenge: tag scores with the UTC-date challenge they belong to (null
-- for free play). The all-time board reads challenge_date IS NULL; the daily
-- board filters by a specific date.
alter table public.scores add column challenge_date text;
create index scores_daily_idx on public.scores (challenge_date, score desc);
