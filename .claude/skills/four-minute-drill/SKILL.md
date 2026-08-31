---
name: four-minute-drill
description: Use when implementing features, UI/design changes, data-pipeline runs, DB migrations, tests, or deploys in the Four Minute Drill repo (app/, data-pipeline/, supabase/). Covers architecture invariants, design system, workflows, and known gotchas.
---

# Building Four Minute Drill

Web game: draft 6 real NFL players (QB, RB, WR×2, TE, K), call plays on a
do-or-die final drive simulated from 2015–2025 nflverse play-by-play, get a
score. Live at https://www.fourminutedrill.com/ (Vercel, root dir `app`; apex
redirects to www; the old four-minute-drill.vercel.app URL still serves).

## Architecture (respect the layer boundaries)

```
data-pipeline/ (Python, offline)  →  app/public/data/*.json (committed)
    →  app/src/engine/ (pure TS, framework-free)  →  React UI  →  Supabase (optional)
```

- **Engine is pure**: `app/src/engine/` never imports from components/state.
  All gameplay math lives there. UI changes must not alter scores.
- **Leaderboard degrades gracefully**: no `VITE_SUPABASE_*` env → all
  leaderboard/streak UI hides (`isLeaderboardEnabled`). Never make the core
  game depend on Supabase.
- Key dirs: `engine/` (sim + scoring), `daily/` (challenge seeds, one-shot,
  day-streak), `share/` (lineup codes, share text/image), `leaderboard/`
  (supabase client/api/UI), `draft|drive|result` under `components/`,
  `state/` (GameStateProvider machine + ModeProvider daily/free).

## Invariants — do not break

1. **Determinism**: a drive is fully reproduced by `(roster, seed, choices)`,
   BUT replay must call `session.getOptions()` before each `choosePlay()` —
   the coverage deal consumes **exactly 4 RNG draws per down** (3 depths +
   1 RB gap, asserted in `playOptions.test.ts`). Test: "replaying (roster, seed, choices)
   reproduces the identical score" in `driveSimulator.test.ts`.
2. **Daily fairness**: challenge id = **ET date**; draft pool seeded by
   `dailyDraftRng(id)`, drive seed by `dailyDriveSeed(id)`. Everyone must get
   identical options/seed for the same id.
3. **The coverage palette** (playOptions.ts): **one spot per skill player,
   every down** (owner rule 2026-07-08). Pass-catchers get a dealt depth; the
   RB gets ONE dealt look on a SINGLE draw — inside 35% / outside 35% /
   **swing pass 30%** (`{kind:"pass",target:"rb",depth:"short"}`, resolved on
   the back's own receiver book; added 2026-08-13, CALL_ORDER appended). Gap
   runs sample `run_gap` via `sampleRushOutcome` (end=outside,
   guard/tackle/middle=inside); the QB keeper is the fifth spot. Still
   exactly FOUR draws per down. Same-surname chips render F.Last. Legacy `{kind:"run"}` + the 11-call `ALL_PLAY_CALLS` stay for old
   ghost links — CALL_ORDER in ghost.ts is wire format, append-only. The play
   UI is field targets (`.field-target` on DriveFieldVisualizer); `?classic=1`
   is the button-list escape hatch. Balance is deliberately **pro-spend**
   (owner call, 2026-07-07): free targeting rewards owning studs.
4. **Salary cap is the balance mechanism** (`draft/pricing.ts`, docs/cap-draft-plan.md).
   `getPricing(players)` ranks each position $1–$10 (bottom ~20% are $0
   "scrubs", never dealt — reachable only via the "give me a scrub" gamble);
   deterministic from the manifest, `CAP = 25`. The draft deals only
   `dealablePlayers`; cards over the remaining budget lock. The old
   `payoutMultiplier`/`rosterPayoutMultiplier`/`payoutBand`/`formatPayout`
   (scoring.ts) are **retained but only for legacy leaderboard rows** (rows with
   null `spend`); do not resurrect them in the draft/score path. `clutchMultiplier`
   (scoring.ts) is the single source of truth for the time bonus — the live
   `TimeBonusMeter` reads it so it can't drift from the final score.
5. **DriveLog shape** (`seed`, `choices`, `clockSecondsRemaining`, …) is
   stored in Supabase rows — additive changes only. `finalFieldPosition(log)`
   (simResult.ts) is the shared derivation of where a drive ended (0 = scored),
   used by recap, daily summary, the leaderboard submission, and the "Longest
   drives" board. Manifest/player entries also carry `team` + `jersey`.
   **Scoring** (cap era): a win is `base(TD 100/FG 40) × clutch` — **no roster
   multiplier** (reported as 1); a *scoreless* drive banks `round(yardsAdvanced
   × 0.5)`, also unmultiplied — so `score` can be >0 on a `won:false` drive, and
   `ScoreBreakdown` carries `driveYards`/`drivePoints`. Free play submits
   wins-only; the Daily submits every drive. Leaderboard rows carry `spend`
   (team salary; null on pre-cap rows → board shows the legacy payout chip).
6. **One-fire effects on result**: guard with the drive-log-identity ref
   pattern (see `recordedLog` in ResultScreen) — StrictMode double-mounts.
7. **Clock rules**: plays cost snap-to-whistle time (PLAY_DURATION_RANGE);
   completed plays also pre-pay the next snap's gap (chosen tempo 15-35s or
   auto runoff); incompletions/sacks/spikes stop the clock. The **two-minute
   warning** (TWO_MINUTE_WARNING_SECONDS=120): first crossing of 2:00 is a
   free stoppage, once per drive -- clamped to exactly 2:00 if crossed during
   the pre-snap runoff, stopped at the whistle if crossed during the play;
   consumed benefit-free on a dead ball; pre-consumed when a scenario starts
   at/inside 2:00. Flagged on `PlayResult.twoMinuteWarning` (additive).
