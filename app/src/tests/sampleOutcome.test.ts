import { describe, expect, it } from "vitest";
import {
  rollBlendedInterception,
  rollQbScrambleOutcome,
  sampleBlendedReceptionOutcome,
  sampleOutcome,
  sampleQbDesignedRun,
} from "../engine/sampleOutcome";
import { makeRng } from "../engine/rng";
import { MIN_SAMPLE_THRESHOLD } from "../engine/situational";
import { makeOutcome, makePlayerFixture } from "./fixtures";

const ctx = { down: 1, distance: 7, fieldPosition: 50 }; // -> "1_medium_midfield"

describe("sampleOutcome", () => {
  it("samples from the exact bucket when it meets the threshold", () => {
    const exactOutcome = makeOutcome({ yards: 999 }); // sentinel value
    const player = makePlayerFixture({
      bucketOutcomes: {
        "1_medium_midfield": Array.from({ length: MIN_SAMPLE_THRESHOLD }, () => exactOutcome),
      },
    });

    const result = sampleOutcome(player, "passer", ctx, {}, makeRng(1));
    expect(result.yards).toBe(999);
  });

  it("falls back to a relaxed same-down bucket when the exact bucket is too small", () => {
    const relaxedOutcome = makeOutcome({ yards: 777 });
    const player = makePlayerFixture({
      bucketOutcomes: {
        "1_medium_midfield": [makeOutcome({ yards: 1 })], // below threshold
        "1_short_red_zone": Array.from({ length: MIN_SAMPLE_THRESHOLD }, () => relaxedOutcome),
      },
    });

    const result = sampleOutcome(player, "passer", ctx, {}, makeRng(1));
    expect(result.yards).toBe(777);
  });

  it("falls back to rate-stat simulation when no bucket has enough samples", () => {
    const player = makePlayerFixture({
      bucketOutcomes: {},
      aggregates: { passer: { sampleSize: 200, firstDownRate: 0.3, completionPct: 1, yardsPerAttempt: 9, sackRate: 0, intRate: 0 } },
    });

    const result = sampleOutcome(player, "passer", ctx, {}, makeRng(1));
    // completionPct=1 and sackRate=0 force the completion path deterministically across seeds
    expect(result.isComplete).toBe(true);
    expect(result.isSack).toBe(false);
  });

  it("never returns yards exceeding the remaining field position", () => {
    const player = makePlayerFixture({
      bucketOutcomes: {},
      aggregates: { rusher: { sampleSize: 200, firstDownRate: 0.9, yardsPerCarry: 50, fumbleRate: 0 } },
    });
    for (let seed = 0; seed < 25; seed++) {
      const result = sampleOutcome(player, "rusher", { down: 1, distance: 5, fieldPosition: 3 }, {}, makeRng(seed));
      expect(result.yards).toBeLessThanOrEqual(3);
    }
  });

  it("filters the exact bucket to the requested depth tier", () => {
    const shortOutcome = makeOutcome({ yards: 4, depthTier: "short" });
    const deepOutcome = makeOutcome({ yards: 40, depthTier: "deep" });
    const player = makePlayerFixture({
      role: "receiver",
      bucketOutcomes: {
        "1_medium_midfield": [
          ...Array.from({ length: MIN_SAMPLE_THRESHOLD }, () => shortOutcome),
          ...Array.from({ length: MIN_SAMPLE_THRESHOLD }, () => deepOutcome),
        ],
      },
    });

    const result = sampleOutcome(player, "receiver", ctx, {}, makeRng(1), "deep");
    expect(result.yards).toBe(40);
    expect(result.depthTier).toBe("deep");
  });

  it("falls back to depth-conditioned rate-stat simulation when no real depth data exists", () => {
    const player = makePlayerFixture({
      role: "receiver",
      bucketOutcomes: {},
      aggregates: {
        receiver: {
          sampleSize: 200,
          firstDownRate: 0.3,
          catchRate: 0.65,
          yardsPerTarget: 7,
          byDepth: { deep: { sampleSize: 200, firstDownRate: 0.3, catchRate: 0.1, yardsPerTarget: 25 } },
        },
      },
    });

    const result = sampleOutcome(player, "receiver", ctx, {}, makeRng(1), "deep");
    expect(result.depthTier).toBe("deep");
  });
});

describe("rollQbScrambleOutcome", () => {
  it("returns a scramble-tagged outcome when the scramble roll succeeds", () => {
    const scrambleOutcome = makeOutcome({ yards: 12, isScramble: true });
    const qb = makePlayerFixture({
      role: "passer",
      aggregates: { passer: { sampleSize: 200, firstDownRate: 0.3, scrambleRate: 1 } }, // always scrambles
      bucketOutcomes: { "1_medium_midfield": Array.from({ length: MIN_SAMPLE_THRESHOLD }, () => scrambleOutcome) },
    });
    // bucketOutcomes above tags the "passer" role bucket; rollQbScrambleOutcome
    // reads from the "rusher" role, so attach the same bucket there too.
    qb.buckets.rusher = qb.buckets.passer;

    const result = rollQbScrambleOutcome(qb, ctx, {}, makeRng(1));
    expect(result).not.toBeNull();
    expect(result?.isScramble).toBe(true);
  });

  it("returns null when the scramble roll fails", () => {
    const qb = makePlayerFixture({
      role: "passer",
      aggregates: { passer: { sampleSize: 200, firstDownRate: 0.3, scrambleRate: 0 } }, // never scrambles
    });
    expect(rollQbScrambleOutcome(qb, ctx, {}, makeRng(1))).toBeNull();
  });
});

