import { describe, expect, it } from "vitest";
import { createDriveSession } from "../engine/driveSimulator";
import { kickDistanceFor, MAX_REALISTIC_FIELD_GOAL_DISTANCE } from "../engine";
import { DEFAULT_SCENARIO } from "../data/startDrive";
import { encodeGhostParam, ghostDoneAtClock, ghostStepAtClock, parseGhostParam, replayDriveCore, type GhostDrive } from "../share/ghost";
import type { DraftedRosterData } from "../types/roster";
import type { DriveLog } from "../types/simResult";
import { makeKickerFixture, makePlayerFixture } from "./fixtures";

function makeRoster(): DraftedRosterData {
  return {
    qb: makePlayerFixture({
      displayName: "Test QB",
      position: "QB",
      role: "passer",
      aggregates: {
        passer: { sampleSize: 200, firstDownRate: 0.3, completionPct: 0.65, yardsPerAttempt: 7, sackRate: 0.05, intRate: 0.02, passTdRate: 0.04, scrambleRate: 0.05 },
        rusher: { sampleSize: 200, firstDownRate: 0.3, yardsPerCarry: 6, rushTdRate: 0.04, fumbleRate: 0.01 },
      },
    }),
    rb: makePlayerFixture({
      displayName: "Test RB",
      position: "RB",
      role: "rusher",
      aggregates: { rusher: { sampleSize: 200, firstDownRate: 0.25, yardsPerCarry: 4.2, rushTdRate: 0.03, fumbleRate: 0.01 } },
    }),
    wr1: makePlayerFixture({
      displayName: "Test WR1",
      position: "WR",
      role: "receiver",
      aggregates: { receiver: { sampleSize: 200, firstDownRate: 0.35, catchRate: 0.65, yardsPerTarget: 8, receivingTdRate: 0.05 } },
    }),
    wr2: makePlayerFixture({
      displayName: "Test WR2",
      position: "WR",
      role: "receiver",
      aggregates: { receiver: { sampleSize: 200, firstDownRate: 0.3, catchRate: 0.6, yardsPerTarget: 6, receivingTdRate: 0.03 } },
    }),
    te: makePlayerFixture({
      displayName: "Test TE",
      position: "TE",
      role: "receiver",
      aggregates: { receiver: { sampleSize: 200, firstDownRate: 0.32, catchRate: 0.7, yardsPerTarget: 5, receivingTdRate: 0.04 } },
    }),
    k: makeKickerFixture({ displayName: "Test Kicker" }),
  };
}

const RATES = { leagueAverageRates: {}, leagueAverageKickerRates: {} };

/** Plays a full drive with varied inputs (tempo on even downs, FG on 4th when
 * in range) so the encoding exercises tempo, offense, and kick choices. */
function playDrive(roster: DraftedRosterData, seed: number): DriveLog {
  const session = createDriveSession(roster, DEFAULT_SCENARIO, {}, {}, seed);
  for (let i = 0; i < 40; i++) {
    const options = session.getOptions();
    if (options.length === 0) break;
    const s = session.getSituation();
    const canKick = kickDistanceFor(s.fieldPosition) <= MAX_REALISTIC_FIELD_GOAL_DISTANCE;
    const call = s.down === 4 && canKick ? ({ kind: "fieldGoal" } as const) : options[0];
    const tempo = s.clockRunning && i % 2 === 0 ? 15 + (i % 21) : undefined;
    const { status } = session.choosePlay(call, tempo);
    if (status !== "continue") break;
  }
  return session.getLog();
}

describe("ghost racing", () => {
  it("encode -> parse -> replay reproduces the exact drive across seeds", () => {
    const roster = makeRoster();
    let checked = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const log = playDrive(roster, seed);
      const param = encodeGhostParam(log);
      expect(param).not.toBeNull();

      const parsed = parseGhostParam(`?team=x&g=${param}&by=Xavier`);
      expect(parsed).not.toBeNull();
      expect(parsed!.seed).toBe(log.seed);
      expect(parsed!.claimedScore).toBe(log.score);
      expect(parsed!.name).toBe("Xavier");
      expect(parsed!.choices).toEqual(log.choices);

      const replayed = replayDriveCore(roster, RATES, parsed!.seed, parsed!.choices);
      expect(replayed).not.toBeNull();
      expect(replayed!.log.score).toBe(log.score);
      expect(replayed!.log.endReason).toBe(log.endReason);
      expect(replayed!.timeline.length).toBe(log.choices.length + 1);
      checked++;
    }
    expect(checked).toBe(25);
  });

  it("rejects malformed or truncated ghost params", () => {
    expect(parseGhostParam("?g=")).toBeNull();
    expect(parseGhostParam("?g=2.abc.def.00")).toBeNull(); // unknown version
    expect(parseGhostParam("?g=1.zz.10.0-")).not.toBeNull(); // minimal valid: one choice, no tempo
    expect(parseGhostParam("?g=1.zz.10.012")).toBeNull(); // odd body length
    expect(parseGhostParam("?g=1.zz.10.z-")).toBeNull(); // call index out of range
    expect(parseGhostParam("?nothing=1")).toBeNull();
  });

  it("filters a disallowed sharer name but keeps the ghost", () => {
    const log = playDrive(makeRoster(), 3);
    const param = encodeGhostParam(log)!;
    const parsed = parseGhostParam(`?g=${param}&by=${encodeURIComponent("fuck123")}`);
    expect(parsed).not.toBeNull();
    expect(parsed!.name).toBeNull();
  });

  it("replay refuses corrupt choice sequences instead of inventing a drive", () => {
    const roster = makeRoster();
    const log = playDrive(roster, 5);
    // Truncate: drive doesn't reach its end -> null.
    const short = replayDriveCore(roster, RATES, log.seed, log.choices.slice(0, 1));
    // (A 1-choice drive CAN legitimately end on a turnover/TD; only assert null
    // when the original drive had more choices and play 1 continued.)
    if (log.choices.length > 1) expect(short).toBeNull();
  });

  it("clock-sync lookup returns the latest ghost state at-or-before a clock", () => {
    const ghost: GhostDrive = {
      name: null,
      score: 100,
      won: true,
      endReason: "WIN_TOUCHDOWN",
      clockSecondsRemaining: 30,
      timeline: [
        { clockSeconds: 240, fieldPosition: 80 },
        { clockSeconds: 200, fieldPosition: 65 },
        { clockSeconds: 150, fieldPosition: 40 },
        { clockSeconds: 30, fieldPosition: 0 },
      ],
    };
    expect(ghostStepAtClock(ghost, 240).fieldPosition).toBe(80);
    expect(ghostStepAtClock(ghost, 210).fieldPosition).toBe(80); // their play at 200 hasn't happened yet
    expect(ghostStepAtClock(ghost, 200).fieldPosition).toBe(65);
    expect(ghostStepAtClock(ghost, 100).fieldPosition).toBe(40);
    expect(ghostStepAtClock(ghost, 10).fieldPosition).toBe(0);
    expect(ghostDoneAtClock(ghost, 100)).toBe(false);
    expect(ghostDoneAtClock(ghost, 30)).toBe(true);
  });
});
