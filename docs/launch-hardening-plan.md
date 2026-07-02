# Launch-hardening implementation plan

Handoff spec for the pre-launch work identified in the 2026-07-02 architecture
review. Ordered by priority; Parts A/B/C are independent and each should be its
own commit. Read the **Gotchas** section before starting.

**Do not put credentials in any committed file.** This repo is public. Supabase
env values live only in `app/.env.local` (gitignored) and the Vercel dashboard.
DB migrations are applied with the Postgres password from `.env.local`
(`SUPABASE_DB_PASSWORD`) via the session pooler
`aws-1-us-west-2.pooler.supabase.com:6543`, user `postgres.kwvckwhabshotbqoiyao`
(direct DB host is IPv6-only and unreachable from this network).

---

## Part A — Launch hardening

### A1. Open Graph / social meta tags + OG image

The share loop is links pasted into chats; today they unfurl blank.

**`app/index.html`** — add to `<head>`:

```html
<meta name="description" content="Draft a roster of real NFL players, then call the plays on a do-or-die final drive. Weaker roster, bigger score. Beat your friends' lineups." />
<meta property="og:type" content="website" />
<meta property="og:title" content="Four Minute Drill" />
<meta property="og:description" content="Draft real NFL players. Call the plays. Win the drive." />
<meta property="og:image" content="https://four-minute-drill.vercel.app/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Four Minute Drill" />
<meta name="twitter:description" content="Draft real NFL players. Call the plays. Win the drive." />
<meta name="twitter:image" content="https://four-minute-drill.vercel.app/og.png" />
```

`og:image` MUST be an absolute URL. `four-minute-drill.vercel.app` is the
expected domain — **flag to the user to confirm/update after Vercel assigns
the real domain.**

