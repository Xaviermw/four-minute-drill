# Outreach plan — the Two-Minute Drill lesson (written Oct 20, 2026)

On Oct 14 an anonymous account posted one text-only tweet — *"Think you can
coach a game better than an NFL Head Coach? Prove it with my new app."* — and
nfl2mindrill.com had 33k likes, Forbes/Yahoo/Operation Sports explainers, and
eight squatter domains within five days. No visible spend. Meanwhile 106 of
our 115 season players came from Reddit ads, and once the spend stopped on
Sep 30 we fell from ~80 weekly entries to 5. We bought visits; they built a
thing people post about themselves.

**The rule this plan runs on: payload before push.** Their "outreach" was one
tweet; what carried it was the card people could post afterward — *Better
than 98% of NFL play-callers · Coached like Dan Campbell · Beat the real
coach*. Every contact below is one shot per person. We do not spend it on the
current card ("33 pts, built for $0 of $25" says nothing about the reader).

## Step 0 — the payload (Claude, Oct 20–30)

1. **Share card v2.** Three lines about the *person*, then the grid, then the
   link, Wordle-numbered so it reads as a ritual:
   `Four Minute Drill #41 · Better than 74% of today's field · Called it
   like Dan Campbell · Saved the Bears on a $23 roster · 🟨🟩🟨🟩🟥🏈 · url`
   - percentile vs today's field: already computed (`fetchDailyDrivePercentile`).
   - "Called it like ___": a tendency fingerprint (pass rate, deep rate,
     4th-down aggression, tempo) matched to a table of real head coaches
     built from nflverse pbp 2023–2025 in the pipeline. Deterministic, one
     coach per drive, never a dig at a coach (it is a compliment or neutral).
   - the verdict line comes from #2.
   - **Shipped Oct 20** (text card; image card and OG unfurl unchanged).
     Two calls made on the first real card: the standing line stays off
     below 10% ("Better than 2%" is a self-own nobody posts; the score line
     already tells the truth), and the coach table is limited to head
     coaches active in the latest season (26) -- the first run matched a
     four-and-out to Frank Reich, which reads as a dig.
2. **The daily is a real moment.** Keep the draft and the cap — that is the
   game — but set each daily's scenario (score, clock, spot, opponent) to a
   real ending from the previous NFL week with 2:00–4:00 left and the team
   trailing: *"Could your $25 roster have saved the Bears?"* Pipeline picks
   the drive deterministically from pbp we already fetch and writes a tiny
   per-date scenario file; the engine already takes a scenario. The real
   coach's result is the bar to beat. (Full "actual 22 on the field, graded
   on win probability" is weeks and is becoming them — not this step.)
3. **Dynamic OG for daily share links** (we already have `/api/og` for ghost
   links) so a posted card unfurls as the poster's own result. They ship a
   static og.png; this is an edge we can own.
4. **First screen = one decision.** At phone width a cold visitor to 2MD
   sees: today's real matchup, two "take over as ___" buttons, done. Ours
   shows a practice banner, a blocking "First time here?" modal, a 3-bullet
   coach strip and a budget tracker before the first card. Proposal: the
   first screen IS today's named moment with a small "practice first?" link;
   the rookie gate's two choices survive, no longer as a wall. **Owner
   decision** — the blocking gate was an explicit owner call (silent
   defaulting was rejected as unclear), so this changes that call, not just
   the layout.
5. **Home-screen install.** A web manifest (standalone, icons,
   `start_url=/?utm_source=homescreen`) — they have one, we have none. Cheap,
   and it is a retention mechanic for a daily.
6. **Search footprint.** "four minute drill game" currently returns a
   coaching term and a WordPress blog. Title/meta/about + a how-it-works page.
   Eight squatters in five days is how fast that ground goes.

## Step 1 — the list (Claude, automated research, by Oct 27)

A file, `docs/outreach-list.md`: handle · platform · why them · what they
posted · the one-line personal hook · status. Three tiers.

- **Tier A — the nflverse / analytics crowd.** We are built on their data
  (per-player nflverse pbp, 2015–2025); that is a credential in this room.
  Candidates to verify: the nflfastR/nflverse maintainers, Ben Baldwin,
  Tej Seth, Arjun Menon, Sumer Sports, Sharp Football, Josh Hermsmeyer, the
  nflverse Discord showcase. Many of these people are active on **Bluesky**,
  where Coach Bot already posts — Bluesky is not useless for this tier.
- **Tier B — proven card-posters.** The accounts that quote-tweeted 2MD with
  their own cards inside 40 hours: Geoff Schwartz, Theo Ash, Robby_NFL,
  GunslingerViews, James Skrmetta, Devin's Bookie, Sean Reider, zilischive,
  Dylan Hornik, JM Football (YouTube). They have demonstrated the exact
  behavior we want. One message each, ever.
