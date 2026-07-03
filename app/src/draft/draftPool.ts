import type { ManifestPlayerEntry, Position } from "../types/player";
import type { RosterSlotKey } from "../types/roster";

/** Draws up to 3 distinct players from a pool using the provided RNG. Injecting
 * the RNG lets the Daily Challenge seed it by date so everyone gets the same
 * three options; free play passes Math.random. */
export function pickRandom3(pool: ManifestPlayerEntry[], rng: () => number): ManifestPlayerEntry[] {
  const copy = [...pool];
  const drawn: ManifestPlayerEntry[] = [];
  for (let i = 0; i < 3 && copy.length > 0; i++) {
    const index = Math.floor(rng() * copy.length);
    drawn.push(copy[index]);
    copy.splice(index, 1);
  }
  return drawn;
}

/**
 * Draws a fixed 3-of-pool for every slot. WR1 and WR2 share a position pool, so
 * WR2's draw excludes whichever 3 WR1 already drew -- guarantees the two can
 * never collide. Deterministic for a given `rng`.
 */
export function drawSlotOptions(
  players: ManifestPlayerEntry[],
  rng: () => number = Math.random
): Record<RosterSlotKey, ManifestPlayerEntry[]> {
  const byPosition = (position: Position) => players.filter((p) => p.position === position);

  const wrPool = byPosition("WR");
  const wr1Options = pickRandom3(wrPool, rng);
  const wr1Ids = new Set(wr1Options.map((p) => p.gsisId));
  const wr2Options = pickRandom3(
    wrPool.filter((p) => !wr1Ids.has(p.gsisId)),
    rng
  );

  return {
    qb: pickRandom3(byPosition("QB"), rng),
    rb: pickRandom3(byPosition("RB"), rng),
    wr1: wr1Options,
    wr2: wr2Options,
    te: pickRandom3(byPosition("TE"), rng),
    k: pickRandom3(byPosition("K"), rng),
  };
}
