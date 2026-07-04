import { describe, expect, it } from "vitest";
import { createDriveSession } from "../engine/driveSimulator";
import { MAX_PLAYS_PER_DRIVE } from "../engine/constants";
import { MIN_SAMPLE_THRESHOLD } from "../engine/situational";
import { rosterPayoutMultiplier } from "../engine";
import type { DraftedRosterData } from "../types/roster";
import { finalFieldPosition, type DriveLog } from "../types/simResult";
import { makeKickerFixture, makeOutcome, makePlayerFixture } from "./fixtures";

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

// 6:00, matching the app's real default scenario -- every play now costs its
// own 5-15s on top of any between-plays gap, so a 75-yard drive needs more
// than the old 2:00 test clock to be winnable at all.
const scenario = { down: 1, distance: 10, fieldPosition: 75, clockSeconds: 360, scoreDiff: -3 };

/** Drives a session to completion, always picking the first offered option each down. */
function runToCompletion(roster: DraftedRosterData, seed: number): DriveLog {
  const session = createDriveSession(roster, scenario, {}, {}, seed);
  let plays = 0;
  while (true) {
    const options = session.getOptions();
    const { status } = session.choosePlay(options[0]);
    plays += 1;
    if (status !== "continue" || plays > MAX_PLAYS_PER_DRIVE + 1) break;
  }
  return session.getLog();
}

