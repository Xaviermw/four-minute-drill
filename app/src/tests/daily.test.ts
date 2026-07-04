import { describe, expect, it } from "vitest";
import type { ManifestPlayerEntry, Position } from "../types/player";
import { drawSlotOptions } from "../draft/draftPool";
import {
  dailyDraftRng,
  dailyDriveSeed,
  formatChallengeDate,
  seedFromString,
  todaysChallengeId,
} from "../daily/dailyChallenge";

function players(): ManifestPlayerEntry[] {
  const out: ManifestPlayerEntry[] = [];
  const counts: Record<Position, number> = { QB: 8, RB: 8, WR: 12, TE: 6, K: 6 };
  for (const pos of ["QB", "RB", "WR", "TE", "K"] as Position[]) {
    for (let i = 0; i < counts[pos]; i++) {
      out.push({
        gsisId: `00-00${pos}${String(i).padStart(3, "0")}`,
        displayName: `${pos} Player ${i}`,
        position: pos,
        tier: "starter",
        team: "KC",
        jersey: i,
        rating: 50 + i,
        flavorStats: { headline: "", subline: "" },
      });
    }
  }
  return out;
}

describe("daily challenge core", () => {
  it("challenge id is the UTC date", () => {
    expect(todaysChallengeId(new Date("2026-07-02T23:30:00Z"))).toBe("2026-07-02");
    expect(todaysChallengeId(new Date("2026-01-05T00:00:01Z"))).toBe("2026-01-05");
  });

  it("seeds are stable per id and differ across ids", () => {
    expect(seedFromString("2026-07-02:drive")).toBe(seedFromString("2026-07-02:drive"));
    expect(dailyDriveSeed("2026-07-02")).toBe(dailyDriveSeed("2026-07-02"));
    expect(dailyDriveSeed("2026-07-02")).not.toBe(dailyDriveSeed("2026-07-03"));
  });

  it("the same day yields the identical shared draft pool for everyone", () => {
    const pool = players();
    const a = drawSlotOptions(pool, dailyDraftRng("2026-07-02"));
    const b = drawSlotOptions(pool, dailyDraftRng("2026-07-02"));
    expect(a).toEqual(b);
    // Each slot still offers 3, and WR1/WR2 never collide.
    for (const slot of ["qb", "rb", "wr1", "wr2", "te", "k"] as const) {
      expect(a[slot]).toHaveLength(3);
    }
    const wr1 = new Set(a.wr1.map((p) => p.gsisId));
    expect(a.wr2.every((p) => !wr1.has(p.gsisId))).toBe(true);
  });

  it("different days generally yield different pools", () => {
    const pool = players();
    const a = drawSlotOptions(pool, dailyDraftRng("2026-07-02"));
    const c = drawSlotOptions(pool, dailyDraftRng("2026-07-09"));
    expect(a.qb.map((p) => p.gsisId)).not.toEqual(c.qb.map((p) => p.gsisId));
  });

  it("formats the challenge date for display", () => {
    expect(formatChallengeDate("2026-07-02")).toMatch(/Jul.*2.*2026/);
  });
});
