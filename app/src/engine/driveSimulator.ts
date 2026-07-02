import type { AggregateRates, KickDistanceTier, KickerDistanceBucket, OutcomeRecord, PlayerDataset, PlayerRole } from "../types/player";
import type { DraftedRosterData, RosterSlotKey } from "../types/roster";
import type { DriveScenario } from "../types/scenario";
import type { DriveChoice, DriveEndReason, DriveLog, PlayResult, ScoreBreakdown } from "../types/simResult";
import {
  CLOCK_RUNOFF_RUNNING,
  CLUTCH_REFERENCE_SECONDS,
  MAX_PLAYS_PER_DRIVE,
  PLAY_DURATION_RANGE,
  SPIKE_RUNOFF_SECONDS,
} from "./constants";
import { attemptFieldGoal, kickDistanceFor } from "./kicker";
import { drawPlayOptions, type PlayCall } from "./playOptions";
import { makeRng, type RNG } from "./rng";
import {
  rollBlendedInterception,
  rollQbSackOutcome,
  rollQbScrambleOutcome,
  sampleBlendedReceptionOutcome,
  sampleOutcome,
  sampleQbDesignedRun,
} from "./sampleOutcome";

const TOUCHDOWN_BASE_POINTS = 100;
const FIELD_GOAL_BASE_POINTS = 40;

// Roster-strength scoring: the weaker your drafted team, the bigger the score.
// Continuous in the players' real overall ratings -- a 99 OVR team multiplies
// by 1.0, a 40 OVR team by 2.0, everything in between scaled linearly.
const RATING_FLOOR = 40;
const RATING_CEIL = 99;
const MIN_ROSTER_MULT = 1.0;
const MAX_ROSTER_MULT = 2.0;

const BIG_GAIN_YARDS = 20;

function pick(rng: RNG, templates: string[]): string {
  return templates[Math.floor(rng.next() * templates.length)];
}

function describePlay(
  outcomeRole: PlayerRole,
  name: string,
  yards: number,
  outcome: OutcomeRecord,
  isScramble: boolean,
  rng: RNG,
  qbName: string
): string {
  if (outcome.isSack) {
    return pick(rng, [
      `${name} is sacked for a loss of ${-yards} yards.`,
      `${name} can't escape the pressure -- sacked for ${-yards} yards.`,
      `The pocket collapses and ${name} is brought down for a ${-yards}-yard loss.`,
    ]);
  }

  if (isScramble) {
    if (outcome.isTurnover) return `${name} scrambles and fumbles -- recovered by the defense!`;
    if (outcome.isTouchdown) return `Touchdown! ${name} scrambles in for ${yards} yards!`;
    if (yards >= BIG_GAIN_YARDS) {
      return pick(rng, [
        `${name} breaks contain and takes off for ${yards} yards!`,
        `${name} scrambles loose for a huge ${yards}-yard gain!`,
      ]);
    }
    return pick(rng, [`${name} scrambles for ${yards} yards.`, `${name} tucks it and runs for ${yards} yards.`]);
  }

  if (outcomeRole === "passer" || outcomeRole === "receiver") {
    if (!outcome.isComplete) {
      if (outcome.isTurnover) {
        return pick(rng, [
          `Pass intercepted! ${qbName}'s throw is picked off.`,
          `Intercepted! ${name} couldn't get there in time.`,
        ]);
      }
      return pick(rng, [
        `Incomplete pass intended for ${name}.`,
        `${qbName} can't connect with ${name} -- incomplete.`,
        `${name} can't bring it in. Incomplete.`,
      ]);
    }
    if (outcome.isTouchdown) {
      return pick(rng, [
        `Touchdown! Complete to ${name} for ${yards} yards.`,
        `Touchdown! ${qbName} finds ${name} for ${yards} yards!`,
        `${name} hauls it in for the score! ${yards}-yard touchdown.`,
      ]);
    }
    if (yards >= BIG_GAIN_YARDS) {
      return pick(rng, [
        `${name} breaks free for a big ${yards}-yard gain!`,
        `${qbName} throws ${name} open for ${yards} yards!`,
        `Big play! ${name} hauls it in and turns it into ${yards} yards.`,
      ]);
    }
    if (outcome.isFirstDown) {
      return pick(rng, [
        `${qbName} finds ${name} to move the chains -- ${yards} yards and a first down.`,
        `${name} comes down with it for ${yards} yards, plenty for the first down.`,
        `Complete to ${name} for ${yards} yards and a first down.`,
      ]);
    }
    return pick(rng, [
      `Complete to ${name} for ${yards} yards.`,
      `${qbName} dumps it off to ${name} for ${yards} yards.`,
      `${name} settles for ${yards} yards underneath.`,
    ]);
  }

  if (outcome.isTurnover) return `${name} fumbles, and it's recovered by the defense!`;
  if (outcome.isTouchdown) return `Touchdown! ${name} runs it in for ${yards} yards!`;
  if (yards >= BIG_GAIN_YARDS) {
    return pick(rng, [`${name} breaks loose for a big ${yards}-yard run!`, `${name} bursts through the line for ${yards} yards!`]);
  }
  if (outcome.isFirstDown) {
    return pick(rng, [`${name} grinds out ${yards} yards and a first down.`, `${name} runs for ${yards} yards, enough to move the chains.`]);
  }
  return pick(rng, [`${name} runs for ${yards} yards.`, `${name} picks up ${yards} yards on the ground.`]);
}

