// Simulates real drives with the actual engine to seed the leaderboard for
// launch. Produces genuine, internally-consistent entries: real rosters (so
// "Play this lineup" works), real scores/outcomes/time-remaining, and real
// seed+choices. Writes JSON for the inserter to push. Run: `npx tsx scripts/seed-leaderboard.ts`
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDriveSession,
  kickDistanceFor,
  MANUAL_TEMPO_RANGE,
  MAX_REALISTIC_FIELD_GOAL_DISTANCE,
  type PlayCall,
} from "../src/engine";
import type { KickerDataset, Manifest, ManifestPlayerEntry, PlayerDataset, Position } from "../src/types/player";
import type { DraftedRosterData } from "../src/types/roster";

const DATA = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "data");
const manifest: Manifest = JSON.parse(readFileSync(resolve(DATA, "manifest.json"), "utf8"));
const load = (id: string) => JSON.parse(readFileSync(resolve(DATA, "players", `${id}.json`), "utf8"));

const byPos = (p: Position) => manifest.players.filter((x) => x.position === p);
const rand = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const SCENARIO = { down: 1, distance: 10, fieldPosition: 80, clockSeconds: 240, scoreDiff: -3 };

type Bias = "weak" | "stacked" | "any";

/** Picks from the bottom/top 45% by rating for weak/stacked, to spread team OVR
 * (and thus scores -- a weak team that scores gets a big multiplier). */
function pickAt(pool: ManifestPlayerEntry[], bias: Bias, exclude?: string): ManifestPlayerEntry {
  let p = pool.filter((x) => x.gsisId !== exclude);
  if (bias !== "any") {
    const sorted = [...p].sort((a, b) => a.rating - b.rating);
    const half = Math.max(1, Math.floor(sorted.length * 0.45));
    p = bias === "weak" ? sorted.slice(0, half) : sorted.slice(-half);
  }
  return rand(p);
}

function randomRoster(bias: Bias): ManifestPlayerEntry[] {
  const wrs = byPos("WR");
  const wr1 = pickAt(wrs, bias);
  const wr2 = pickAt(wrs, bias, wr1.gsisId);
  return [pickAt(byPos("QB"), bias), pickAt(byPos("RB"), bias), wr1, wr2, pickAt(byPos("TE"), bias), pickAt(byPos("K"), bias)];
}

const teamOvr = (r: ManifestPlayerEntry[]) => Math.round(r.reduce((s, p) => s + p.rating, 0) / r.length);

/** Runs one drive with a deliberately LOW-scoring strategy so real players can
 * set the top of the board: kick a field goal (base 40, not a TD's 100) as soon
 * as in range, snap quickly to leave the clock high (a smaller time bonus), and
 * lean on higher-OVR rosters (a smaller underdog multiplier). */
function simulate(bias: Bias) {
  const entries = randomRoster(bias);
  const [qb, rb, wr1, wr2, te, k] = entries.map((e) => load(e.gsisId)) as [
    PlayerDataset, PlayerDataset, PlayerDataset, PlayerDataset, PlayerDataset, KickerDataset
  ];
  const rosterData: DraftedRosterData = { qb, rb, wr1, wr2, te, k };
  const seed = Math.floor(Math.random() * 2 ** 31);
  const session = createDriveSession(rosterData, SCENARIO, manifest.leagueAverageRates, manifest.leagueAverageKickerRates, seed);

  for (let i = 0; i < 40; i++) {
    const sit = session.getSituation();
    const options = session.getOptions();
    if (options.length === 0) break;
    const inFgRange = kickDistanceFor(sit.fieldPosition) <= MAX_REALISTIC_FIELD_GOAL_DISTANCE;

    // Kick the moment it's a realistic attempt; otherwise grind out short
    // gains (run / short pass) to get into range. Quick snap keeps the clock up.
    let call: PlayCall;
    if (inFgRange) {
      call = { kind: "fieldGoal" };
    } else {
      call = options.find((o) => o.kind === "run") ?? options.find((o) => o.kind === "pass" && o.depth === "short") ?? options[0];
    }
    const { status } = session.choosePlay(call, sit.clockRunning ? MANUAL_TEMPO_RANGE.min : undefined);
    if (status !== "continue") break;
  }

  const log = session.getLog();
  return {
    entries,
    log,
    roster: entries.map((e) => ({ gsisId: e.gsisId, name: e.displayName, position: e.position, rating: e.rating })),
    team_ovr: teamOvr(entries),
  };
}

