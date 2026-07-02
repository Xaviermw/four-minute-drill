import { createDriveSession, type DriveSession } from "../engine";
import type { Manifest } from "../types/player";
import type { DraftedRoster, DraftedRosterData } from "../types/roster";
import type { DriveScenario } from "../types/scenario";
import { loadKicker } from "./loadKicker";
import { loadPlayer } from "./loadPlayer";

// Every drive is the same do-or-die situation: 4:00 left, own 20, down by 3.
export const DEFAULT_SCENARIO: DriveScenario = {
  down: 1,
  distance: 10,
  fieldPosition: 80,
  clockSeconds: 240,
  scoreDiff: -3,
};

/**
 * Loads the full per-player datasets for a drafted roster (cached by gsisId,
 * so re-running this for the same roster -- e.g. "play again, same lineup"
 * -- doesn't re-fetch) and creates a fresh DriveSession against the default
 * scenario with a new random seed.
 */
export async function startDrive(
  roster: DraftedRoster,
  manifest: Manifest,
  seed?: number
): Promise<{ scenario: DriveScenario; session: DriveSession; seed: number }> {
  const [qb, rb, wr1, wr2, te, k] = await Promise.all([
    loadPlayer(roster.qb.gsisId),
    loadPlayer(roster.rb.gsisId),
    loadPlayer(roster.wr1.gsisId),
    loadPlayer(roster.wr2.gsisId),
    loadPlayer(roster.te.gsisId),
    loadKicker(roster.k.gsisId),
  ]);
  const rosterData: DraftedRosterData = { qb, rb, wr1, wr2, te, k };
  const resolvedSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
  const session = createDriveSession(
    rosterData,
    DEFAULT_SCENARIO,
    manifest.leagueAverageRates,
    manifest.leagueAverageKickerRates,
    resolvedSeed
  );
  return { scenario: DEFAULT_SCENARIO, session, seed: resolvedSeed };
}
