import type { AggregateRates, DepthTier, OutcomeRecord, PlayerDataset, PlayerRole } from "../types/player";
import { QB_OUTCOME_WEIGHT, RECEIVER_OUTCOME_WEIGHT } from "./constants";
import type { RNG } from "./rng";
import { shrinkRate } from "./shrinkage";
import { bucketKey, distanceBucketId, fieldZoneId, MIN_SAMPLE_THRESHOLD } from "./situational";

function findBucket(dataset: PlayerDataset, role: PlayerRole, key: string) {
  return dataset.buckets[role]?.find((b) => b.bucketKey === key);
}

function sameDownOutcomes(dataset: PlayerDataset, role: PlayerRole, down: number): OutcomeRecord[] {
  return (dataset.buckets[role] ?? [])
    .filter((b) => b.bucketKey.startsWith(`${down}_`))
    .flatMap((b) => b.outcomes);
}

/**
 * Relaxation order: down matters most, then field zone, then distance.
 * Tries same-down/any-zone/any-distance buckets pooled together before
 * giving up on real-sample matching entirely.
 */
function findRelaxedOutcomes(
  dataset: PlayerDataset,
  role: PlayerRole,
  down: number
): OutcomeRecord[] | null {
  const pooled = sameDownOutcomes(dataset, role, down);
  return pooled.length >= MIN_SAMPLE_THRESHOLD ? pooled : null;
}

export function getShrunkRates(
  dataset: PlayerDataset,
  role: PlayerRole,
  leagueAverageRates: Partial<Record<PlayerRole, AggregateRates>>
): AggregateRates {
  const playerRates = dataset.aggregates[role];
  const leagueRates = leagueAverageRates[role];
  const playerN = playerRates?.sampleSize ?? 0;

  const merged: AggregateRates = { firstDownRate: 0 };
  const keys = new Set<keyof AggregateRates>([
    ...(Object.keys(playerRates ?? {}) as (keyof AggregateRates)[]),
    ...(Object.keys(leagueRates ?? {}) as (keyof AggregateRates)[]),
  ]);
  keys.delete("byDepth"); // nested object, not a plain rate -- handled separately by getShrunkDepthRates
  for (const key of keys) {
    (merged as any)[key] = shrinkRate(
      playerRates?.[key] as number | undefined,
      playerN,
      leagueRates?.[key] as number | undefined
    );
  }
  return merged;
}

/**
 * Depth-conditioned version of getShrunkRates, for passer/receiver roles
 * when a specific pass depth was called. Falls back to the overall
 * (non-depth) shrunk rates if neither the player nor the league has
 * byDepth data for that tier (e.g. extremely low-volume player).
 */
export function getShrunkDepthRates(
  dataset: PlayerDataset,
  role: PlayerRole,
  depth: DepthTier,
  leagueAverageRates: Partial<Record<PlayerRole, AggregateRates>>
): AggregateRates {
  const playerDepthRates = dataset.aggregates[role]?.byDepth?.[depth];
  const leagueDepthRates = leagueAverageRates[role]?.byDepth?.[depth];
  if (!playerDepthRates && !leagueDepthRates) {
    return getShrunkRates(dataset, role, leagueAverageRates);
  }

  const playerN = playerDepthRates?.sampleSize ?? 0;
  const merged: AggregateRates = { firstDownRate: 0 };
  const keys = new Set<keyof AggregateRates>([
    ...(Object.keys(playerDepthRates ?? {}) as (keyof AggregateRates)[]),
    ...(Object.keys(leagueDepthRates ?? {}) as (keyof AggregateRates)[]),
  ]);
  for (const key of keys) {
    (merged as any)[key] = shrinkRate(
      playerDepthRates?.[key] as number | undefined,
      playerN,
      leagueDepthRates?.[key] as number | undefined
    );
  }
  return merged;
}

function clampYards(yards: number, fieldPosition: number): number {
  return Math.min(yards, fieldPosition);
}

