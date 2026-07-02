// Tuned heuristics, not derived from pbp data (pbp doesn't expose per-play
// real-time duration cleanly). Every v1 drive is a must-score, hurry-up
// situation, so these assume no-huddle tempo throughout, not standard pacing.
//
// Clock cost per down is two separate components:
//  1. PLAY_DURATION_RANGE -- the snap-to-whistle time, always consumed by
//     every offensive play and field goal attempt, regardless of whether the
//     clock keeps running afterward.
//  2. The *between-plays* gap before the next snap, only relevant if the
//     clock is still running after the play (an incomplete pass stops the
//     clock immediately, so there's no further gap to account for): either
//     the player's own manual tempo choice (MANUAL_TEMPO_RANGE) or, lacking
//     one, the automatic CLOCK_RUNOFF_RUNNING fallback range.
export const PLAY_DURATION_RANGE = { min: 5, max: 15 };
export const CLOCK_RUNOFF_RUNNING = { min: 12, max: 20 }; // automatic between-plays gap when no manual tempo is given

export const MAX_PLAYS_PER_DRIVE = 30; // defensive cap against infinite loops

// Manual snap-tempo controls: when the clock is already running going into a
// down, the player chooses how long to hold the ball before snapping again.
export const MANUAL_TEMPO_RANGE = { min: 15, max: 35 };
export const SPIKE_RUNOFF_SECONDS = 10;
export const SPIKE_AVAILABLE_BELOW_CLOCK_SECONDS = 120;
export const MAX_REALISTIC_FIELD_GOAL_DISTANCE = 65; // kick_distance, not field position

// "Clutch" scoring bonus is based on absolute clock remaining at the moment
// of scoring (not a fraction of that drive's own starting clock) -- scoring
// with 0:00 left is always maximally clutch, scoring with 2:00+ left never
// gets a bonus, regardless of how much time the scenario started with.
export const CLUTCH_REFERENCE_SECONDS = 120;

export const LEAGUE_AVG_TARGET_SHARE = 1 / 3; // fallback when a receiver lacks aggregate data
export const LEAGUE_AVG_RUSH_SHARE = 1;

// Shrinkage prior weight (in "plays") used to blend a low-volume player's own
// aggregate rates toward league-average-by-role.
export const SHRINKAGE_PRIOR_WEIGHT = 50;
export const SHRINKAGE_LOW_VOLUME_THRESHOLD = 50;

// On a completed pass attempt to a drafted WR/TE, the outcome (interception
// risk, then completion/yards/TD for non-INT plays) is a blend of the
// receiver's own profile and the QB's own profile, weighted toward the
// receiver since they're the one catching (or not catching) the ball.
export const RECEIVER_OUTCOME_WEIGHT = 0.75;
export const QB_OUTCOME_WEIGHT = 0.25;
