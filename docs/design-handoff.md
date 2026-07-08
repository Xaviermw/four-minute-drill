# Design handoff — Fable → Opus (2026-07-07)

I'm the design lead going off rotation; you're inheriting the whole seat.
This is everything in my head that isn't already in code or the other docs:
the taste rules behind the decisions, the designs that exist only as intent,
the traps, and how to make calls in my absence. The skill doc
(.claude/skills/four-minute-drill/SKILL.md) stays the operational bible —
this is the judgment layer above it.

Read order for any future session doing serious work here: SKILL.md →
this file → docs/macro-review-2026-07.md → docs/marketing-plan.md.

---

## 1. The soul of the game (protect this)

The identity crystallized across three redesigns, each replacing a weaker
version of the same instinct:

> **Everyone gets the same drive. Only your calls differ.**

- v1 was "underdog payout gamble" (weak roster = big multiplier). Retired:
  the cap does that job structurally.
- v2 was "play the hand you're dealt" (3-of-11 play options). Retired: once
  you PAID for Chase, being unable to throw to Chase felt like the game
  fighting you.
- v3 (current) is **"coach the team you built"**: cap-constrained draft, full
  offense targetable every down, the dealt element demoted to coverage
  (per-down depth per receiver). The dealt hand became texture instead of
  handcuffs. This is the right resting place — don't add a fourth constraint
  system without killing one first.

The product is a **ritual, not a session game**. Every design call should
survive the question: "does this still take ~90 seconds and produce something
worth pasting into a group chat?" Depth that costs legibility loses.

## 2. Taste rules (how I made calls; how you should)

