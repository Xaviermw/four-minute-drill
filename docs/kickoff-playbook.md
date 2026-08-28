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

## The spend plan

Reddit only. Three phases, ~$150 total (owner sizes it — this is a
recommendation, and every phase is independently cancellable):

1. **Bridge, Sep 6–9 — $5/day (~$20).** The trickle campaign ends Sep 5 and
   the burst starts Sep 8; without a bridge the boards go quiet in the four
   days when football interest is climbing fastest. Same campaign settings,
   `utm_campaign=bridge`.
2. **Kickoff burst, Sep 10–16 — $15/day (~$105).** Starts ON opening day, not
   before: the ad's promise ("the season starts today, every drill counts")
   is only true from the 10th. Budget **daily, not lifetime**, so a hot day
   can't exhaust the week in six hours.
3. **Hold back ~$25** for a re-push in week 2 if retention holds.

Expect CPC to rise — every fantasy advertiser bids kickoff week. If it lands
near $0.30, that is still ~$0.60/player and fine. Kill rule unchanged: CPC
> $2 sustained, or completion rate collapsing, means stop and diagnose.

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
