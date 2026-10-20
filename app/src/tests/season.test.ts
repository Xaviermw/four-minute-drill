import { describe, expect, it } from "vitest";
import {
  lastCompletedWeekStart,
  seasonDayNumber,
  SEASON_END,
  SEASON_START,
  weekEndFor,
  weekLabel,
  weekNumberFor,
  weekStartFor,
} from "../daily/season";

describe("NFL weeks (Thursday to Wednesday)", () => {
  it("opening night starts week 1", () => {
    expect(weekStartFor(SEASON_START)).toBe("2026-09-10");
    expect(weekNumberFor("2026-09-10")).toBe(1);
  });

  it("Wednesday closes a week; Thursday opens the next", () => {
    expect(weekStartFor("2026-09-16")).toBe("2026-09-10");
    expect(weekStartFor("2026-09-17")).toBe("2026-09-17");
    expect(weekNumberFor("2026-09-17")).toBe(2);
    expect(weekEndFor("2026-09-17")).toBe("2026-09-23");
  });

  it("is unmoved by the fall-back clock change (Nov 1)", () => {
    expect(weekStartFor("2026-11-01")).toBe("2026-10-29");
    expect(weekStartFor("2026-11-04")).toBe("2026-10-29");
    expect(weekStartFor("2026-11-05")).toBe("2026-11-05");
  });

  it("clamps the final week to the season's end", () => {
    expect(weekStartFor(SEASON_END)).toBe("2026-12-31");
    expect(weekNumberFor("2026-12-31")).toBe(17);
    expect(weekEndFor("2026-12-31")).toBe(SEASON_END);
  });

  it("labels a week's dates", () => {
    expect(weekLabel("2026-09-17")).toBe("Sep 17–23");
    expect(weekLabel("2026-12-31")).toBe("Dec 31 – Jan 5");
  });

  it("numbers the dailies from opening night", () => {
    expect(seasonDayNumber("2026-09-10")).toBe(1);
    expect(seasonDayNumber("2026-10-20")).toBe(41);
    expect(seasonDayNumber("2026-09-09")).toBeNull(); // warm-up, unnumbered
    expect(seasonDayNumber(SEASON_END)).toBe(118);
  });

  it("knows which week just finished", () => {
    expect(lastCompletedWeekStart("2026-09-16")).toBeNull(); // week 1 still running
    expect(lastCompletedWeekStart("2026-09-17")).toBe("2026-09-10");
    expect(lastCompletedWeekStart("2026-09-20")).toBe("2026-09-10");
  });
});
