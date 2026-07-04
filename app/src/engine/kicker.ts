import type { KickDistanceTier, KickerDataset, KickerDistanceBucket } from "../types/player";
import { MIN_SAMPLE_THRESHOLD } from "./situational";
import { shrinkRate } from "./shrinkage";
import type { RNG } from "./rng";

// Mirrors data-pipeline/config/buckets.yaml's kick_distance_buckets.
const KICK_DISTANCE_BUCKETS: { id: KickDistanceTier; maxDistance: number }[] = [
  { id: "under30", maxDistance: 29 },
  { id: "30s", maxDistance: 39 },
  { id: "40s", maxDistance: 49 },
  { id: "50s", maxDistance: 59 },
  { id: "60plus", maxDistance: 999 },
];

export function kickDistanceBucketId(kickDistance: number): KickDistanceTier {
  for (const bucket of KICK_DISTANCE_BUCKETS) {
    if (kickDistance <= bucket.maxDistance) return bucket.id;
  }
  return KICK_DISTANCE_BUCKETS[KICK_DISTANCE_BUCKETS.length - 1].id;
}

/** kick_distance = yardline_100 (fieldPosition) + 18, verified against real nflfastR data. */
export function kickDistanceFor(fieldPosition: number): number {
  return fieldPosition + 18;
}

function shrunkMakePct(
  kickerBucket: KickerDistanceBucket | undefined,
  leagueBucket: KickerDistanceBucket | undefined
): number {
  const playerN = kickerBucket?.attempts ?? 0;
  if (playerN >= MIN_SAMPLE_THRESHOLD) return kickerBucket!.makePct;
  return shrinkRate(kickerBucket?.makePct, playerN, leagueBucket?.makePct);
}

/** The kicker's make probability (0-1) for a given kick distance. */
function fieldGoalMakePct(
  kicker: KickerDataset,
  kickDistance: number,
  leagueAverageKickerRates: Partial<Record<KickDistanceTier, KickerDistanceBucket>>
): number {
  const tier = kickDistanceBucketId(kickDistance);
  return shrunkMakePct(kicker.distanceBuckets[tier], leagueAverageKickerRates[tier]);
}

/** Returns true if the field goal is made. */
export function attemptFieldGoal(
  kicker: KickerDataset,
  kickDistance: number,
  leagueAverageKickerRates: Partial<Record<KickDistanceTier, KickerDistanceBucket>>,
  rng: RNG
): boolean {
  const makePct = fieldGoalMakePct(kicker, kickDistance, leagueAverageKickerRates);
  return rng.next() < makePct;
}