- **Tier C — rooms.** nflverse Discord, Operation Sports (covered a one-day-old
  app from a tweet), the Forbes contributor and Yahoo writer who wrote the
  2MD explainers ("the draft-and-cap take on the same idea" is a natural
  follow-on), Show HN, the 2+2 puzzles forum and team boards that already
  discuss 2MD, r/NFL-adjacent subs where "I made a daily NFL game" posts are
  welcome (verify rules per sub before listing).

## Step 2 — the sends (owner, ≤10 minutes a week; Claude drafts)

The irreducible human part. Claude cannot DM as you, post as you, or email
as you — and the competitor did none of that either; humans posting their
own cards did the work. What Claude can do is put the week's drafts in front
of you so sending is pressing a button.

- **One shot per person.** Personal line (why them — ideally the card they
  posted), today's card, the link. Never a second message. DMs from your
  account; emails from the brand Gmail; community posts as the maker,
  disclosed. Drafts live in the list file; you edit and send.
- **Timing is the NFL week.** Sunday night and Monday are when play-calling
  arguments peak. Batches go Monday/Tuesday, with that week's real ending in
  the card ("the Bears' ending — could you have saved it?").
- **Rooms** get one well-made post each (card, one paragraph on the draft +
  cap idea, link, "built on nflverse data"), not a drip.

Draft templates (brand voice for email; the DM is a skeleton you personalize):

> **DM (Tier B):** Saw your Two-Minute Drill card — you're clearly the
> audience for this. I make Four Minute Drill: same nflverse data, but you
> *draft* the six players under a $25 cap first, then call the drive. Today's
> is the [team] ending from Sunday. Here's my card: [card]. Beat it: [link]

> **Email (Tier C press, brand Gmail):** Subject: The draft-and-cap take on
> the two-minute-drill game. You covered Two-Minute Drill last week. Four
> Minute Drill is the other half of that argument: before you call the
> plays, you have to build the roster under a $25 cap from real players
> (nflverse play-by-play, 2015–2025), so "could you have saved the Bears?"
> also asks "with whom?" Daily, free, no account. One real ending a day,
> season table, weekly winners. [card] [link] — happy to answer anything.

## Step 3 — the brand engine (Claude, automated, allowed)

- **X, back on, as a disclosed brand bot.** The viral event happened on X;
  Bluesky has no NFL argument culture. X's free tier is gone; pay-per-use is
  about $0.015 per post and about $0.20 per post containing a link (2026
  pricing write-ups — verify in the developer console before buying credits).
  Three posts a day with links ≈ $18/month; link-free posts with the link in
  the bio ≈ $1.50/month. **Owner decision** (X was retired Sep 16 over $5 of
  credits, before this evidence existed).
- **Coach Bot posts the real moment**, not a robot's score: *"Bears blew it
  from the 23 with 2:40 left. Coach Bot's $25 roster: 41 pts. You?"* plus
  the evening recap and the Thursday winner, on both networks.
- **Weekly digest** (GitHub Action, Monday 8am ET → job summary + brand
  Gmail): organic devices/day, cards shared, new mentions (Bluesky API +
  Google Alerts for "four minute drill"; X mentions need the paid read API —
  skipped), and the week's five suggested outreach drafts with the hook
  pre-filled. You read it, send what you like, done.
- **Attribution per channel.** First-touch `utm_source` already lands in
  `scores.source`: use `x`, `bsky`, `dm`, `nflverse`, `hn`, `press`,
  `homescreen`. The season/weekly views split by it for free.

## What this plan will not automate, and why

No auto-DMs, no auto-replies to strangers, no posting under identities that
are not plainly the brand or the owner, no mass email. Those get accounts
banned and brands remembered for the wrong reason — and nothing in 2MD's
spread used any of them.

## Measurement and the kill/scale rules

Baseline today: 2–3 daily players, ~1 organic device/day, 0 players at 20+
season days. Push-week targets: **50+ organic devices in a day; 10+ cards
posted by people who are not us.** Rules:

- A Tier B batch of 15 that produces zero posted cards means the **payload**
  is wrong, not the list — fix the card before sending more.
- A posted card that gets no clicks (OG unfurl, link placement) is a card
  problem; a click that doesn't play is a first-screen problem. Both are
  visible in the funnel events.
- Do not restart Reddit spend to compensate. 106 paid players, none kept
  past 20 days.

## Calendar

- **Oct 20–30:** Step 0 builds (card, real-ending daily, OG, first screen if
  approved, manifest, search). Step 1 list in parallel.
- **Mon Nov 2** (after Week 8's Sunday): first push — Tier A + B batch,
  nflverse Discord, Show HN, press emails. Coach Bot on X if approved.
- **Mon Nov 9:** second wave with week-one results in hand; rooms that
  warranted a second look.
- **Nov 16 readout:** did posted cards appear, did organic hold after the
  batches, which channel's `source` retained.
- **January:** the playoffs are the peak of late-game drama; the whole loop
  runs again with "the actual playoff ending" as the daily.
