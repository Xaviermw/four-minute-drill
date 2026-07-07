/**
 * BALANCE SIM — salary-cap draft (docs/cap-draft-plan.md).
 *
 * Prices players $1–$10 (percentile mode adds the $0 scrub tier: bottom ~20%
 * per position, never dealt, assigned at random via "give me a scrub"), deals
 * the existing 3-options-per-slot draft under a hard cap, drafts with several
 * spending strategies, runs real drives through the actual engine, and
 * compares EV under different leftover-budget rewards. The approved spec is
 * percentile pricing, cap $25, no leftover reward ("bonus0").
 *
 * Run:   npx tsx scripts/sim-cap-draft.ts [trials] [cap] [payoutFloor] [pricing] [scoring]
 * Spec:  npx tsx scripts/sim-cap-draft.ts 2000 25 18 percentile bonus0
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
import { createDriveSession, kickDistanceFor, MAX_REALISTIC_FIELD_GOAL_DISTANCE, makeRng } from "../src/engine";
import type { KickerDataset, Manifest, ManifestPlayerEntry, PlayerDataset, Position } from "../src/types/player";
import type { DraftedRosterData, RosterSlotKey } from "../src/types/roster";
import { pickRandom3 } from "../src/draft/draftPool";

// ---- Tunables (args: trials cap payoutFloor pricing) ----
const TRIALS = Number(process.argv[2] ?? 1500);
const CAP = Number(process.argv[3] ?? 25);
const MIN_SPEND = Number(process.argv[4] ?? 6); // spend at/below this earns the max x2.0 payout
const PRICING = (process.argv[5] ?? "linear") as "linear" | "percentile";
// Scoring mode: "payout" = leftover budget -> x1..x2 multiplier;
// "bonusN" = score + N pts per unspent dollar (no roster multiplier at all).
const SCORING = process.argv[6] ?? "payout";
const BONUS_PER_DOLLAR = SCORING.startsWith("bonus") ? Number(SCORING.slice(5)) : 0;
const PRICE_MIN = 1;
const PRICE_MAX = 10;
const SCENARIO = { down: 1, distance: 10, fieldPosition: 80, clockSeconds: 240, scoreDiff: -3 };

/** Leftover budget -> payout, mirroring today's x1.0..x2.0 linear shape. */
function capPayout(spent: number): number {
  const t = (CAP - Math.min(CAP, spent)) / (CAP - MIN_SPEND);
  return 1 + Math.max(0, Math.min(1, t));
}

// ---- Data ----
const DATA = join(__dirname, "..", "public", "data");
const manifest = JSON.parse(readFileSync(join(DATA, "manifest.json"), "utf8")) as Manifest;
const datasetCache = new Map<string, PlayerDataset | KickerDataset>();
function loadDataset(gsisId: string): PlayerDataset | KickerDataset {
  let d = datasetCache.get(gsisId);
  if (!d) {
    d = JSON.parse(readFileSync(join(DATA, "players", `${gsisId}.json`), "utf8"));
    datasetCache.set(gsisId, d!);
  }
  return d!;
}

// ---- Pricing: $1..$10 linear in rating within each position ----
const priceById = new Map<string, number>();
const scrubIds = new Set<string>();
for (const pos of ["QB", "RB", "WR", "TE", "K"] as Position[]) {
  const group = [...manifest.players.filter((p) => p.position === pos)].sort(
    (a, b) => a.rating - b.rating || (a.gsisId < b.gsisId ? -1 : 1)
  );
  const ratings = group.map((p) => p.rating);
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  // $0 scrub tier (spec): bottom max(3, 20%) never appear among dealt options;
  // they're only reachable via the "give me a scrub" gamble.
  const scrubCount = PRICING === "percentile" ? Math.max(3, Math.floor(group.length * 0.2)) : 0;
  group.forEach((p, idx) => {
    if (idx < scrubCount) {
      priceById.set(p.gsisId, 0);
      scrubIds.add(p.gsisId);
      return;
    }
    const i = idx - scrubCount;
    const m = group.length - scrubCount;
    // linear: price tracks the rating value. percentile: price tracks rank, so
    // tags spread evenly $1..$10 regardless of how ratings cluster.
    const t = PRICING === "percentile" ? (m === 1 ? 1 : i / (m - 1)) : max === min ? 1 : (p.rating - min) / (max - min);
    priceById.set(p.gsisId, Math.max(PRICE_MIN, Math.min(PRICE_MAX, Math.round(PRICE_MIN + t * (PRICE_MAX - PRICE_MIN)))));
  });
}
const price = (p: ManifestPlayerEntry) => priceById.get(p.gsisId)!;

