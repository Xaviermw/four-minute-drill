import type { PlayerDataset } from "../types/player";

const cache = new Map<string, Promise<PlayerDataset>>();

export function loadPlayer(gsisId: string): Promise<PlayerDataset> {
  let promise = cache.get(gsisId);
  if (!promise) {
    promise = fetch(`/data/players/${gsisId}.json`).then((res) => {
      if (!res.ok) throw new Error(`Failed to load player ${gsisId}: ${res.status}`);
      return res.json() as Promise<PlayerDataset>;
    });
    cache.set(gsisId, promise);
  }
  return promise;
}
