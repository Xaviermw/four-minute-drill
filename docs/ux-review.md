# UX/UI review — making Four Minute Drill dynamic & user-friendly

Fable design review, 2026-07-03. Grounded in 14 fresh screenshots of every screen
state (draft initial/mid/recap, drive initial/after-play, result, leaderboard,
how-it-works, daily-done, free-play) at 1280×900 **and** 390×844, plus code
verification. The verdict up front: the visual foundation is strong — the field,
the card language, the scoreboard type all read "broadcast" — but the game is
**almost entirely static**. Nothing moves: the ball teleports, plays appear as a
text swap, the score just *is*. For a drama-of-the-drive game, motion isn't
polish, it's the product. Priorities below reflect that.

Conventions: **[impact/effort]** · file anchors given per item. All new motion
must be wrapped in `@media (prefers-reduced-motion: reduce)` guards (currently
zero usages in the codebase).

---

## A. Correctness & clarity fixes (cheap, do first)

**A1. The scoreboard's "TO GO" is wrong. [high/low]**
It shows *yards to the end zone* (80) under the label "TO GO" while "1st & 10"
already carries the real to-go distance. Any football fan reads "TO GO: 80" as
nonsense, and it duplicates the caption under the field. Change the third cell
to the ball spot in football convention — `BALL ON · OWN 20` / `AWAY 29` — and
keep "to go" only inside "1st & 10". `DriveFieldVisualizer.tsx` (scoreboard
cells).

**A2. Drive-log down-and-distance uses engine coordinates, not football. [high/low]**
Log rows read "1ST & 10 FROM THE 80" — that's `yardline_100`, not a yard line.
Should be "1st & 10 · own 20", "3rd & 12 · AWAY 29". Same helper as A1; used in
`PlayByPlayFeed.tsx` row labels.

