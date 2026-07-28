# Aug 1 test week — prep & run plan

The $15 Reddit smoke test runs Aug 1–8 (`utm_campaign=smoke-early`). The goal
is NOT revenue or even players — it's three answers: what a click costs from
this audience, whether cold traffic completes a drive, and whether anyone
comes back the next day. Those three numbers shape the $25 kickoff burst and
the Meta/X tests.

## Before Aug 1 (prep window: Jul 28–31)

**Owner (blocking, ~15 min total):**
- [ ] Enable Vercel Web Analytics: vercel.com → four-minute-drill → Analytics
      tab → Enable. Without this the test measures nothing. (Found 404ing on
      2026-07-27.)
- [ ] Confirm the Reddit campaign shows Scheduled/Approved for Aug 1, $15
      LIFETIME (not daily), landing URL ends `utm_campaign=smoke-early`.
- [ ] Optional but recommended: Sentry (free) → project DSN → Vercel env var
      `VITE_SENTRY_DSN` → redeploy. Cold traffic = unseen devices; crashes
      should be loud, not inferred.

**Claude (verification + builds):**
- [ ] Verify analytics end-to-end once toggled (script serves, pageview +
      custom events land).
- [ ] Dynamic OG images shipped before Aug 1 if stable — every player the ads
      buy becomes a better sharer. (Ship-by-Jul-31 target; if it slips, it
      does NOT block the test.)
- [ ] Confirm Coach Bot posts daily without babysitting (it now fails loud).
- [ ] Fresh-eyes pass on the cold-visitor path at phone width: ad click →
      rookie gate → draft → drive → result → "come back tomorrow" framing.

## During the week (Aug 1–8)

- Owner does NOTHING except glance at Reddit's dashboard if curious. All
  reads come from our side; Reddit's numbers are only spend/CTR truth.
- Claude pulls the funnel on **Aug 4 or 5** (~half the budget spent):
  clicks (Reddit) vs `utm_source=reddit` sessions vs `draft_started` vs
  `drive_completed` vs D1 return. Also: which headline/image combos carry
  CTR — pause the bottom half of creatives mid-week (owner: one click, list
  provided).
- Watch-outs: a broken mobile flow (Sentry/session data), CPC > $2 sustained
  (pause early, keep the budget), review rejection (reword + resubmit —
  avoid "fantasy" phrasing; it triggers DFS-gambling review).

## After (Aug 9–10): the readout

One short doc with the three numbers and a recommendation:
- **CPC** — what a click cost from football Reddit in the offseason.
- **Completion rate** — % of ad clicks that finished a drive. This is the
  product verdict; under ~25% means fix the funnel before spending more.
- **D1 return** — % back the next day. This is the habit verdict; it decides
  whether the kickoff burst is $25 or bigger, and whether Meta/X tests are
  worth their setup time.

Decision gates (pre-agreed so the readout is mechanical, not vibes):
- Completion ≥ 25% AND D1 ≥ 15% → scale: kickoff burst on Reddit + launch
  Meta/X tests in late August.
- Completion good, D1 weak → product work on the comeback loop (streaks,
  notifications-by-bot, share prompts) before more spend.
- Completion weak → funnel work (first-drive experience) before ANY spend;
  ads amplified a leak, which is exactly what a $15 test is for.

## Standing context

- Season calendar unchanged: August data refresh → Sep 1 economy freeze →
  kickoff-week launch (pre-season-plan.md). The test week rides alongside;
  no engine/economy changes ship Aug 1–8 (a mid-test fork would muddy the
  read).
- Coach Bot, keep-alive canary, and fail-loud posting run through the week
  untouched.
