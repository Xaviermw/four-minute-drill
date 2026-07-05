---
name: four-minute-drill
description: Use when implementing features, UI/design changes, data-pipeline runs, DB migrations, tests, or deploys in the Four Minute Drill repo (app/, data-pipeline/, supabase/). Covers architecture invariants, design system, workflows, and known gotchas.
---

# Building Four Minute Drill

Web game: draft 6 real NFL players (QB, RB, WR×2, TE, K), call plays on a
do-or-die final drive simulated from 2015–2025 nflverse play-by-play, get a
score. Live at https://four-minute-drill.vercel.app/ (Vercel, root dir `app`).

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
   drawing options consumes RNG. Test: "replaying (roster, seed, choices)
   reproduces the identical score" in `driveSimulator.test.ts`.
2. **Daily fairness**: challenge id = **UTC date**; draft pool seeded by
   `dailyDraftRng(id)`, drive seed by `dailyDriveSeed(id)`. Everyone must get
   identical options/seed for the same id.
3. **Salary cap is the balance mechanism** (`draft/pricing.ts`, docs/cap-draft-plan.md).
   `getPricing(players)` ranks each position $1–$10 (bottom ~20% are $0
   "scrubs", never dealt — reachable only via the "give me a scrub" gamble);
   deterministic from the manifest, `CAP = 25`. The draft deals only
   `dealablePlayers`; cards over the remaining budget lock. The old
   `payoutMultiplier`/`rosterPayoutMultiplier`/`payoutBand`/`formatPayout`
   (scoring.ts) are **retained but only for legacy leaderboard rows** (rows with
   null `spend`); do not resurrect them in the draft/score path. `clutchMultiplier`
   (scoring.ts) is the single source of truth for the time bonus — the live
   `TimeBonusMeter` reads it so it can't drift from the final score.
4. **DriveLog shape** (`seed`, `choices`, `clockSecondsRemaining`, …) is
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
5. **One-fire effects on result**: guard with the drive-log-identity ref
   pattern (see `recordedLog` in ResultScreen) — StrictMode double-mounts.
6. Scores/streaks writes: daily drives → daily board + device-local day
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
  payout chip; play options show a target payout chip; the FG button shows a
  make-% from `session.getFieldGoalMakePct()` (real engine odds, not a guess).
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
  `fmd_seen_intro` (coach strip), `fmd_daily_*`/`fmd_daily_streak` (daily).
  Share text (`share/shareText.ts`) includes a Wordle-style emoji **drive grid**
  (`buildDriveGrid`: 🟩15+/🟨4-14/⬜1-3/🟥stuffed/🏈TD/❌TO + terminal 🎯/🚫/🛑/🏁);
  SharePanel shows it in a read-only preview. Default scenario is **down 3**.
  Draft picks advance instantly (no transition delay) — the deliberate beat is
  the ball gliding in on the drive result, not the draft.
- Football conventions in copy: ball spot as "OWN 20"/"AWAY 29" (yardline_100
  >50 → OWN 100-x, else AWAY x), never raw yards-to-endzone in labels.
- Design source docs: `app/FrontEndDesign.md`, `docs/ux-review.md`,
  `docs/ux-implementation-plan.md`.

## Workflows

- **Dev**: `cd app && npm run dev` (localhost:5173). Server binds IPv6 only —
  Playwright/curl need `npx vite --host 127.0.0.1`.
- **Tests**: `npx vitest run` (unit, excludes e2e/); `npm run test:e2e`
  (Playwright smoke, own server on port 5175). Smoke selectors it depends on:
  `.player-grid .player-card`, `.draft-progress-count`, `.play-option-button`,
  `.result-screen`, `.result-score-unit`.
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
- Windows shell: LF/CRLF warnings on `git add` are normal noise. Use temp
  script files instead of inline `node -e` with template literals (bash eats
  backticks).
- Commits: small and scoped, imperative subject + short why-body, end with
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`, and grep staged
  files for `.env|venv|node_modules|dist|seed-data` before committing.
