# Mobile field legibility — theory & plan (2026-08-13)

Owner: "mobile can look pretty compressed and hard to see the current
down/spacing." Root cause: ~2.5px/yard on phones; the actionable ~35 yards
of any down occupy ~20% of the screen.

## Option ladder

- **A. Broadcast camera** (the real fix, post-launch flagship): viewport
  windows ~45 yds around the LOS at ~6-7px/yd, panning with the ball;
  full-field minimap strip for drive context. Retires red-zone compressive
  seating + goal-line band slides (windowed views rarely collide). Panning
  needs house-easing + reduced-motion care; audit rework required.
- **B. Vertical field on phones**: honest 6px/yd via rotation, but forks the
  layout structurally and abandons the broadcast-chart identity. Fallback if
  A's minimap proves fussy.
- **C. Legibility pack** (pre-kickoff, small): (1) ASK-ZONE SHADING -- tint
  LOS→sticks so the down's demand reads as an area; (2) mobile field floor
  200→240px; (3) thicker LOS/1ST lines on phones; (4) Down cell loudest in
  the scoreboard. Item 1 is the highest value/effort.
- **D. Fisheye x-scale: REJECTED** -- unevenly spaced yard lines read as
  broken and visually lie about distance (against the honesty ethos).

## Decision

C ships pre-kickoff (after Season Score, before the freeze -- UI-only,
outside the freeze surface). A is the first post-launch build, spec'd
properly then. Revisit B only if A prototyping fails.
