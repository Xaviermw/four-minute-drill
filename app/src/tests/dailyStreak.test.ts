import { beforeEach, describe, expect, it } from "vitest";
import { dailyStreakDisplay, recordDailyWin } from "../daily/dailyStreak";

// Minimal in-memory localStorage (these tests run in node).
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
});

describe("daily streak", () => {
  it("extends on consecutive days and is idempotent within a day", () => {
    expect(recordDailyWin("2026-07-01").currentDays).toBe(1);
    expect(recordDailyWin("2026-07-02").currentDays).toBe(2);
    expect(recordDailyWin("2026-07-02").currentDays).toBe(2); // same day again -> no change
    expect(recordDailyWin("2026-07-03").currentDays).toBe(3);
  });

  it("resets to 1 after a skipped day and tracks the best", () => {
    recordDailyWin("2026-07-01");
    recordDailyWin("2026-07-02");
    recordDailyWin("2026-07-03"); // best now 3
    const afterGap = recordDailyWin("2026-07-06"); // skipped 4th & 5th
    expect(afterGap.currentDays).toBe(1);
    expect(afterGap.bestDays).toBe(3);
  });

  it("handles month boundaries", () => {
    recordDailyWin("2026-07-31");
    expect(recordDailyWin("2026-08-01").currentDays).toBe(2);
  });

  it("display: active on a win, ended on a loss that breaks an active run", () => {
    recordDailyWin("2026-07-01");
    recordDailyWin("2026-07-02");
    // Won today -> active (call recordDailyWin then display, as the app does).
    recordDailyWin("2026-07-03");
    expect(dailyStreakDisplay("2026-07-03", true)).toEqual({ days: 3, best: 3, state: "active" });
    // Lose the next day with an active run reaching yesterday -> ended.
    expect(dailyStreakDisplay("2026-07-04", false)).toEqual({ days: 3, best: 3, state: "ended" });
    // Lose after already having lapsed -> nothing to end.
    expect(dailyStreakDisplay("2026-07-10", false)).toEqual({ days: 0, best: 3, state: "none" });
  });
});
