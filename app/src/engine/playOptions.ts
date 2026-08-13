import type { DepthTier } from "../types/player";
import type { RosterSlotKey } from "../types/roster";
import type { RNG } from "./rng";

/** Works for both the lightweight DraftedRoster (manifest entries) and the
 * full DraftedRosterData (loaded PlayerDataset) -- only displayName is needed. */
type RosterNames = Record<RosterSlotKey, { displayName: string }>;

/** "rb" arrives only via the dealt swing (never in the legacy 11-call list). */
export type PassTarget = "wr1" | "wr2" | "te" | "rb";
export type RunGap = "inside" | "outside";

export type PlayCall =
  | { kind: "run" } // legacy (pre-coverage ghosts) -- samples the whole rush pool
  | { kind: "runInside" }
  | { kind: "runOutside" }
  | { kind: "designedRun" }
  | { kind: "pass"; target: PassTarget; depth: DepthTier }
  | { kind: "fieldGoal" }
  | { kind: "spike" };

const PASS_TARGETS: PassTarget[] = ["wr1", "wr2", "te"]; // dealt-depth receivers (rb swings via the gap draw)
const DEPTH_TIERS: DepthTier[] = ["short", "medium", "deep"];

/** Legacy enumeration -- still the ghost wire format's base ordering and the
 * replay surface for old links. Append-only (see share/ghost.ts CALL_ORDER). */
export const ALL_PLAY_CALLS: PlayCall[] = [
  { kind: "run" },
  { kind: "designedRun" },
  ...PASS_TARGETS.flatMap((target) => DEPTH_TIERS.map((depth): PlayCall => ({ kind: "pass", target, depth }))),
];

/**
 * The per-down "coverage" deal -- ONE spot per skill player, always: every
 * pass-catcher gets a spot whose DEPTH is dealt, the RB gets a run whose GAP
 * is dealt (some downs the front gives you the inside, some the edge), and
 * the QB keeper is the fifth spot. The fiction throughout: what the defense
 * gives you this down. This replaced the old draw-3-of-11 hand once the
 * salary cap took over as the constraint -- you paid for your stud; you can
 * always target him.
 *
 * The RB's look is a THREE-WAY deal on one draw (owner call 2026-08-13):
 * inside 35% / outside 35% / swing pass 30%. Real carries skew ~4:1 inside;
 * the even-ish deal keeps the edge and the checkdown in the game as the
 * spicier looks, and pass-catching backs finally play like themselves.
 *
 * Consumes exactly FOUR RNG draws per down (three depths + one RB look), so
 * the replay rule is unchanged: call this before every choosePlay.
 */
export function drawPlayOptions(rng: RNG): PlayCall[] {
  const passes = PASS_TARGETS.map((target): PlayCall => {
    const depth = DEPTH_TIERS[Math.floor(rng.next() * DEPTH_TIERS.length)];
    return { kind: "pass", target, depth };
  });
  const rbRoll = rng.next();
  const rbSpot: PlayCall =
    rbRoll < 0.35
      ? { kind: "runInside" }
      : rbRoll < 0.7
        ? { kind: "runOutside" }
        : { kind: "pass", target: "rb", depth: "short" };
  return [...passes, rbSpot, { kind: "designedRun" }];
}

const DEPTH_LABEL: Record<DepthTier, string> = { short: "Short", medium: "Intermediate", deep: "Deep" };

export function describePlayCall(call: PlayCall, roster: RosterNames): string {
  if (call.kind === "run") return `Run with ${roster.rb.displayName}`;
  if (call.kind === "runInside") return `Pound it inside with ${roster.rb.displayName}`;
  if (call.kind === "runOutside") return `Bounce it outside with ${roster.rb.displayName}`;
  if (call.kind === "designedRun") return `Keeper with ${roster.qb.displayName}`;
  if (call.kind === "fieldGoal") return `Kick a field goal with ${roster.k.displayName}`;
  if (call.kind === "spike") return "Spike the ball";
  if (call.target === "rb") return `Swing it out to ${roster.rb.displayName}`;
  return `${DEPTH_LABEL[call.depth]} pass to ${roster[call.target].displayName}`;
}

export function playCallKey(call: PlayCall): string {
  return call.kind === "pass" ? `pass_${call.target}_${call.depth}` : call.kind;
}
