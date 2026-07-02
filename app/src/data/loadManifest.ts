import type { Manifest } from "../types/player";

let cached: Promise<Manifest> | null = null;

export function loadManifest(): Promise<Manifest> {
  if (!cached) {
    cached = fetch("/data/manifest.json").then((res) => {
      if (!res.ok) throw new Error(`Failed to load manifest.json: ${res.status}`);
      return res.json() as Promise<Manifest>;
    });
  }
  return cached;
}