describe("sampleQbDesignedRun", () => {
  it("excludes scramble-tagged outcomes from the designed-run sample", () => {
    const designedRun = makeOutcome({ yards: 6, isScramble: false });
    const qb = makePlayerFixture({
      role: "rusher",
      bucketOutcomes: { "1_medium_midfield": Array.from({ length: MIN_SAMPLE_THRESHOLD }, () => designedRun) },
    });

    for (let seed = 0; seed < 10; seed++) {
      const result = sampleQbDesignedRun(qb, ctx, {}, makeRng(seed));
      expect(result.isScramble).toBe(false);
    }
  });
});

describe("rollBlendedInterception", () => {
  const depth = "medium" as const;

  it("blends ~25% from the QB and ~75% from the receiver", () => {
    // QB always intercepted, receiver never -- blended rate should land near 0.25.
    const qb = makePlayerFixture({
      role: "passer",
      aggregates: { passer: { sampleSize: 200, firstDownRate: 0.3, intRate: 1.0 } },
    });
    const receiver = makePlayerFixture({
      role: "receiver",
      position: "WR",
      aggregates: { receiver: { sampleSize: 200, firstDownRate: 0.3, intRate: 0.0 } },
    });

    let interceptions = 0;
    const trials = 2000;
    for (let seed = 0; seed < trials; seed++) {
      if (rollBlendedInterception(qb, receiver, depth, {}, makeRng(seed))) interceptions++;
    }
    expect(interceptions / trials).toBeGreaterThan(0.18);
    expect(interceptions / trials).toBeLessThan(0.32);
  });

  it("weighs the receiver's own interception rate more heavily than the QB's", () => {
    // Receiver always intercepted, QB never -- blended rate should land near 0.75.
    const qb = makePlayerFixture({
      role: "passer",
      aggregates: { passer: { sampleSize: 200, firstDownRate: 0.3, intRate: 0.0 } },
    });
    const receiver = makePlayerFixture({
      role: "receiver",
      position: "WR",
      aggregates: { receiver: { sampleSize: 200, firstDownRate: 0.3, intRate: 1.0 } },
    });

    let interceptions = 0;
    const trials = 2000;
    for (let seed = 0; seed < trials; seed++) {
      if (rollBlendedInterception(qb, receiver, depth, {}, makeRng(seed))) interceptions++;
    }
    expect(interceptions / trials).toBeGreaterThan(0.68);
    expect(interceptions / trials).toBeLessThan(0.82);
  });
});

describe("sampleBlendedReceptionOutcome", () => {
  const depth = "medium" as const;

  it("draws yardage that's a roughly 75/25 receiver/QB-weighted blend", () => {
    // Both always complete with a fixed, very different yardage so the
    // resulting average should sit close to 0.75*receiverYards + 0.25*qbYards.
    const qb = makePlayerFixture({
      role: "passer",
      aggregates: { passer: { sampleSize: 200, firstDownRate: 0, completionPct: 1, yardsPerAttempt: 20, sackRate: 0, intRate: 0 } },
    });
    const receiver = makePlayerFixture({
      role: "receiver",
      position: "WR",
      aggregates: { receiver: { sampleSize: 200, firstDownRate: 0, catchRate: 1, yardsPerTarget: 2, receivingTdRate: 0 } },
    });

    let totalYards = 0;
    const trials = 2000;
    for (let seed = 0; seed < trials; seed++) {
      totalYards += sampleBlendedReceptionOutcome(qb, receiver, ctx, depth, {}, makeRng(seed)).yards;
    }
    const avgYards = totalYards / trials;
    // simulateFromRates multiplies the base rate by a random 0.4-1.6x factor
    // (avg ~1.0x), so expect avgYards near 0.75*2 + 0.25*20 = 6.5, loosely.
    expect(avgYards).toBeGreaterThan(4);
    expect(avgYards).toBeLessThan(9);
  });

  it("never returns isSack or isTurnover even if the donor sample carried one", () => {
    const contaminatedOutcome = makeOutcome({ yards: -5, isSack: true });
    const qb = makePlayerFixture({
      role: "passer",
      bucketOutcomes: { "1_medium_midfield": Array.from({ length: MIN_SAMPLE_THRESHOLD }, () => contaminatedOutcome) },
    });
    const receiver = makePlayerFixture({
      role: "receiver",
      position: "WR",
      bucketOutcomes: { "1_medium_midfield": Array.from({ length: MIN_SAMPLE_THRESHOLD }, () => makeOutcome({ yards: 8, isTurnover: true })) },
    });

    for (let seed = 0; seed < 30; seed++) {
      const result = sampleBlendedReceptionOutcome(qb, receiver, ctx, depth, {}, makeRng(seed));
      expect(result.isSack).toBe(false);
      expect(result.isTurnover).toBe(false);
    }
  });
});