const SCORE_NAMES = [
  "GridironGoblin", "AudibleAndy", "PlayActionPat", "FourthDownFrank", "HailMaryHank", "PocketPete",
  "RedZoneRoyalty", "ChainMover", "TwoMinuteTina", "GunslingerGus", "CheckdownChad", "DeepBallDan",
  "ScrambleSam", "FieldGoalPhil", "UpsetSpecial", "BackupBaller", "TurfToeTony", "PuntGodPaul",
  "BlitzBrian", "SnapCountSue", "WildcatWes", "ClutchCarl", "OvertimeOllie", "Mr4thAnd1",
];

// Keep the seeded board modest so players top it. Cap well under the existing
// real entry ("StopPunting", 160) -- a handful may edge up near it, most sit low.
const SCORE_CAP = 145;
const biasFor = () => (Math.random() < 0.6 ? "stacked" : "any") as Bias;

// ---- Score board: keep low-scoring winners with a spread ----
const wins: ReturnType<typeof simulate>[] = [];
for (let i = 0; i < 800 && wins.length < 80; i++) {
  const r = simulate(biasFor());
  if (r.log.won && r.log.score > 0 && r.log.score <= SCORE_CAP) wins.push(r);
}
wins.sort((a, b) => a.log.score - b.log.score); // ascending: mostly low
// Spread across the low range rather than clustering.
const step = Math.max(1, Math.floor(wins.length / SCORE_NAMES.length));
const picked = wins.filter((_, i) => i % step === 0).slice(0, SCORE_NAMES.length);
const scores = picked.map((r, i) => ({
  name: SCORE_NAMES[i],
  score: r.log.score,
  outcome: r.log.endReason,
  team_ovr: r.team_ovr,
  time_remaining: r.log.clockSecondsRemaining,
  roster: r.roster,
  seed: r.log.seed,
  choices: r.log.choices,
}));

// ---- Streak board: each user plays a run of drives; bank points across wins ----
const STREAK_NAMES = [
  "StreakSeeker", "HotHandHarry", "ComboKing", "RunItBackRick", "MomentumMax", "OnFireOfelia",
  "BackToBackBo", "WinColumnWill", "DialedInDena", "HeaterHeidi", "RollingRoger", "UnstoppableUma",
];
// Short runs of low-scoring wins -> modest streak totals players can beat.
const streaks = STREAK_NAMES.map((name) => {
  let cur = 0, curWins = 0, bestPts = 0, bestWins = 0;
  const games = 2 + Math.floor(Math.random() * 4);
  for (let g = 0; g < games; g++) {
    const r = simulate(biasFor());
    if (r.log.won && r.log.score <= SCORE_CAP) {
      cur += r.log.score; curWins += 1;
      if (cur > bestPts) { bestPts = cur; bestWins = curWins; }
    } else {
      cur = 0; curWins = 0;
    }
  }
  return { name, best_points: bestPts, best_wins: bestWins };
}).filter((s) => s.best_points > 0);

const out = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "seed-data.json");
writeFileSync(out, JSON.stringify({ scores, streaks }, null, 2));
console.log(`Wrote ${scores.length} scores (${scores[scores.length - 1]?.score}-${scores[0]?.score} pts) + ${streaks.length} streaks -> ${out}`);
