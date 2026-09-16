// The 2026 Season and its NFL weeks -- pure date math shared by the app and
// Coach Bot (scripts/daily-bot.ts), so it must stay free of browser and Vite
// imports. The window constants are mirrored in the season_totals (011) and
// weekly_totals (017) views: change them together.

export const SEASON_START = "2026-09-10"; // opening night, a Thursday
export const SEASON_END = "2027-01-05";
export const SEASON_LABEL = "2026 Season";
const WEEK_DAYS = 7;

export function isSeasonLive(challengeId: string): boolean {
  return challengeId >= SEASON_START && challengeId <= SEASON_END;
}

const DAY_MS = 86_400_000;

/** Days from opening day to `id` (negative before the season). Calendar math
 * in UTC on the plain ISO dates, so a clock change never moves a boundary. */
function daysFromOpening(id: string): number {
  return Math.round((Date.parse(`${id}T00:00:00Z`) - Date.parse(`${SEASON_START}T00:00:00Z`)) / DAY_MS);
}

function addDays(id: string, days: number): string {
  return new Date(Date.parse(`${id}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** First day (a Thursday) of the NFL week containing `id`: weeks run Thursday
 * to Wednesday, opening night included. */
export function weekStartFor(id: string): string {
  return addDays(SEASON_START, Math.floor(daysFromOpening(id) / WEEK_DAYS) * WEEK_DAYS);
}

/** Last day of the week starting `weekStart`, clamped to the season's end. */
export function weekEndFor(weekStart: string): string {
  const end = addDays(weekStart, WEEK_DAYS - 1);
  return end > SEASON_END ? SEASON_END : end;
}

/** 1-based NFL week number of the week starting `weekStart`. */
export function weekNumberFor(weekStart: string): number {
  return Math.floor(daysFromOpening(weekStart) / WEEK_DAYS) + 1;
}

/** The most recently COMPLETED week as of `id` (its start), or null while
 * week 1 is still running. On a Thursday morning that is the week that ended
 * at midnight -- the one Coach Bot announces. */
export function lastCompletedWeekStart(id: string): string | null {
  const prev = addDays(weekStartFor(id), -WEEK_DAYS);
  return prev >= SEASON_START ? prev : null;
}

/** "Sep 17–23", or "Dec 31 – Jan 5" when the week straddles a month. */
export function weekLabel(weekStart: string): string {
  const fmt = (id: string, withMonth: boolean) =>
    new Date(`${id}T00:00:00Z`).toLocaleDateString("en-US", {
      timeZone: "UTC",
      day: "numeric",
      ...(withMonth ? { month: "short" } : {}),
    });
  const end = weekEndFor(weekStart);
  return weekStart.slice(0, 7) === end.slice(0, 7)
    ? `${fmt(weekStart, true)}–${fmt(end, false)}`
    : `${fmt(weekStart, true)} – ${fmt(end, true)}`;
}
