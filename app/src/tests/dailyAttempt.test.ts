import { beforeEach, describe, expect, it, vi } from "vitest";
import { countDailyStart, dailyTries } from "../daily/dailyState";

// The suite runs in node (no DOM); dailyState only touches storage inside its
// functions, so stubbing the global before the first call is enough.
class MemoryStorage {
  private map = new Map<string, string>();
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

describe("daily attempt counter", () => {
  beforeEach(() => store.clear());

  it("reports nothing before a drive starts", () => {
    expect(dailyTries("2026-09-12")).toBe(0);
  });

  it("counts each started drive, per drill", () => {
    expect(countDailyStart("2026-09-12")).toBe(1);
    expect(countDailyStart("2026-09-12")).toBe(2);
    expect(dailyTries("2026-09-12")).toBe(2);
    expect(dailyTries("2026-09-13"), "tomorrow's drill starts over").toBe(0);
  });

  it("ignores junk left in storage", () => {
    store.setItem("fmd_daily_tries_2026-09-12", "not a number");
    expect(dailyTries("2026-09-12")).toBe(0);
    expect(countDailyStart("2026-09-12")).toBe(1);
  });
});
