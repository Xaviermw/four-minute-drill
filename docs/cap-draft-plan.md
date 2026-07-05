# Cap Draft — implementation plan (concept A, approved)

Owner's call (July 2026): replace the payout-multiplier economy with a **$25
salary-cap draft**. Keep the dealt-hand draft flow; every card gets a price,
the team must fit the cap, and the payout multiplier retires. This is a
scoring-identity change — shipping pre-season on purpose, since scores change
meaning. Old system stays recoverable (see "Preserving the old system").

Evidence: `app/scripts/sim-cap-draft.ts` (committed with this doc) — ~30k
engine drives. Key findings the design locks in:

1. **Rank-based pricing, not rating-based.** Raw-rating pricing skews cards
   expensive (pool is stud-heavy) and pins every build at ~$23. Percentile
   pricing spreads $1–$10 evenly per position → cheap builds ~$18, spenders
   $25, and build choice moves win% 40.7 → 45.1.
2. **No leftover-budget reward.** ×1.0–×2.0 on unspent cap makes cheap
   dominant (EV 82.5 vs 54.6). EV-neutral is ~1pt/$ (feels like nothing).
   With no reward, EV is near flat with a slight pro-spend lean, which is
   right for a DFS-style format. Unspent cap is a **share-text flex only**.
3. The cap replaces the multiplier as the balance mechanism. Both together
   double-compensate.
4. **Final spec validated** (scrub tier live, no leftover reward, 2k
   drives/strategy): paying strategies EV 52.2–56.1 (within ~7%);
   **allScrub EV 40.7, win% 32.3** — the $0 team is a real gamble, never
   the correct play. ~10% of slots see all 3 dealt cards locked, so the
   forced-scrub moment genuinely occurs. Repro:
   `npx tsx scripts/sim-cap-draft.ts 2000 25 18 percentile bonus0`.

## Locked decisions

