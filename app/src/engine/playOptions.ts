import type { DepthTier } from "../types/player";
import type { RosterSlotKey } from "../types/roster";
import type { RNG } from "./rng";

/** Works for both the lightweight DraftedRoster (manifest entries) and the
 * full DraftedRosterData (loaded PlayerDataset) -- only displayName is needed. */
type RosterNames = Record<RosterSlotKey, { displayName: string }>;

export type PassTarget = "wr1" | "wr2" | "te";

export type PlayCall =
  | { kind: "run" }
  | { kind: "designedRun" }
  | { kind: "pass"; target: PassTarget; depth: DepthTier }
  | { kind: "fieldGoal" }
  | { kind: "spike" };

const PASS_TARGETS: PassTarget[] = ["wr1", "wr2", "te"];
const DEPTH_TIERS: DepthTier[] = ["short", "medium", "deep"];

export const ALL_PLAY_CALLS: PlayCall[] = [
  { kind: "run" },
  { kind: "designedRun" },
  ...PASS_TARGETS.flatMap((target) => DEPTH_TIERS.map((depth): PlayCall => ({ kind: "pass", target, depth }))),
];

/** Fisher-Yates partial shuffle: draws `count` distinct calls uniformly at random. */
export function drawPlayOptions(rng: RNG, count = 3): PlayCall[] {
  const pool = [...ALL_PLAY_CALLS];
  const drawn: PlayCall[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const index = Math.floor(rng.next() * pool.length);
    drawn.push(pool[index]);
    pool.splice(index, 1);
  }
  return drawn;
}

const DEPTH_LABEL: Record<DepthTier, string> = { short: "Short", medium: "Intermediate", deep: "Deep" };

export function describePlayCall(call: PlayCall, roster: RosterNames): string {
  if (call.kind === "run") return `Run with ${roster.rb.displayName}`;
  if (call.kind === "designedRun") return `Designed run with ${roster.qb.displayName}`;
  if (call.kind === "fieldGoal") return `Kick a field goal with ${roster.k.displayName}`;
  if (call.kind === "spike") return "Spike the ball";
  return `${DEPTH_LABEL[call.depth]} pass to ${roster[call.target].displayName}`;
}

export function playCallKey(call: PlayCall): string {
  return call.kind === "pass" ? `pass_${call.target}_${call.depth}` : call.kind;
}
