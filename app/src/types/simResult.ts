import type { PlayCall } from "../engine/playOptions";
import type { OutcomeRecord, PlayerRole } from "./player";
import type { RosterSlotKey } from "./roster";

/** A user's input on a single down: the play they called plus, when the clock
 * was running, the snap tempo they chose. (seed, choices) + the roster fully
 * reproduce a drive deterministically -- used for share links and leaderboard
 * verification/replay. */
export interface DriveChoice {
  call: PlayCall;
  tempoSeconds?: number;
}

export interface PlayResult {
  playNumber: number;
  down: number;
  distance: number;
  fieldPosition: number;
  role: PlayerRole | "kicker" | "special";
  ballCarrier: RosterSlotKey;
  ballCarrierName: string;
  outcome: OutcomeRecord;
  description: string;
  /** Set on the play whose clock crossing triggered the (once-per-drive)
   * two-minute warning. Additive -- absent on older logs. */
  twoMinuteWarning?: boolean;
}

export type DriveEndReason =
  | "WIN_TOUCHDOWN"
  | "WIN_FIELD_GOAL"
  | "LOSS_TURNOVER"
  | "LOSS_TURNOVER_ON_DOWNS"
  | "LOSS_CLOCK_EXPIRED"
  | "LOSS_MISSED_FIELD_GOAL";

export interface ScoreBreakdown {
  basePoints: number;
  baseLabel: string; // "Touchdown" | "Field Goal" | "No Score"
  rosterMultiplier: number;
  clockMultiplier: number;
  /** Net yards the drive advanced (only credited on a scoreless drive). */
  driveYards: number;
  /** Marginal points from those yards, before the roster multiplier. */
  drivePoints: number;
  total: number;
}

export interface DriveLog {
  plays: PlayResult[];
  endReason: DriveEndReason;
  won: boolean;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  /** Seed + ordered choices fully reproduce this drive given the roster. */
  seed: number;
  choices: DriveChoice[];
  /** Game clock (seconds) left when the drive ended -- what's shown on the
   * leaderboard and what feeds the time bonus. 0 if the clock expired. */
  clockSecondsRemaining: number;
}

/** Yards-to-end-zone where the drive finally came to rest (0 = reached the end
 * zone). Derived from the last play so every surface -- recap, daily summary,
 * the "longest drives" board -- agrees on how far the drive got. Defaults to
 * midfield for the degenerate empty-drive case. */
export function finalFieldPosition(log: DriveLog): number {
  const last = log.plays[log.plays.length - 1];
  if (!last) return 50;
  return Math.max(0, last.fieldPosition - last.outcome.yards);
}