interface Situation {
  down: number;
  distance: number;
  fieldPosition: number;
}

/** resolvePlay only ever handles offensive plays -- fieldGoal/spike are
 * handled directly in createDriveSession since they don't sample real
 * per-player situational data the way these do. */
export type OffensivePlayCall = Extract<PlayCall, { kind: "run" } | { kind: "designedRun" } | { kind: "pass" }>;

/**
 * Pure, stateless resolution of a single user-chosen play call into a
 * PlayResult (minus playNumber, which is a session-level concern). Handles
 * the QB-sack-then-scramble-then-target chain for pass calls, the same
 * goal-line yard-clamping/touchdown-coherence logic as before.
 */
export function resolvePlay(
  roster: DraftedRosterData,
  leagueAverageRates: Partial<Record<PlayerRole, AggregateRates>>,
  situation: Situation,
  call: OffensivePlayCall,
  rng: RNG
): Omit<PlayResult, "playNumber"> {
  const { down, distance, fieldPosition } = situation;
  const ctx = { down, distance, fieldPosition };

  let ballCarrierSlot: RosterSlotKey;
  let outcomeRole: PlayerRole;
  let dataset: PlayerDataset;
  let outcome: OutcomeRecord;
  let isScramble = false;

  if (call.kind === "run") {
    ballCarrierSlot = "rb";
    outcomeRole = "rusher";
    dataset = roster.rb;
    outcome = sampleOutcome(dataset, "rusher", ctx, leagueAverageRates, rng);
  } else if (call.kind === "designedRun") {
    ballCarrierSlot = "qb";
    outcomeRole = "rusher";
    dataset = roster.qb;
    outcome = sampleQbDesignedRun(dataset, ctx, leagueAverageRates, rng);
  } else {
    // Pass call: roll sack, then scramble, before resolving the chosen target.
    const sackOutcome = rollQbSackOutcome(roster.qb, ctx, leagueAverageRates, rng);
    if (sackOutcome) {
      ballCarrierSlot = "qb";
      outcomeRole = "passer";
      dataset = roster.qb;
      outcome = sackOutcome;
    } else {
      const scrambleOutcome = rollQbScrambleOutcome(roster.qb, ctx, leagueAverageRates, rng);
      if (scrambleOutcome) {
        ballCarrierSlot = "qb";
        outcomeRole = "rusher";
        dataset = roster.qb;
        outcome = scrambleOutcome;
        isScramble = true;
      } else {
        ballCarrierSlot = call.target;
        outcomeRole = "receiver";
        dataset = roster[call.target];
        const interception = rollBlendedInterception(roster.qb, dataset, call.depth, leagueAverageRates, rng);
        outcome = interception ?? sampleBlendedReceptionOutcome(roster.qb, dataset, ctx, call.depth, leagueAverageRates, rng);
      }
    }
  }

  // Bucket-sampled outcomes carry yardage from their original real-world field
  // position, which may not match the current drive's field position. Clamp
  // yards to what's actually available, and re-derive touchdown from whether
  // the (clamped) gain reaches the goal line -- the original isTouchdown flag
  // alone can't be trusted once yards are reclamped to a different distance.
  const canScore = !outcome.isTurnover && outcome.isComplete !== false;
  const reachesGoal = canScore && outcome.yards >= fieldPosition;
  const isTouchdown = canScore && (reachesGoal || outcome.isTouchdown);
  const clampedYards = isTouchdown ? fieldPosition : Math.min(outcome.yards, fieldPosition);
  const effectiveOutcome: OutcomeRecord = { ...outcome, yards: clampedYards, isTouchdown };

  const ballCarrierName = dataset.displayName;
  return {
    down,
    distance,
    fieldPosition,
    role: outcomeRole,
    ballCarrier: ballCarrierSlot,
    ballCarrierName,
    outcome: effectiveOutcome,
    description: describePlay(outcomeRole, ballCarrierName, effectiveOutcome.yards, effectiveOutcome, isScramble, rng, roster.qb.displayName),
  };
}

