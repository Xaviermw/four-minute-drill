# Four Minute Drill — macro review (July 2026)

Overnight strategic pass over the whole project: product thesis, risks,
growth, expansions, money. Opinionated on purpose; everything here is a
proposal, not a decision. Companion finds shipped tonight: the How It Works
modal still taught the retired payout system (fixed), and the flaky ET
daily-id test got its one moving part removed (Intl formatter hoisted).

## 1. What this product actually is now

After the cap cutover, the game has a cleaner identity than it's ever had:

> **A daily decision puzzle wearing a football broadcast's clothes.**
> Build the best team $25 buys, then out-call everyone on the same drive.

The under-appreciated fact — worth building marketing *and* retention around —
is that the daily is a **shared-deal puzzle**: every player gets the same
three options per slot, the same prices, and the same drive seed. Outcome
differences are decisions (draft build, play calls, tempo, when to kick).
"Everyone gets the same game; only your calls differ" is a claim Wordle can
make and almost no sports game can. We barely say it anywhere.

Who it's for: the fantasy-football-adjacent fan who wants a 90-second ritual
with real NFL texture — not the hardcore DFS optimizer (too little control),
not the pure casual (too much football). That's a huge audience and exactly
the audience that spreads things through group chats in September.

**What's genuinely strong:** differentiated concept; determinism/replay
architecture (enables features competitors can't cheaply copy — see ghost
racing below); the share loop (emoji grid + image + beat-my-lineup links);
polish level way above prototype; funnel analytics in place before launch.

## 2. Pitfalls, ranked

**P1 — A stranger's first-ever drive is their only daily shot.** Default mode
is `daily`, one attempt. New visitors learn the UI by burning their one
chance, lose (55% do), and get "come back tomorrow." That's the single worst
funnel moment in the product. *Fix: a "rookie drive" — first-time visitors
play a clearly-labeled practice drive first (reuse free play + a banner),
then the daily unlocks. Probably the highest-ROI retention change available.*

