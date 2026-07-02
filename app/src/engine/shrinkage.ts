import { SHRINKAGE_LOW_VOLUME_THRESHOLD, SHRINKAGE_PRIOR_WEIGHT } from "./constants";

/**
 * Blends a low-volume player/kicker's own rate toward a league-average rate,
 * weighted by how much real sample the player actually has. Shared by
 * sampleOutcome.ts (offensive players) and kicker.ts (field goals) so both
 * use the same shrinkage math instead of duplicating it.
 */
export function shrinkRate(
  playerValue: number | undefined,
  playerN: number,
  leagueValue: number | undefined
): number {
  const lv = leagueValue ?? 0;
  if (playerValue === undefined) return lv;
  if (playerN >= SHRINKAGE_LOW_VOLUME_THRESHOLD) return playerValue;
  const weight = SHRINKAGE_PRIOR_WEIGHT;
  return (playerValue * playerN + lv * weight) / (playerN + weight);
}
