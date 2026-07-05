import { describe, expect, it } from "vitest";
import type { ManifestPlayerEntry, Position } from "../types/player";
import type { DraftedRoster, RosterSlotKey } from "../types/roster";
import type { DriveLog } from "../types/simResult";
import { decodeLineup, encodeLineup, LINEUP_SLOT_ORDER } from "../share/lineupCode";
import { buildDriveGrid, buildShareText, buildShareUrl } from "../share/shareText";
import { rosterFromToken } from "../share/sharedLineup";
import type { Manifest } from "../types/player";

function entry(gsisId: string, position: Position, displayName: string, rating: number): ManifestPlayerEntry {
  return { gsisId, displayName, position, tier: "starter", team: "KC", jersey: 1, rating, flavorStats: { headline: "", subline: "" } };
}

function makeRoster(): DraftedRoster {
  return {
    qb: entry("00-0033873", "QB", "Lamar Jackson", 93),
    rb: entry("00-0034857", "RB", "Jahmyr Gibbs", 80),
    wr1: entry("00-0034796", "WR", "JaMarr Chase", 90),
    wr2: entry("00-0036442", "WR", "Justin Jefferson", 91),
    te: entry("00-0036389", "TE", "Trey McBride", 78),
    k: entry("00-0033892", "K", "Justin Tucker", 95),
  };
}

const wonLog = (score: number, endReason: string): DriveLog =>
  ({
    plays: [],
    endReason: endReason as DriveLog["endReason"],
    won: endReason.startsWith("WIN"),
    score,
    scoreBreakdown: { basePoints: 7, baseLabel: "Touchdown", rosterMultiplier: 1, clockMultiplier: 1, driveYards: 0, drivePoints: 0, total: score },
    seed: 1,
    choices: [],
    clockSecondsRemaining: 42,
  }) as DriveLog;

describe("lineup code", () => {
  it("round-trips a roster's six gsisIds in slot order", () => {
    const roster = makeRoster();
    const token = encodeLineup(roster);
    expect(token).not.toBeNull();
    expect(token).toMatch(/^\d{30}$/);

    const decoded = decodeLineup(token!);
    expect(decoded).not.toBeNull();
    for (const slot of LINEUP_SLOT_ORDER) {
      expect(decoded![slot as RosterSlotKey]).toBe(roster[slot as RosterSlotKey].gsisId);
    }
  });

  it("rejects malformed tokens", () => {
    expect(decodeLineup("")).toBeNull();
    expect(decodeLineup("123")).toBeNull();
    expect(decodeLineup("x".repeat(30))).toBeNull();
    expect(decodeLineup("1".repeat(29))).toBeNull();
  });

  it("returns null when a gsisId is non-canonical", () => {
    const roster = makeRoster();
    roster.qb = entry("01-1234567", "QB", "Weird Id", 80);
    expect(encodeLineup(roster)).toBeNull();
  });
});

describe("rosterFromToken", () => {
  function makeManifest(roster: DraftedRoster): Manifest {
    return {
      generatedAt: "",
      players: LINEUP_SLOT_ORDER.map((s) => roster[s as RosterSlotKey]),
      leagueTendencies: {},
      leagueAverageRates: {},
      leagueAverageKickerRates: {},
    };
  }

  it("reconstructs the roster from a token using the manifest", () => {
    const roster = makeRoster();
    const token = encodeLineup(roster)!;
    const rebuilt = rosterFromToken(token, makeManifest(roster));
    expect(rebuilt).not.toBeNull();
    expect(rebuilt!.qb.gsisId).toBe(roster.qb.gsisId);
    expect(rebuilt!.k.displayName).toBe("Justin Tucker");
  });

  it("returns null when an id is unknown to the manifest", () => {
    const roster = makeRoster();
    const token = encodeLineup(roster)!;
    const manifest = makeManifest(roster);
    manifest.players = manifest.players.filter((p) => p.position !== "K");
    expect(rosterFromToken(token, manifest)).toBeNull();
  });

  it("returns null when a player lands in the wrong-position slot", () => {
    const roster = makeRoster();
    // Swap the QB id to point at the kicker -> position mismatch in the qb slot.
    const token = encodeLineup({ ...roster, qb: roster.k })!;
    expect(rosterFromToken(token, makeManifest(roster))).toBeNull();
  });
});

describe("share text + url", () => {
  it("builds a ?team= link off the given origin", () => {
    const roster = makeRoster();
    const url = buildShareUrl(roster, "https://example.com/app/");
    expect(url).toBe(`https://example.com/app/?team=${encodeLineup(roster)}`);
  });

  it("summarizes a winning drive with score, outcome, spend, lineup, and link", () => {
    const roster = makeRoster();
    const text = buildShareText(wonLog(152, "WIN_FIELD_GOAL"), roster, 19, "https://x.test/?team=abc");
    expect(text).toContain("Four Minute Drill — 152 pts");
    expect(text).toContain("Field goal");
    expect(text).toContain("built for $19 of $25");
    expect(text).toContain("💰 $6 under the cap");
    expect(text).toContain("QB L.Jackson");
    expect(text).toContain("beat it ▶ https://x.test/?team=abc");
  });

  it("says 'no score' and omits points for a loss", () => {
    const text = buildShareText(wonLog(0, "LOSS_TURNOVER"), makeRoster(), undefined, null);
    expect(text).toContain("no score");
    expect(text).not.toContain("beat it");
  });

  it("omits the cap line at full spend", () => {
    const text = buildShareText(wonLog(100, "WIN_TOUCHDOWN"), makeRoster(), 25, null);
    expect(text).toContain("built for $25 of $25");
    expect(text).not.toContain("under the cap");
  });
});

describe("drive emoji grid", () => {
  const play = (yards: number, extra: Partial<DriveLog["plays"][number]> = {}): DriveLog["plays"][number] =>
    ({
      playNumber: 1,
      down: 1,
      distance: 10,
      fieldPosition: 75,
      role: "wr" as DriveLog["plays"][number]["role"],
      ballCarrier: "wr1",
      ballCarrierName: "x",
      outcome: { yards, isTouchdown: false, isTurnover: false, isSack: false } as DriveLog["plays"][number]["outcome"],
      description: "",
      ...extra,
    }) as DriveLog["plays"][number];

  const logWith = (plays: DriveLog["plays"], endReason: string): DriveLog =>
    ({ ...wonLog(0, endReason), plays }) as DriveLog;

  it("colors snaps by yards and marks the touchdown", () => {
    const log = logWith(
      [play(2), play(18), play(6), play(0, { outcome: { yards: 12, isTouchdown: true, isTurnover: false, isSack: false } as DriveLog["plays"][number]["outcome"] })],
      "WIN_TOUCHDOWN"
    );
    expect(buildDriveGrid(log)).toBe("⬜🟩🟨🏈");
  });

  it("folds a made field goal into a terminal target and skips the kick snap", () => {
    const log = logWith([play(9), play(-3), play(0, { role: "kicker" as DriveLog["plays"][number]["role"] })], "WIN_FIELD_GOAL");
    expect(buildDriveGrid(log)).toBe("🟨🟥🎯");
  });

  it("marks a turnover on downs", () => {
    expect(buildDriveGrid(logWith([play(3), play(1)], "LOSS_TURNOVER_ON_DOWNS"))).toBe("⬜⬜🛑");
  });
});
