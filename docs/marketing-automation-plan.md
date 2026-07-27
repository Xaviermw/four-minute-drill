# Marketing on autopilot — July 27 revision

Owner constraint changed: **near-zero founder hours, some ad budget
available**. This reorders the July plan (marketing-plan.md §6) — everything
that needed Xavier's daily presence (group-chat seeding, Reddit
karma-building, Discord membership) moves from "Tier 1" to "only if he feels
like it." What remains must run itself.

One line we don't cross: no undisclosed automation — no sockpuppets posting
"just found this!" into subreddits, no auto-DMs, no fake engagement. Besides
being fake (see the tweet-draft lesson), new domains with spam signals get
banned by Reddit's filters permanently, which would kill the best organic
channel NFL games have. Every automated voice below is *openly* the game's
own bot. The players are the undetectable marketing — because they're real.

## A. The automated engine (code — no recurring owner time)

Ranked by leverage; 1–2 are near-done, 3–5 are new builds.

1. **Coach Bot goes live** (built, blocked on accounts). Daily X + Bluesky
   post: today's challenge + raceable ghost link. Owner does the ONE ~30-min
   task: create @fourminutedrill on X and Bluesky, drop the 6 secrets into
   GitHub Actions (launch-kit.md §5 has the steps). Everything after is
   automatic, forever.
2. **Evening results post** (small daily-bot extension). Second scheduled run
   ~11pm ET: pull today's board via the public REST API — "Coach got beat by
   41 players today. Top drive: 212 pts on a $19 roster." Score-envy is the
   hook; zero human input.
3. **Dynamic OG images** (the unbuilt design-handoff spec — highest-leverage
   build). Today every shared ghost link unfurls as the same static card. A
   tiny edge function rendering score + emoji grid + team into the OG image
   makes every player's share a personalized ad. This multiplies the loop
   that already exists (`result_shared` → `lineup_link_opened`) on every
   surface links land — group chats, X, Discord — and WE never post anything.
4. **Daily archive pages** (SEO that compounds). Static `/archive/<date>`
   pages: that day's board, winning roster, the Coach's result. Gives Google
   a site that grows daily instead of a one-page SPA, gives the bot
   permalinks to cite, costs one build-time loop.
5. **Weekly recap automation** (Sunday Action). "This week: hardest daily
   (only 9% scored), streak leader (11 straight)" → posts + an archive page.
   Content that writes itself from data we already store.

## B. Paid ads — yes, small, timed (the honest version of "pay instead of grind")

Truth first: a free game with no revenue never recoups ad spend in dollars.
Ads are justified ONLY as ignition for the share loop — buy the seed cohort,
let K-factor do the multiplying. The July plan said "no paid ads" under a
founder-hours model; under a budget model they're the right tool.

- **Budget: $400–600 total.** $100 smoke test late August (validate the
  funnel while the season's warming up), the rest as a kickoff-week burst
  (Sep 8–14), which is when a daily NFL habit is actually formable.
- **Where:** (1) **Reddit Ads** — feed placement targeted to
  r/fantasyfootball / r/nfl / r/DynastyFF. It's the audience bullseye and the
  legitimate way to be in those communities without karma-building. (2)
  **Meta (IG/FB)** — interest-targeted mobile traffic, cheapest reach for a
  thumb-first game. Skip Google Search (no query volume exists yet) and
  TikTok (creative production is a founder-hours tax).
- **Creative:** I build it — static cards from the OG pipeline (real drive,
  real prices, "Draft under $25. One drive. Everyone gets the same board.")
  plus a 20s screen-capture GIF of a two-minute-warning finish. A/B the
  price-debate hook ("Chase is $9. Worth it?") against the challenge hook.
- **Measurement (already wired):** UTM → Vercel Analytics + our funnel
  events. The metric is **cost per D1-retained player**, not CPC. Kill rules:
  CPC > $2 sustained, or D1 return < 20% on ad traffic → stop spending, the
  product isn't ready for cold traffic yet (that's a finding, not a failure).
- **Owner's part:** create the two ad accounts + payment method (~30 min,
  can't be delegated), approve creatives before they run, set the hard cap.

## C. What stays human (the complete list)

1. Create bot accounts on X + Bluesky, paste 6 secrets into GitHub (~30 min).
2. Create Reddit Ads + Meta ad accounts with a spend cap (~30 min).
3. Approve ad creatives (one thumbs-up per batch).
4. Optional, whenever: post in your own voice. Never scripted by us — the
   game's Copy Result output IS the post.

Everything in the old plan that assumed founder presence (SFB community
participation, mailbag recruiting, Discord membership) is now explicitly
optional garnish. If traction earns inbound (a host finds us), the response
assets in launch-kit.md are ready.

## D. Build order & calendar

- **This week:** owner does C1 (bot accounts) → Coach Bot live. I build A2
  (evening post) and start A3 (dynamic OG).
- **Aug 1–15:** A3 ships behind the share flow; A4 archive pages ship with
  the 2026 data refresh (same deploy window, per pre-season-plan).
- **Aug 20–31:** C2 ad accounts; $100 smoke test runs; A5 weekly recap ships.
- **Sep 1:** economy/engine freeze (unchanged). Marketing code is outside the
  freeze surface (bot, OG, archive are additive).
- **Sep 8–14 (kickoff):** ad burst + Product Hunt (the one launch-day human
  task worth 3 hours if the owner opts in; otherwise skip — the engine
  doesn't depend on it).

## E. What we'll know and when

Weekly 15-minute check (dashboard queries already exist): shares per
completed drive, ghost-link opens per share (K), D1/D7, and — once ads run —
cost per retained player. Decision gate Sep 15: if K ≥ 0.3 and D7 ≥ 15%,
scale the burst with another $500; below that, stop spend and go back to
product (retention is the bottleneck ads can't fix).