**`app/public/og.png`** — static 1200×630 card. Generate with a one-off script
`app/scripts/make-og.mjs` using `sharp` (add as devDependency): author an SVG
string (dark radial background `#0b0f17`→`#18233a`, amber `#ffc233` condensed
headline "FOUR MINUTE DRILL", white sub "Draft real NFL players. Call the
plays. Win the drive.", green `#22c55e` accent bar, `#57637a` footer "Can you
beat it?") and rasterize to PNG. Use a system bold sans stack — the brand font
(Barlow Condensed) isn't installed locally and librsvg won't fetch webfonts;
good enough for v1, note the brand-font upgrade as follow-up. Match the visual
language of `app/src/share/resultCard.css`.

Acceptance: `dist/og.png` exists after build (it's in `public/`), all tags
present in served HTML, image is 1200×630 and < 300KB.

### A2. React error boundary

No boundary exists anywhere (verified); one render exception = permanent
white screen.

- New `app/src/components/ErrorBoundary.tsx`: class component with
  `componentDidCatch` / `getDerivedStateFromError`. Fallback UI: centered panel
  using existing tokens (`var(--surface-1)`, `var(--loss)`, `.cta-button`
  style) — headline "Something broke", sub "The drive hit a snag. Reload to
  keep playing.", button calling `window.location.reload()`. `console.error`
  the error.
- Wire in `app/src/main.tsx` (currently bare `<StrictMode><App/></StrictMode>`):
  wrap `<App />` with the boundary, inside StrictMode.

Acceptance: temporarily `throw` in a screen component → fallback renders,
reload recovers. Remove the throw.

### A3. Leaderboard name filter

Public user-generated text with zero moderation. Two layers:

**Client — new `app/src/leaderboard/nameFilter.ts`:**
- `isNameAllowed(name: string): boolean`. Normalize first: lowercase, apply
  leetspeak map (`0→o 1→i 3→e 4→a 5→s 7→t $→s @→a !→i`), strip remaining
  non-letters. Check against a severe-terms-only denylist (slurs + the
  unambiguous obscenities). **Severe terms only** — substring matching on a
  short list of words that essentially never appear inside innocent names
  avoids the Scunthorpe problem. Do not try to catch mild profanity.
- Wire into `SubmitScorePanel.handleSubmit` (before `setStoredName`): reject
  with error copy "Pick a different name." Also guard `recordDrive`'s name
  argument in `app/src/components/result/ResultScreen.tsx` — if the stored
  name fails the filter, pass `""` (server keeps prior/`Anonymous`).

**Server — extend `record_drive` + scores insert policy** with the same
severe-only check as a SQL regex (`nm !~* '(term1|term2|...)'`, on the
leet-normalized value via `translate()`). Apply via pooler script; also update
the SQL in `app/SUPABASE_SETUP.md` and the migrations folder (C1).

Acceptance: unit test for `isNameAllowed` (allowed: "Xavier", "Smasher",
"Scunthorpe"; blocked: leetspeak variants of denylist terms). Submitting a
blocked name shows the error and sends nothing.

### A4. Analytics

`npm i @vercel/analytics` (in `app/`), then in `main.tsx`:

```ts
import { inject } from "@vercel/analytics";
inject();
```

No-ops locally; needs **Analytics enabled in the Vercel dashboard** (user
step — add to their checklist).

---

## Part B — Data payload + bundle perf

### B1. Strip dead weight from player data

Verified: the engine never **reads** `outcome.epa` — it's only written on
synthetic fallback outcomes. Veteran QB files are ~1.1–1.2MB; total data dir
39MB.

1. Remove `epa` from `OutcomeRecord` in `app/src/types/player.ts`.
2. Delete every `epa:` write: `app/src/engine/sampleOutcome.ts` (~8 sites),
   `app/src/engine/driveSimulator.ts` (~line 223 spike outcome),
   `app/src/tests/fixtures.ts` (`makeOutcome`).
3. Pipeline `data-pipeline/src/build_player_dataset.py` `_to_outcome_record`:
   remove the `"epa"` key; change `"yards"` to `int(row["yards_gained"])`
   (nflfastR yards are whole numbers stored as floats — `3.0` → `3` in JSON).
   Keep `isFirstDown` — the engine reads it (reconciliation at
   driveSimulator.ts:98/117).
4. Re-run the pipeline (venv at `data-pipeline/venv`, Windows:
   `venv/Scripts/python.exe`): `build_player_dataset.py` →
   `build_kicker_dataset.py` → `build_manifest.py` → `validate_dataset.py`
   (each re-fetches pbp; run in background, minutes each). Then
   `rm -rf app/public/data && cp -r data-pipeline/output app/public/data`.
5. `npx vitest run` + `npm run build`; confirm file count in
   `app/public/data/players` still equals manifest player count (no orphans —
   the pipeline doesn't delete stale files, so clear `output/players/*.json`
   first).

Expected: ~15–25% smaller data dir. Do NOT restructure buckets into
distributions in this pass (bigger change, separate effort).

### B2. Lazy-load heavy client deps

- `html-to-image`: in `app/src/share/shareImage.ts`, replace the static import
  with `const { toBlob } = await import("html-to-image")` inside
  `nodeToPngBlob`.
- `LeaderboardScreen`: in `app/src/leaderboard/LeaderboardUI.tsx`, use
  `React.lazy(() => import("./LeaderboardScreen").then(m => ({ default: m.LeaderboardScreen })))`
  + `<Suspense fallback={null}>` around the conditional render.
- `@supabase/supabase-js`: `getSupabase()` in
  `app/src/leaderboard/supabaseClient.ts` becomes `async` with a dynamic
  import (cache the promise). Every call site is already in an async function
  (`ensureAnonSession`, `getCurrentUserId`, `submitScore`, `fetchTopScores`,
  `recordDrive`, `fetchTopStreaks`) — add `await`s. `isLeaderboardEnabled`
  stays a sync env check (it gates the header button; must not need the lib).

Acceptance: `npm run build` shows multiple JS chunks; initial chunk shrinks
meaningfully (baseline: 455KB single bundle); leaderboard + share still work
in the browser.

---

## Part C — Engineering hygiene

### C1. Versioned SQL migrations

The live DB was evolved via hand-run scripts; `app/SUPABASE_SETUP.md` is
narrative, not source of truth. Create `supabase/migrations/` at repo root
capturing current state as separate numbered files:
`001_scores.sql` (table + RLS + policies + index), `002_anon_auth.sql`
(`user_id` column, authed insert policy), `003_time_remaining.sql`,
`004_streaks.sql` (table, RLS, `record_drive`, grant), `005_name_filter.sql`
(from A3). Content must match the live DB — the authoritative definitions are
in SUPABASE_SETUP.md and the session history; verify against
`information_schema` via the pooler if unsure. Add a short
`supabase/README.md` explaining these are applied manually (no CLI wired up).

### C2. Playwright smoke test

One e2e covering draft → drive → result, the path unit tests can't see.

- `npm i -D @playwright/test` in `app/` + `npx playwright install chromium`.
- `app/e2e/smoke.spec.ts`: start dev server with `npx vite --host 127.0.0.1`
  (**required** — the server binds IPv6 `::1` by default and Playwright's
  `127.0.0.1` connections get ECONNREFUSED; see Gotchas). Use Playwright
  `webServer` config with that command.
- Flow: load `/` → click the first player card 6 times (each pick has a ~220ms
  transition — wait for the next picker to appear, keyed by "Pick N / 6"
  text) → click "Run the Drive →" → loop: click the first play-option button
  until the result screen appears (there's a deliberate anticipation delay
  after each play call — use generous `expect` timeouts, and cap the loop;
  drives end within ~40 plays) → assert the score panel ("points") renders.
- Add script `"test:e2e": "playwright test"` — keep OUT of the default `test`
  script so `vitest run` stays fast.

---

## Verification (every part)

- `cd app && npx tsc -b` clean, `npx vitest run` green (48+ tests),
  `npm run build` clean.
- Manual: draft → drive → win → share (copy + image) → submit score → both
  leaderboard tabs render.
- Nothing new in `git status` that shouldn't be committed (no `.env.local`,
  no `venv/`, no `dist/`).

## User-only steps (do not attempt — dashboard/OAuth)

1. Enable **Anonymous sign-ins** (Supabase → Authentication → Sign In /
   Providers). Verified still disabled — leaderboard/streak writes fail until
   flipped.
2. Connect Vercel: import repo, **Root Directory = `app`**, Vite preset, env
   vars `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (values in
   `app/.env.local` locally / Supabase dashboard).
3. Enable Vercel Analytics (after A4).
4. Confirm the production domain and update the `og:image`/`twitter:image`
   absolute URLs if it isn't `four-minute-drill.vercel.app`.

## Gotchas

- **Replay/RNG**: `getOptions()` consumes RNG. Any replay of `(seed, choices)`
  must call it each down exactly like the live loop or outcomes diverge (see
  the determinism test in `app/src/tests/driveSimulator.test.ts`).
- **Dev server is IPv6-only by default** (`localhost` works in a browser;
  Playwright/curl need `npx vite --host 127.0.0.1`).
- **StrictMode double-effects**: drive recording in `ResultScreen` is guarded
  by a ref keyed on drive-log identity — preserve that pattern if touched.
- **Pipeline orphans**: it writes but never deletes player JSONs — clear
  `output/players/` before a full rebuild.
- **LF/CRLF warnings** on `git add` are normal on this machine; ignore.
- The 2015–2025 pbp fetch has no local cache and takes minutes per script —
  run pipeline steps as background tasks.
