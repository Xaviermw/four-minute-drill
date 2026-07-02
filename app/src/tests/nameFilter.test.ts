import { describe, expect, it } from "vitest";
import { isNameAllowed, normalizeName } from "../leaderboard/nameFilter";

describe("name filter", () => {
  it("allows normal names and names that merely contain banned substrings", () => {
    for (const name of ["Xavier", "Smasher", "Scunthorpe", "Spice", "Raccoon", "GridironGuru", "Big Ben"]) {
      expect(isNameAllowed(name)).toBe(true);
    }
  });

  it("blocks severe terms, including leetspeak and spacing evasions", () => {
    for (const name of ["n1gg3r", "f u c k", "F4GGOT", "$hit", "H1TLER"]) {
      expect(isNameAllowed(name)).toBe(false);
    }
  });

  it("rejects names that normalize to nothing (no letters, no leetspeak)", () => {
    expect(isNameAllowed("689")).toBe(false); // 6/8/9 aren't leet-mapped
    expect(isNameAllowed("   ")).toBe(false);
    expect(isNameAllowed("...")).toBe(false);
  });

  it("normalizes leetspeak to letters", () => {
    expect(normalizeName("l33t")).toBe("leet");
    expect(normalizeName("N1c3-Name_42")).toBe("nicenamea");
  });
});
