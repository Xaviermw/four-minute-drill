import type { KickerDataset } from "../types/player";

const cache = new Map<string, Promise<KickerDataset>>();

export function loadKicker(gsisId: string): Promise<KickerDataset> {
  let promise = cache.get(gsisId);
  if (!promise) {
    promise = fetch(`/data/players/${gsisId}.json`).then((res) => {
      if (!res.ok) throw new Error(`Failed to load kicker ${gsisId}: ${res.status}`);
      return res.json() as Promise<KickerDataset>;
    });
    cache.set(gsisId, promise);
  }
  return promise;
}
