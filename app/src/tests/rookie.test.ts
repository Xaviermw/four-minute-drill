import { beforeEach, describe, expect, it, vi } from "vitest";

// The suite runs in node (no DOM), so stand up the tiny slice of localStorage
// that rookie.ts uses -- key/length iteration included.
class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  clear() {
    this.map.clear();
  }
}
const store = new MemoryStorage();
vi.stubGlobal("localStorage", store);

/** isRookie snapshots per module load, so each case needs a fresh import. */
async function freshIsRookie() {
  vi.resetModules();
  const mod = await import("../state/rookie");
  return mod.isRookie();
}

describe("rookie detection", () => {
  beforeEach(() => store.clear());

  it("treats a brand-new visitor as a rookie", async () => {
    expect(await freshIsRookie()).toBe(true);
  });

  it("still treats an AD arrival as a rookie (fmd_src is not evidence of play)", async () => {
    // Regression: attribution stamps fmd_src on boot for any utm_source
    // arrival, which silently made every paid visitor a "veteran" -- no gate,
    // no practice option, no teaching hints.
    store.setItem("fmd_src", "reddit");
    expect(await freshIsRookie()).toBe(true);
  });

  it("treats someone who has actually played as a veteran", async () => {
    store.setItem("fmd_seen_intro", "1");
    expect(await freshIsRookie()).toBe(false);
  });

  it("respects an explicit graduation", async () => {
    store.setItem("fmd_rookie_done", "1");
    expect(await freshIsRookie()).toBe(false);
  });
});
