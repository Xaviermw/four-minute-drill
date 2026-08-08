# Season Score — spec (v1, pre-build)

Owner concept 2026-08-07: cumulative score across dailies as the
returning-user hook, possibly a user page. This is the v1 that captures the
retention value without accounts, pages, or new friction. Build window:
Aug 15–25 (after the data refresh), live for kickoff. Additive UI + one
read-only view — outside the Sep 1 engine/economy freeze surface.

## The pitch (player-facing)

"The 2026 season starts Sept 10. Every drill counts." Your Season Score is
the sum of your daily-drill scores since opening day. Playing daily is the
only way it grows; it never goes down. The season table mirrors the sport's
own arc — latecomers see a race they can still climb, regulars feed a number
that compounds.

## What ships

1. **`season_totals` view** (migration 011, read-only): sum of daily scores +
   days played per user_id within the season window, joined to the latest
   name. Season window is a constant in the view (2026-09-10 .. 2027-01-05);
   pre-season scores are warmup, deliberately excluded. No new writes, no RLS
   surface beyond select.
2. **"Season" tab** on the leaderboard: rank · name · days played · season
   total. Named rows only (same rule as streaks -- Anonymous is
   anti-social-proof); the claim nudge pattern reuses as-is.
3. **"Your season" strip** on the daily result + DailyDone: "Season: 1,240
   pts · 9 drills · #14" -- the number tomorrow's visit feeds. Device-scoped
   (user_id), shows even for unnamed players (their rank vs named board
   shown as "unranked -- claim a name").
4. **Copy framing rule**: accumulation, never guilt. "Look what you've
   built," not "you missed 3 days." The daily streak already carries the
   attendance pressure; Season Score is the trophy shelf.

## Deliberately deferred

- **User pages** (routes, share surface, moderation) -- revisit post-launch
  if players ask for them.
- **Accounts / cross-device identity** -- the first friction we'd ever add;
  a later "claim your history via email" can graft on without rework.
- **Season archives/awards** -- end-of-season problem, happily.

## Decided (owner, 2026-08-08)

- Daily LOSSES count their marginal points toward the season total — every
  play adds (consistent with "the daily accepts losses").
- No practice table pre-season: ONE season table, starting opening day.
