import { ALL_PLAY_CALLS, createDriveSession, MANUAL_TEMPO_RANGE, playCallKey, type PlayCall } from "../engine";
import { DEFAULT_SCENARIO } from "../data/startDrive";
import { loadKicker } from "../data/loadKicker";
import { loadPlayer } from "../data/loadPlayer";
import { isNameAllowed } from "../leaderboard/nameFilter";
import type { Manifest } from "../types/player";
import type { DraftedRoster, DraftedRosterData } from "../types/roster";
import type { DriveChoice, DriveEndReason, DriveLog } from "../types/simResult";

/**
 * Ghost racing: a share link carries the sharer's actual drive -- (seed,
 * ordered choices) -- which, with the lineup, deterministically reproduces
 * every play. The receiver races that drive clock-synced on their own field.
 *
 * Wire format (URL-safe, all base36):  g=1.<seed>.<score>.<choices>
 * where each choice is two chars: call index into CALL_ORDER, then tempo
 * ('-' when none, else tempo - MANUAL_TEMPO_RANGE.min). The claimed score is
 * an integrity check: if replaying against current data doesn't reproduce it
 * (e.g. the datasets changed since the share), the ghost is dropped and the
 * link degrades to the plain "beat their score" flow. Never show a wrong ghost.
 */

// Canonical call enumeration. Order is part of the wire format -- APPEND-ONLY,
// never reorder: indexes 0-12 are the legacy palette (old links must keep
// decoding), 13-14 are the coverage-era gap runs.
const CALL_ORDER: PlayCall[] = [
  ...ALL_PLAY_CALLS,
  { kind: "fieldGoal" },
  { kind: "spike" },
  { kind: "runInside" },
  { kind: "runOutside" },
];
const CALL_INDEX = new Map(CALL_ORDER.map((c, i) => [playCallKey(c), i]));

const VERSION = "1";

/** One moment of the ghost's drive: where their ball was at a given clock. */
export interface GhostStep {
  clockSeconds: number;
  fieldPosition: number;
}

export interface GhostDrive {
  name: string | null;
  score: number;
  won: boolean;
  endReason: DriveEndReason;
  clockSecondsRemaining: number;
  /** Post-play states, newest last; step 0 is the pre-drive spot. */
  timeline: GhostStep[];
}

/** Encodes a finished drive as the `g=` share param, or null if any choice
 * can't be represented (shouldn't happen; belt-and-suspenders). */
export function encodeGhostParam(driveLog: DriveLog): string | null {
  if (driveLog.choices.length === 0) return null;
  let choicesPart = "";
  for (const c of driveLog.choices) {
    const idx = CALL_INDEX.get(playCallKey(c.call));
    if (idx === undefined) return null;
    choicesPart += idx.toString(36);
    if (c.tempoSeconds === undefined) choicesPart += "-";
    else {
      const t = Math.round(c.tempoSeconds) - MANUAL_TEMPO_RANGE.min;
      if (t < 0 || t >= 36) return null;
      choicesPart += t.toString(36);
    }
  }
  return [VERSION, driveLog.seed.toString(36), driveLog.score.toString(36), choicesPart].join(".");
}

export interface ParsedGhost {
  seed: number;
  claimedScore: number;
  choices: DriveChoice[];
  name: string | null;
}

/** Parses `g=` (and the optional `by=` name) from a search string. Returns
 * null on any malformed input -- the link then behaves like a plain team link. */
export function parseGhostParam(search: string = typeof window !== "undefined" ? window.location.search : ""): ParsedGhost | null {
  const params = new URLSearchParams(search);
  const raw = params.get("g");
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;

  const seed = parseInt(parts[1], 36);
  const claimedScore = parseInt(parts[2], 36);
  const body = parts[3];
  if (!Number.isFinite(seed) || !Number.isFinite(claimedScore) || body.length === 0 || body.length % 2 !== 0) return null;

  const choices: DriveChoice[] = [];
  for (let i = 0; i < body.length; i += 2) {
    const idx = parseInt(body[i], 36);
    const call = CALL_ORDER[idx];
    if (!call) return null;
    const tempoChar = body[i + 1];
    if (tempoChar === "-") choices.push({ call });
    else {
      const t = parseInt(tempoChar, 36);
      if (!Number.isFinite(t)) return null;
      choices.push({ call, tempoSeconds: t + MANUAL_TEMPO_RANGE.min });
    }
  }

  const rawName = (params.get("by") ?? "").trim().slice(0, 20);
  const name = rawName && isNameAllowed(rawName) ? rawName : null;
  return { seed, claimedScore, choices, name };
}

