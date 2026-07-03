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

const key = (id: string) => `fmd_daily_${id}`;

export function getDailyRecord(challengeId: string): DailyRecord | null {
  try {
    const raw = localStorage.getItem(key(challengeId));
    return raw ? (JSON.parse(raw) as DailyRecord) : null;
  } catch {
    return null;
  }
}

export function saveDailyRecord(rec: DailyRecord): void {
  try {
    localStorage.setItem(key(rec.challengeId), JSON.stringify(rec));
  } catch {
    /* ignore storage failures -- worst case the one-shot gate is skipped */
  }
}

export function markDailySubmitted(challengeId: string): void {
  const rec = getDailyRecord(challengeId);
  if (rec) saveDailyRecord({ ...rec, submitted: true });
}
