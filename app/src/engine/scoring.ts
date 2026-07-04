import { CLUTCH_REFERENCE_SECONDS } from "./constants";

// Payout multiplier: the weaker the drafted player/roster, the bigger the score
// if you win. This is what the draft now surfaces instead of an "Overall" (a
// high OVR is actually the *low*-payout, misleading pick).
//
// It's linear in rating, which is the key property the UI relies on: a team's
// payout equals the average of its players' individual payouts, so a per-card
// payout composes exactly into the team payout and the final score.
export const RATING_FLOOR = 40;
export const RATING_CEIL = 99;
export const MIN_PAYOUT = 1.0; // a 99-rated player/team
export const MAX_PAYOUT = 2.0; // a 40-rated player/team

/**
 * Maps clock remaining (seconds) at the moment of scoring to the clutch
 * multiplier (1.0 at 2:00+ remaining, up to 2.0 at 0:00). Exported so the live
 * drive UI can preview the exact bonus a score right now would earn -- it MUST
 * stay the single source of truth so the meter and the final score never drift.
 */
export function clutchMultiplier(clockAtScoreSeconds: number): number {
  const remainingFraction = Math.max(0, Math.min(1, clockAtScoreSeconds / CLUTCH_REFERENCE_SECONDS));
  return Math.min(2, Math.max(1, 1 + (1 - remainingFraction)));
}

/** Maps a rating (40-99) to its payout multiplier (2.0 down to 1.0). */
export function payoutMultiplier(rating: number): number {
  const clamped = Math.max(RATING_FLOOR, Math.min(RATING_CEIL, rating));
  const t = (RATING_CEIL - clamped) / (RATING_CEIL - RATING_FLOOR); // 1 at floor, 0 at ceil
  return MIN_PAYOUT + t * (MAX_PAYOUT - MIN_PAYOUT);
}

/** The payout for a whole roster = payout of its average rating (== the average
 * of the per-player payouts, since the mapping is linear). */
export function rosterPayoutMultiplier(ratings: number[]): number {
  const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  return payoutMultiplier(avg);
}
