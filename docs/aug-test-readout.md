# Reddit smoke test — readout (Aug 1–8 campaign, written Aug 12)

$40 lifetime, r/fantasyfootball + r/nfl + r/DynastyFF feed placement,
`utm_campaign=smoke-early`. Decision gates were pre-agreed in
aug1-test-week.md; verdicts below.

## Acquisition (Reddit dashboard)

Aug 5 snapshot (final screenshot pending — owner): $25.89 spent, 3,523
impressions, 148 clicks, **$0.17 CPC, 4.20% CTR** (4–8× the ~0.5–1% feed-ad
benchmark). Extrapolated final at full $40: ~220–240 clicks. Spend pattern
suggests the budget exhausted around Aug 7 (daily players drop Aug 8).

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
| **Cost per playing device** (even attributing only ~2/3) | **≈ $0.25–0.30** |

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