function simulateFromRates(
  rates: AggregateRates,
  role: PlayerRole,
  fieldPosition: number,
  rng: RNG,
  depth?: DepthTier
): OutcomeRecord {
  const zone = fieldZoneId(fieldPosition);
  const isGoalLine = zone === "goal_line";
  const depthTier = depth ?? null;

  if (role === "passer") {
    if (rng.next() < (rates.sackRate ?? 0.06)) {
      const yards = -(2 + Math.floor(rng.next() * 6));
      return { yards, epa: -1, isTouchdown: false, isTurnover: false, isSack: true, isComplete: false, isFirstDown: false, depthTier: null, isScramble: false };
    }
    const isComplete = rng.next() < (rates.completionPct ?? 0.6);
    if (!isComplete) {
      const incompletePool = 1 - (rates.completionPct ?? 0.6);
      const isInt = incompletePool > 0 && rng.next() < (rates.intRate ?? 0.02) / incompletePool;
      return { yards: 0, epa: isInt ? -3 : -0.5, isTouchdown: false, isTurnover: isInt, isSack: false, isComplete: false, isFirstDown: false, depthTier, isScramble: false };
    }
    const baseYards = Math.max(0, (rates.yardsPerAttempt ?? 6) * (0.4 + rng.next() * 1.2));
    const yards = clampYards(Math.round(baseYards), fieldPosition);
    const isTouchdown = isGoalLine && rng.next() < (rates.passTdRate ?? 0.04) * 4;
    const isFirstDown = yards >= 10 || rng.next() < (rates.firstDownRate ?? 0.3);
    return { yards, epa: yards / 8, isTouchdown, isTurnover: false, isSack: false, isComplete: true, isFirstDown, depthTier, isScramble: false };
  }

  if (role === "rusher") {
    const baseYards = (rates.yardsPerCarry ?? 4.2) * (0.2 + rng.next() * 1.6);
    const yards = clampYards(Math.round(baseYards), fieldPosition);
    const isFumble = rng.next() < (rates.fumbleRate ?? 0.007);
    const isTouchdown = !isFumble && isGoalLine && rng.next() < (rates.rushTdRate ?? 0.03) * 4;
    const isFirstDown = !isFumble && (yards >= 10 || rng.next() < (rates.firstDownRate ?? 0.25));
    return { yards, epa: yards / 10, isTouchdown, isTurnover: isFumble, isSack: false, isComplete: null, isFirstDown, depthTier: null, isScramble: false };
  }

  // receiver
  const isComplete = rng.next() < (rates.catchRate ?? 0.65);
  if (!isComplete) {
    return { yards: 0, epa: -0.5, isTouchdown: false, isTurnover: false, isSack: false, isComplete: false, isFirstDown: false, depthTier, isScramble: false };
  }
  const baseYards = Math.max(0, (rates.yardsPerTarget ?? 7) / (rates.catchRate ?? 0.65) * (0.4 + rng.next() * 1.2));
  const yards = clampYards(Math.round(baseYards), fieldPosition);
  const isTouchdown = isGoalLine && rng.next() < (rates.receivingTdRate ?? 0.05) * 4;
  const isFirstDown = yards >= 10 || rng.next() < (rates.firstDownRate ?? 0.35);
  return { yards, epa: yards / 8, isTouchdown, isTurnover: false, isSack: false, isComplete: true, isFirstDown, depthTier, isScramble: false };
}

export interface SampleContext {
  down: number;
  distance: number;
  fieldPosition: number;
}

/**
 * `depth` only applies to passer/receiver roles (a chosen pass depth).
 * Relaxation order when a depth is specified:
 *   1. exact bucket, filtered to that depth
 *   2. same-down pool (any zone/distance), filtered to that depth
 *   3. same-down pool, depth filter dropped (real data of the wrong depth
 *      beats a fully synthetic guess)
 *   4. depth-conditioned rate-stat fallback (getShrunkDepthRates)
 */
