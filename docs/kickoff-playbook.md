# Kickoff playbook — the Reddit push (written Aug 28)

Season opens **Thu Sep 10**. This is the one week of the year when "a daily
NFL game" sells itself, so the plan is: spend where we have proof, be ready
before traffic arrives, and let the season table do the retaining.

## Where we actually stand (Aug 28, owner excluded from all counts)

| | |
|---|---|
| Named daily players, all-time | **79** |
| Played 2+ different days | **26 (33%)** |
| Played 3+ different days | 7 |
| Daily players/day, last 9 days | 4–11, no organic push |
| Devices by source | **Reddit 154 · Meta 8** |
| Proven creative | coach-bot board + "Our robot coach scored 9 points today. Beat him or live with that." |
| Measured cost | **$0.13 CPC · 3.9% CTR** · ~$118.79 spent to date |

**Meta is dead.** $40 bought 8 devices (~$5 each) against Reddit's ~$0.27.
Do not re-run it; the account stays for a future retry, not for kickoff.

## The spend plan (measured, Aug 28 dashboard)

Real numbers, not estimates:

| | Smoke | Trickle |
|---|---|---|
| Spend | $39.35 | $79.44 |
| Clicks | 289 | 625 |
| CPC | $0.14 | **$0.13** |
| CTR | 4.00% | 3.87% |

Trickle runs **$5/day, ends Sep 7**. Total spent to date: **$118.79**.

**The bottleneck is NOT traffic cost.** At $0.13, $5/day buys ~39 clicks a
day — and that produces ~12–17 new devices and ~6–9 daily players. So the
leak is downstream: roughly **5% of clicks become someone who plays a daily
on a given day**. Buying more clicks multiplies the top of that funnel and
leaves the ratio untouched.

Two consequences, and they point the same way:

1. **Don't over-buy.** Tripling to $15/day should be read as buying ~3x the
   clicks at the SAME conversion: expect **~15–20 daily players**, not 40.
   Anyone promising 40 from budget alone is extrapolating a rate we have
   never observed.
2. **The 40-player goal is a retention problem, not a budget problem.** The
   season table, result cinematics, and the coach's note are what move the
   5%. That is where the effort belongs — the ad spend just needs to keep
   enough new faces arriving to measure whether those changes work.

**Step 1 — Sep 8–9: extend the trickle's end date from Sep 7 to Sep 9.**
Two days, ~$10, no new campaign, no gap before the burst.

**Step 2 — Sep 10–16: `4md-burst` at $15/day ($105 gross, ~$70
incremental).** Starts ON opening day; daily budget, never lifetime.
Honest expectation: ~20 daily players, ~25–30 if the season table lifts the
conversion.

**Step 3 — Sep 17 gate, up to $150 conditional.** ≥10% of burst devices
playing 2+ separate days → continue at $10/day. Under that → drop back to
$5/day and spend the effort on the funnel instead.

**Total incremental ask: ~$80.** The rest is either the existing run rate
or conditional on evidence.

**Kill rule** (unchanged): CPC > $2 sustained, or drive-completion rate
collapsing, means stop and diagnose rather than ride it out.

## Creative

Lead with the proven combo, unchanged. Two kickoff-specific headlines to add
(they only make sense this week, so they go in the burst campaign, not the
bridge):

- `Week 1 starts today. Every daily drill counts toward your season score.`
- `Our robot coach has a season score. Yours starts today.`

Keep the 15-headline set from campaign-specs.md as the rest of the pool.
Assets tab check on Sep 12 to see which combo the algorithm elected.

## Ready-before-traffic checklist

**Owner (do before Sep 8):**
- [ ] **Top up X API credits** — the bot has been 402-dead since ~Aug 16, so
      only Bluesky is posting. Kickoff week is the week it matters.
- [ ] Build the bridge + burst campaigns from campaign-specs.md (paste-sheet).
- [ ] **Send the opening-day email** on Sep 10 (procedure: SUPABASE_SETUP.md
      §8 — pull, BCC, delete). One email. That's the promise.

**Claude (before Sep 8):**
- [ ] Result cinematics (outcome stamps, haptics, clutch beat) — the game
      should feel loud during its highest-traffic week.
- [ ] Cold-visitor pass at phone width, now that the camera and season table
      changed what a stranger sees.
- [ ] Sep 1: engine/economy freeze. UI and marketing keep moving; prices,
      pool, and simulation do not change once the season is live.
- [ ] Sep 9: dry-run the whole first-time flow on the preview of production —
      ad click → draft → drive → result → season strip → share.

## What we're measuring (and the honest denominator)

Report on **Sep 17** with: cost per playing device, drive-completion rate of
`utm_campaign=burst` traffic, and — the number that decides the season —
**how many burst-acquired devices play 2+ separate days**. Pre-kickoff that
figure is 33% of *named* players, which is ~4-5% of all acquired devices.
Kickoff-week traffic plus the season table should move it; if it doesn't,
the product answer (not more spend) is the next move.
