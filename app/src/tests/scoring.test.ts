import { describe, expect, it } from "vitest";
import { MAX_PAYOUT, MIN_PAYOUT, payoutMultiplier, rosterPayoutMultiplier } from "../engine/scoring";

describe("payout multiplier", () => {
  it("maps the rating range onto the payout range (inverted)", () => {
    expect(payoutMultiplier(99)).toBeCloseTo(MIN_PAYOUT); // best player -> smallest payout
    expect(payoutMultiplier(40)).toBeCloseTo(MAX_PAYOUT); // worst player -> biggest payout
  });

  it("clamps out-of-range ratings", () => {
    expect(payoutMultiplier(120)).toBeCloseTo(MIN_PAYOUT);
    expect(payoutMultiplier(10)).toBeCloseTo(MAX_PAYOUT);
  });

  it("is monotonically decreasing in rating", () => {
    for (let r = 41; r <= 99; r++) {
      expect(payoutMultiplier(r)).toBeLessThan(payoutMultiplier(r - 1));
    }
  });

  it("team payout equals the average of the players' payouts (linearity)", () => {
    const ratings = [99, 90, 75, 60, 55, 48];
    const avgOfPayouts = ratings.reduce((s, r) => s + payoutMultiplier(r), 0) / ratings.length;
    expect(rosterPayoutMultiplier(ratings)).toBeCloseTo(avgOfPayouts);
  });
});
