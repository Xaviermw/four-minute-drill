import type { ManifestPlayerEntry, Position } from "../types/player";

/**
 * Salary-cap pricing: every player costs $1–$10 by rank within their position,
 * with the bottom slice priced $0 (the "scrub" tier) and never dealt among the
 * three options -- a $0 scrub is only reachable via the "give me a scrub"
 * gamble. Deterministic from the manifest, so it's the single source of truth
 * for the draft UI, the share/leaderboard surfaces, tests, and the balance sim.
 *
 * Rank-based (not rating-based) on purpose: the pool skews stud-heavy, so
 * pricing on the raw rating would make almost every card expensive. Ranking
 * spreads the tags evenly $1–$10 in every position, which is what gives the cap
 * a real decision space (see docs/cap-draft-plan.md).
 */
export const CAP = 25;
export const SCRUB_PRICE = 0;

const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "K"];

export interface Pricing {
  /** Price for a player ($0 = scrub). */
  priceFor: (entry: ManifestPlayerEntry) => number;
  /** True if the player is in the never-dealt $0 tier. */
  isScrub: (entry: ManifestPlayerEntry) => boolean;
  /** The $0 players at a position (the pool the scrub gamble draws from). */
  scrubPool: (position: Position) => ManifestPlayerEntry[];
  /** The priced ($1+) players at a position -- what the draft deals. */
  dealablePool: (position: Position) => ManifestPlayerEntry[];
  /** Every priced ($1+) player, all positions -- the pool drawSlotOptions uses. */
  dealablePlayers: ManifestPlayerEntry[];
}

interface Built {
  priceOf: Map<string, number>;
  scrubs: Map<Position, ManifestPlayerEntry[]>;
  dealable: Map<Position, ManifestPlayerEntry[]>;
  dealableAll: ManifestPlayerEntry[];
}

function build(players: ManifestPlayerEntry[]): Built {
  const priceOf = new Map<string, number>();
  const scrubs = new Map<Position, ManifestPlayerEntry[]>();
  const dealable = new Map<Position, ManifestPlayerEntry[]>();
  const dealableAll: ManifestPlayerEntry[] = [];

  for (const pos of POSITIONS) {
    // (rating asc, gsisId asc) -- stable so prices never shuffle between loads.
    const group = players
      .filter((p) => p.position === pos)
      .sort((a, b) => a.rating - b.rating || (a.gsisId < b.gsisId ? -1 : 1));

    const scrubCount = Math.max(3, Math.floor(group.length * 0.2));
    const posScrubs: ManifestPlayerEntry[] = [];
    const posDealable: ManifestPlayerEntry[] = [];

    group.forEach((p, idx) => {
      if (idx < scrubCount) {
        priceOf.set(p.gsisId, SCRUB_PRICE);
        posScrubs.push(p);
        return;
      }
      const rank = idx - scrubCount; // 0..m-1 over the priced players
      const m = group.length - scrubCount;
      const price = m <= 1 ? 10 : Math.round(1 + (9 * rank) / (m - 1));
      priceOf.set(p.gsisId, Math.max(1, Math.min(10, price)));
      posDealable.push(p);
    });

    scrubs.set(pos, posScrubs);
    dealable.set(pos, posDealable);
    dealableAll.push(...posDealable);
  }

  return { priceOf, scrubs, dealable, dealableAll };
}

// Memoize by the players array identity: the manifest loads once, so this
// builds a single time and every caller shares it.
let cache: { players: ManifestPlayerEntry[]; built: Built } | null = null;
function builtFor(players: ManifestPlayerEntry[]): Built {
  if (!cache || cache.players !== players) cache = { players, built: build(players) };
  return cache.built;
}

export function getPricing(players: ManifestPlayerEntry[]): Pricing {
  const b = builtFor(players);
  return {
    priceFor: (entry) => b.priceOf.get(entry.gsisId) ?? 0,
    isScrub: (entry) => (b.priceOf.get(entry.gsisId) ?? 0) === 0,
    scrubPool: (position) => b.scrubs.get(position) ?? [],
    dealablePool: (position) => b.dealable.get(position) ?? [],
    dealablePlayers: b.dealableAll,
  };
}

/** Total spend of a set of drafted players. */
export function totalSpend(players: ManifestPlayerEntry[], roster: ManifestPlayerEntry[]): number {
  const pricing = getPricing(players);
  return roster.reduce((sum, p) => sum + pricing.priceFor(p), 0);
}