describe("DriveSession", () => {
  it("always terminates in one of the four defined end states", () => {
    const roster = makeRoster();
    for (let seed = 0; seed < 100; seed++) {
      const log = runToCompletion(roster, seed);
      expect(["WIN_TOUCHDOWN", "LOSS_TURNOVER", "LOSS_TURNOVER_ON_DOWNS", "LOSS_CLOCK_EXPIRED"]).toContain(log.endReason);
      expect(log.plays.length).toBeLessThanOrEqual(MAX_PLAYS_PER_DRIVE);
      expect(log.plays.length).toBeGreaterThan(0);
      expect(log.won).toBe(log.endReason === "WIN_TOUCHDOWN");
    }
  });

  it("produces a non-degenerate win rate across seeds (not always 0% or 100%)", () => {
    const roster = makeRoster();
    let wins = 0;
    const trials = 200;
    for (let seed = 0; seed < trials; seed++) {
      if (runToCompletion(roster, seed).won) wins++;
    }
    expect(wins).toBeGreaterThan(0);
    expect(wins).toBeLessThan(trials);
  });

  it("offers 3 distinct options each down, redrawn after each choice", () => {
    const roster = makeRoster();
    const session = createDriveSession(roster, scenario, {}, {}, 42);
    const firstOptions = session.getOptions();
    expect(firstOptions).toHaveLength(3);
    expect(session.getOptions()).toEqual(firstOptions); // stable until a choice is made

    const { status } = session.choosePlay(firstOptions[0]);
    const secondOptions = session.getOptions();
    // 0 options once the drive has ended (rare on play 1, e.g. a pick-six-style
    // turnover or immediate touchdown), otherwise always exactly 3.
    expect(secondOptions).toHaveLength(status === "continue" ? 3 : 0);
  });

  it("does not award a first down from a stale historical isFirstDown flag that doesn't match the current distance", () => {
    // Real historical play converted at its OWN original (shorter) distance,
    // but only gained 3 yards -- not enough for the current 1st-and-10.
    const shortGainButFlaggedAsConverting = makeOutcome({ yards: 3, isFirstDown: true });
    const roster = makeRoster();
    roster.rb.buckets.rusher = [
      {
        bucketKey: "1_long_own_territory",
        sampleSize: MIN_SAMPLE_THRESHOLD,
        outcomes: Array.from({ length: MIN_SAMPLE_THRESHOLD }, () => shortGainButFlaggedAsConverting),
      },
    ];

    const session = createDriveSession(roster, { down: 1, distance: 10, fieldPosition: 75, clockSeconds: 600, scoreDiff: -4 }, {}, {}, 1);
    const { play, status } = session.choosePlay({ kind: "run" });

    expect(play.outcome.yards).toBe(3);
    expect(status).toBe("continue");
    const situation = session.getSituation();
    expect(situation.down).toBe(2); // not reset to 1st -- the stale flag must not grant a conversion
    expect(situation.distance).toBe(7);
  });

  it("ends in turnover on downs when 4 straight plays fail to gain the needed distance", () => {
    const roster = makeRoster();
    roster.rb.buckets.rusher = []; // force the rate-stat fallback path every down
    roster.rb.aggregates.rusher = { sampleSize: 200, firstDownRate: 0, yardsPerCarry: 1, rushTdRate: 0, fumbleRate: 0 };

    const session = createDriveSession(roster, { down: 1, distance: 10, fieldPosition: 75, clockSeconds: 600, scoreDiff: -4 }, {}, {}, 7);
    let status: string = "continue";
    for (let i = 0; i < 4; i++) {
      ({ status } = session.choosePlay({ kind: "run" }));
    }
    expect(status).toBe("LOSS_TURNOVER_ON_DOWNS");
  });

  it("ends the drive immediately on a field goal attempt, made or missed", () => {
    const roster = makeRoster();
    roster.k = makeKickerFixture({
      distanceBuckets: { under30: { attempts: 100, makes: 100, makePct: 1.0 } }, // always good
    });
    const session = createDriveSession(roster, { down: 1, distance: 10, fieldPosition: 10, clockSeconds: 120, scoreDiff: -3 }, {}, {}, 1);
    const { status } = session.choosePlay({ kind: "fieldGoal" });
    expect(status).toBe("WIN_FIELD_GOAL");
    expect(session.getLog().won).toBe(true);
    expect(session.getLog().score).toBeGreaterThan(0);
  });

  it("a missed field goal scores 0 and ends as a loss", () => {
    const roster = makeRoster();
    roster.k = makeKickerFixture({
      distanceBuckets: { under30: { attempts: 100, makes: 0, makePct: 0 } }, // always no good
    });
    const session = createDriveSession(roster, { down: 1, distance: 10, fieldPosition: 10, clockSeconds: 120, scoreDiff: -3 }, {}, {}, 1);
    const { status } = session.choosePlay({ kind: "fieldGoal" });
    expect(status).toBe("LOSS_MISSED_FIELD_GOAL");
    const log = session.getLog();
    expect(log.won).toBe(false);
    expect(log.score).toBe(0);
  });

  it("a scoreless drive banks marginal points for yards advanced (times payout)", () => {
    const roster = makeRoster();
    const ratings = [roster.qb, roster.rb, roster.wr1, roster.wr2, roster.te, roster.k].map((p) => p.rating);
    const payout = rosterPayoutMultiplier(ratings);
    let sawAdvancingLoss = false;
    for (let seed = 0; seed < 200; seed++) {
      const log = runToCompletion(roster, seed);
      if (log.won) {
        expect(log.scoreBreakdown.driveYards).toBe(0);
        continue;
      }
      const yards = Math.max(0, scenario.fieldPosition - finalFieldPosition(log));
      expect(log.scoreBreakdown.driveYards).toBe(yards);
      // score = round(round(yards * 0.5) * payout), no clutch bonus on a loss.
      expect(log.score).toBe(Math.round(Math.round(yards * 0.5) * payout));
      expect(log.scoreBreakdown.clockMultiplier).toBe(1);
      if (log.score > 0) sawAdvancingLoss = true;
    }
    // The feature is actually exercised: some losses that drove downfield scored.
    expect(sawAdvancingLoss).toBe(true);
  });

  it("spiking consumes a down, costs a fixed 10s, and stops the clock", () => {
    const roster = makeRoster();
    const session = createDriveSession(roster, { down: 1, distance: 10, fieldPosition: 50, clockSeconds: 60, scoreDiff: -3 }, {}, {}, 1);
    const { play, status } = session.choosePlay({ kind: "spike" });
    expect(play.outcome.yards).toBe(0);
    expect(status).toBe("continue");
    const situation = session.getSituation();
    expect(situation.down).toBe(2);
    expect(situation.distance).toBe(10); // unchanged, no yards gained
    expect(situation.clockSeconds).toBe(50);
    expect(situation.clockRunning).toBe(false);
  });

  it("spiking on 4th down with no gain ends in turnover on downs", () => {
    const roster = makeRoster();
    const session = createDriveSession(roster, { down: 4, distance: 5, fieldPosition: 50, clockSeconds: 60, scoreDiff: -3 }, {}, {}, 1);
    const { status } = session.choosePlay({ kind: "spike" });
    expect(status).toBe("LOSS_TURNOVER_ON_DOWNS");
  });

  it("records the seed and the ordered choices in the log", () => {
    const roster = makeRoster();
    const log = runToCompletion(roster, 12345);
    expect(log.seed).toBe(12345);
    // One recorded choice per play that was actually run.
    expect(log.choices).toHaveLength(log.plays.length);
    expect(log.choices.every((c) => typeof c.call?.kind === "string")).toBe(true);
  });

  it("replaying (roster, seed, choices) reproduces the identical score and outcome", () => {
    const roster = makeRoster();
    for (let seed = 0; seed < 25; seed++) {
      const original = runToCompletion(roster, seed);
      // Feed the captured choices back into a fresh session with the same seed.
      // Drawing options consumes RNG, so the replay must call getOptions() each
      // down exactly as the live session did to keep the stream aligned.
      const replay = createDriveSession(roster, scenario, {}, {}, original.seed);
      for (const choice of original.choices) {
        replay.getOptions();
        replay.choosePlay(choice.call, choice.tempoSeconds);
      }
      const replayed = replay.getLog();
      expect(replayed.score).toBe(original.score);
      expect(replayed.endReason).toBe(original.endReason);
      expect(replayed.plays.length).toBe(original.plays.length);
    }
  });
});

