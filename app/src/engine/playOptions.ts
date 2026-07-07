import type { DepthTier } from "../types/player";
import type { RosterSlotKey } from "../types/roster";
import type { RNG } from "./rng";

/** Works for both the lightweight DraftedRoster (manifest entries) and the
 * full DraftedRosterData (loaded PlayerDataset) -- only displayName is needed. */
type RosterNames = Record<RosterSlotKey, { displayName: string }>;

export type PassTarget = "wr1" | "wr2" | "te";
export type RunGap = "inside" | "outside";

export type PlayCall =
  | { kind: "run" } // legacy (pre-coverage ghosts) -- samples the whole rush pool
  | { kind: "runInside" }
  | { kind: "runOutside" }
  | { kind: "designedRun" }
  | { kind: "pass"; target: PassTarget; depth: DepthTier }
  | { kind: "fieldGoal" }
  | { kind: "spike" };

const PASS_TARGETS: PassTarget[] = ["wr1", "wr2", "te"];
const DEPTH_TIERS: DepthTier[] = ["short", "medium", "deep"];

/** Legacy enumeration -- still the ghost wire format's base ordering and the
 * replay surface for old links. Append-only (see share/ghost.ts CALL_ORDER). */
export const ALL_PLAY_CALLS: PlayCall[] = [
  { kind: "run" },
  { kind: "designedRun" },
  ...PASS_TARGETS.flatMap((target) => DEPTH_TIERS.map((depth): PlayCall => ({ kind: "pass", target, depth }))),
];

/**
 * The per-down "coverage" deal: every pass-catcher gets exactly one spot whose
 * DEPTH is dealt (the fiction: what the defense gives you this down), plus the
 * always-available ground game (RB inside/outside, QB keeper). This replaced
 * the old draw-3-of-11 hand once the salary cap took over as the constraint --
 * you paid for your stud; you can always target him.
 *
 * Consumes exactly three RNG draws per down (one per receiver), so the
 * replay rule is unchanged: call this before every choosePlay.
 */
export function drawPlayOptions(rng: RNG): PlayCall[] {
  const passes = PASS_TARGETS.map((target): PlayCall => {
    const depth = DEPTH_TIERS[Math.floor(rng.next() * DEPTH_TIERS.length)];
    return { kind: "pass", target, depth };
  });
  return [...passes, { kind: "runInside" }, { kind: "runOutside" }, { kind: "designedRun" }];
}

const DEPTH_LABEL: Record<DepthTier, string> = { short: "Short", medium: "Intermediate", deep: "Deep" };

export function describePlayCall(call: PlayCall, roster: RosterNames): string {
  if (call.kind === "run") return `Run with ${roster.rb.displayName}`;
  if (call.kind === "runInside") return `Pound it inside with ${roster.rb.displayName}`;
  if (call.kind === "runOutside") return `Bounce it outside with ${roster.rb.displayName}`;
  if (call.kind === "designedRun") return `Keeper with ${roster.qb.displayName}`;
  if (call.kind === "fieldGoal") return `Kick a field goal with ${roster.k.displayName}`;
  if (call.kind === "spike") return "Spike the ball";
  return `${DEPTH_LABEL[call.depth]} pass to ${roster[call.target].displayName}`;
}

export function playCallKey(call: PlayCall): string {
  return call.kind === "pass" ? `pass_${call.target}_${call.depth}` : call.kind;
}