1. **Never show a number the engine doesn't use.** The clutch meter reads
   `clutchMultiplier` itself so it cannot lie. The ghost self-check drops any
   ghost whose replay doesn't reproduce its claimed score. We killed per-play
   payout chips (implied targeting affected the multiplier — it didn't) and
   the FG make-% (owner: the player shouldn't see the odds). If a UI number
   and an engine number can drift, the design is wrong.
2. **Fake granularity is a lie wearing a UI.** Route-level calls aren't in
   public data; pass-direction splits fail sample math (79% of receiver
   bucket×tier cells were already under threshold). The rule: UI resolution
   must never exceed data resolution. Lateral seating is honest ONLY because
   it's presentation, not choice. (Upgrade path that stays honest: seat by
   real per-player `pass_location` tendency — see §4.)
3. **Teach once, then get out of the way.** One surface per fact. Hints are
   rookie-only (`state/rookie.ts`); HowItWorks is the reference; everything
   else is chrome. Feature work accretes explainer text — diet it on every
   pass. (The copy-diet commit `a041623` is the pattern.)
4. **Consent over cleverness.** The rookie drive failed as a silent default
   and worked as a one-time asked choice. Anything that redirects a user's
   intention needs their click.
5. **Evidence before build.** Sim before economy changes (scripts/
   sim-cap-draft.ts, ~3k drives/strategy), measure bucket coverage before
   granularity, screenshot before ship, spike branch + Vercel preview before
   core-loop changes. The cap, the scrub tier, the coverage palette, and the
   slim cap (75) were all numbers first, code second.
6. **The unit of growth is the group chat.** K = `lineup_link_opened` ÷
   `result_shared`. Every feature should answer: does this give someone a
   reason to send one more link? Ghost racing is the purest yes we've built.
7. **Determinism is the moat.** Replays, ghosts, shared dailies, the
   counterfactual coach note (unbuilt, §4) all hang on it. The three laws:
   `getOptions()` before every `choosePlay()` (the deal consumes exactly 3
   RNG draws/down, test-asserted); UI randomness must be a pure function
   (hash), never engine RNG; `CALL_ORDER` in ghost.ts is wire format,
   append-only forever.
8. **Owner vetoes on record** (do not re-litigate): no play-payout chips; no
   FG make-%; scenario is down 3 (not 2); balance is deliberately
   **pro-spend** (~11% cheap→max EV — free targeting rewards owning studs,
   his explicit call 2026-07-07); practice is opt-in.

## 3. State of the world (2026-07-07)

Live at www.fourminutedrill.com: cap draft ($25, $0 scrub gamble), coverage
palette on field-call targets, ghost racing, rookie gate, daily @ midnight
ET, Coach Bot Action (dry-run until secrets), SEO layer, privacy/about,
Sentry (dark until DSN), analytics funnel with `rookie`/`ghost`/`scrub`
dimensions. All numbered docs current. Owner still owes: Sentry DSN, Web
Analytics toggle, bot account secrets, GSC verification, 4minutedrill.com.

## 4. Designs that exist only as intent (specs from my head)

**a. Tendency-based lateral seating (August, with the data refresh).**
Today target lanes are a gsisId hash. The honest upgrade: pipeline emits, per
player per depth tier, the modal `pass_location` (left/middle/right) over
their career → seat targets there. "Chase lives deep-right" becomes true.
Pipeline field ~20 lines; laneFor() swaps to read it with hash fallback.
Keep the deconflict pass — tendencies collide more than hashes.

**b. The counterfactual coach's note (the skill-perception fix).**
Determinism means we can honestly answer "what if?" After a loss, find the
pivotal down (last 4th-down failure, or the down where FG was in range but
they went for it), clone the session inputs, replay with the one changed
call, and report ONLY what the replay actually produced: "Had you kicked on
that 4th & 3: GOOD from 41 — 40 pts left on the field." One line on the
result screen, expandable. Rules: never speculate beyond the replay; cap at
one note (don't turn the result into homework); rookie-gate it off (too much
for a first game). This is the single best answer to "it feels like a slot
machine" — macro-review P2. Medium build: session inputs are all in
DriveLog + roster; the replay harness exists in ghost.ts.

**c. Dynamic OG images (the unfurl upgrade).**
Share links currently unfurl with the static og.png. A Vercel Edge Function
(`/api/og`) reading the `g=` payload could render score + emoji grid + "race
my drive" per link (@vercel/og). Then every pasted link is a personalized
scoreboard. This is likely the highest-K single feature left. Gotcha: the
share URL's og tags are read by scrapers from the HTML, not the SPA — you'd
point og:image at `/api/og?g=...` via a tiny middleware or make share links
route through a `/r/<payload>` edge-rendered page. Spec carefully; don't
break existing links.

**d. Replay theater ("watch a drive").**
The ghost timeline already reconstructs any drive play-by-play. A view that
animates it (ball marker walking the field, play descriptions ticking) turns
every leaderboard row and ghost link into watchable content — and every
watchable drive into a screen-recordable clip. Mostly UI work over
`replayDriveCore`. Pairs with (c).

**e. Archive + season record (in-season retention skeleton).**
Past dailies as browsable pages (`/daily/2026-09-14`): the board, the
coverage, the Coach's drive. Doubles as the SEO content engine (the
"Wordle answers" search pattern). Needs edge/SSG rendering — the SPA can't
serve crawlable per-day pages. Plus a personal season W-L record
(localStorage now, Supabase later) culminating in a January "playoffs"
event for regulars. Ship archive early in season, playoffs planned by
December.

**f. Payload compaction (the real data lever).**
Bucket-capping topped out at −36% (33→23MB with gap fields). The remaining
fat is per-outcome JSON keys (`isTouchdown:false` × 130k). A compact
encoding (tuple arrays or bitfields) with a decode shim in the data loaders
could hit another 3-5×. It touches the sampling hot path and every fixture —
spec as its own PR with the sim as the regression gate. Worth doing before
any traffic spike; invalidates ghosts (ship between dailies, batch with a
refresh).

**g. Season-start board reset.**
Era mixing is real now (payout-era rows, cap-era rows, coverage-era rows).
Before September launch, propose to the owner: archive the all-time board
and start "Season 2026" fresh — clean comparability, and returning players
get a land-grab moment. Cheap: a `season` column or a `challenge_date`
cutoff in queries.