export interface DriveStepResult {
  play: PlayResult;
  status: "continue" | DriveEndReason;
}

function makeOutcome(partial: Partial<OutcomeRecord>): OutcomeRecord {
  return {
    yards: 0, isTouchdown: false, isTurnover: false, isSack: false,
    isComplete: null, isFirstDown: false, depthTier: null, isScramble: false,
    ...partial,
  };
}

/**
 * Based on absolute clock remaining at the moment of scoring, not a fraction
 * of that drive's own starting clock -- scoring with 0:00 left is always
 * maximally clutch, scoring with 2:00+ left never gets a bonus, regardless
 * of whether the scenario started at 1:00 or 10:00.
 */
function clutchMultiplier(clockAtScoreSeconds: number): number {
  const remainingFraction = Math.max(0, Math.min(1, clockAtScoreSeconds / CLUTCH_REFERENCE_SECONDS));
  return Math.min(2, Math.max(1, 1 + (1 - remainingFraction)));
}

/** Average overall rating across the drafted roster, mapped to a roster-strength
 * multiplier: lower-rated teams score more. */
function rosterMultiplierFor(roster: DraftedRosterData): number {
  const ratings = [roster.qb, roster.rb, roster.wr1, roster.wr2, roster.te, roster.k].map((p) => p.rating);
  const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  const clamped = Math.max(RATING_FLOOR, Math.min(RATING_CEIL, avg));
  const t = (RATING_CEIL - clamped) / (RATING_CEIL - RATING_FLOOR); // 0 at 99 OVR, 1 at 40 OVR
  return MIN_ROSTER_MULT + t * (MAX_ROSTER_MULT - MIN_ROSTER_MULT);
}

/**
 * Score is 0 on any loss. On a win, a touchdown is worth more than a field
 * goal, a weaker drafted roster (lower overall rating) multiplies the score up
 * (the upset/skill bonus), and scoring with less clock left multiplies it up
 * further (the clutch bonus). Returned itemized so the UI can show the
 * breakdown, not just the final total.
 */