describe("scoring formula", () => {
  const ALWAYS_GOOD_KICK = { under30: { attempts: 100, makes: 100, makePct: 1.0 } };

  function rosterWithRating(rating: number): DraftedRosterData {
    const roster = makeRoster();
    for (const slot of ["qb", "rb", "wr1", "wr2", "te"] as const) {
      roster[slot] = { ...roster[slot], rating };
    }
    roster.k = makeKickerFixture({ rating });
    return roster;
  }

  it("a touchdown scores more than a field goal for the same roster and clock", () => {
    const roster = rosterWithRating(70);
    const scenario1 = { down: 1, distance: 10, fieldPosition: 50, clockSeconds: 200, scoreDiff: -3 };

    const tdSession = createDriveSession(roster, scenario1, {}, {}, 1);
    // Force a touchdown via a deterministic rusher bucket reaching the goal line.
    roster.rb.buckets.rusher = [
      { bucketKey: "1_long_midfield", sampleSize: 8, outcomes: Array.from({ length: 8 }, () => makeOutcome({ yards: 50, isTouchdown: true })) },
    ];
    const { status: tdStatus } = tdSession.choosePlay({ kind: "run" });
    expect(tdStatus).toBe("WIN_TOUCHDOWN");
    const tdScore = tdSession.getLog().score;

    const fgRoster = rosterWithRating(70);
    fgRoster.k = makeKickerFixture({ rating: 70, distanceBuckets: ALWAYS_GOOD_KICK });
    const fgSession = createDriveSession(fgRoster, { ...scenario1, fieldPosition: 10 }, {}, {}, 1);
    const { status: fgStatus } = fgSession.choosePlay({ kind: "fieldGoal" });
    expect(fgStatus).toBe("WIN_FIELD_GOAL");
    const fgScore = fgSession.getLog().score;

    expect(tdScore).toBeGreaterThan(fgScore);
  });

  it("a weaker (low-rated) roster scores more than a stronger (high-rated) roster for the same field goal and clock", () => {
    const scenario1 = { down: 1, distance: 10, fieldPosition: 10, clockSeconds: 200, scoreDiff: -3 };

    const stackedRoster = rosterWithRating(95);
    stackedRoster.k = makeKickerFixture({ rating: 95, distanceBuckets: ALWAYS_GOOD_KICK });
    const stackedSession = createDriveSession(stackedRoster, scenario1, {}, {}, 1);
    stackedSession.choosePlay({ kind: "fieldGoal" });
    const stackedScore = stackedSession.getLog().score;

    const underdogRoster = rosterWithRating(48);
    underdogRoster.k = makeKickerFixture({ rating: 48, distanceBuckets: ALWAYS_GOOD_KICK });
    const underdogSession = createDriveSession(underdogRoster, scenario1, {}, {}, 1);
    underdogSession.choosePlay({ kind: "fieldGoal" });
    const underdogScore = underdogSession.getLog().score;

    expect(underdogScore).toBeGreaterThan(stackedScore);
  });

  it("scoring with less clock left is worth more than scoring with more clock left, all else equal", () => {
    // Same starting clock for both -- the "late" session burns clock with 3
    // deterministic spikes (10s each, no field-position change) before
    // kicking, so it scores with meaningfully less time left than the
    // "early" session, which kicks immediately.
    const makeFgRoster = () =>
      Object.assign(rosterWithRating(70), {
        k: makeKickerFixture({ rating: 70, distanceBuckets: ALWAYS_GOOD_KICK }),
      });
    // Both end up under the 120s clutch reference, but "late" ends up lower.
    const scenarioWithClock = { down: 1, distance: 10, fieldPosition: 10, clockSeconds: 100, scoreDiff: -3 };

    const earlySession = createDriveSession(makeFgRoster(), scenarioWithClock, {}, {}, 1);
    earlySession.choosePlay({ kind: "fieldGoal" });
    const earlyScore = earlySession.getLog().score;

    const lateSession = createDriveSession(makeFgRoster(), scenarioWithClock, {}, {}, 1);
    lateSession.choosePlay({ kind: "spike" });
    lateSession.choosePlay({ kind: "spike" });
    lateSession.choosePlay({ kind: "spike" });
    lateSession.choosePlay({ kind: "fieldGoal" });
    const lateScore = lateSession.getLog().score;

    expect(lateScore).toBeGreaterThan(earlyScore);
  });
});
