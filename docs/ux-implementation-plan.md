# UX implementation plan (from docs/ux-review.md)

Design decisions are made — implement as specified, don't re-litigate. Four PRs,
each independently shippable, ordered by impact. Client-only: **no engine-math,
pipeline, or Supabase schema changes anywhere in this plan.**

Global rules for every PR:
- All new animation wrapped in a reduced-motion guard. Add once, in `index.css`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
  ```
- House easing for movement: `cubic-bezier(0.22, 1, 0.36, 1)` ("out-expo-ish").
  Entrances 250ms; movement 800ms; celebrations ≤600ms.
- Don't rename these classes (the e2e smoke depends on them): `.player-card`,
  `.player-grid`, `.draft-progress-count`, `.play-option-button`,
  `.result-screen`, `.result-score-unit`, `.draft-recap`.
- Verification per PR: `npx tsc -b` · `npx vitest run` · `npm run build` ·
  `npx playwright test` all green, then commit + push (Vercel auto-deploys).

---

## PR 1 — Truth & motion basics (A1–A4, B1)

**1a. `formatBallOn` helper + scoreboard fix.**
New in `app/src/utils/formatting.ts`:
```ts
/** Football-convention ball spot from yards-to-end-zone (yardline_100). */
export function formatBallOn(fieldPosition: number): string {
  if (fieldPosition > 50) return `OWN ${100 - fieldPosition}`;
  if (fieldPosition === 50) return "MIDFIELD";
  return `AWAY ${fieldPosition}`;
}
```
Unit tests: 80→"OWN 20", 50→"MIDFIELD", 29→"AWAY 29", 1→"AWAY 1".
In `DriveFieldVisualizer.tsx`, the scoreboard becomes **four** cells:
`DOWN` ("1st & 10") · `BALL ON` ("OWN 20") · `SCORE` ("DOWN 3") · `CLOCK`.
The "TO GO 80" cell is deleted. New prop `scoreDiff` passed from
`DriveScreen.tsx` (`state.scenario.scoreDiff`); render `DOWN ${-scoreDiff}`
(scoreDiff is negative). Grid: `repeat(4, 1fr)`, collapsing to `repeat(2, 1fr)`
two rows under 560px. Keep the "N yards to the end zone" caption under the
field — it's now the only place that number appears.

**1b. Drive-log labels.** In `PlayByPlayFeed.tsx`, row label becomes
`` `${ordinalDown(p.down)} & ${p.distance} · ${formatBallOn(p.fieldPosition)}` ``
(replaces "FROM THE 80").

**1c. Stakes strip.** In `DriveScreen.tsx`, directly under the visualizer:
```tsx
<p className="stakes-strip">Down by {-scenario.scoreDiff} · one drive to win it</p>
```
Style: centered, `var(--font-display)`, 0.85rem, letter-spacing 0.08em,
uppercase, `color: var(--loss)` for the "Down by N" span, rest `var(--muted)`.
Render only while driving (not on result).

**1d. Tempo control never unmounts.** In `DriveScreen.tsx` remove the
`situation.clockRunning &&` around the tempo block; instead pass a `disabled`
state: slider `disabled={resolving || !situation.clockRunning}`. When clock is
stopped, replace the `15s` readout with a chip `CLOCK STOPPED` (muted bg, no
amber) and swap the hint to "Clock's stopped — this snap costs nothing extra."

**1e. Ball + progress animate.** `drive.css`:
```css
.field-marker { transition: left 800ms cubic-bezier(0.22, 1, 0.36, 1); }
.field-progress { transition: width 800ms cubic-bezier(0.22, 1, 0.36, 1); }
```

**Acceptance:** scoreboard shows OWN/AWAY + DOWN 3; log rows read "3rd & 12 ·
AWAY 29"; tempo block persists after an incompletion with CLOCK STOPPED chip;
ball glides on gains. `formatBallOn` tests green.

---

## PR 2 — Game feel (B2, B3, B4, B6)

**2a. Staged play reveal** (`DriveScreen.tsx`, `drive.css`):
- Variable anticipation, replacing the flat 700ms:
  ```ts
  const HIGH_LEVERAGE_MS = 1300;
  const isHighLeverage = situation.down === 4 || call.kind === "fieldGoal" || situation.clockSeconds <= 30;
  const delay = isHighLeverage ? HIGH_LEVERAGE_MS : 700;
  ```
- While resolving: option buttons get `opacity: 0.45`; the "Calling the play…"
  line gets a CSS ellipsis pulse (3 dots, staggered `@keyframes` opacity).
- Banner entrance: give the banner `key={plays.length}` so it remounts per
  play, with `@keyframes banner-in { from { opacity: 0; transform: translateY(10px); } }`
  250ms house easing.
- Outcome flourishes on the banner element:
  - `.touchdown`: gold text (exists) + `@keyframes td-flash` (box-shadow/bg
    pulse amber, 600ms) + confetti (2d below).
  - `.turnover`: red text (exists) + `@keyframes shake` (translateX ±6px, 400ms).
  - New `.big-gain` class when `outcome.yards >= 20 && !isTouchdown`: scale-pop
    (1 → 1.04 → 1, 300ms).

**2b. Confetti util** — no dependency. New `app/src/utils/confetti.ts`
(~40 lines): spawn 14 absolutely-positioned 8×8px divs at a given element's
center, random pastel from the token palette (`#ffc233 #34e07a #5b9dff #f1556a`),
animate outward+fall via Web Animations API (`element.animate`), remove on
finish, and no-op when `matchMedia("(prefers-reduced-motion: reduce)").matches`.