/**
 * Pure replay core: runs (roster data, seed, choices) through the engine and
 * captures the clock/position timeline. CRITICAL: getOptions() is called
 * before every choosePlay -- drawing options consumes RNG, and skipping it
 * desyncs the replay from the original drive.
 */
export function replayDriveCore(
  roster: DraftedRosterData,
  manifest: Pick<Manifest, "leagueAverageRates" | "leagueAverageKickerRates">,
  seed: number,
  choices: DriveChoice[]
): { log: DriveLog; timeline: GhostStep[] } | null {
  try {
    const session = createDriveSession(roster, DEFAULT_SCENARIO, manifest.leagueAverageRates, manifest.leagueAverageKickerRates, seed);
    const timeline: GhostStep[] = [{ clockSeconds: DEFAULT_SCENARIO.clockSeconds, fieldPosition: DEFAULT_SCENARIO.fieldPosition }];
    let ended = false;
    for (const c of choices) {
      if (ended) return null; // choices continue past the drive's end -> corrupt
      session.getOptions();
      const { status } = session.choosePlay(c.call, c.tempoSeconds);
      const s = session.getSituation();
      timeline.push({ clockSeconds: s.clockSeconds, fieldPosition: s.fieldPosition });
      ended = status !== "continue";
    }
    if (!ended) return null; // ran out of choices before the drive ended
    const log = session.getLog();
    // A touchdown's final spot is the end zone, clearer on the field than the
    // pre-snap position getSituation reports.
    if (log.endReason === "WIN_TOUCHDOWN") timeline[timeline.length - 1].fieldPosition = 0;
    return { log, timeline };
  } catch {
    return null; // illegal choice sequence (e.g. FG from out of range)
  }
}

/** Loads the lineup's datasets (cached; the deep link already fetched them)
 * and replays the ghost. Null if the replay fails or doesn't reproduce the
 * claimed score (data drift since the share). */
export async function replayGhost(
  roster: DraftedRoster,
  manifest: Manifest,
  parsed: ParsedGhost
): Promise<GhostDrive | null> {
  try {
    const [qb, rb, wr1, wr2, te, k] = await Promise.all([
      loadPlayer(roster.qb.gsisId),
      loadPlayer(roster.rb.gsisId),
      loadPlayer(roster.wr1.gsisId),
      loadPlayer(roster.wr2.gsisId),
      loadPlayer(roster.te.gsisId),
      loadKicker(roster.k.gsisId),
    ]);
    const data: DraftedRosterData = { qb, rb, wr1, wr2, te, k };
    const replayed = replayDriveCore(data, manifest, parsed.seed, parsed.choices);
    if (!replayed || replayed.log.score !== parsed.claimedScore) return null;
    const { log, timeline } = replayed;
    return {
      name: parsed.name,
      score: log.score,
      won: log.won,
      endReason: log.endReason,
      clockSecondsRemaining: log.clockSecondsRemaining,
      timeline,
    };
  } catch {
    return null;
  }
}

/** The ghost's state at a given game clock: their latest step at-or-before
 * that moment (both drives start from the same 4:00). */
export function ghostStepAtClock(ghost: GhostDrive, clockSeconds: number): GhostStep {
  let current = ghost.timeline[0];
  for (const step of ghost.timeline) {
    if (step.clockSeconds >= clockSeconds) current = step;
    else break;
  }
  return current;
}

/** True once the ghost's whole drive has already happened at this clock. */
export function ghostDoneAtClock(ghost: GhostDrive, clockSeconds: number): boolean {
  return ghost.timeline[ghost.timeline.length - 1].clockSeconds >= clockSeconds;
}