export function sampleOutcome(
  dataset: PlayerDataset,
  role: PlayerRole,
  ctx: SampleContext,
  leagueAverageRates: Partial<Record<PlayerRole, AggregateRates>>,
  rng: RNG,
  depth?: DepthTier
): OutcomeRecord {
  const key = bucketKey(ctx.down, ctx.distance, ctx.fieldPosition);
  const exact = findBucket(dataset, role, key);

  if (depth) {
    const exactDepthOutcomes = exact?.outcomes.filter((o) => o.depthTier === depth) ?? [];
    if (exactDepthOutcomes.length >= MIN_SAMPLE_THRESHOLD) {
      return exactDepthOutcomes[Math.floor(rng.next() * exactDepthOutcomes.length)];
    }

    const sameDownDepthOutcomes = sameDownOutcomes(dataset, role, ctx.down).filter((o) => o.depthTier === depth);
    if (sameDownDepthOutcomes.length >= MIN_SAMPLE_THRESHOLD) {
      return sameDownDepthOutcomes[Math.floor(rng.next() * sameDownDepthOutcomes.length)];
    }

    const relaxedAnyDepth = findRelaxedOutcomes(dataset, role, ctx.down);
    if (relaxedAnyDepth) {
      return relaxedAnyDepth[Math.floor(rng.next() * relaxedAnyDepth.length)];
    }

    const depthRates = getShrunkDepthRates(dataset, role, depth, leagueAverageRates);
    return simulateFromRates(depthRates, role, ctx.fieldPosition, rng, depth);
  }

  if (exact && exact.sampleSize >= MIN_SAMPLE_THRESHOLD) {
    return exact.outcomes[Math.floor(rng.next() * exact.outcomes.length)];
  }

  const relaxed = findRelaxedOutcomes(dataset, role, ctx.down);
  if (relaxed) {
    return relaxed[Math.floor(rng.next() * relaxed.length)];
  }

  const rates = getShrunkRates(dataset, role, leagueAverageRates);
  return simulateFromRates(rates, role, ctx.fieldPosition, rng);
}

function poolSackOutcomesForDown(dataset: PlayerDataset, down: number): OutcomeRecord[] {
  return (dataset.buckets.passer ?? [])
    .filter((b) => b.bucketKey.startsWith(`${down}_`))
    .flatMap((b) => b.outcomes)
    .filter((o) => o.isSack);
}

/**
 * Pass plays roll for a QB sack before a receiver is even chosen -- sack
 * propensity is fundamentally a QB/offensive-line stat, independent of which
 * receiver was targeted. Returns null when no sack occurs this play.
 */
export function rollQbSackOutcome(
  qbDataset: PlayerDataset,
  ctx: SampleContext,
  leagueAverageRates: Partial<Record<PlayerRole, AggregateRates>>,
  rng: RNG
): OutcomeRecord | null {
  const rates = getShrunkRates(qbDataset, "passer", leagueAverageRates);
  const sackRate = rates.sackRate ?? 0.06;
  if (rng.next() >= sackRate) return null;

  const pooled = poolSackOutcomesForDown(qbDataset, ctx.down);
  if (pooled.length > 0) {
    return pooled[Math.floor(rng.next() * pooled.length)];
  }
  const yards = -(2 + Math.floor(rng.next() * 6));
  return { yards, epa: -1.2, isTouchdown: false, isTurnover: false, isSack: true, isComplete: false, isFirstDown: false, depthTier: null, isScramble: false };
}

function poolScrambleOutcomesForDown(dataset: PlayerDataset, down: number): OutcomeRecord[] {
  return sameDownOutcomes(dataset, "rusher", down).filter((o) => o.isScramble);
}

/**
 * Rolled for any chosen pass play (after a non-sack result) -- the QB may
 * scramble instead of throwing to the selected target. Returns null when no
 * scramble occurs, in which case the caller proceeds with the normal
 * receiver-targeted sample. Outcome is sampled from the QB's own rusher-role
 * data, filtered to scramble plays specifically (excludes designed runs).
 */
export function rollQbScrambleOutcome(
  qbDataset: PlayerDataset,
  ctx: SampleContext,
  leagueAverageRates: Partial<Record<PlayerRole, AggregateRates>>,
  rng: RNG
): OutcomeRecord | null {
  const rates = getShrunkRates(qbDataset, "passer", leagueAverageRates);
  const scrambleRate = rates.scrambleRate ?? 0.04;
  if (rng.next() >= scrambleRate) return null;

  const pooled = poolScrambleOutcomesForDown(qbDataset, ctx.down);
  if (pooled.length >= MIN_SAMPLE_THRESHOLD) {
    return pooled[Math.floor(rng.next() * pooled.length)];
  }

  const rusherRates = getShrunkRates(qbDataset, "rusher", leagueAverageRates);
  const outcome = simulateFromRates(rusherRates, "rusher", ctx.fieldPosition, rng);
  return { ...outcome, isScramble: true };
}

