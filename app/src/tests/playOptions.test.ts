import { describe, expect, it } from "vitest";
import { ALL_PLAY_CALLS, drawPlayOptions, playCallKey } from "../engine/playOptions";
import { makeRng } from "../engine/rng";

describe("drawPlayOptions (the coverage deal)", () => {
  it("deals exactly ONE spot per skill player, every down", () => {
    for (let seed = 0; seed < 50; seed++) {
      const options = drawPlayOptions(makeRng(seed));
      expect(options).toHaveLength(5);
      const keys = options.map(playCallKey);
      expect(new Set(keys).size).toBe(5); // no duplicate spots

      // Exactly one spot per receiver...
      for (const target of ["wr1", "wr2", "te"]) {
        expect(options.filter((o) => o.kind === "pass" && o.target === target)).toHaveLength(1);
      }
      // ...exactly one RB look: a gap run or the dealt swing pass...
      const rbLooks = options.filter(
        (o) => o.kind === "runInside" || o.kind === "runOutside" || (o.kind === "pass" && o.target === "rb")
      );
      expect(rbLooks).toHaveLength(1);
      // ...and the QB keeper.
      expect(keys).toContain("designedRun");
    }
  });

  it("keeps the legacy 11-call enumeration intact (ghost wire format)", () => {
    expect(ALL_PLAY_CALLS).toHaveLength(11);
  });

  it("deals every depth and all three RB looks across many downs", () => {
    const depths = new Set<string>();
    const rbLooks = new Set<string>();
    for (let seed = 0; seed < 500; seed++) {
      for (const call of drawPlayOptions(makeRng(seed))) {
        if (call.kind === "pass" && call.target !== "rb") depths.add(`${call.target}_${call.depth}`);
        if (call.kind === "runInside" || call.kind === "runOutside") rbLooks.add(call.kind);
        if (call.kind === "pass" && call.target === "rb") rbLooks.add("swing");
      }
    }
    expect(depths.size).toBe(9); // 3 receivers x 3 depths all reachable
    expect(rbLooks.size).toBe(3); // inside, outside, and the swing all get dealt
  });

  it("consumes exactly four RNG draws per deal (replay alignment)", () => {
    // Two RNGs from the same seed: one feeds a deal, the other burns 4 draws
    // manually -- they must land in the same state (next float identical).
    const a = makeRng(1234);
    const b = makeRng(1234);
    drawPlayOptions(a);
    b.next();
    b.next();
    b.next();
    b.next();
    expect(a.next()).toBe(b.next());
  });
});
