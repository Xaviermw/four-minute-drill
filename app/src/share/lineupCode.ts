import type { DraftedRoster, RosterSlotKey } from "../types/roster";

/**
 * Encodes/decodes a drafted lineup as a compact, URL-safe token used in the
 * share link's `?team=` param so a friend's browser can reconstruct the exact
 * same 6 players.
 *
 * Every curated gsisId is canonical nflverse form `00-00#####` (a 5-digit
 * suffix). We pack the six suffixes, in fixed slot order, into one 30-digit
 * string -- shorter and cleaner in a URL than base64-encoding the raw ids, and
 * fully reversible. A non-canonical id (none today) makes encoding return null
 * so the share UI can degrade instead of emitting a broken link.
 */

// qb, rb, wr1, wr2, te, k -- the order the token's six 5-digit groups appear in.
export const LINEUP_SLOT_ORDER: RosterSlotKey[] = ["qb", "rb", "wr1", "wr2", "te", "k"];

const CANONICAL = /^00-00(\d{5})$/;
const SUFFIX_LEN = 5;

function toSuffix(gsisId: string): string | null {
  const m = CANONICAL.exec(gsisId);
  return m ? m[1] : null;
}

function fromSuffix(suffix: string): string {
  return `00-00${suffix}`;
}

/** Returns the 30-digit token, or null if any id isn't canonical. */
export function encodeLineup(roster: DraftedRoster): string | null {
  const groups: string[] = [];
  for (const slot of LINEUP_SLOT_ORDER) {
    const suffix = toSuffix(roster[slot].gsisId);
    if (suffix === null) return null;
    groups.push(suffix);
  }
  return groups.join("");
}

/**
 * Parses a token back into the six gsisIds in slot order. Returns null for any
 * malformed token (wrong length, non-digit) so callers can fall back to the
 * normal draft flow. Does NOT verify the ids exist in the manifest -- that's
 * the caller's job when it tries to load them.
 */
export function decodeLineup(token: string): Record<RosterSlotKey, string> | null {
  if (!/^\d{30}$/.test(token)) return null;
  const result = {} as Record<RosterSlotKey, string>;
  for (let i = 0; i < LINEUP_SLOT_ORDER.length; i++) {
    const suffix = token.slice(i * SUFFIX_LEN, (i + 1) * SUFFIX_LEN);
    result[LINEUP_SLOT_ORDER[i]] = fromSuffix(suffix);
  }
  return result;
}
