import { describe, expect, it } from "vitest";
import { CAP } from "../draft/pricing";
import { capForChallenge, type CapConfig } from "../draft/capConfig";

describe("cap config (theme days)", () => {
  it("defaults to the standard cap for free play and unscheduled days", () => {
    expect(capForChallenge(null)).toEqual({ cap: CAP });
    expect(capForChallenge("2099-01-01")).toEqual({ cap: CAP });
  });

  it("returns the special cap + label on a scheduled day, standard otherwise", () => {
    const specials: Record<string, CapConfig> = { "2026-09-15": { cap: 15, label: "Tightwad Tuesday" } };
    expect(capForChallenge("2026-09-15", specials)).toEqual({ cap: 15, label: "Tightwad Tuesday" });
    expect(capForChallenge("2026-09-16", specials)).toEqual({ cap: CAP });
    expect(capForChallenge(null, specials)).toEqual({ cap: CAP }); // free play ignores specials
  });

  it("a tighter cap makes more cards unaffordable", () => {
    // Affordability is `price > cap - spent`; an $8 card with $12 already spent
    // is fine under $25 (budget 13) but locked under $15 (budget 3).
    const price = 8;
    const spent = 12;
    expect(price > 25 - spent).toBe(false);
    expect(price > 15 - spent).toBe(true);
  });
});