// ---- Draft under the cap ----
const SLOTS: { key: RosterSlotKey; pos: Position }[] = [
  { key: "qb", pos: "QB" },
  { key: "rb", pos: "RB" },
  { key: "wr1", pos: "WR" },
  { key: "wr2", pos: "WR" },
  { key: "te", pos: "TE" },
  { key: "k", pos: "K" },
];

type Strategy = "cheap" | "max" | "balanced" | "studQB" | "random" | "allScrub";
let forcedScrubs = 0;

function draftUnderCap(strategy: Strategy, rng: () => number): { roster: Record<RosterSlotKey, ManifestPlayerEntry>; spent: number } {
  const roster = {} as Record<RosterSlotKey, ManifestPlayerEntry>;
  let budget = CAP;
  const takenWr = new Set<string>();

  SLOTS.forEach(({ key, pos }, i) => {
    const slotsLeft = SLOTS.length - i;
    const pool = manifest.players.filter((p) => p.position === pos && !takenWr.has(p.gsisId));
    const scrubs = pool.filter((p) => scrubIds.has(p.gsisId));
    const dealable = pool.filter((p) => !scrubIds.has(p.gsisId));
    const options = pickRandom3(dealable.length > 0 ? dealable : pool, rng);
    const takeScrub = () => (scrubs.length > 0 ? scrubs[Math.floor(rng() * scrubs.length)] : options[0]);

    // No reserve, no guard: the $0 scrub gamble is always available, so
    // "affordable" is just price <= budget. All three dealt cards can be locked.
    const picks = options.filter((p) => price(p) <= budget).sort((a, b) => price(a) - price(b));

    let choice: ManifestPlayerEntry;
    if (strategy === "allScrub" && scrubs.length > 0) choice = takeScrub();
    else if (picks.length === 0) {
      forcedScrubs++;
      choice = takeScrub();
    } else if (strategy === "cheap") choice = picks[0];
    else if (strategy === "max") choice = picks[picks.length - 1];
    else if (strategy === "studQB") choice = key === "qb" ? picks[picks.length - 1] : scrubs.length > 0 && rng() < 0.5 ? takeScrub() : picks[0];
    else if (strategy === "balanced") {
      const target = budget / slotsLeft;
      choice = picks.reduce((best, p) => (Math.abs(price(p) - target) < Math.abs(price(best) - target) ? p : best), picks[0]);
    } else choice = picks[Math.floor(rng() * picks.length)];

    roster[key] = choice;
    budget -= price(choice);
    if (pos === "WR") takenWr.add(choice.gsisId);
  });

  return { roster, spent: CAP - budget };
}

