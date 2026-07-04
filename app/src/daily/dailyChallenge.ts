import { makeRng } from "../engine/rng";

// The daily rolls over at midnight US Eastern. America/New_York (not a fixed
// -05:00) so the boundary tracks EST/EDT automatically. Because we always
// resolve against this zone, every player worldwide computes the same "today".
const CHALLENGE_ZONE = "America/New_York";

/** The wall-clock date/time fields in Eastern for a given instant. */
function easternParts(now: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHALLENGE_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const hour = get("hour");
  return { year: get("year"), month: get("month"), day: get("day"), hour: hour === 24 ? 0 : hour, minute: get("minute"), second: get("second") };
}

/**
 * The Daily Challenge: everyone gets the same date-seeded draft pool + drive
 * seed, so it's a shared, comparable puzzle (you still draft and call the
 * plays). The challenge id is the Eastern date (YYYY-MM-DD) so there's one
 * canonical "today" that rolls over at midnight ET for every player.
 */
export function todaysChallengeId(now: Date = new Date()): string {
  const { year, month, day } = easternParts(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Stable 32-bit FNV-1a hash of a string -> unsigned seed. */
export function seedFromString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Seeded RNG (0..1) for drawing the day's shared draft options. */
export function dailyDraftRng(id: string): () => number {
  const rng = makeRng(seedFromString(`${id}:draft`));
  return () => rng.next();
}

/** The day's shared drive seed -- distinct from the draft seed so the draw and
 * the drive don't correlate. */
export function dailyDriveSeed(id: string): number {
  return seedFromString(`${id}:drive`);
}

/** "Jul 2, 2026" for display (the id is a plain calendar date). */
export function formatChallengeDate(id: string): string {
  return new Date(`${id}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Whole seconds until the next midnight ET (when the next drill unlocks). Off
 * by at most an hour on the two DST-change days; exact otherwise. */
export function secondsUntilNextChallenge(now: Date = new Date()): number {
  const { hour, minute, second } = easternParts(now);
  const elapsed = hour * 3600 + minute * 60 + second;
  return Math.max(0, 24 * 3600 - elapsed);
}
