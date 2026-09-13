-- Are players bailing on a daily mid-drive and drafting again? (owner call
-- 2026-09-12: measure it, don't police it -- not an issue at this size.)
--
-- The one-shot rule counts FINISHED drives, so reloading mid-drive or switching
-- to Free and back drops the drive and re-opens today's draft (verified with a
-- browser probe, 2026-09-11). Closing that would burn a player's whole day on a
-- crashed phone, so instead every daily post carries WHICH attempt of the day it
-- was: the device counts the daily drives it starts (fmd_daily_tries_<date>) and
-- sends that count. 1 = first drive of the day. Null = free play, a client older
-- than 2026-09-12, or unusable storage.
--
-- Client-reported and trivially forgeable: a metric, never an enforcement input.
-- Read it with:
--   select challenge_date,
--          count(*) filter (where daily_attempt > 1) as re_drafted,
--          count(*) filter (where daily_attempt is not null) as measured
--   from daily_entries group by 1 order by 1;

alter table public.scores add column if not exists daily_attempt int;

-- daily_entries (015) expands `*` when it is created, so it has to be recreated
-- to carry the new column -- appended at the end, which create or replace allows.
create or replace view public.daily_entries
with (security_invoker = true) as
select distinct on (user_id, challenge_date) *
from public.scores
where challenge_date is not null
  and user_id is not null
order by user_id, challenge_date, created_at, id;