- Cap **$25**, prices **$1–$10 by position rank** (see Pricing).
- **$0 scrub tier** (owner's addition): the bottom of each position is priced
  $0 and **never appears among the 3 dealt options**. Instead, every slot has
  a permanent 4th option: **"Give me a scrub · $0"** — randomly assigns a $0
  player of that position. This *replaces* the reserve/guard mechanism
  entirely: no $1-per-slot holdback, no dealer guard, no way to brick the
  draft, budget can legally hit $0 spent... or all six slots can be scrubs
  (the "$0 team" meme build is allowed and intended).
- Unaffordable dealt cards render **locked** (dimmed, disabled, "Over budget"
  tag) — visible, not hidden. Seeing what you can't afford is the sting.
- Scoring: **`base × clutch + driveYards points`**. `rosterMultiplier` is no
  longer applied (breakdown reports it as 1). Yardage consolation (0.5/yd)
  stays but is **no longer multiplied by anything** (it had only the roster
  multiplier — verify tests reflect this).
- Daily fairness: prices are pure functions of the manifest (same for all);
  options dealt exactly as today; the **daily scrub is seeded** per
  challenge+slot (`seedFromString(`${id}:scrub:${slot}`)`) so everyone who
  gambles on the QB scrub today gets the same guy. Free play scrubs use
  `Math.random`.
- Share/replay/lineup codes unaffected (lineups are still 6 gsisIds).

## Pricing spec (`app/src/draft/pricing.ts`, new)

Deterministic, computed from the manifest at load, single source for UI +
tests + seed script:

- Per position, sort by `(rating asc, gsisId asc)` (stable ties).
- Bottom `max(3, floor(0.2 × n))` players → **$0 scrub pool** (never dealt).
- Remaining m players: `price = round(1 + 9 × rank / (m − 1))`, rank 0..m−1
  ascending → $1..$10 spread evenly by rank.
- Export: `priceFor(entry)`, `scrubPool(players, position)`,
  `dealablePool(players, position)`, `CAP = 25`.
- `drawSlotOptions` draws from `dealablePool` only. WR exclusion logic
  unchanged; scrub assignment must also exclude the drafted WR.

## Build order

**PR 1 — pricing + draft UI** (`pricing.ts`, DraftScreen, RosterSlotPicker,
PlayerCard, TeamPanel, draft.css):
- PlayerCard: optional `price` prop → renders `$N` tag where the payout chip
  sits; **when absent, the payout chip renders as today** (this keeps the old
  card path alive for leaderboard/legacy surfaces). Locked state = `disabled`
  + `.locked` class (don't rename `.player-card` — e2e).
- DraftScreen: track `spent`; affordable = `price ≤ 25 − spent`. Render the
  scrub button as a 4th option under the trio ("🎲 Give me a scrub · $0 ·
  random [position]"). Budget tracker replaces TeamPanel's payout bar:
  "$18 spent · $7 left" + segmented bar (mock: claude.ai artifact
  "The $25 Draft"; the yellow reserve line from the mock is **dead** — scrubs
  made it unnecessary).
- Coach-strip copy: replace the ×Payout bullet with the cap ("Everyone gets
  $25. Studs cost, scrubs are free — spend it or flex it.").

**PR 2 — scoring + result/share** (driveSimulator `computeScore`, ResultScreen
receipt, DailyDone, shareText, ResultCard):
- `computeScore`: drop the roster multiplier from both branches (report
  `rosterMultiplier: 1`; keep the field — DriveLog/ScoreBreakdown changes are
  additive-only).
- Receipt: remove the "Roster payout" line; keep base/clutch/total (and the
  drive-yards branch for scoreless drives).
- Share text: `×1.4 payout squad` line → `built for $19 of $25`, plus
  `💰 $N under the cap` when under. ResultCard image: payout header → spend.
  Spend at share time = sum of `priceFor` over the roster (recomputable from
  gsisIds — no DriveLog change needed).

**PR 3 — leaderboard/DB** (migration 009, leaderboardApi, LeaderboardScreen,
SubmitScorePanel, SUPABASE_SETUP.md):
- Migration `009_spend.sql`: `alter table scores add column spend int;`
  (null = legacy row). Recreating the insert policy? **It must re-include
  `name_ok(name)` and the `final_field_position` bounds** (the 005/008
  regression trap) — add `spend between 0 and 100` if bounded at all.
- Submission includes `spend`. Board rows: show `$N` where spend is non-null,
  else the legacy payout chip (`payoutMultiplier(team_ovr)` — this is why the
  old functions stay).
- Apply via pooler before deploying the client (same coupling as 008).

## Verification

- Unit: pricing spread (every position has $1, $10, ≥3 scrubs; deterministic);
  cap enforcement; scrub never dealt in options; daily scrub deterministic per
  challengeId; `computeScore` without multiplier (win = round(base × clutch);
  scoreless = round(yards × 0.5)); existing payout tests **stay** (functions
  remain for legacy display).
- e2e smoke: clicking the first card blindly can now hit a locked button —
  change to `.player-grid .player-card:not(.locked)` first, and add a
  scrub-button fallback. Protected selectors otherwise unchanged.
- Sim: already extended with `allScrub` + the $0 tier and passing (finding 4
  above). Re-run after wiring the real `pricing.ts` to confirm the shared
  pricing function reproduces the sim's spread.
- tsc, vitest, build, screenshots (draft w/ locked card + scrub button,
  budget bar, receipt without payout line, share text).

## Preserving the old system

Do **not** delete: `payoutMultiplier` / `rosterPayoutMultiplier` /
`payoutBand` / `formatPayout` (still used for legacy leaderboard rows and the
no-price PlayerCard path). The old scoring is one function-body change in
`computeScore` (restore the `rosterMultiplier` factor) plus the PlayerCard
payout chip — both live in git and stay compiled. If cap draft flops, revert
is a small PR, not an excavation.

## Out of scope (explicitly)

- Full-board "Perfect Lineup" weekly mode (concept B/C) — later.
- Any engine sim-mechanics change; any payout retuning (`clutchMultiplier`
  untouched — it's now the main score dial).
- `team_ovr` column stays populated (legacy display + audit).
