import type { DriveLog } from "../types/simResult";

/** What we remember about a player's completed daily drill (device-local). Used
 * to enforce the one-shot-per-day rule and to render the "done" screen (with
 * share) on a return visit. */
export interface DailyRecord {
  challengeId: string;
  driveLog: DriveLog;
  rosterIds: string[]; // six gsisIds in slot order (qb..k), to rebuild for sharing
  submitted: boolean;
}

/** Exported so a tab can recognize ANOTHER tab banking today's drill (storage event). */
export const dailyRecordKey = (id: string) => `fmd_daily_${id}`;

export function getDailyRecord(challengeId: string): DailyRecord | null {
  try {
    const raw = localStorage.getItem(dailyRecordKey(challengeId));
    return raw ? (JSON.parse(raw) as DailyRecord) : null;
  } catch {
    return null;
  }
}

export function saveDailyRecord(rec: DailyRecord): void {
  try {
    localStorage.setItem(dailyRecordKey(rec.challengeId), JSON.stringify(rec));
  } catch {
    /* ignore storage failures -- worst case the one-shot gate is skipped */
  }
}

export function markDailySubmitted(challengeId: string): void {
  const rec = getDailyRecord(challengeId);
  if (rec) saveDailyRecord({ ...rec, submitted: true });
}

/** Is `a` the same drive as `b`? A stored record holds the JSON round-trip of
 * the drive that banked it, so comparing serialized logs identifies it exactly. */
export function isSameDrive(a: DriveLog, b: DriveLog): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// How many daily drives this device has STARTED today. The one-shot rule counts
// FINISHED drives, so a player can bail mid-drive (reload, or switch modes) and
// draft again; posting this count is how we measure whether anyone actually does
// (owner call 2026-09-12: measure, don't police).
const triesKey = (id: string) => `fmd_daily_tries_${id}`;

/** Records the start of a daily drive; returns which attempt of the day it is. */
export function countDailyStart(challengeId: string): number {
  const next = dailyTries(challengeId) + 1;
  try {
    localStorage.setItem(triesKey(challengeId), String(next));
  } catch {
    /* ignore -- the metric is best-effort, the game is not */
  }
  return next;
}

/** Daily drives started today on this device; 0 when unknown. */
export function dailyTries(challengeId: string): number {
  try {
    const raw = Number(localStorage.getItem(triesKey(challengeId)));
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  } catch {
    return 0;
  }
}
