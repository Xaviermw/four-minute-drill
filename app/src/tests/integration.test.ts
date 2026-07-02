import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createDriveSession } from "../engine/driveSimulator";
import type { KickerDataset, Manifest, PlayerDataset } from "../types/player";
import type { DraftedRosterData } from "../types/roster";
import type { DriveLog } from "../types/simResult";

const DATA_DIR = resolve(__dirname, "../../public/data");

function loadPlayer(gsisId: string): PlayerDataset {
  return JSON.parse(readFileSync(resolve(DATA_DIR, "players", `${gsisId}.json`), "utf-8"));
}

function loadKicker(gsisId: string): KickerDataset {
  return JSON.parse(readFileSync(resolve(DATA_DIR, "players", `${gsisId}.json`), "utf-8"));
}

const manifest: Manifest = JSON.parse(readFileSync(resolve(DATA_DIR, "manifest.json"), "utf-8"));
// 6:00, matching the app's real default scenario.
const scenario = { down: 1, distance: 10, fieldPosition: 75, clockSeconds: 360, scoreDiff: -3 };

/** Drives a session to completion, cycling through the offered options each down. */
function runToCompletion(roster: DraftedRosterData, seed: number): DriveLog {
  const session = createDriveSession(roster, scenario, manifest.leagueAverageRates, manifest.leagueAverageKickerRates, seed);
  let playNumber = 0;
  while (true) {
    const options = session.getOptions();
    const { status } = session.choosePlay(options[playNumber % options.length]);
    playNumber += 1;
    if (status !== "continue" || playNumber > 40) break;
  }
  return session.getLog();
}

describe("integration: real pre-baked data", () => {
  it("loads real player JSON with the expected shape, including depth tiers and scramble data", () => {
    const mahomes = loadPlayer("00-0033873");
    expect(mahomes.displayName).toBe("Patrick Mahomes");
    expect(mahomes.position).toBe("QB");
    expect(mahomes.buckets.passer?.length).toBeGreaterThan(0);
    expect(mahomes.aggregates.passer?.sampleSize).toBeGreaterThan(0);
    expect(mahomes.aggregates.passer?.scrambleRate).toBeGreaterThan(0);

    const byDepth = mahomes.aggregates.passer?.byDepth;
    expect(byDepth?.short?.completionPct).toBeGreaterThan(byDepth?.deep?.completionPct ?? 0);
    expect(byDepth?.deep?.yardsPerAttempt).toBeGreaterThan(byDepth?.short?.yardsPerAttempt ?? 0);
  });

  it("loads real kicker JSON with make% decreasing as distance increases", () => {
    const tucker = loadKicker("00-0029597");
    expect(tucker.displayName).toBe("Justin Tucker");
    expect(tucker.totalAttempts).toBeGreaterThan(0);
    const under30 = tucker.distanceBuckets.under30?.makePct ?? 0;
    const fifties = tucker.distanceBuckets["50s"]?.makePct ?? 0;
    expect(under30).toBeGreaterThan(fifties);
  });

  it("runs a full interactive drive session against real players (star roster) without throwing, across many seeds", () => {
    const roster: DraftedRosterData = {
      qb: loadPlayer("00-0033873"), // Mahomes
      rb: loadPlayer("00-0033280"), // McCaffrey
      wr1: loadPlayer("00-0033040"), // Tyreek Hill
      wr2: loadPlayer("00-0031381"), // Davante Adams
      te: loadPlayer("00-0030506"), // Kelce
      k: loadKicker("00-0029597"), // Justin Tucker
    };

    let wins = 0;
    const trials = 100;
    for (let seed = 0; seed < trials; seed++) {
      const log = runToCompletion(roster, seed);
      expect(log.plays.length).toBeGreaterThan(0);
      if (log.won) wins++;
    }
    expect(wins).toBeGreaterThan(0);
    expect(wins).toBeLessThan(trials);
  });

  it("star roster wins more often than a scrub roster on the same scenario", () => {
    const starRoster: DraftedRosterData = {
      qb: loadPlayer("00-0033873"), // Mahomes
      rb: loadPlayer("00-0033280"), // McCaffrey
      wr1: loadPlayer("00-0033040"), // Tyreek Hill
      wr2: loadPlayer("00-0031381"), // Davante Adams
      te: loadPlayer("00-0030506"), // Kelce
      k: loadKicker("00-0029597"), // Justin Tucker
    };
    const scrubRoster: DraftedRosterData = {
      qb: loadPlayer("00-0030520"), // Mike Glennon
      rb: loadPlayer("00-0034164"), // Trenton Cannon
      wr1: loadPlayer("00-0031326"), // Bruce Ellington
      wr2: loadPlayer("00-0033562"), // Ryan Switzer
      te: loadPlayer("00-0033611"), // Ricky Seals-Jones
      k: loadKicker("00-0033102"), // Roberto Aguayo
    };

    const trials = 150;
    let starWins = 0;
    let scrubWins = 0;
    for (let seed = 0; seed < trials; seed++) {
      if (runToCompletion(starRoster, seed).won) starWins++;
      if (runToCompletion(scrubRoster, seed + 10_000).won) scrubWins++;
    }
    expect(starWins).toBeGreaterThan(scrubWins);
  });
});