8. Scores/streaks writes: daily drives → daily board + device-local day
   streak; free-play drives → `record_drive` RPC (returns updated streak).
   Daily does NOT feed the free-play streak board. The **Daily accepts losses**
   (score 0, ranked by `final_field_position`); free play still only takes wins.
   Gate submit UI accordingly in `SubmitScorePanel` (`isDaily || scored`).

## Design system

- Tokens in `app/src/index.css` (`--bg-0/1, --surface-1/2/3, --line(-2),
  --text/--muted/--dim, --grass*, --amber, --sky, --win, --loss`, radii,
  `--font-display` Barlow Condensed / `--font-body` Inter). Never hardcode
  colors in components — exception: `share/resultCard.css` + `scripts/make-og.mjs`
  are deliberately self-contained (html-to-image/librsvg can't see tokens).
- Patterns: `.eyebrow` section labels, `.cta-button` (green pill primary),
  `.ghost-button` secondary, modal = overlay + panel (leaderboard.css /
  howItWorks.css), banners `.streak-banner`, payout heat = amber(hot ≥1.6) /
  green(mid ≥1.3) / muted(low) via `payoutBand` — band on the *rounded* value.
- **Team identity**: `utils/teamColors.ts` maps a team abbr → `{primary,
  secondary,name}` for all 32, with relocation ALIASES (SD→LAC, OAK→LV,
  STL/LA→LAR, JAC→JAX, WSH→WAS) and a NEUTRAL fallback — always resolve colors
  through `teamColors(team)`, never index the map raw (data keeps historical
  abbrevs). PlayerCard/ResultCard show a team-color band/border + jersey chip +
  price tag. (Play-option payout chips and the FG make-% hint were removed --
  owner calls; don't resurrect either.)
- **Field** = broadcast drive chart (`DriveFieldVisualizer` + drive.css): blue
  scrimmage line, yellow first-down line, amber drive trail + start ring (pass
  `driveStartPosition`), faint "4MD", numerals top+bottom, deep endzones. Uses
  yardline_100 (`progressPct = 100 - fieldPosition`).
- Motion rules: house easing `cubic-bezier(0.22,1,0.36,1)`; entrances 250ms,
  movement 800ms; global `prefers-reduced-motion` guard lives in `index.css`
  (neutralizes all durations) — JS animations (`utils/confetti.ts`,
  `utils/useCountUp.ts`) must also `matchMedia` reduced-motion and no-op.
- Reusable UI utils: `utils/useModalBehavior.ts` (Escape/focus-trap/restore —
  apply to any modal; extract inline modals into a child so the hook mounts
  with it), `components/result/DriveRecap.tsx` (collapsible field+log),
  `utils/confetti.ts` (WAAPI burst), `utils/useCountUp.ts`. Fire-once-on-result
  effects (confetti) use the drive-log-identity ref guard.
- Copy: ball spot via `formatBallOn`; the drive scoreboard is DOWN · BALL ON ·
  SCORE · CLOCK (`DriveFieldVisualizer` takes `scoreDiff`). localStorage flags:
  `fmd_seen_intro` (coach strip), `fmd_daily_*`/`fmd_daily_streak` (daily),
  `fmd_rookie_done` (graduation).
- **Ghost racing** (`share/ghost.ts` + `GhostProvider`): every share link
  carries the drive's DNA (`g=1.<seed36>.<score36>.<2-chars-per-choice>` +
  optional `by=` name, filtered by nameFilter). The receiver's client REPLAYS
  it (getOptions() before every choosePlay — the RNG rule) and races it
  clock-synced (`ghostStepAtClock`); if the replay doesn't reproduce the
  claimed score (data changed since the share), the ghost is silently dropped
  to the plain beat-their-score flow — never show a wrong ghost. CALL_ORDER
  in ghost.ts is wire format: append-only, never reorder. Ghost survives Run
  It Back, cleared on entering the draft. Data slims/refreshes invalidate
  in-flight ghost links (accepted).
- **Rookie drive** (`state/rookie.ts` + `RookieGate.tsx`): a visitor with NO
  `fmd_*` keys is a rookie. They are ASKED via a one-time, non-dismissable
  choice modal ("Run a practice drive" / "Skip to Today's Drill") — owner
  explicitly rejected silent defaulting as unclear; don't reintroduce it. The
  choice is session-scoped (`rookieGateChoice`), so an ungraduated rookie is
  asked again next visit. During practice a persistent amber banner (AppBody)
  says "Practice drive — nothing counts yet"; the shared-lineup banner takes
  precedence, and deep-link arrivals skip the gate entirely (the challenge IS
  their practice). Completing ANY drive graduates them (`markRookieDone` in
  ResultScreen's record effect) → the amber "Play Today's Drill →" card.
  Rookie-ness is SNAPSHOTTED per page load (keys written mid-session, e.g.
  dismissing the coach strip, must not flip it mid-drive). Teaching hints
  (tempo, clutch, budget note, scrub sub-line) render **only for rookies**.
  Funnel events carry a `rookie` prop + a `rookie_gate` event logs the choice.
  e2e: `rookie.spec.ts` covers both paths; any fresh-context e2e must click
  through the gate first (see smoke/ghost specs).
  Share text (`share/shareText.ts`) includes a Wordle-style emoji **drive grid**
  (`buildDriveGrid`: 🟩15+/🟨4-14/⬜1-3/🟥stuffed/🏈TD/❌TO + terminal 🎯/🚫/🛑/🏁);
  SharePanel shows it in a read-only preview. Default scenario is **down 3**.
  Draft picks advance instantly (no transition delay) — the deliberate beat is
  the ball gliding in on the drive result, not the draft.
- **Dynamic OG cards** (share unfurls): ghost links carry `r=` (letter drive
  code) + `sp=` (spend); `api/og.ts` (@vercel/og edge fn, plain-object
  elements, no JSX) renders score/squares/name; `middleware.ts` swaps
  og:image/og:title ONLY on `?g=` links and fails open. THREE things in
  lockstep: buildDriveGrid emojis ↔ buildDriveCode letters (shareText.ts) ↔
  SQUARE color map (api/og.ts). Plain visits must keep static og.png.
  Vercel preview deployments are auth-free (owner disabled protection
  2026-07-28) — test middleware/functions on a branch preview before main.
- **Field-target seating order is regime-conditional** (DriveScreen, hard-won
  across 4 audit-caught failure rounds): open field (fp > 22) seats GROUND
  first anchored at the LOS (runs must never read backward — owner-flagged
  twice) with routes flexing deeper; red zone seats PASSES first (compressive
  seating pins them to the goal-line band) and ground yields backward as a
  pitch. Give-up placement takes the largest-gap candidate, never
  last-tried. Don't unify the two regimes; they want opposite priorities.
- Football conventions in copy: ball spot as "OWN 20"/"AWAY 29" (yardline_100
  >50 → OWN 100-x, else AWAY x), never raw yards-to-endzone in labels.
- Design source docs: `app/FrontEndDesign.md`, `docs/ux-review.md`,
  `docs/ux-implementation-plan.md`.
- **Before any significant design/product decision, read
  `docs/design-handoff.md`** — the departing design lead's judgment layer:
  taste rules, owner vetoes, specs for unbuilt features (counterfactual coach
  note, dynamic OG, tendency seating, archive/season record, compaction),
  and the August-refresh → Sept-1-freeze calendar.

## Workflows

- **Dev**: `cd app && npm run dev` (localhost:5173). Server binds IPv6 only —
  Playwright/curl need `npx vite --host 127.0.0.1`.
- **Tests**: `npx vitest run` (unit, excludes e2e/); `npm run test:e2e`
  (Playwright smoke, own server on port 5175). Smoke selectors it depends on:
  `.player-grid .player-card`, `.draft-progress-count`, `.field-target` (play
  calls; `.play-option-button` remains on FG/spike + the ?classic=1 list),
  `.result-screen`, `.result-score-unit`. `layout-audit.spec.ts` plays five
  full drives asserting every down has 5 on-turf, non-stacked, tappable
  targets (ring AND `.field-target-chip` boxes, incl. pairwise no-overlap) at
  360px — the strictest width — run it after any change to target seating,
  chip layout, `--chip-shift`, or chip sides. Lane rows are 17/50/83 in BOTH
  DriveScreen (LANE_Y) and DriveFieldVisualizer, paired with the field's
  200px floor so below/above label bands physically clear across lanes —
  change any of the three together or labels mash. Give every Playwright
  action an explicit timeout: the default is unlimited and hangs, not fails.
- **Build**: `npm run build` (tsc -b && vite build). Verify before commit:
  tsc + vitest + build (+ e2e for UI-flow changes).
- **Data pipeline** (only when roster/seasons/fields change): venv at
  `data-pipeline/venv` (Windows: `venv/Scripts/python.exe`). Run in order:
  `build_player_dataset.py` → `build_kicker_dataset.py` → `build_manifest.py`
  → `validate_dataset.py`. Each re-fetches pbp (minutes; run in background).
  `identity.py` (`get_identity`, cached) adds `team`/`jersey` from nflverse
  `import_seasonal_rosters` (most-recent season wins) — builders read it, and
  manifest re-reads team/jersey from the written player JSONs.
  **Clear `output/players/*.json` first** (writes never delete → orphans),
  then `rm -rf app/public/data && cp -r data-pipeline/output app/public/data`.
  Curated pool: `data-pipeline/config/roster_pool.yaml` (name resolution
  hard-fails; validate names before the expensive fetch).
  `slim.py` downsamples oversized situation buckets to
  `MAX_OUTCOMES_PER_BUCKET` (75), **stratified by TD/turnover/other** so rates
  are preserved, deterministic per (player, bucket). `sampleSize` stays the FULL
  count (the engine's confidence gate at `sampleOutcome.ts:190` reads it; only
  the `outcomes` array shrinks). To slim already-built output without a pbp
  re-fetch: `python src/slim_existing.py` (stdlib only, in place on
  `output/players`). Changing the cap forks the daily and invalidates prior
  shared-drive replays → ship between dailies; verify with
  `sim-cap-draft.ts` before/after (win% per strategy within ~2pts). The
  bucket cap only reaches ~35% total reduction (33→21MB) — the many small
  buckets floor it; the bigger lever (unshipped) is compacting the per-outcome
  JSON, which would touch `sampleOutcome.ts` + the outcome types.
- **DB migrations**: numbered SQL in `supabase/migrations/` is source of
  truth; applied manually via the session pooler
  (`aws-1-us-west-2.pooler.supabase.com:6543`, user
  `postgres.kwvckwhabshotbqoiyao`, password = `SUPABASE_DB_PASSWORD` in
  gitignored `app/.env.local` — direct DB host is IPv6-only/unreachable).
  Simplest: `psql.exe` (bundled at `/c/Program Files/PostgreSQL/18/bin/`) with a
  `host=… port=6543 … sslmode=require` conn string and `-f migration.sql`
  (source `.env.local`, `PGPASSWORD=$SUPABASE_DB_PASSWORD`); or a temp node `pg`
  script in scratchpad, delete after. Changing a function's return type — or a
  policy — requires DROP first, and a recreated **insert policy must re-include
  `name_ok(name)`** (added in 005) or it silently regresses. Always add the
  migration file AND update `app/SUPABASE_SETUP.md`.
- **Season Score** (migration 011 + `season_totals` view): per-user sum of
  best-daily-score-per-day inside the season window. Window constants live in
  BOTH the view and `SEASON_START/END` in leaderboardApi.ts -- change together.
  Season tab + SeasonStrip (result + DailyDone); named players only.
- **Opening-day reminders** (migration 013): write-only `reminders` table --
  insert policy AND select/update/delete revoked from anon/authenticated, so
  the publishable key cannot read addresses. Promise shown to players is ONE
  email; the send runbook (pooler pull, BCC, then delete rows) is in
  SUPABASE_SETUP.md §8.
- **Daily board reconstruction** (FieldDraftPanel, migration 014): "how the
  field drafted" rebuilds the three offered cards from the challenge date
  rather than storing them — sound ONLY while pricing is frozen, since the
  dealable pool feeds `drawSlotOptions`. Change prices and every historical
  reconstruction silently shows a board nobody was offered; the panel's
  guard (hide when no pick is explained) catches the gross case, not subtle
  ones. Free play has no equivalent: its boards are random and unstored.
- **Data refresh gotcha**: nflverse changes team abbreviations between seasons
  (2026: ARI -> AZ). After every refresh, check EVERY distinct manifest team
  against `teamColors.ts` (TEAMS + ALIASES) or players render neutral grey.
  `identity.py` `_SEASONS` must include the upcoming season for post-offseason
  teams/jerseys.
- **Analytics**: Vercel Web Analytics via `inject()` (main.tsx) + custom funnel
  events through `analytics/track.ts` (`trackEvent(name, props)`, best-effort,
  no-ops locally). Events: `draft_started`, `drive_started`, `drive_completed`,
  `score_submitted`, `result_shared`, `lineup_link_opened`. Keep names stable;
  add to the `AnalyticsEvent` union, don't inline `track()` calls.
- **Deploy**: push to `main` → Vercel auto-builds (root `app`). Verify:
  `curl -s https://four-minute-drill.vercel.app/ | grep -oE 'assets/index-[^"]+\.js'`
  then grep the bundle for a new string; poll ~20s intervals.
- **Leaderboard seeding**: `npx tsx scripts/seed-leaderboard.ts` (keep seeded
  scores LOW — real players set the top; cap under the current #1).

## Guardrails & gotchas

- **Public repo — no secrets ever.** Anon/publishable key + project URL are
  fine; the DB password and service keys are not. Env only in `app/.env.local`
  (gitignored) + Vercel dashboard.
- Supabase client is lazy/dynamic-imported: `getSupabase()` is **async**;
  `isLeaderboardEnabled` stays a sync env check. Keep supabase-js,
  LeaderboardScreen, and html-to-image out of the initial bundle.
- Name moderation: severe-terms-only, leet-normalized, substring — mirrored in
  `nameFilter.ts` and SQL `name_ok`. Keep both in sync; never add terms that
  occur inside innocent names (Scunthorpe: no "cunt/spic/coon/rape").
- `epa` was removed from data + `OutcomeRecord`; don't reintroduce dead fields
  (veteran player JSONs are ~1MB even now).
- Testing live Supabase: sign in anonymously via REST, block/abort writes for
  read-only checks (Playwright `page.route`), and **delete any test rows**
  via the pooler afterward.
- Full-page Playwright screenshots paint the sticky header mid-content —
  capture artifact, not a bug.
- **package-lock regen**: npm on this Windows machine biases the lock toward
  the existing node_modules and silently DROPS foreign-platform optional
  nodes (fsevents, @emnapi/*, wasm32-wasi) — local `npm ci` passes, Linux CI
  fails "Missing: @emnapi/runtime". Regenerate ONLY in a clean room: copy
  package.json to an empty temp dir, `npm install --package-lock-only`
  there, copy the lock back, validate with `npm ci` (check its real exit
  code — don't pipe it into tail). CI runs Node 24 to match local npm 11.
- Windows shell: LF/CRLF warnings on `git add` are normal noise. Use temp
  script files instead of inline `node -e` with template literals (bash eats
  backticks).
- Commits: small and scoped, imperative subject + short why-body, end with
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`, and grep staged
  files for `.env|venv|node_modules|dist|seed-data` before committing.
