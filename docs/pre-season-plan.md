# Pre-season plan — Opus batch (from macro-review-2026-07)

Six spec-followable items from the review's next-ten. Fable keeps the two
design-in-the-loop items (rookie drive + hint retirement; ghost racing) and
the launch-kit writing — do NOT start those from this doc.

**Regression rule learned the hard way (HowItWorks incident):** whenever a
mechanic/economy/copy-adjacent change ships, grep the copy surfaces:
coach strip (DraftScreen), HowItWorks.tsx, draft/drive hints, shareText.ts,
ResultCard, OG/meta in index.html, SUPABASE_SETUP.md, README. Add what you
find to the commit.

---

## 1. Slim the player datasets (M) — ship BETWEEN dailies

`app/public/data` is 33MB; veterans ~1MB (Stafford: 6,675 outcomes across 77
buckets, biggest bucket 1,103, only 13 buckets over 150).

Pipeline change (`data-pipeline/src/build_player_dataset.py`), applied when a
bucket's outcomes exceed `MAX_OUTCOMES_PER_BUCKET = 150`:

- **Stratified downsample**: keep ALL outcomes where `isTouchdown` or
  `isTurnover` (rare, tail-defining); fill the remainder with a sample of the
  rest up to 150. If TD+TO alone exceed 150, sample within them proportionally.
- **Deterministic**: seed the sampler with `hash(f"{gsis_id}:{bucket_key}")`
  so pipeline re-runs are reproducible.
- Order: aggregates/ratings/flavor stats are computed from FULL data before
  bucket slimming — do not reorder that; only the stored `outcomes` arrays
  shrink. Kicker files are small; leave them alone.

Verify: `validate_dataset.py` passes; largest player file < ~250KB; run
`npx tsx scripts/sim-cap-draft.ts 2000 25 18 percentile bonus0` before/after —
win% per strategy within ~2pts. Copy output → `app/public/data` per the skill
workflow. **Deploy timing**: merge + deploy in one go, not near midnight ET
(slimming changes what seeds sample → same-day daily results would fork).
Note in the commit: replays of previously-shared drives are invalidated
(accepted, pre-launch).

## 2. `scrub_taken` event + daily field summary (S)

- Add `"scrub_taken"` to the `AnalyticsEvent` union; fire in
  `DraftScreen.pickScrub` with `{ mode, position }`.
- Field summary: `fetchDailyFieldSummary(challengeId)` in leaderboardApi —
  two head-count queries (total entries; entries with `score > 0`) →
  `{ total, scored }`. On `DailyDone`, under the score hero, one line:
  `"Today's field: N drives · M% scored"` (skip if total < 5 — don't show a
  sad empty stat). No new DB objects needed.

## 3. Sentry (S)

`@sentry/react`, init in `main.tsx` gated on `import.meta.env.VITE_SENTRY_DSN`
(absent → no-op, like the Supabase pattern). Wire `ErrorBoundary` to
`Sentry.captureException`. Keep it OUT of the initial bundle if possible
(dynamic import after first paint is fine). Human step (flag in your summary):
create the Sentry project + add `VITE_SENTRY_DSN` to Vercel env + `.env.local`.

## 4. Privacy page (S)

Static `app/public/privacy.html` (no router; keep it a plain page, self-styled
dark to match). Footer link "Privacy" next to "How it works". Content to
cover, plainly: what's stored (chosen display name + score on public
leaderboards; an anonymous account id; gameplay analytics events via Vercel
Analytics; localStorage for streaks/settings), what's NOT (no email, no real
name, no ads/tracking pixels, nothing sold), deletion (email
xavier.weisenreder@gmail.com with your leaderboard name), and a last-updated
date. Keep it under a screen of text.

## 5. Domain cutover code (S) — blocked on the human buying it

When `fourminutedrill.com` exists (Vercel dashboard: add domain, root `app`):
update `app/index.html` `og:image`/`twitter:image` to the new origin, add
`<link rel="canonical">`, update `rc-footer`/README/SUPABASE_SETUP mentions of
the vercel.app URL. `buildShareUrl` uses `window.location` — no change.
Verify with a fresh `curl` of both domains after deploy.

## 6. Theme-day scaffold (M — honest sizing; config-only variants later)

Goal: dailies can vary the cap ("$15 Tightwad Tuesday") with one config line.

- `app/src/draft/capConfig.ts`: `capForChallenge(challengeId: string | null):
  { cap: number; label?: string }` — default `{ cap: 25 }`; a
  `SPECIALS: Record<string, {cap, label}>` map keyed by challenge date.
  Free play (null) is always 25.
- Refactor: `CAP` is imported directly in pricing.ts, TeamPanel, DraftScreen,
  shareText, ResultCard, SubmitScorePanel. Thread a `cap` value instead
  (pricing's `getPricing` is cap-independent — prices don't change; only
  affordability and display do). shareText's "built for $X of $25" takes the
  cap as a param. Show `label` as the draft eyebrow when set.
- Leaderboard: rows already carry `spend`; days with a different cap are
  self-explanatory on the daily board. No DB change.
- Tests: capForChallenge default + special; a $15 draft locks more cards.
- Do NOT schedule any specials yet — scaffold only, owner picks the calendar.

---

### Standing constraints (unchanged)

- Engine determinism + `getOptions()` RNG rule; additive-only DriveLog/DB.
- Protected e2e selectors; run tsc + vitest + build (+ e2e for UI flows).
- Public repo: no secrets; grep staged files.
- **No scoring/economy changes** — the cap economy is locked until Sept 1+.
- Migrations (none needed in this batch) go pooler-first, then deploy.