**A3. The stakes are never stated. [high/low]**
Nowhere on the drive screen does it say you're **down 3 with one drive left** —
the entire premise. Players who arrive via a share link get no framing. Add a
one-line stakes strip under the scoreboard ("▼ DOWN BY 3 · FG ties nothing —
you need points to win") or fold "DOWN 3" into the scoreboard as a fourth cell.
`DriveScreen.tsx` / `DriveFieldVisualizer.tsx`.

**A4. Tempo control unmounts when the clock stops → layout jump. [med/low]**
After an incompletion the "Snap tempo" block vanishes and everything shifts up;
it pops back on the next running-clock play. Keep it mounted and disabled with a
"CLOCK STOPPED" badge in place of the readout. `DriveScreen.tsx` (the
`situation.clockRunning &&` conditional).

**A5. Mobile header is a 3-line pileup. [med/low]**
At 390px the brand wraps to three lines ("FOUR / MINUTE / DRILL"), the toggle
wraps "FREE / PLAY", and the bar eats ~90px+ of a small screen. Fix: keep the
brand on one line at a smaller size (or 🏈 + "4MD"), shorten toggle labels to
"Daily / Free" below 480px. `App.css` header media queries.

**A6. Mobile field tick labels collide. [low/low]**
The right-side "◄40 ◄30 ◄20 ◄10" labels cram together at 390px. Hide odd ticks
(or all numerals, keeping hashes) below ~480px. `drive.css` `.field-tick-label`.

---

## B. Dynamism — make the sim feel alive (the big ROI)

**B1. Animate the ball and progress fill. [high/trivial]**
`.field-marker` and `.field-progress` are positioned by inline `left`/`width`
with **no transition** — the ball teleports. One line each:
`transition: left 800ms cubic-bezier(.22,1,.36,1)` (and width for the fill).
Instantly the drive reads as movement down a field. `drive.css`.

**B2. Stage the play reveal. [high/med]**
Today: click → static "Calling the play…" for a flat 700ms → banner text swaps
in with no animation. Make the anticipation an actual beat:
- Pulse/ellipsis animation while resolving; disable+dim the option buttons.
- Banner **enters** (translateY + fade, ~250ms) instead of appearing.
- Outcome-scaled celebration: TD → gold flash on the banner + brief confetti
  burst; turnover → red flash + horizontal shake; 20+ yard gain → quick
  scale-pop. The classes already exist (`.touchdown`, `.turnover`) — they only
  recolor text today.
- Variable suspense: stretch `ANTICIPATION_MS` to ~1300ms on 4th down, FG
  attempts, and inside the final 30s. Constant delays stop feeling like drama.
`DriveScreen.tsx` (`ANTICIPATION_MS`, `resolving`), `drive.css`.

**B3. Result-screen payoff moment. [high/med]**
The final score just *sits there*. Wins should feel earned: count the score up
0→N (~900ms, ease-out) with the multiplier lines landing one at a time in the
receipt; confetti on win; a subtle desaturate/slow fade-in on loss. On a loss,
pull the **fatal play** up into a callout under the hero ("4th & 12: Mike White
can't connect with DK Metcalf") — right now the drive-ending play is buried at
the bottom of the log. `ResultScreen.tsx`, `result.css`.

**B4. Clock urgency. [med/low]**
The clock is amber at 4:00 and amber at 0:14. Under 60s make it red with a
1s pulse; under 10s pulse faster. Cheap tension. `DriveFieldVisualizer.tsx` +
`drive.css`.

**B5. Draft deal & pick feedback. [med/med]**
New trios swap in via a 220ms opacity fade; picking is instant. Deal the three
cards with a stagger (60ms apart, translateY+fade), scale-pop the picked card,
and tick the team-payout number up/down to its new value instead of snapping.
`DraftScreen.tsx` transition block, `draft.css`, `TeamPanel.tsx`.

**B6. Streak banner entrance. [low/low]**
`🔥 N-win streak` just appears; give it the same pop as B2's banner (scale
1.05→1 + fade). `result.css` `.streak-banner`.

---

## C. Usability & structure

**C1. Result page: actions are ~1,800–2,000px below the fold. [high/med]**
Order today: hero → receipt → roster line → submit → share → full-width field →
10-row drive log → *finally* the CTAs. Restructure: keep hero → submit/share,
then collapse the log behind an accordion ("Show full drive · 10 plays"), and
make the primary actions a sticky bottom bar on mobile. The field can shrink to
a thin final-spot strip on result. `ResultScreen.tsx`, `result.css`.

**C2. Modal accessibility & loading. [med/low]**
Both modals (leaderboard, how-it-works): no **Escape** to close, no focus trap,
focus isn't returned to the opener. Leaderboard shows a bare "Loading…" string —
swap for 5 skeleton rows (shimmer). `LeaderboardScreen.tsx`, `HowItWorks.tsx`,
`leaderboard.css`.

**C3. First-run onboarding nudge. [med/med]**
Payout is explained only by a desktop-only `title` tooltip and a footer link.
A first-visit dismissible coach strip on the draft screen (3 bullets: what
payout means · you call the plays · daily = one shot) stored in localStorage
would cover mobile users. `DraftScreen.tsx`.

**C4. DailyDone is a stub with a void. [med/med]**
After the one daily attempt, the return screen shows score + countdown and
~300px of empty space. It has `rosterIds` and the full `driveLog` — show the
drafted lineup (mini cards), "you reached the AWAY 29", and the log accordion.
Make the recap worth returning to. `DailyDone.tsx`.

**C5. Disambiguate "Play this lineup" from the daily tab. [low/low]**
Clicking it on a *Today's Drill* row starts a **free-play** drive (correct,
since the daily is one-shot), but nothing says so. Rename the button in the
daily tab to "Try in Free Play". `LeaderboardScreen.tsx`.

**C6. Skeleton the initial player load. [low/low]**
"Loading players..." plain text on first paint → 3 skeleton cards + gauge
placeholder. `DraftScreen.tsx`.

---

## D. Consistency & polish

**D1. Unify the payout color language. [low/low]**
Cards use amber = hot payout, but the team-gauge gradient runs teal→pink, so
"good" is amber in one place and pink in another. Make the gauge fill sweep
muted→amber to match `payout-hot`. `draft.css` `.power-meter-fill`.

**D2. Press states & focus rings. [low/low]**
Hovers are good; `:active` compression (scale .98) is missing on play options
and CTAs, and `:focus-visible` rings should be consistent across all
interactive elements. Global pass in `index.css`.

**D3. Sound pass (later, behind a mute toggle). [med/med]**
Whistle on snap, crowd swell on TD, thud on turnover. Off by default on first
visit is safest; persist the toggle. Flagging for the backlog — motion (B)
comes first.

---

## Suggested implementation order

1. **A1–A4** (label/clarity fixes) + **B1** (ball transition) — one small PR,
   transforms perceived quality immediately.
2. **B2 + B3 + B4** — the "game feel" PR (play reveal, result payoff, clock).
3. **C1 + C4** (result & daily-done restructure) + **A5/A6** mobile pass.
4. **C2 + C3 + D1/D2** (a11y, onboarding, consistency).
5. **B5/B6, C5/C6, D3** as polish follow-ups.

Everything in A/B/C1–C2 is client-only — no data, engine, or Supabase changes.