/**
 * For the "Designed run with [QB]" play call -- samples the QB's rusher data
 * filtered to non-scramble plays. Falls back to the unfiltered rusher pool
 * (then rate-stat simulation) for low-volume QBs with few/no tagged designed
 * runs, same relaxation spirit as the rest of this module.
 */
export function sampleQbDesignedRun(
  qbDataset: PlayerDataset,
  ctx: SampleContext,
  leagueAverageRates: Partial<Record<PlayerRole, AggregateRates>>,
  rng: RNG
): OutcomeRecord {
  const key = bucketKey(ctx.down, ctx.distance, ctx.fieldPosition);
  const exact = findBucket(qbDataset, "rusher", key);
  const exactDesigned = exact?.outcomes.filter((o) => !o.isScramble) ?? [];
  if (exactDesigned.length >= MIN_SAMPLE_THRESHOLD) {
    return exactDesigned[Math.floor(rng.next() * exactDesigned.length)];
  }

  const sameDownDesigned = sameDownOutcomes(qbDataset, "rusher", ctx.down).filter((o) => !o.isScramble);
  if (sameDownDesigned.length >= MIN_SAMPLE_THRESHOLD) {
    return sameDownDesigned[Math.floor(rng.next() * sameDownDesigned.length)];
  }

  return sampleOutcome(qbDataset, "rusher", ctx, leagueAverageRates, rng);
}

/**
 * On a non-sacked, non-scrambled pass attempt, interception risk is blended
 * 25% from the QB's own intRate and 75% from the targeted receiver's own
 * intRate (their historical rate of being picked off when targeted) -- an
 * INT is mostly about who's catching (or not), but the QB's decision-making
 * still matters. Both rates are depth-conditioned (a deep ball is riskier for
 * both). Returns the interception OutcomeRecord if it hits, else null.
 */
export function rollBlendedInterception(
  qbDataset: PlayerDataset,
  receiverDataset: PlayerDataset,
  depth: DepthTier,
  leagueAverageRates: Partial<Record<PlayerRole, AggregateRates>>,
  rng: RNG
): OutcomeRecord | null {
  const qbRates = getShrunkDepthRates(qbDataset, "passer", depth, leagueAverageRates);
  const receiverRates = getShrunkDepthRates(receiverDataset, "receiver", depth, leagueAverageRates);
  const blendedIntRate = QB_OUTCOME_WEIGHT * (qbRates.intRate ?? 0.02) + RECEIVER_OUTCOME_WEIGHT * (receiverRates.intRate ?? 0.02);
  if (rng.next() >= blendedIntRate) return null;
  return { yards: 0, epa: -3, isTouchdown: false, isTurnover: true, isSack: false, isComplete: false, isFirstDown: false, depthTier: depth, isScramble: false };
}

/**
 * For a non-intercepted pass attempt, the completion/yards/TD outcome is
 * drawn from the targeted receiver's own distribution 75% of the time and
 * the QB's own passing distribution 25% of the time -- reuses the existing
 * single-player sampleOutcome (real bucket data when available, rate-stat
 * fallback otherwise) for whichever player is chosen. Sack/INT status for
 * this play was already decided by separate rolls upstream, so any
 * conflicting flag the sampled donor play happened to carry (e.g. a real QB
 * sack/INT bucket sample) is sanitized away here.
 */
export function sampleBlendedReceptionOutcome(
  qbDataset: PlayerDataset,
  receiverDataset: PlayerDataset,
  ctx: SampleContext,
  depth: DepthTier,
  leagueAverageRates: Partial<Record<PlayerRole, AggregateRates>>,
  rng: RNG
): OutcomeRecord {
  const fromReceiver = rng.next() < RECEIVER_OUTCOME_WEIGHT;
  const outcome = fromReceiver
    ? sampleOutcome(receiverDataset, "receiver", ctx, leagueAverageRates, rng, depth)
    : sampleOutcome(qbDataset, "passer", ctx, leagueAverageRates, rng, depth);

  if (outcome.isSack || outcome.isTurnover) {
    return { ...outcome, isSack: false, isTurnover: false };
  }
  return outcome;
}

// Exported for tests that need to assert on bucket-distance/zone IDs directly.
export { distanceBucketId, fieldZoneId };