**2c. Result payoff** (`ResultScreen.tsx`, `result.css`):
- `useCountUp(target, 900)` hook (rAF-based, ease-out, returns displayed int;
  returns `target` immediately under reduced motion). Apply to the hero score.
- Receipt rows cascade: `animation: banner-in 250ms both` with
  `animation-delay: calc(var(--i) * 120ms)` (set `--i` per `<li>`).
- Win: fire confetti once on the hero — guard with a `useRef` keyed on
  `driveLog` **exactly like the `recordedLog` ref** (StrictMode double-mount
  would otherwise double-fire).
- Loss: fatal-play callout under the hero:
  ```tsx
  <p className="fatal-play">{lastPlay.description}</p>
  ```
  styled like the drive screen's turnover banner (red-tinted card). Only when
  `!driveLog.won && lastPlay`.

**2d. Clock urgency** (`DriveFieldVisualizer.tsx`, `drive.css`): add
`clock-danger` class to the clock value when `clockSeconds < 60` → `color:
var(--loss)` + 1s opacity pulse; `< 10` → 0.5s pulse (`clock-critical`).

**2e. Streak banner pop:** `.streak-banner { animation: banner-in 250ms both; }`.

**Acceptance:** 4th-down/FG/final-30s calls take visibly longer to resolve;
TD flashes gold + confetti; turnovers shake; result score counts up; receipt
lines cascade; loss shows the fatal play under the hero; clock pulses red
under 1:00. No motion under reduced-motion emulation
(DevTools → Rendering → prefers-reduced-motion).

---

## PR 3 — Structure & mobile (C1, C4, A5, A6)

**3a. Result page reorder** (`ResultScreen.tsx`): new order = hero →
fatal-play (loss) / receipt (win) → roster credit → SubmitScorePanel →
SharePanel → **action buttons** (moved up from the bottom) → collapsible
drive section. The field visualizer + log both go inside:
```tsx
<details className="drive-log-details">
  <summary>Final field position &amp; full drive · {driveLog.plays.length} plays</summary>
  <DriveFieldVisualizer fieldPosition={finalFieldPosition} />
  <PlayByPlayFeed plays={driveLog.plays} />
</details>
```
Default **collapsed**. Style `summary` like `.eyebrow` with a rotating ▸
chevron. Extract this block as `DriveRecap.tsx` (shared with 3b).

**3b. DailyDone enrichment** (`DailyDone.tsx`): after the streak badge, add
(i) the drafted lineup as a 3×2 grid of `PlayerCard readOnly` (resolve entries
from `record.rosterIds` via the manifest — `rosterFromIdList` already returns
the roster); (ii) a line "You reached {formatBallOn(finalFieldPosition)}" for
losses / "You scored with {formatClock(clockSecondsRemaining)} left" for wins;
(iii) the shared `DriveRecap` accordion. Kills the dead space.

