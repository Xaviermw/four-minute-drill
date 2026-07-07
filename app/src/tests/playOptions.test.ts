import { describe, expect, it } from "vitest";
import { ALL_PLAY_CALLS, drawPlayOptions, playCallKey } from "../engine/playOptions";
import { makeRng } from "../engine/rng";

describe("drawPlayOptions (the coverage deal)", () => {
  it("deals one spot per pass-catcher plus the full ground game, every down", () => {
    for (let seed = 0; seed < 50; seed++) {
      const options = drawPlayOptions(makeRng(seed));
      expect(options).toHaveLength(6);
      const keys = options.map(playCallKey);
      expect(new Set(keys).size).toBe(6); // no duplicate spots

      // Exactly one spot per receiver...
      for (const target of ["wr1", "wr2", "te"]) {
        expect(options.filter((o) => o.kind === "pass" && o.target === target)).toHaveLength(1);
      }
      // ...and the fixed ground game.
      expect(keys).toContain("runInside");
      expect(keys).toContain("runOutside");
      expect(keys).toContain("designedRun");
    }
  });

  it("keeps the legacy 11-call enumeration intact (ghost wire format)", () => {
    expect(ALL_PLAY_CALLS).toHaveLength(11);
  });

  it("deals every depth to every receiver across many downs", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 500; seed++) {
      for (const call of drawPlayOptions(makeRng(seed))) {
        if (call.kind === "pass") seen.add(`${call.target}_${call.depth}`);
      }
    }
    expect(seen.size).toBe(9); // 3 receivers x 3 depths all reachable
  });

  it("consumes exactly three RNG draws per deal (replay alignment)", () => {
    // Two RNGs from the same seed: one feeds a deal, the other burns 3 draws
    // manually -- they must land in the same state (next float identical).
    const a = makeRng(1234);
    const b = makeRng(1234);
    drawPlayOptions(a);
    b.next();
    b.next();
    b.next();
    expect(a.next()).toBe(b.next());
  });
});
