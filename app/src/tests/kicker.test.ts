import { describe, expect, it } from "vitest";
import { attemptFieldGoal, kickDistanceBucketId, kickDistanceFor } from "../engine/kicker";
import { makeRng } from "../engine/rng";
import type { KickerDataset } from "../types/player";

function makeKicker(overrides: Partial<KickerDataset> = {}): KickerDataset {
  return {
    gsisId: "00-TESTK1",
    displayName: "Test Kicker",
    position: "K",
    tier: "starter",
    rating: 75,
    totalAttempts: 200,
    distanceBuckets: {
      under30: { attempts: 60, makes: 59, makePct: 0.983 },
      "30s": { attempts: 60, makes: 56, makePct: 0.933 },
      "40s": { attempts: 50, makes: 40, makePct: 0.8 },
      "50s": { attempts: 25, makes: 15, makePct: 0.6 },
      "60plus": { attempts: 5, makes: 1, makePct: 0.2 },
    },
    ...overrides,
  };
}

describe("kickDistanceFor / kickDistanceBucketId", () => {
  it("converts field position to kick distance with the +18 adjustment", () => {
    expect(kickDistanceFor(20)).toBe(38);
    expect(kickDistanceFor(0)).toBe(18);
  });

  it("buckets distances correctly at the boundaries", () => {
    expect(kickDistanceBucketId(29)).toBe("under30");
    expect(kickDistanceBucketId(30)).toBe("30s");
    expect(kickDistanceBucketId(49)).toBe("40s");
    expect(kickDistanceBucketId(50)).toBe("50s");
    expect(kickDistanceBucketId(75)).toBe("60plus");
  });
});

describe("attemptFieldGoal", () => {
  it("uses the kicker's own bucket rate directly when sample size is sufficient", () => {
    const kicker = makeKicker();
    let makes = 0;
    const trials = 500;
    for (let seed = 0; seed < trials; seed++) {
      if (attemptFieldGoal(kicker, 25, {}, makeRng(seed))) makes++; // under30, makePct 0.983
    }
    expect(makes / trials).toBeGreaterThan(0.9);
  });

  it("makes a high-percentage short kick far more often than a low-percentage long kick", () => {
    const kicker = makeKicker();
    let shortMakes = 0;
    let longMakes = 0;
    const trials = 300;
    for (let seed = 0; seed < trials; seed++) {
      if (attemptFieldGoal(kicker, 25, {}, makeRng(seed))) shortMakes++;
      if (attemptFieldGoal(kicker, 65, {}, makeRng(seed + 10_000))) longMakes++;
    }
    expect(shortMakes).toBeGreaterThan(longMakes);
  });

  it("shrinks toward league average for a low-volume kicker", () => {
    const lowVolumeKicker = makeKicker({
      distanceBuckets: { "40s": { attempts: 2, makes: 2, makePct: 1.0 } }, // tiny sample, looks perfect
    });
    const leagueAverage = { "40s": { attempts: 10000, makes: 8000, makePct: 0.8 } };

    let makes = 0;
    const trials = 500;
    for (let seed = 0; seed < trials; seed++) {
      if (attemptFieldGoal(lowVolumeKicker, 45, leagueAverage, makeRng(seed))) makes++;
    }
    // Shrunk rate should land well below the naive 100% and not far from league average.
    const rate = makes / trials;
    expect(rate).toBeLessThan(0.95);
    expect(rate).toBeGreaterThan(0.5);
  });
});
