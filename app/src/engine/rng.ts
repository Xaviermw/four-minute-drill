export interface RNG {
  next(): number;
}

/** mulberry32 -- small, fast, deterministic PRNG for reproducible sims/tests. */
export function makeRng(seed: number): RNG {
  let a = seed >>> 0;
  return {
    next(): number {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function weightedRandomChoice<T>(items: T[], weights: number[], rng: RNG): T {
  const total = weights.reduce((sum, w) => sum + Math.max(w, 0), 0);
  if (total <= 0) return items[Math.floor(rng.next() * items.length)];

  let target = rng.next() * total;
  for (let i = 0; i < items.length; i++) {
    target -= Math.max(weights[i], 0);
    if (target <= 0) return items[i];
  }
  return items[items.length - 1];
}
