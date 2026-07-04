/**
 * Wordle-style daily streak: how many days in a row you've *won* the daily
 * drill. Device-local (like the one-shot record) -- a personal retention hook,
 * not a competitive board. A daily loss doesn't record anything; the next win
 * simply sees a gap and resets to 1, which naturally breaks the run.
 */
interface DailyStreakStore {
  currentDays: number;
  bestDays: number;
  lastWinDate: string | null; // challenge id (ET date) of the last won daily
}

const KEY = "fmd_daily_streak";
const EMPTY: DailyStreakStore = { currentDays: 0, bestDays: 0, lastWinDate: null };

function read(): DailyStreakStore {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as DailyStreakStore) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

function write(s: DailyStreakStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore storage failures */
  }
}

/** The calendar date one day before the given challenge id (pure date math on
 * the id string -- timezone-independent). */
function prevDate(challengeId: string): string {
  const d = new Date(`${challengeId}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Records a daily win and returns the updated streak. Idempotent for the same
 * day (winning "again" via a return visit doesn't double-count). */
export function recordDailyWin(challengeId: string): DailyStreakStore {
  const s = read();
  let currentDays: number;
  if (s.lastWinDate === challengeId) currentDays = s.currentDays; // already counted today
  else if (s.lastWinDate === prevDate(challengeId)) currentDays = s.currentDays + 1; // consecutive
  else currentDays = 1; // fresh (or broken) streak
  const next: DailyStreakStore = {
    currentDays,
    bestDays: Math.max(s.bestDays, currentDays),
    lastWinDate: challengeId,
  };
  write(next);
  return next;
}

export type DailyStreakState = "active" | "ended" | "none";

/** The streak to display given today's outcome. Read-only. Call *after*
 * {@link recordDailyWin} on a win. */
export function dailyStreakDisplay(
  challengeId: string,
  won: boolean
): { days: number; best: number; state: DailyStreakState } {
  const s = read();
  if (won) return { days: s.currentDays, best: s.bestDays, state: "active" };
  // A loss today ends an active run (one that reached yesterday).
  if (s.lastWinDate === prevDate(challengeId) && s.currentDays > 0) {
    return { days: s.currentDays, best: s.bestDays, state: "ended" };
  }
  return { days: 0, best: s.bestDays, state: "none" };
}
