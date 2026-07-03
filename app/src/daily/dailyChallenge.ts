import { makeRng } from "../engine/rng";

/**
 * The Daily Challenge: everyone gets the same date-seeded draft pool + drive
 * seed, so it's a shared, comparable puzzle (you still draft and call the
 * plays). The challenge id is the UTC date (YYYY-MM-DD) so there's one
 * canonical "today" worldwide regardless of the player's timezone.
 */
export function todaysChallengeId(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
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

/** "Jul 2, 2026" for display (interprets the id as a UTC date). */
export function formatChallengeDate(id: string): string {
  return new Date(`${id}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Whole seconds until the next UTC midnight (when the next drill unlocks). */
export function secondsUntilNextChallenge(now: Date = new Date()): number {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
}
