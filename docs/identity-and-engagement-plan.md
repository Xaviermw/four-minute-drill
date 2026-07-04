# Identity & engagement implementation plan

From the game-design review (docs/game-design-review.md) + approved visual mock
(2026-07-04). Decisions are locked: **team colors + jersey numbers (no
headshots)**, score-the-loss daily, live time-bonus meter, emoji-share as a
*visible preview* the owner can veto. Four PRs, each shippable alone.

Global rules: same as docs/ux-implementation-plan.md (house easing,
reduced-motion, protected e2e selectors, verify tsc+vitest+build+smoke per PR).
Identity is **display-only** — no engine/scoring/determinism changes anywhere.

---

## PR A — Pipeline: player identity fields

**A1. Identity lookup** — new `data-pipeline/src/identity.py`:
`nfl.import_seasonal_rosters(range(2015, 2026))`, filter to curated gsis ids,
take the **most recent** season row per player → `{team, jersey_number}`.
Coverage verified 164/164. Cast jersey to `int` (source is float). Cache the
frame in-module so both build scripts share one download.

**A2. Wire into builds**: `build_player_dataset.py` and `build_kicker_dataset.py`
add `"team": str, "jersey": int` to each player JSON; `build_manifest.py`
passes both through to manifest entries. Update `ManifestPlayerEntry`,
`PlayerDataset`, `KickerDataset` types (+ test fixtures) with
`team: string; jersey: number`.

**A3. Re-run the pipeline** (skill workflow: clear `output/players/*.json`
first, four scripts in order as background tasks, then copy to
`app/public/data`, confirm file count == manifest count).

**Gotchas:** a player whose last season predates a relocation carries the old
abbr (`SD`, `OAK`, `STL`) — keep it verbatim in data; the app color map (B1)
handles aliases. Retired players (Brady→`TB`, Brees→`NO`) verified present.

## PR B — Team-color cards + field rebuild

**B1. `app/src/utils/teamColors.ts`** — static map of all 32 teams →
`{ primary, secondary, name }` (e.g. `KC: { primary:"#E31837",
secondary:"#FFB81C", name:"Chiefs" }`), plus aliases `SD→LAC, OAK→LV, STL→LAR`
and a neutral fallback `{ primary:"#3a4356", secondary:"#8c99ad",
name: team }`. Export `teamColors(team: string)`.

**B2. PlayerCard redesign** (per approved mock, `PlayerCard.tsx` + draft.css):
- Top **team band**: `linear-gradient(115deg, primary 0 68%, secondary 68.2%
  74%, primary 74.2%)`; contains jersey chip, name/team, payout chip.
- **Jersey chip**: 38px rounded square, `rgba(0,0,0,.28)` bg, 1.5px secondary
  border, white display-font number.
- Name white with subtle text-shadow; under it `TEAM NAME · POS` small caps.
- **Payout chip (contrast fix from mock)**: dark pill `rgba(0,0,0,.35)` on the
  band's right; value in `--amber` when `payoutBand()==="hot"`, else white;
  tiny "PAYOUT" label. Remove the old left accent stripe + band-colored
  position tag (position now lives in the band); keep `payout-*` classes for
  the heat coloring of the value only.
- Stats block below unchanged. Applies everywhere PlayerCard renders (picker,
  team panel, DailyDone). Placeholder cards unchanged.
- **ResultCard (share image)**: replace the position label with a mini jersey
  chip + team-colored left border per row (inline hex from the same map —
  resultCard.css stays self-contained by importing the TS map in the
  component, not CSS vars).

**B3. Field rebuild** (`DriveFieldVisualizer.tsx` + drive.css), per mock B
minus the emoji artifacts (no 🏈 midfield, no 🥅 — midfield gets a faint
"4MD" display-font wordmark at 14% opacity; no goalpost):
- Turf: `repeating-linear-gradient(90deg,#2b8a4b 0 10%,#257a41 10% 20%)` +
  top radial sheen + inset vignette (`inset 0 -34px 50px rgba(0,0,0,.42)`).
- Yard lines every 5% (1.5px, .34 alpha), heavier every 10% (2.5px, .6);
  two hash rows at 26% top/bottom; painted italic numerals **top and bottom**
  with ◄/► arrows (`1 0`…`5 0`…`1 0`), ~21px, .5 alpha; keep the existing
  `tick-alt` mobile hiding for both rows.
- **Line of scrimmage turns blue** (`#3ea0ff`, glow) — the ball sits on it.
- **First-down line, yellow** (`#ffe100`, glow) at
  `100 - (fieldPosition - distance)` %, with a small "1ST ↦" tag chip; render
  only when `down`+`distance` provided (drive screen, not recap) and hide when
  `fieldPosition - distance <= 0` (goal-to-go: tag reads "GOAL").
