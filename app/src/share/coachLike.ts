import { kickDistanceFor, MAX_REALISTIC_FIELD_GOAL_DISTANCE } from "../engine";
import type { DriveLog } from "../types/simResult";
import { COACHES, type CoachTendency } from "./coachTendencies.generated";

/**
 * "Called it like Dan Campbell" -- which real head coach a finished drive's
 * play-calling most resembles. A toy on purpose (four tendencies, nearest
 * neighbour), framed as a compliment or neutral, never a dig. The coach table
 * is computed from nflverse play-by-play by the pipeline; nothing here is
 * typed in from memory.
 *
 * Fingerprint of the drive, each on the coach table's own scale:
 *   passRate  pass calls / (pass + run calls)
 *   deepRate  deep calls / pass calls (null when the drive never threw)
 *   fourthGo  on 4th downs where a field goal was realistic, share that
 *             went for it (null when no such decision came up)
 *   urgency   from the chosen tempo: 15s snaps = 1, 35s = 0 (auto = middle)
 *
 * Matching happens in rank space: a value is placed by the share of coaches
 * below it, so a 70% pass rate means "passes more than N% of coaches", and
 * urgency (a different quantity from the coaches' no-huddle share) compares
 * rank-to-rank. Euclidean distance over the available features; ties go to
 * the alphabetically first name so the pick is deterministic.
 */
const MIN_CALLS = 3; // fewer than three offensive calls is not a tendency

interface Fingerprint {
  passRate: number;
  deepRate: number | null;
  fourthGo: number | null;
  urgency: number;
}

export function fingerprintDrive(driveLog: DriveLog): Fingerprint | null {
  let passes = 0;
  let runs = 0;
  let deep = 0;
  let fourthDecisions = 0;
  let fourthGoes = 0;
  let tempoSum = 0;
  let tempoN = 0;
  const n = Math.min(driveLog.choices.length, driveLog.plays.length);
  for (let i = 0; i < n; i++) {
    const { call, tempoSeconds } = driveLog.choices[i];
    const play = driveLog.plays[i];
    const offensive = call.kind !== "fieldGoal" && call.kind !== "spike";
    if (offensive) {
      if (call.kind === "pass") {
        passes++;
        if (call.depth === "deep") deep++;
      } else runs++;
      // Tempo is chosen after a completed play; auto-runoff counts as the middle.
      tempoSum += tempoSeconds ?? 25;
      tempoN++;
    }
    if (play.down === 4 && kickDistanceFor(play.fieldPosition) <= MAX_REALISTIC_FIELD_GOAL_DISTANCE) {
      fourthDecisions++;
      if (offensive) fourthGoes++;
    }
  }
  const calls = passes + runs;
  if (calls < MIN_CALLS) return null;
  return {
    passRate: passes / calls,
    deepRate: passes > 0 ? deep / passes : null,
    fourthGo: fourthDecisions > 0 ? fourthGoes / fourthDecisions : null,
    urgency: tempoN > 0 ? Math.min(1, Math.max(0, (35 - tempoSum / tempoN) / 20)) : 0.5,
  };
}

/** Share of `sorted` strictly below `v` (0-1): a value's rank among coaches. */
function rankOf(v: number, sorted: number[]): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return sorted.length ? lo / sorted.length : 0.5;
}

export function coachLike(driveLog: DriveLog, table: CoachTendency[] = COACHES): CoachTendency | null {
  const fp = fingerprintDrive(driveLog);
  if (!fp || table.length === 0) return null;
  const asc = (k: keyof CoachTendency) => table.map((c) => c[k] as number).sort((a, b) => a - b);
  const passSorted = asc("passRate");
  const deepSorted = asc("deepRate");
  const fourthSorted = asc("fourthGo");
  const huddleSorted = asc("noHuddle");

  // The drive's position in each coach distribution.
  const target = {
    pass: rankOf(fp.passRate, passSorted),
    deep: fp.deepRate === null ? null : rankOf(fp.deepRate, deepSorted),
    fourth: fp.fourthGo === null ? null : rankOf(fp.fourthGo, fourthSorted),
    urgency: fp.urgency,
  };

  let best: CoachTendency | null = null;
  let bestDist = Infinity;
  for (const c of [...table].sort((a, b) => a.name.localeCompare(b.name))) {
    let d = (rankOf(c.passRate, passSorted) - target.pass) ** 2;
    if (target.deep !== null) d += (rankOf(c.deepRate, deepSorted) - target.deep) ** 2;
    // Fourth-down samples are small on both sides -- half weight.
    if (target.fourth !== null) d += 0.5 * (rankOf(c.fourthGo, fourthSorted) - target.fourth) ** 2;
    d += 0.5 * (rankOf(c.noHuddle, huddleSorted) - target.urgency) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}