function computeScore(endReason: DriveEndReason, roster: DraftedRosterData, clockAtScoreSeconds: number): ScoreBreakdown {
  const basePoints = endReason === "WIN_TOUCHDOWN" ? TOUCHDOWN_BASE_POINTS : endReason === "WIN_FIELD_GOAL" ? FIELD_GOAL_BASE_POINTS : 0;
  const baseLabel = endReason === "WIN_TOUCHDOWN" ? "Touchdown" : endReason === "WIN_FIELD_GOAL" ? "Field Goal" : "No Score";

  if (basePoints === 0) {
    return { basePoints, baseLabel, rosterMultiplier: 1, clockMultiplier: 1, total: 0 };
  }

  const rosterMultiplier = rosterMultiplierFor(roster);
  const clockMultiplier = clutchMultiplier(clockAtScoreSeconds);
  const total = Math.round(basePoints * rosterMultiplier * clockMultiplier);
  return { basePoints, baseLabel, rosterMultiplier, clockMultiplier, total };
}

/**
 * Stateful session driving one interactive drive: tracks down/distance/field
 * position/clock, offers 3 random play-call options at a time, and resolves
 * the user's choice into the next play. Field goal and spike calls are
 * always-available persistent options (see playOptions.ts) handled here
 * directly rather than through resolvePlay, since neither samples real
 * per-player situational data the way offensive plays do.
 */
