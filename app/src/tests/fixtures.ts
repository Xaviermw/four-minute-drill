import type { KickerDataset, KickerDistanceBucket, KickDistanceTier, OutcomeRecord, PlayerDataset, PlayerRole } from "../types/player";

function outcome(partial: Partial<OutcomeRecord> = {}): OutcomeRecord {
  return {
    yards: 5,
    isTouchdown: false,
    isTurnover: false,
    isSack: false,
    isComplete: true,
    isFirstDown: false,
    depthTier: null,
    isScramble: false,
    ...partial,
  };
}

export function makePlayerFixture(overrides: {
  gsisId?: string;
  displayName?: string;
  position?: PlayerDataset["position"];
  tier?: PlayerDataset["tier"];
  rating?: number;
  bucketOutcomes?: Record<string, OutcomeRecord[]>;
  role?: PlayerRole;
  aggregates?: PlayerDataset["aggregates"];
}): PlayerDataset {
  const role = overrides.role ?? "passer";
  const bucketOutcomes = overrides.bucketOutcomes ?? {};

  const buckets: PlayerDataset["buckets"] = {
    [role]: Object.entries(bucketOutcomes).map(([bucketKey, outcomes]) => ({
      bucketKey,
      sampleSize: outcomes.length,
      outcomes,
    })),
  };

  return {
    gsisId: overrides.gsisId ?? "00-TEST01",
    displayName: overrides.displayName ?? "Test Player",
    position: overrides.position ?? "QB",
    tier: overrides.tier ?? "starter",
    rating: overrides.rating ?? 70,
    seasonsCovered: [2015, 2024],
    totalPlaysSampled: Object.values(bucketOutcomes).flat().length,
    buckets,
    aggregates: overrides.aggregates ?? {
      [role]: { sampleSize: 200, firstDownRate: 0.3, completionPct: 0.6, yardsPerAttempt: 7 },
    },
  };
}

export function makeKickerFixture(overrides: {
  gsisId?: string;
  displayName?: string;
  tier?: KickerDataset["tier"];
  rating?: number;
  distanceBuckets?: Partial<Record<KickDistanceTier, KickerDistanceBucket>>;
} = {}): KickerDataset {
  const distanceBuckets = overrides.distanceBuckets ?? {
    under30: { attempts: 60, makes: 58, makePct: 0.967 },
    "30s": { attempts: 60, makes: 55, makePct: 0.917 },
    "40s": { attempts: 50, makes: 40, makePct: 0.8 },
    "50s": { attempts: 25, makes: 15, makePct: 0.6 },
    "60plus": { attempts: 5, makes: 1, makePct: 0.2 },
  };
  return {
    gsisId: overrides.gsisId ?? "00-TESTK1",
    displayName: overrides.displayName ?? "Test Kicker",
    position: "K",
    tier: overrides.tier ?? "starter",
    rating: overrides.rating ?? 70,
    totalAttempts: Object.values(distanceBuckets).reduce((sum, b) => sum + (b?.attempts ?? 0), 0),
    distanceBuckets,
  };
}

export { outcome as makeOutcome };
