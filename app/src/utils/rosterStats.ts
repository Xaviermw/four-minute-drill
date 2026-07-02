import type { DraftedRoster } from "../types/roster";
import { LINEUP_SLOT_ORDER } from "../share/lineupCode";

/** Team Overall = rounded average of the six players' ratings. Single source
 * of truth shared by the draft gauge, share text, image card, and leaderboard. */
export function teamOverall(roster: DraftedRoster): number {
  const sum = LINEUP_SLOT_ORDER.reduce((acc, slot) => acc + roster[slot].rating, 0);
  return Math.round(sum / LINEUP_SLOT_ORDER.length);
}