**h. Other sports (next year, only after football works).**
The engine's shape — situation → historical sample → outcome, deterministic
session — is sport-agnostic. MLB bottom-of-the-9th is the cleanest port
(retrosheet = the nflverse of baseball; outs ≈ downs, bases ≈ field
position). Don't start until FMD has proven retention; a second sport
doubles every surface.

**i. Monetization posture (unchanged from macro-review §5).**
Nothing before traction. Order: sponsorship (theme days are the native ad
unit — "The [Show] $15 Challenge" — vibe-check gambling brands hard) →
premium archive/stats → acquisition (Immaculate Grid → Sports Reference is
the comp; a strong Sept–Jan is the asset). If sponsorship talks ever start,
revisit right-of-publicity posture on player names first.

## 5. Known debt & traps (so they don't surprise you)

- **The August data refresh is THE calendar item.** 2026 rosters, price
  re-rank (freeze prices for the season after), tendency seating (a),
  possibly compaction (f) — one regeneration, shipped between dailies,
  ghosts invalidated once. After Sept 1: economy frozen, additive only.
- **Field targets on real phones**: owner thumb-test still pending as of my
  departure. The deconfliction is heuristic; red-zone density and the
  same-lane 18-yard window may need tuning from feel, not theory.
- **The sim's policy is crude** (rotates spots). Free targeting makes a
  greedy-EV policy meaningful — build one before trusting any future balance
  read; the pro-spend number will move.
- **Coach Bot copy will wear out** (three variants). Add a rotation before
  September; keep the self-deprecating loss voice — beatable is the brand.
- **`?classic=1` button list**: second render path for options. Either keep
  it tested (it's the a11y hatch) or kill it deliberately — don't let it rot.
- **Copy-surface drift** is the recurring failure mode (HowItWorks taught a
  dead economy twice-over). The grep ritual after ANY mechanic change:
  coach strip, HowItWorks, hints, shareText, about.html, launch-kit, OG
  tags, README, SUPABASE_SETUP.
- **Migrations**: recreated insert policies MUST re-include `name_ok` and
  every prior bound (the 005/008/009 trap). Pooler first, deploy second.
- **e2e flakes cold**: first parallel Playwright run after a rebuild can
  time out on this machine; serial rerun before believing a failure.
- **The name pedantry**: "four-minute drill" is technically the
  clock-killing offense. Owned, never argued: "in this game, the drill
  takes four minutes."
- **Supabase anon-auth limits + Vercel bandwidth** are the viral-day
  ceilings; the $25 Pro flip is the morning-of move.

## 6. Working with the owner (the part that matters most)

He's decisive, moves fast, and his instincts have beaten mine twice — the
rookie gate (consent) and killing the play chips (honesty) were his calls
against my shipped designs, and he was right both times. Patterns that work:

- **Bring numbers and screenshots, not adjectives.** Every accepted proposal
  in this project rode in on a sim table or a PNG.
- **Spike branches + Vercel previews for core-loop changes** — he decides
  with his thumbs, on his phone. Never merge feel-changes unfelt.
- **When he says "does that make sense?" he wants sharpening, not
  agreement.** Find the strongest version of his idea (the coverage palette
  was his sentence; the dealt-depth framing made it buildable).
- **State the costs plainly** (daily forks, ghost invalidation, era mixing).
  He accepts costs readily when they're named before, not after.
- **He'll say "sounds fake" to anything ghost-written in his voice.** Give
  him shape and principles for personal-voice things, never scripts.

## 7. The one-line summaries, if you keep nothing else

Ritual over depth. Honest numbers only. Data resolution bounds UI
resolution. Teach once. Ask, don't default. Sim first, screenshot always.
The group chat is the customer. Determinism is the moat. The calendar
(August refresh → Sept 1 freeze → kickoff launch) is the strategy.

It's been a hell of a build. Take care of it.

— Fable
