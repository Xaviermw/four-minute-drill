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
| Benchmarks to beat | $0.14 CPC · 4.0% CTR · ~$0.27 per playing device |

**Meta is dead.** $40 bought 8 devices (~$5 each) against Reddit's ~$0.27.
Do not re-run it; the account stays for a future retry, not for kickoff.

## The spend plan (grounded in the measured funnel)

Measured Aug 28, not assumed:

- **$1 of Reddit spend ≈ 2.5 playing devices** ($0.30 CPC allowing for
  kickoff-week auction inflation, 75% of clicks reach a played drive)
- **19% of acquired devices ever play a daily** (30 of 155 Reddit devices)
- **~22% of those play on any given day** (~6.5 daily actives from a pool
  of 30)

So at *today's* conversion, $1 buys about **0.02 daily players** — and the
40-player goal would cost ~$280. That is the honest arithmetic, and it is
why the plan is staged rather than committed up front: kickoff week and the
season table should both lift those rates, but neither has been measured
yet. If device→daily rises to ~30% and daily-active to ~30%, the same goal
costs ~$130.

**The baseline already running: $3–5/day** (the trickle; confirm the exact
figure in Ads Manager — Campaigns tab, `4md-trickle`, Amount Spent ÷ days
elapsed). It has been live since Aug 13 and is scheduled to Sep 5, so a
chunk of any "kickoff budget" is money that gets spent anyway. Framing the
ask as INCREMENTAL over that baseline is the honest way to size it — and
the $3-vs-$5 difference moves the kickoff ask by only ~$14, so it does not
change the plan.

**Step 1 — Sep 6–9: extend, don't build ($20, already the run rate).**
No bridge campaign needed: just change the trickle's end date from Sep 5 to
Sep 9. Same settings, same creative, no new setup, no gap in the boards.

**Step 2 — Sep 10–16: raise to $15/day for kickoff week.**
Full cost $105, of which $21–35 would have been spent at the baseline
anyway, so the **incremental ask is $70–84**. Starts ON opening day — the promise
"every drill counts toward your season score" is only true from the 10th.
Budget **daily, never lifetime**: a lifetime budget can be eaten in six
hours on a hot day. New campaign `4md-burst`, `utm_campaign=burst`.

Expected from the kickoff week: ~310 new devices → **20 daily players if
conversion holds flat, ~35 if the season table works.**

**Step 3 — Sep 17 gate, up to $150 more (conditional):**

- If ≥10% of burst devices played 2+ separate days → hold $10/day through
  Sep 30. The retention signal justifies buying more of the same.
- If under 10% → **drop back to $5/day or stop.** More traffic into a leaky
  funnel buys a bigger number and the same problem; the money goes to
  product instead.

**Total incremental ask for kickoff week: ~$70–85.** Everything above that is
either the existing run rate or conditional on evidence.

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
