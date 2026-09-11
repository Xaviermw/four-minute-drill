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
