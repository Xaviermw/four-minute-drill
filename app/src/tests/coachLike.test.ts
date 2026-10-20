import { describe, expect, it } from "vitest";
import { coachLike, fingerprintDrive } from "../share/coachLike";
import type { CoachTendency } from "../share/coachTendencies.generated";
import type { PlayCall } from "../engine/playOptions";
import type { DriveLog } from "../types/simResult";

// A synthetic coach table so the test pins the MATCHING, not the data.
const TABLE: CoachTendency[] = [
  { name: "Air Raid Al", team: "AAA", lastSeason: 2026, passRate: 0.85, deepRate: 0.35, fourthGo: 0.8, fourthN: 40, noHuddle: 0.3, lateN: 500 },
  { name: "Balanced Bo", team: "BBB", lastSeason: 2026, passRate: 0.6, deepRate: 0.18, fourthGo: 0.5, fourthN: 40, noHuddle: 0.1, lateN: 500 },
  { name: "Ground Gus", team: "GGG", lastSeason: 2026, passRate: 0.4, deepRate: 0.1, fourthGo: 0.3, fourthN: 40, noHuddle: 0.05, lateN: 500 },
];

const pass = (depth: "short" | "medium" | "deep"): PlayCall => ({ kind: "pass", target: "wr1", depth });
const run: PlayCall = { kind: "runInside" };

function drive(calls: PlayCall[], tempo?: number, downs?: number[]): DriveLog {
  return {
    plays: calls.map((_, i) => ({
      playNumber: i + 1,
      down: downs?.[i] ?? 1,
      distance: 10,
      fieldPosition: 60,
      role: "wr",
      ballCarrier: "wr1",
      ballCarrierName: "x",
      outcome: { yards: 5, isTouchdown: false, isTurnover: false, isSack: false },
      description: "",
    })),
    choices: calls.map((call) => (tempo === undefined ? { call } : { call, tempoSeconds: tempo })),
    endReason: "LOSS_CLOCK_EXPIRED",
    won: false,
    score: 0,
    scoreBreakdown: { basePoints: 0, baseLabel: "No Score", rosterMultiplier: 1, clockMultiplier: 1, driveYards: 0, drivePoints: 0, total: 0 },
    seed: 1,
    clockSecondsRemaining: 0,
  } as unknown as DriveLog;
}

describe("called it like", () => {
  it("matches a deep, hurry-up passing drive to the air-raid coach", () => {
    const log = drive([pass("deep"), pass("deep"), pass("medium"), pass("deep"), run], 15);
    expect(coachLike(log, TABLE)?.name).toBe("Air Raid Al");
  });

  it("matches a run-first, clock-milking drive to the ground coach", () => {
    const log = drive([run, run, run, pass("short"), run], 35);
    expect(coachLike(log, TABLE)?.name).toBe("Ground Gus");
  });

  it("has no opinion on a drive too short to be a tendency", () => {
    expect(coachLike(drive([pass("deep"), run]), TABLE)).toBeNull();
  });

  it("reads fourth-down nerve only when a kick was realistic", () => {
    // Went for it on 4th from the 60 (a 77-yard kick): not a real decision.
    const far = fingerprintDrive(drive([run, run, run, run], undefined, [1, 2, 3, 4]));
    expect(far?.fourthGo).toBeNull();
    // From the 20 (a 37-yard kick), going for it counts.
    const near = drive([run, run, run, run], undefined, [1, 2, 3, 4]);
    near.plays[3].fieldPosition = 20;
    expect(fingerprintDrive(near)?.fourthGo).toBe(1);
  });

  it("ignores kicks and spikes when counting calls", () => {
    const log = drive([pass("short"), { kind: "spike" }, pass("short"), { kind: "fieldGoal" }]);
    expect(coachLike(log, TABLE)).toBeNull(); // only two offensive calls
  });

  it("is deterministic", () => {
    const log = drive([pass("short"), run, pass("medium"), run, pass("short")], 25);
    expect(coachLike(log, TABLE)?.name).toBe(coachLike(log, TABLE)?.name);
  });
});