**P2 — Skill has to be *felt*, or it reads as a slot machine by day 7.**
Win% ~45% with high variance. The loss consolation (yards points) and the
percentile line help, but a regular needs evidence they're improving. Ideas,
cheapest first: (a) say the shared-deal fact loudly ("today's field: 41% of
players scored — you're top 18%"); (b) show the field's outcomes on the same
board (wins get a rank line too, not just losses); (c) the killer feature:
**counterfactual coach's note** — determinism means we can replay the drive
with one changed call and honestly say "had you kicked on that 4th & 3, the
FG was good — 40 pts left on the field." No other sports game can do this
honestly. Medium build, huge "one more try" energy.

**P3 — Season timing and roster staleness.** The pool is 2015–2025 careers;
in September, "why is this guy on that team/retired" breaks the spell. The
2026 season opens ~Sept 10 — that's the launch window, and the data refresh
must land in August. Decision needed: **freeze prices for the season**
(recommended — repricing shuffles the board's meaning) vs. weekly re-pricing
(topical but churns daily comparability and invites re-litigating prices).

**P4 — Payload weight.** `public/data` is 33MB; veteran players run ~1MB
each; a drive loads six. Compression helps on the wire, but it's still heavy
for mobile and it burns Vercel bandwidth under any real traffic. *Fix: cap
outcome samples per bucket in the pipeline (e.g. ~150/bucket) — likely 5–10×
smaller with negligible sim fidelity loss.* Caveat: slimming changes what
seeds sample, so it must ship **between** dailies and it invalidates replay
of previously-shared drives — do it once, pre-launch, not after.

**P5 — Ops under virality (solo-project failure modes).** No error
monitoring (add Sentry free tier or equivalent); Supabase free-tier auth
rate limits and DB size worth a pre-launch review; no scores-table backup
(a weekly pg_dump via the pooler is 10 minutes of setup); **no privacy
policy/terms page** — we collect display names + analytics; a one-page
policy is table stakes before asking press/Reddit for attention.

**P6 — Copy-surface drift.** Tonight's find: the cap shipped while How It
Works still taught payout multipliers. The copy surfaces are scattered
(coach strip, How It Works, draft hints, share text, OG description,
README). *Fix: a release-checklist line in the skill doc — "grep user-facing
copy when an economy/mechanic changes." Added tonight's fix; keep the habit.*

**P7 — Legal posture (fine, stay disciplined).** Player names + stats in
games have strong US precedent (the fantasy-sports line of cases); team
*colors* as plain hex values and jersey numbers are fine. The discipline:
no logos, no headshots (already decided), no "NFL" in the name or domain,
and revisit rights questions before taking money (sponsorship changes the
right-of-publicity calculus).

## 3. Growth plan to kickoff (~Sept 10)

**July — instrument and harden.** Rookie-drive onboarding; payload slim;
domain purchase (`fourminutedrill.com`) + hardcoded OG URL fix; privacy page;
Sentry; add a `scrub_taken` analytics event (we can't currently see how often
the dice gets rolled) and a win-rank line. Watch the funnel weekly; the
number that matters is **D7 return of daily players** (want ≥15–20% from the
soft-launch cohort before spending launch ammunition).

**August — refresh and load the cannon.** 2026 roster/data refresh + price
freeze; re-seed boards modestly; friends-and-family wave (20–50 real
players); record share-worthy clips (an all-scrub $0-team win attempt is
inherently content); draft the Product Hunt listing and 2–3 launch posts;
build the podcast pitch: *fantasy podcasts doing "we all played the same
daily, compare on air" segments* — the shared seed makes this format work,
and it's the single best-fit distribution channel this product has.

**September (kickoff week) — go loud once.** PH launch midweek;
r/fantasyfootball + r/nfl (participate genuinely or have a community member
post — both subs punish drive-by self-promo); podcast/newsletter outreach.
No paid ads — this genre spreads socially or not at all.

## 4. Expansion map

**Horizon 1 (pre-season, cheap):**
- **Theme days** — config-only variants: "$15 Tightwad Tuesday," "$40
  Splurge Saturday," "kicker-chaos day." Variety at near-zero eng cost.
- **Ghost racing** — replay determinism means a shared link could show the
  friend's drive play-by-play *alongside yours on the same field*. This is
  the feature competitors structurally can't copy; it upgrades
  "beat my lineup" from a link into an experience.
- **Season record** — daily results accumulate into a personal W–L; January
  "playoffs" for regulars. A retention skeleton timed to the real calendar.
- **Scrub reveal moment** — the dice roll currently just... assigns. It
  deserves a beat of suspense (small, pure delight).

**Horizon 2 (in-season):** Perfect Lineup Friday (full-board weekly mode —
concept B, already parked); past-dailies archive; the counterfactual coach's
note (P2c); weekly form pricing *only if* the freeze proves too stale.

**Horizon 3 (next year):** other sports — MLB bottom-of-the-9th is the
cleanest analog (retrosheet is the nflverse of baseball); NBA final
possession. The engine's shape (situation → historical sampling → outcome)
ports; everything else is new data pipeline.

## 5. Money and endgame (explicitly later)

Don't monetize before there's a September. Ranked options when there is:
1. **Sponsorship** — a daily NFL-decision game is a natural DFS-adjacent
   funnel (Underdog/PrizePicks/DraftKings), with the caveat that gambling
   sponsorship changes the game's vibe and legal surface; sports-media
   sponsors are the calmer version.
2. **Premium** — archive + stats + streak insurance for $2–3/mo; only
   defensible with a real DAU base.
3. **Acquisition** — the honest comp: Immaculate Grid was acquired by Sports
   Reference after one strong season. A good Sept–Jan with real retention
   numbers is the asset; Sports Reference / The Athletic / theScore are the
   plausible calls in the new year.

## 6. What I would *not* do

- No paid ads, ever, at this scale.
- No accounts/logins — anonymous + localStorage is a feature, not a gap.
- **No scoring/economy changes after Sept 1.** The cap just landed; let it
  season. Lock the economy before strangers arrive so scores stay comparable.
- No second daily mode before kickoff. Focus beats variety pre-launch.

## 7. Next ten actions, in order

1. Rookie practice drive before the daily unlocks (M) — biggest funnel fix
2. Slim player datasets in the pipeline, ship between dailies (M)
3. Buy fourminutedrill.com; fix hardcoded OG image URL + meta (S)
4. Privacy/terms page (S)
5. Error monitoring (Sentry free tier) (S)
6. `scrub_taken` event + win-rank ("top N% today") line (S)
7. August: 2026 data refresh + season price freeze (M)
8. Ghost-racing replay for shared drives (L, the moat feature)
9. Theme-day config scaffold (S)
10. Launch kit: PH draft, posts, podcast one-pager (M, mostly human)

— Fable, overnight 2026-07-05