**3c. Mobile header** (`App.tsx`, `App.css`): change the toggle label from
"Free Play" → **"Free"** (both viewports — "Daily / Free" reads fine). At
≤560px: `.brand-name { font-size: 1rem; white-space: nowrap; }`, reduce header
paddings, `.header-leaderboard-button { padding: 0.35rem 0.6rem; }` and drop
its "Leaderboard" text to just 🏆 at ≤420px (wrap text in a span hidden by
media query). Target: one-line header ≤ 56px tall at 390px.

**3d. Field ticks on small screens** (`drive.css`):
```css
@media (max-width: 480px) {
  .field-tick:nth-child(even) .field-tick-label { display: none; }
}
```

**Acceptance:** on mobile the result page's submit/share/actions are all
within the first ~1.5 screens; log expands on tap; DailyDone shows lineup +
final-spot line + recap; header is a single row at 390px; no colliding yard
numbers.

---

## PR 4 — A11y, onboarding, consistency (C2, C3, C5, C6, D1, D2)

**4a. Modal behavior hook.** New `app/src/utils/useModalBehavior.ts`:
Escape→onClose; on open, focus the close button; on unmount, restore focus to
`document.activeElement` from before open; trap Tab within the modal (cycle
first/last focusable). Apply to `LeaderboardScreen` and `HowItWorks`.

**4b. Loading skeletons.** Leaderboard: when data is `null`, render 5
`.lb-skeleton` rows (surface-2 bars, `@keyframes shimmer` background-position
sweep) instead of "Loading…". Draft initial load: 3 skeleton player cards +
gauge placeholder instead of "Loading players...".

**4c. First-run coach strip** (`DraftScreen.tsx`): if
`localStorage.fmd_seen_intro` unset, show a dismissible strip above the team
panel — three bullets: "**×payout** = score multiplier — weaker players pay
more · **You call every play** — run, pass, kick · **Daily = one shot**, new
drill at midnight UTC" with an ✕ that sets the flag. Amber left-border card,
same pattern as `.hiw-note`.

**4d. Leaderboard daily-tab button copy** (`LeaderboardScreen.tsx`): in the
daily tab only, "Play this lineup" → **"Try in Free Play"**.

**4e. Payout gauge gradient** (`draft.css`): `.power-meter-fill` background →
`linear-gradient(90deg, #93a3ba, #34e07a 45%, #ffc233)` (muted → mid-green →
hot amber), matching the card payout bands.

**4f. Press/focus states** (`index.css`): global
`:focus-visible { outline: 2px solid var(--sky); outline-offset: 2px; }`;
`.cta-button:active, .ghost-button:active, .play-option-button:active,
.share-button:active, .lb-play:active { transform: scale(0.98); }` (replace
any per-component translateY(1px) actives to keep one convention).

**Acceptance:** Escape closes both modals, focus returns to opener, Tab stays
inside; skeletons replace both loading strings; coach strip shows exactly once
per device; gauge sweeps to amber; keyboard-tabbing shows a visible ring on
every control.

---

## Deferred (do not build now)
Draft deal/pick animations (B5), sound pass (D3), sticky mobile action bar —
revisit after the four PRs land and the feel is reassessed.

## Gotchas
- **StrictMode double-mount**: any "fire once on result" effect (confetti)
  must use the drive-log-identity ref pattern already in `ResultScreen`.
- The banner remount (`key={plays.length}`) is what retriggers entrance
  animations — don't "optimize" it away.
- `details`/`summary` needs `-webkit-details-marker` hidden for custom chevron.
- Full-page Playwright screenshots paint the sticky header mid-content — it's
  a capture artifact, not a layout bug; judge the header only in viewport shots.
- Toggle label rename ("Free Play"→"Free") touches `App.tsx` `ModeToggle`; the
  e2e review spec used `name: "Free Play"` — the *committed* smoke test doesn't,
  no test change needed.
- `useCountUp` must clean up its rAF on unmount (Run It Back mid-count).
