import { describe, expect, it } from "vitest";
import { formatBallOn, formatClock, formatPayout, ordinalDown } from "../utils/formatting";

describe("formatBallOn", () => {
  it("uses football field-position convention", () => {
    expect(formatBallOn(80)).toBe("OWN 20"); // own 20-yard line
    expect(formatBallOn(75)).toBe("OWN 25");
    expect(formatBallOn(50)).toBe("MIDFIELD");
    expect(formatBallOn(29)).toBe("AWAY 29"); // 29 yards from the opp end zone
    expect(formatBallOn(1)).toBe("AWAY 1");
  });
});

describe("formatting basics", () => {
  it("ordinalDown / formatClock / formatPayout", () => {
    expect(ordinalDown(1)).toBe("1st");
    expect(ordinalDown(4)).toBe("4th");
    expect(formatClock(125)).toBe("2:05");
    expect(formatClock(-3)).toBe("0:00");
    expect(formatPayout(1.8)).toBe("×1.8");
  });
});
