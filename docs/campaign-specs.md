# Campaign paste-sheets

Everything needed to rebuild a campaign without chat archaeology. Creative
images live in `docs/ad-creatives/`.

## Trickle (Aug 13 – Sep 5) — continuous QA stream

Reddit Ads → Create Campaign (Max flow; Duplicate is disabled for Max
campaigns, build fresh):

- Name: `4md-trickle`
- Objective: Traffic · Bid: Lowest cost
- Destination URL:
  `https://www.fourminutedrill.com/?utm_source=reddit&utm_medium=cpc&utm_campaign=trickle`
- Communities: r/fantasyfootball, r/DynastyFF, r/nfl (+ r/SalaryCapFantasy
  optional) — pick from the dropdown so they become pills; estimates panel
  should read in the millions
- Interest groups: empty · Location: United States · Devices: all
- Budget: **$2/day DAILY** (not lifetime) · Schedule: **Aug 13 → Sep 5**
- Media: the three `*-1200x628.png` boards · Thumbnails: the three
  `thumb-*.png`
- CTA: Play Now

### The 15 headlines

1. `Test your NFL IQ in Four Minute Drill`
2. `Stop waiting for Sunday. Get your football fix with Four Minute Drill and put your salary cap skills to the test today.`
3. `Ditch the season-long grind. Test your NFL IQ with Four Minute Drill and compete for daily wins.`
4. `Draft 6 NFL players under $25. One drive to win it. Same board as everyone today.`
5. `Think you can call a better drive than your coach? Prove it in Four Minute Drill, the daily football strategy game.`
6. `You have $25 – draft a roster and score as time expires`
7. `Test your NFL IQ. Play now.`
8. `Down 3, 4 Minutes on the Clock. Draft your team and win`
9. `Have the Clutch gene? Draft the winning drive`
10. `Our robot coach scored 9 points today. Beat him or live with that.`
11. `$25 cap. Studs cost $10. Kickers cost $1. Choose your pain.`
12. `4th & 12, down 3, no timeouts. What's the call?`
13. `The all-$1 roster has never once been the right answer. Prove us wrong.`
14. `Everyone gets the same board at midnight. One drive. No do-overs.`
15. `Real players, a decade of real play-by-play. Two minutes a day.`

("daily fantasy" phrasing stays banned — reads as DFS gambling to reviewers.)

## Finding (Aug 13, smoke-test Assets tab): one combo took every impression

Reddit Max does NOT rotate assets at small budgets -- it elected one combo
immediately and served it 7,226/7,226: **coach-bot board + "Our robot coach
scored 9 points today. Beat him or live with that." + Play Now**. All other
headlines/images: zero impressions. So the 4.0% CTR belongs entirely to the
robot-coach taunt -- the cleanest possible single-creative result, and the
proven kickoff lead. Corollary: passive A/B doesn't happen in Max; to learn
a runner-up, test SEQUENTIALLY (pause the coach-bot headline in the trickle
for ~a week and let the algorithm elect #2).

## Meta $40 test (Aug 14 – ~24)

adsmanager.facebook.com → Create. Leads with the Reddit-proven creative.

- Objective: **Traffic** (decline any Advantage+ campaign upsell; A/B off)
- Campaign name: `4md-meta-test`
- Ad set: Conversion location **Website** · Performance goal **Maximize
  number of landing page views** (no longer needs the pixel — Meta measures
  the load in its in-app browser; optimizes for arrivals, not thumb-taps)
- Budget: **$40 LIFETIME** on the ad set · Schedule Aug 14 → Aug 24
- Audience: US, 18+, detailed targeting/interests: **Fantasy football**
  (+ NFL if it asks for more) — if the UI pushes "Advantage+ audience",
  add those as interest suggestions; it constrains delivery enough at $40
- Placements: switch OFF Advantage+ placements → manual: **Facebook Feed,
  Instagram Feed, Facebook Reels, Instagram Reels** only (Audience Network
  is where small budgets go to die)
- Ad: Identity = Four Minute Drill Page · Single image ·
  **coach-bot-1200x628.png** (the proven board)
  - Primary text: `Our robot coach scored 9 points today. Beat him or live
    with that.`
  - Headline: `One drive. $25 cap. Free.`
  - Description: `New drill daily — same board as everyone.`
  - URL: `https://www.fourminutedrill.com/?utm_source=meta&utm_medium=cpc&utm_campaign=meta-test`
  - CTA button: **Play Game** (Meta has it)
- Account spending limit $40 should already be set (runbook §2 step 5) —
  belt and suspenders with the lifetime budget.
- Expect "in review" up to ~24h on a first ad. Benchmarks from Reddit:
  $0.14 CPC / 4.0% CTR — Meta will likely cost more per click; what matters
  is cost per PLAYING device via the `meta` source tag, readable in SQL.

## Bridge (Sep 6–9) — keep the boards warm

Clone of the trickle: $5/day, Traffic, Lowest cost, same communities and
creative, URL `utm_campaign=bridge`. Exists because the trickle ends Sep 5
and the burst starts Sep 10.

## Kickoff burst (Sep 10–16) — the push

Reddit only; Meta is out (its $40 bought 8 devices vs Reddit's 154 — see
docs/kickoff-playbook.md). Settings as the trickle except:

- Name `4md-burst`, URL `utm_campaign=burst`
- Budget **$15/DAILY** (never lifetime for the burst: a lifetime budget can
  be eaten in hours on a hot day), Sep 10 → Sep 16
- Starts ON opening day — the promise "every drill counts toward your season
  score" is only true from Sep 10
- Lead creative unchanged (coach-bot board + robot-coach taunt), plus two
  kickoff-only headlines:
  - `Week 1 starts today. Every daily drill counts toward your season score.`
  - `Our robot coach has a season score. Yours starts today.`

Benchmarks to beat: $0.14 CPC, 4.0% CTR, ~$0.27/playing device. Expect CPC
to rise in kickoff-week auctions; ~$0.30 is still fine.