- **Drive trail**: amber dashed 4px line from drive start (`100 -
  scenario.fieldPosition`%, i.e. 20%) to the scrimmage %, with a hollow start
  ring. Needs a `driveStartPosition` prop from DriveScreen (scenario value);
  recap can pass it too (constant 80 today — read from scenario, don't
  hardcode). Trail width transitions with the same 1.1s ease as the marker.
- Endzones: deepen to gradient pairs (`#17335f→#122a50` / `#5c1620→#4a1119`),
  3px white inner borders. Height: drop to `clamp(180px, 24vh, 240px)` — the
  broadcast strip reads better shorter.
- Keep `.field-marker` glide; ball gets `rotate(-14deg)`, 34×21px.

## PR C — Score the loss (daily) + time-bonus meter

**C1. Migration `008_final_field_position.sql`**: `alter table public.scores
add column final_field_position int;` (yards to end zone at drive end; null on
wins/legacy). Apply via pooler; update SUPABASE_SETUP.md schema block.

**C2. Submit losses (daily only).** `buildSubmission` gains
`final_field_position` (from the last play: `max(0, fieldPosition - yards)`).
`SubmitScorePanel`: in daily mode render for losses too — title "Put your
drive on the board", same name box; success copy for a loss: "Logged — your
drive died at {formatBallOn(pos)}". RLS already allows score 0. Free play
stays winners-only. Streaks + all-time untouched (loss rows carry
`challenge_date`, so the all-time query's `challenge_date is null` filter
already excludes them).

**C3. Daily board shows everyone.** Daily tab: winners ranked by score as
today; below, a **"Longest drives"** subsection for that day's `score = 0`
rows ordered by `final_field_position asc` (closer to the end zone = better),
row shows name · `died at AWAY 12` · no play button… keep "Try in Free Play".
`fetchDailyScores` orders by `score desc, final_field_position asc nulls last,
created_at asc` so one query serves both sections.

**C4. Percentile on DailyDone/result (daily).** After submit (or on DailyDone
load), fetch today's rows and compute locally: winners beat all losers;
within losers compare `final_field_position`. Line: "Further than **NN%** of
today's players" (needs ≥5 rows, else omit).

**C5. Live time-bonus meter.** Move the clutch math to
`engine/scoring.ts` as `export function clutchMultiplier(clockAtScoreSeconds)`
(exact body from driveSimulator; driveSimulator imports it — **scores must be
byte-identical**, tests prove it). DriveScreen, when
`display.clockSeconds < CLUTCH_REFERENCE_SECONDS` (export the constant), shows
under the clock cell: `TIME BONUS ×{v.toFixed(2)} ↑` in amber, updating with
the held/revealed clock (use `display`, not live, so it doesn't leak the
outcome early). One line in "How it works" scoring section: "the bonus starts
climbing under 2:00."

## PR D — Emoji drive grid (visible preview; owner may veto)

`buildShareText` inserts a drive-pattern line after the headline:
per play → `🎉` TD · `🥅` FG made · `🚫` INT/fumble/missed FG · `💥` sack or
negative run · `✅` first down gained · `🏈` other gain · `❌` no gain /
incomplete / spike. Order: chronological, max ~14 glyphs (truncate head with
`…`). **SharePanel gains a small read-only preview box** showing the exact
share text so the owner can judge the grid in situ; if vetoed, delete the one
builder function + preview box.

## Also included (small, straight from the review's P2 list — cut any on request)

- **Scenario → down 2** (`DEFAULT_SCENARIO.scoreDiff: -2`): "Down by 2 — a
  field goal wins it." `scoreDiff` verified display-only; stored replays
  unaffected. Update stakes strip + How-it-works copy.
- **FG button hint**: kicker's `distanceBuckets` bucket for the current
  `kickDistanceFor()` → "· makes ~NN% from here" appended to the button text
  (fall back to career rate when the bucket is empty; color the % red < 40%).
- **Target chips on play options**: pass-option buttons append the target's
  payout (`×1.4`) in a small muted chip via `describePlayCall`'s existing
  roster access — display-only.

## Order & verification

A → B (visual payoff needs A's data) → C → D. Per PR: `tsc`, `npx vitest run`
(fixtures gain team/jersey in A), `npm run build`, smoke e2e, screenshot pass
(draft cards, drive field w/ first-down line, daily board with losses, share
preview). C1 applied via pooler **and** committed as migration 008 + doc
update. Never rename protected e2e classnames; `formatBallOn` is the only
yard-copy helper — reuse it everywhere new copy shows field position.
