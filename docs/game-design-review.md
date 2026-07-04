# Game design review — is Four Minute Drill actually fun?

Fable review, 2026-07-04. Unlike the UX pass, this reviews the *game*: the loop,
the incentives, the hooks. Grounded in a 3,600-drive simulation run against the
real engine (9 cells: roster strength × strategy, N=400 each) plus the live app.

## The balance data (run 2026-07-04, real engine + real player data)

| cell | win% | TD% | FG% | clock† | downs† | INT/fum† | missFG† | **EV** | avg win score | clock left on win |
|---|---|---|---|---|---|---|---|---|---|---|
| stacked / td-fast | 61.8 | 51.0 | 10.8 | 0.0 | 15.8 | 18.3 | 4.3 | **73.1** | 118 | 2:16 |
| stacked / td-milk | 56.8 | 47.8 | 9.0 | 1.8 | 15.0 | 21.0 | 5.5 | **82.3** | 145 | 1:31 |
| stacked / fg-asap | 43.8 | 16.0 | 27.8 | 0.3 | 23.5 | 7.8 | 24.8 | **35.9** | 82 | 2:15 |
| random / td-fast | 51.3 | 39.8 | 11.5 | 0.3 | 19.5 | 23.5 | 5.5 | **70.3** | 137 | 2:05 |
| random / td-milk | 50.0 | 40.8 | 9.3 | 3.3 | 18.5 | 24.5 | 3.8 | **83.8** | 168 | 1:25 |
| random / fg-asap | 35.0 | 9.0 | 26.0 | 0.0 | 29.8 | 11.8 | 23.5 | **30.4** | 87 | 2:07 |
| scrub / td-fast | 44.0 | 34.0 | 10.0 | 0.3 | 26.8 | 26.8 | 2.3 | **72.5** | 165 | 1:55 |
| scrub / td-milk | 43.5 | 32.8 | 10.8 | 3.3 | 26.0 | 23.0 | 4.3 | **79.0** | 182 | 1:34 |
| scrub / fg-asap | 29.8 | 8.0 | 21.8 | 0.0 | 39.0 | 10.3 | 21.0 | **30.0** | 101 | 2:07 |

† loss-cause shares. EV = mean score including 0-point losses.

### What the numbers say

1. **The core gamble is genuinely balanced.** EV for TD-seeking play is ~70–84
   across stacked → scrub rosters. Stacked wins 62%, scrubs win 44%, and the
   payout multiplier almost exactly compensates. There is no dominant draft
   archetype — the central design bet *works*, and no tuning is needed.
2. **Clock-milking is a real push-your-luck lever**: +9–13 EV, costs a few
   points of win rate, clock-death risk 2–3%. A skilled player *should* milk.
   **But nothing in the UI reveals this** — the time bonus is invisible until
   the receipt. The game's best hidden decision is hidden.
3. **Kick-early is a trap, and the game lets you walk into it blind.** FG-asap
   halves your EV, mostly via 21–25% missed kicks from silly range. Fine that
   it's bad — but the persistent "Kick a 63-yard field goal" button gives no
   make-probability signal, and the data to show one exists per-kicker
   (`distanceBuckets.makePct`).
4. **~50% of daily players lose and get nothing.** Zero points, no board
   presence, no comparison. For a one-shot daily, that's half your audience
   receiving no feedback loop at all — the single biggest retention hole.
5. Clock expiry is a non-factor (≤3%); losses come from turnover-on-downs and
   turnovers, which feel attributable (you called the play) — good.

## What makes sense (keep, lean in)

- **The premise**: draft + call-the-plays + payout gamble in a 90-second round
  is a real, differentiated idea — 82-0's "absurd lineup" DNA crossed with a
  playable moment. The one-shot daily with a shared pool is exactly the right
  Wordle-shaped container for it.
- **Play-the-hand-you're-dealt**: 3 random options per down (sometimes none of
  them fit 3rd & 12) is the card-game charm, not a flaw. Don't "fix" it.
- **The stat lines on draft cards** give obscure players meaning; NFL knowledge
  is an edge but not a requirement.
- **"Beat my lineup" links** are a hook Wordle doesn't have — a *challenge*,
  not just a brag.

## What doesn't make sense

1. **Down 3, and a field goal "wins."** Football fans notice. `scoreDiff` is
   verified display-only, so set the scenario to **down 2** ("a field goal
   wins it — a touchdown wins it in style") with zero mechanical impact.
2. **The invisible time bonus** (finding 2 above).
3. **Uninformed field-goal temptation** (finding 3 above).
4. **Play buttons carry no player quality.** "Deep pass to Trent Sherfield"
   vs "Short pass to DK Metcalf" is a real decision — but you must remember
   the draft stats. A tiny payout/catch-rate chip on each option fixes it.
5. **Losing the daily is a dead end** (finding 4). "Better luck tomorrow" +
   0 + an empty board row is the weakest moment in the product.

## How it hooks people — honest assessment

Current hooks: daily scarcity + day-streak (good), three leaderboards (good),
share text + image + challenge link (good scaffold). What's missing is the
**compulsive-share artifact** and the **loser's feedback loop** — the two
things that actually made Wordle-likes spread.

### Ranked recommendations

**P1 — Emoji drive grid in the share text.** Wordle spread because the share
was a spoiler-free *pattern* that made people ask "what is that?" Encode each
play: 🏈 gain, ➡️ first down, ❌ incomplete, 💥 sack/loss, 🚫 turnover, 🥅 FG,
🎉 TD. `🏈🏈❌➡️💥🏈🎉 · 168 pts · ×1.7 squad` is instantly recognizable in a
group chat. All data is in `driveLog.plays`; ~30 lines in `shareText.ts`.

**P1 — Score the loss / rank everyone daily.** Submit daily losses too (RLS
already allows score 0; add a `final_field_position` column). Daily tab gains a
"longest failed drives" section under the winners; DailyDone shows "Your drive
died at the AWAY 12 — further than 78% of today's players." Everyone gets a
number every day. (Keep win-streaks wins-only; keep all-time board wins-only.)

**P1 — Live time-bonus meter on the drive screen.** Small `TIME BONUS ×1.42 ↑`
readout next to the clock once under 2:00. Turns the milk-vs-snap choice into
visible push-your-luck — the data says it's the game's most interesting lever.

**P2 — FG button make-% hint** ("Kick a 63-yarder · Prater makes ~18% from
here") from the kicker's `distanceBuckets`; nudge label color by band.
**P2 — Target chips on play options** (payout or catch rate).
**P2 — Scenario → down 2** so the FG win is legitimate.
**P2 — "Yesterday's drill" recap** on the daily done/draft screen (winner name
+ score + your rank) — closes the daily loop.

**P3 —** Personal stats panel (games, win%, best, current streaks — all
localStorage); near-miss loss copy ("12 yards short"); weekly flavor modes
(e.g., payout cap floor "Underdog Friday"); optional sound.

**Explicitly not recommended now:** balance changes (EV is flat — don't touch
payout or clutch curves), more roster slots, play-option rerolls (would erode
the dealt-hand identity), accounts/login.

## Bottom line

The loop is sound and the central gamble is provably fair — this is a real
game, not a toy. What it's missing is *feedback and flaunt*: half the players
currently end their day with nothing to feel, and the share artifact doesn't
yet brag at a glance. Ship the three P1s and the daily becomes a habit with a
built-in spread mechanism.