// ---- Drive policy: kick on 4th when in range, else first offered option ----
function runDrive(rosterEntries: Record<RosterSlotKey, ManifestPlayerEntry>, seed: number) {
  const roster: DraftedRosterData = {
    qb: loadDataset(rosterEntries.qb.gsisId) as PlayerDataset,
    rb: loadDataset(rosterEntries.rb.gsisId) as PlayerDataset,
    wr1: loadDataset(rosterEntries.wr1.gsisId) as PlayerDataset,
    wr2: loadDataset(rosterEntries.wr2.gsisId) as PlayerDataset,
    te: loadDataset(rosterEntries.te.gsisId) as PlayerDataset,
    k: loadDataset(rosterEntries.k.gsisId) as KickerDataset,
  };
  const session = createDriveSession(roster, SCENARIO, manifest.leagueAverageRates, manifest.leagueAverageKickerRates, seed);
  for (let i = 0; i < 40; i++) {
    const options = session.getOptions();
    if (options.length === 0) break;
    const s = session.getSituation();
    const canKick = kickDistanceFor(s.fieldPosition) <= MAX_REALISTIC_FIELD_GOAL_DISTANCE;
    // Rotate through the coverage (passes, gap runs, keeper) so no single
    // spot dominates; kick on 4th when in range.
    const { status } = session.choosePlay(s.down === 4 && canKick ? { kind: "fieldGoal" } : options[i % options.length]);
    if (status !== "continue") break;
  }
  return session.getLog();
}

// ---- Run ----
const strategies: Strategy[] = ["allScrub", "cheap", "studQB", "balanced", "random", "max"];
console.log(`cap=$${CAP}, prices $${PRICE_MIN}-$${PRICE_MAX} (${PRICING}), payout x2.0 at <=$${MIN_SPEND}, ${TRIALS} drives/strategy\n`);
console.log("strategy  | avg $ | win%  | TD%   | EV(cap) | EV(today) | avg win pts (cap)");
console.log("----------|-------|-------|-------|---------|-----------|------------------");

const spendBuckets = new Map<number, { n: number; ev: number; wins: number }>();

for (const strat of strategies) {
  const rng = makeRng(0xc0ffee ^ strategies.indexOf(strat));
  let spentSum = 0, wins = 0, tds = 0, evCap = 0, evToday = 0, winPts = 0;
  for (let t = 0; t < TRIALS; t++) {
    const { roster, spent } = draftUnderCap(strat, () => rng.next());
    const log = runDrive(roster, 1_000_000 + t);
    const b = log.scoreBreakdown;
    // Cap scoring: same base/clutch/marginal-yardage shape; leftover budget is
    // either a multiplier (like today's payout) or a flat additive bonus.
    const capScore = SCORING.startsWith("bonus")
      ? (log.won ? Math.round(b.basePoints * b.clockMultiplier) : b.drivePoints) + (CAP - spent) * BONUS_PER_DOLLAR
      : log.won
        ? Math.round(b.basePoints * b.clockMultiplier * capPayout(spent))
        : Math.round(b.drivePoints * capPayout(spent));
    spentSum += spent;
    if (log.won) { wins++; winPts += capScore; }
    if (log.endReason === "WIN_TOUCHDOWN") tds++;
    evCap += capScore;
    evToday += log.score;
    const bucket = Math.min(25, Math.max(6, Math.round(spent / 3) * 3));
    const sb = spendBuckets.get(bucket) ?? { n: 0, ev: 0, wins: 0 };
    sb.n++; sb.ev += capScore; sb.wins += log.won ? 1 : 0;
    spendBuckets.set(bucket, sb);
  }
  console.log(
    `${strat.padEnd(9)} | $${(spentSum / TRIALS).toFixed(1).padStart(4)} | ${((wins / TRIALS) * 100).toFixed(1).padStart(4)}% | ${((tds / TRIALS) * 100).toFixed(1).padStart(4)}% | ${(evCap / TRIALS).toFixed(1).padStart(7)} | ${(evToday / TRIALS).toFixed(1).padStart(9)} | ${(wins ? winPts / wins : 0).toFixed(0).padStart(6)}`
  );
}

console.log(`\nforced scrubs (all 3 dealt cards locked): ${forcedScrubs} times / ${TRIALS * strategies.length} drafts`);
console.log("\nEV(cap) by spend bucket (pooled):");
for (const [bucket, s] of [...spendBuckets.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`  ~$${String(bucket).padStart(2)}: n=${String(s.n).padStart(5)}  win%=${((s.wins / s.n) * 100).toFixed(1).padStart(5)}  EV=${(s.ev / s.n).toFixed(1)}`);
}