export function createDriveSession(
  roster: DraftedRosterData,
  scenario: DriveScenario,
  leagueAverageRates: Partial<Record<PlayerRole, AggregateRates>>,
  leagueAverageKickerRates: Partial<Record<KickDistanceTier, KickerDistanceBucket>>,
  seed: number
) {
  const rng = makeRng(seed);
  let down = scenario.down;
  let distance = scenario.distance;
  let fieldPosition = scenario.fieldPosition;
  let clock = scenario.clockSeconds;
  let clockRunning = true; // a fresh mid-game scenario starts with a live clock
  let playNumber = 0;
  let endReason: DriveEndReason | null = null;
  const plays: PlayResult[] = [];
  const choices: DriveChoice[] = [];
  let currentOptions: PlayCall[] | null = null;

  function getOptions(): PlayCall[] {
    if (endReason) return [];
    if (!currentOptions) currentOptions = drawPlayOptions(rng);
    return currentOptions;
  }

  function pushPlay(partial: Omit<PlayResult, "playNumber">): PlayResult {
    playNumber += 1;
    const play: PlayResult = { ...partial, playNumber };
    plays.push(play);
    currentOptions = null;
    return play;
  }

  function randomInRange(range: { min: number; max: number }): number {
    return range.min + rng.next() * (range.max - range.min);
  }

  function chooseFieldGoal(): DriveStepResult {
    const kickDistance = kickDistanceFor(fieldPosition);
    const made = attemptFieldGoal(roster.k, kickDistance, leagueAverageKickerRates, rng);
    const outcome = makeOutcome({ isComplete: made, isTurnover: !made });
    const play = pushPlay({
      down, distance, fieldPosition,
      role: "kicker", ballCarrier: "k", ballCarrierName: roster.k.displayName,
      outcome,
      description: made
        ? `${roster.k.displayName} nails a ${kickDistance}-yard field goal! It's good!`
        : `${roster.k.displayName}'s ${kickDistance}-yard attempt is no good.`,
    });
    clock -= randomInRange(PLAY_DURATION_RANGE); // snap-hold-kick time, matters for the clutch score bonus below
    endReason = made ? "WIN_FIELD_GOAL" : "LOSS_MISSED_FIELD_GOAL";
    return { play, status: endReason };
  }

  function chooseSpike(): DriveStepResult {
    const outcome = makeOutcome({ isComplete: false });
    const play = pushPlay({
      down, distance, fieldPosition,
      role: "special", ballCarrier: "qb", ballCarrierName: roster.qb.displayName,
      outcome,
      description: `${roster.qb.displayName} spikes the ball to stop the clock.`,
    });
    clock -= SPIKE_RUNOFF_SECONDS;
    clockRunning = false;

    if (clock <= 0) {
      endReason = "LOSS_CLOCK_EXPIRED";
    } else if (down === 4) {
      endReason = "LOSS_TURNOVER_ON_DOWNS"; // spiking away your last down with no gain
    } else {
      down += 1;
    }
    return { play, status: endReason ?? "continue" };
  }

  function chooseOffensivePlay(call: OffensivePlayCall, manualTempoSeconds?: number): DriveStepResult {
    const resolved = resolvePlay(roster, leagueAverageRates, { down, distance, fieldPosition }, call, rng);
    const play = pushPlay(resolved);

    const { outcome } = play;
    const preSnapClockWasRunning = clockRunning;
    // Every play costs its own snap-to-whistle time, regardless of what
    // happens after the whistle.
    clock -= randomInRange(PLAY_DURATION_RANGE);
    if (outcome.isComplete === false) {
      // Incomplete pass or sack -- clock stops immediately, no further gap
      // before the next snap to account for (real-football clock pauses
      // during a dead-ball interval, however long the offense takes).
      clockRunning = false;
    } else {
      // Clock keeps running -- there's a real gap before the next snap,
      // either the player's chosen tempo or (lacking one) an automatic range.
      clock -= preSnapClockWasRunning && manualTempoSeconds !== undefined
        ? manualTempoSeconds
        : randomInRange(CLOCK_RUNOFF_RUNNING);
      clockRunning = true;
    }

    if (outcome.isTouchdown) {
      endReason = "WIN_TOUCHDOWN";
    } else if (outcome.isTurnover) {
      endReason = "LOSS_TURNOVER";
    } else if (clock <= 0) {
      endReason = "LOSS_CLOCK_EXPIRED";
    } else if (playNumber >= MAX_PLAYS_PER_DRIVE) {
      endReason = "LOSS_CLOCK_EXPIRED"; // defensive cap, should never realistically trigger
    } else {
      fieldPosition = Math.max(0, fieldPosition - outcome.yards);
      // Same reconciliation as the touchdown check above: outcome.isFirstDown
      // reflects whether the donor historical play converted at ITS OWN
      // original down/distance, which bucket relaxation may have pulled from
      // a much shorter distance-to-go than the current synthetic situation.
      // Trusting it here would make first downs (and therefore
      // turnover-on-downs) wildly over/under-fire -- yards vs. the current
      // distance is the only number that's actually consistent with this drive.
      const gainedFirstDown = outcome.yards >= distance;
      if (gainedFirstDown) {
        down = 1;
        distance = Math.min(10, fieldPosition);
      } else if (down === 4) {
        endReason = "LOSS_TURNOVER_ON_DOWNS";
      } else {
        down += 1;
        distance -= outcome.yards;
      }
    }

    return { play, status: endReason ?? "continue" };
  }

  function choosePlay(call: PlayCall, manualTempoSeconds?: number): DriveStepResult {
    if (endReason) throw new Error("Drive has already ended");
    // Record the raw input so (seed, choices, roster) can replay this drive.
    choices.push(manualTempoSeconds === undefined ? { call } : { call, tempoSeconds: manualTempoSeconds });
    if (call.kind === "fieldGoal") return chooseFieldGoal();
    if (call.kind === "spike") return chooseSpike();
    return chooseOffensivePlay(call, manualTempoSeconds);
  }

  function getLog(): DriveLog {
    if (!endReason) throw new Error("Drive has not ended yet");
    const won = endReason === "WIN_TOUCHDOWN" || endReason === "WIN_FIELD_GOAL";
    const clockSecondsRemaining = Math.max(0, Math.round(clock));
    const scoreBreakdown = computeScore(endReason, roster, Math.max(0, clock));
    return { plays, endReason, won, score: scoreBreakdown.total, scoreBreakdown, seed, choices, clockSecondsRemaining };
  }

  function getSituation(): DriveSituation {
    return { down, distance, fieldPosition, clockSeconds: Math.max(0, Math.round(clock)), clockRunning };
  }

  return { getOptions, choosePlay, getLog, getSituation };
}

export interface DriveSituation {
  down: number;
  distance: number;
  fieldPosition: number;
  clockSeconds: number;
  clockRunning: boolean;
}

export type DriveSession = ReturnType<typeof createDriveSession>;
