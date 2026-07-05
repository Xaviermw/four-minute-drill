import type { Manifest, ManifestPlayerEntry, Position } from "../types/player";
import type { DraftedRoster, RosterSlotKey } from "../types/roster";
import { decodeLineup, LINEUP_SLOT_ORDER } from "./lineupCode";

// Position each slot must resolve to -- guards against a tampered token that
// e.g. puts a kicker in the QB slot, which would break the drive engine.
const SLOT_POSITION: Record<RosterSlotKey, Position> = {
  qb: "QB",
  rb: "RB",
  wr1: "WR",
  wr2: "WR",
  te: "TE",
  k: "K",
};

/**
 * Reconstructs a drafted roster from six gsisIds in slot order, validating each
 * exists in the manifest and sits in a position-appropriate slot. Returns null
 * otherwise so callers can fall back to the normal draft flow.
 */
export function rosterFromIds(ids: Record<RosterSlotKey, string>, manifest: Manifest): DraftedRoster | null {
  const byId = new Map<string, ManifestPlayerEntry>(manifest.players.map((p) => [p.gsisId, p]));
  const roster = {} as DraftedRoster;
  for (const slot of LINEUP_SLOT_ORDER) {
    const entry = byId.get(ids[slot]);
    if (!entry || entry.position !== SLOT_POSITION[slot]) return null;
    roster[slot] = entry;
  }
  return roster;
}

/** Reconstructs a roster from a share token (see {@link rosterFromIds}). */
export function rosterFromToken(token: string, manifest: Manifest): DraftedRoster | null {
  const ids = decodeLineup(token);
  if (!ids) return null;
  return rosterFromIds(ids, manifest);
}

/** Reconstructs a roster from an ordered list of six gsisIds (qb..k). */
export function rosterFromIdList(idList: string[], manifest: Manifest): DraftedRoster | null {
  if (idList.length !== LINEUP_SLOT_ORDER.length) return null;
  const ids = {} as Record<RosterSlotKey, string>;
  LINEUP_SLOT_ORDER.forEach((slot, i) => {
    ids[slot] = idList[i];
  });
  return rosterFromIds(ids, manifest);
}

/** Reads the `?team=` token from a URL search string (defaults to the live one). */
export function readTeamToken(
  search: string = typeof window !== "undefined" ? window.location.search : ""
): string | null {
  return new URLSearchParams(search).get("team");
}

/** Strips the deep-link params (`team`, plus the ghost's `g`/`by`) from the
 * address bar once consumed, so a later normal draft doesn't re-trigger it. */
export function clearTeamParam(): void {
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  const url = new URL(window.location.href);
  url.searchParams.delete("team");
  url.searchParams.delete("g");
  url.searchParams.delete("by");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}
