# Reddit smoke test — readout (Aug 1–8 campaign, written Aug 12)

$40 lifetime, r/fantasyfootball + r/nfl + r/DynastyFF feed placement,
`utm_campaign=smoke-early`. Decision gates were pre-agreed in
aug1-test-week.md; verdicts below.

## Acquisition (Reddit dashboard)

FINAL (owner dashboard, Aug 12): **$39.35 spent, 7,226 impressions, 289
clicks, $0.14 CPC, 4.0% CTR** (4–8× the ~0.5–1% feed-ad benchmark). Budget
effectively exhausted around Aug 7 (daily players drop Aug 8). Click →
playing-device ratio: 216/289 ≈ 75% even before counting organic arrivals —
the funnel barely leaks.

## What the money bought (our database, ground truth)

| Metric | Value |
|---|---|
| Active devices Aug 1–8 (played ≥1 free drive) | **216** |
| Distinct named leaderboard players (week) | 35 |
| Daily-challenge players/day at peak | 9 → 8 → 6 → 5 (Aug 4–7) |
| Named players on 2+ different days | **7 of ~35 (~20%)** |
| Named players on 3+ different days | 2 |
| Best score / best win streak | 200 (ceiling) / 6 straight |
| Production errors (Sentry) | 0 |
| **Cost per playing device** (even attributing only ~2/3) | **≈ $0.27** ($39.35 / ~145–216) |

## The post-campaign floor (calibrated: it's a handful, not an audience)

Ads stopped Aug 8. Daily players since, with **zero spend**: 1, 2, 2, 3
(Aug 9–12) — a few people, not an audience (owner's correction, kept
honest). The defensible claim is the RATE, not the count: ~1–2% of the 216
acquired devices formed a daily-ish habit in week one, pre-season, with no
season mechanic and no reminders. The kickoff bet is that all three
multipliers move at once: in-season relevance raises the rate, Season Score
raises the rate, and a bigger top-funnel multiplies the base it applies to.
At kickoff-scale traffic (~2,000 visitors), today's rates alone would seed
20–40 daily regulars — before the product improvements bite.

## Gates → verdicts

- CPC < $2 → **$0.17** ✅
- Completion ≥ 25% of visitors → 216 players vs ~250–300 est. visitors ✅ (by a mile)
- D1/return ≥ 15% → **~20% of named players multi-day** ✅ (named slice
  skews engaged; device-level D1 instrumentation now exists via source tags
  for the next test)
- Errors → 0 ✅

**Verdict: SCALE.** Every gate passed; several were crushed.

## September recommendation

1. **Meta $40 test** as soon as the account review clears — same cap-math /
   coach-bot creative hooks adapted to feed format; source attribution is
   live, so Reddit-vs-Meta retention is a SQL query this time.
2. **Kickoff burst (Sep 8–14): ~$60**, weighted by the Meta read; Reddit
   gets ≥ $40 of it regardless (proven at 4.2% CTR). Same creative family,
   fresh headlines from the test's per-headline winners (pending screenshot).
3. **Product side is the bigger lever now**: Season Score (spec'd, build
   Aug 15–25) converts exactly the behavior this test proved exists (multi-
   day returners) into a compounding habit. Ads buy the audience; the season
   table keeps it.
4. Budget beyond $100: not yet. Re-evaluate after kickoff week with
   attribution-clean cohort data.

## Retention, full window Aug 1–18 (owner-name excluded; corrected)

An earlier cut counted only from Aug 12 and split players whose days
straddled the smoke test and the trickle (owner caught it). Full window,
StopPunting (= owner) excluded: **37 named daily players; 13 played 2+
different days (35%); 3 played 3+; Khanson25 has played 10 distinct days
(Aug 5–15) -- a formed daily habit, pre-season, from a $0.14 click.**
Several 2-day players have LONG gaps (tjoconn Aug 2→17, Gb Aug 7→17):
latent recall, not consecutive-day-then-gone -- exactly what a season
table converts. Device level: 48/62 Reddit-tagged devices (77%) show
activity beyond their first drive; Meta cohort tiny (3) but same shape.
Daily player count climbed 2 → 5-6/day. The smoke test's "soft spot" was
partly a measurement-window artifact; the habit signal is real.
