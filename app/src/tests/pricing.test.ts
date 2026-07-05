import { describe, expect, it } from "vitest";
import type { ManifestPlayerEntry, Position } from "../types/player";
import { CAP, getPricing, totalSpend } from "../draft/pricing";

/** Minimal manifest entry for pricing (only position/rating/gsisId matter). */
function entry(gsisId: string, position: Position, rating: number): ManifestPlayerEntry {
  return { gsisId, displayName: gsisId, position, tier: "starter", team: "KC", jersey: 1, rating, flavorStats: { headline: "", subline: "" } };
}

/** n players at a position, ratings spread 40..99. */
function group(position: Position, n: number): ManifestPlayerEntry[] {
  return Array.from({ length: n }, (_, i) =>
    entry(`${position}-${i}`, position, Math.round(40 + (59 * i) / (n - 1)))
  );
}

const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "K"];
const players = POSITIONS.flatMap((pos) => group(pos, 20));

describe("cap pricing", () => {
  it("spreads $1-$10 with a $0 scrub tier in every position", () => {
    const pricing = getPricing(players);
    for (const pos of POSITIONS) {
      const dealable = pricing.dealablePool(pos);
      const scrubs = pricing.scrubPool(pos);
      const prices = dealable.map((p) => pricing.priceFor(p));
      expect(scrubs.length).toBeGreaterThanOrEqual(3); // max(3, 20%)
      expect(scrubs.every((p) => pricing.priceFor(p) === 0)).toBe(true);
      expect(Math.min(...prices)).toBe(1);
      expect(Math.max(...prices)).toBe(10);
      // Scrubs are the lowest-rated and never leak into the dealable pool.
      expect(dealable.some((p) => pricing.isScrub(p))).toBe(false);
    }
  });

  it("is deterministic and price rises with rating", () => {
    const a = getPricing(players);
    const b = getPricing(players);
    const qb = players.filter((p) => p.position === "QB");
    const lo = qb[qb.length - 1]; // highest rated
    const hi = qb[0]; // lowest rated
    expect(a.priceFor(lo)).toBe(b.priceFor(lo));
    expect(a.priceFor(lo)).toBeGreaterThanOrEqual(a.priceFor(hi));
  });

  it("dealablePlayers excludes every scrub", () => {
    const pricing = getPricing(players);
    expect(pricing.dealablePlayers.every((p) => !pricing.isScrub(p))).toBe(true);
    const scrubCount = POSITIONS.reduce((n, pos) => n + pricing.scrubPool(pos).length, 0);
    expect(pricing.dealablePlayers.length).toBe(players.length - scrubCount);
  });

  it("totalSpend sums a roster's prices and CAP is $25", () => {
    expect(CAP).toBe(25);
    const pricing = getPricing(players);
    const roster = POSITIONS.map((pos) => pricing.dealablePool(pos)[0]); // cheapest dealable each
    expect(totalSpend(players, roster)).toBe(roster.reduce((s, p) => s + pricing.priceFor(p), 0));
  });
});
