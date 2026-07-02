export type Position = "QB" | "RB" | "WR" | "TE" | "K";
export type Tier = "star" | "starter" | "scrub";
export type PlayerRole = "passer" | "rusher" | "receiver";
export type DepthTier = "short" | "medium" | "deep";
export type KickDistanceTier = "under30" | "30s" | "40s" | "50s" | "60plus";

export interface OutcomeRecord {
  yards: number;
  epa: number;
  isTouchdown: boolean;
  isTurnover: boolean;
  isSack: boolean;
  isComplete: boolean | null;
  isFirstDown: boolean;
  /** passer/receiver only; null for rusher/sack rows (no air_yards). */
  depthTier: DepthTier | null;
  /** rusher only; always false for passer/receiver. */
  isScramble: boolean;
}

export interface SituationalBucket {
  bucketKey: string;
  sampleSize: number;
  outcomes: OutcomeRecord[];
}

export interface AggregateRates {
  sampleSize?: number;
  completionPct?: number;
  yardsPerAttempt?: number;
  intRate?: number;
  sackRate?: number;
  passTdRate?: number;
  yardsPerCarry?: number;
  rushTdRate?: number;
  fumbleRate?: number;
  yardsPerTarget?: number;
  catchRate?: number;
  receivingTdRate?: number;
  firstDownRate: number;
  /** passer only: fraction of dropbacks (attempts + sacks + scrambles) that end in a scramble. */
  scrambleRate?: number;
  /** passer/receiver only: same rate fields, sliced by depthTier. */
  byDepth?: Partial<Record<DepthTier, AggregateRates>>;
}

export interface PlayerDataset {
  gsisId: string;
  displayName: string;
  position: Position;
  tier: Tier;
  /** Overall rating 40-99, derived from real aggregate stats. */
  rating: number;
  seasonsCovered: [number, number];
  totalPlaysSampled: number;
  buckets: Partial<Record<PlayerRole, SituationalBucket[]>>;
  aggregates: Partial<Record<PlayerRole, AggregateRates>>;
}

export interface KickerDistanceBucket {
  attempts: number;
  makes: number;
  makePct: number;
}

export interface KickerDataset {
  gsisId: string;
  displayName: string;
  position: "K";
  tier: Tier;
  /** Overall rating 40-99, derived from real make rates. */
  rating: number;
  totalAttempts: number;
  distanceBuckets: Partial<Record<KickDistanceTier, KickerDistanceBucket>>;
}

export interface ManifestPlayerEntry {
  gsisId: string;
  displayName: string;
  position: Position;
  tier: Tier;
  /** Overall rating 40-99, derived from real aggregate stats. */
  rating: number;
  flavorStats: { headline: string; subline: string };
}

export interface LeagueTendencyEntry {
  passRate: number;
  sampleSize: number;
}

export interface Manifest {
  generatedAt: string;
  players: ManifestPlayerEntry[];
  leagueTendencies: Record<string, LeagueTendencyEntry>;
  leagueAverageRates: Partial<Record<PlayerRole, AggregateRates>>;
  leagueAverageKickerRates: Partial<Record<KickDistanceTier, KickerDistanceBucket>>;
}
