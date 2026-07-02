import { describe, expect, it } from "vitest";
import { ALL_PLAY_CALLS, drawPlayOptions, playCallKey } from "../engine/playOptions";
import { makeRng } from "../engine/rng";

describe("drawPlayOptions", () => {
  it("always returns 3 distinct calls", () => {
    for (let seed = 0; seed < 50; seed++) {
      const options = drawPlayOptions(makeRng(seed));
      expect(options).toHaveLength(3);
      const keys = options.map(playCallKey);
      expect(new Set(keys).size).toBe(3);
    }
  });

  it("draws from the full pool of 11 possible calls", () => {
    expect(ALL_PLAY_CALLS).toHaveLength(11);
  });

  it("is reasonably uniform: every call appears at least once across many draws", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 500; seed++) {
      for (const call of drawPlayOptions(makeRng(seed))) {
        seen.add(playCallKey(call));
      }
    }
    expect(seen.size).toBe(ALL_PLAY_CALLS.length);
  });
});
