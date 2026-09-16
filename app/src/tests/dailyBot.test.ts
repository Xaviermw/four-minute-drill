import { describe, expect, it } from "vitest";
import { composeWeekly } from "../../scripts/daily-bot";

// Week 1 (Sep 10-16, 2026) as it stood on Wednesday afternoon.
const week1 = [
  { name: "RA3", week_points: 686, days_played: 6, total_spend: 149 },
  { name: "DakSucks", week_points: 429, days_played: 3, total_spend: 75 },
  { name: "Roberto", week_points: 397, days_played: 3, total_spend: 73 },
  { name: "Michael Keane", week_points: 383, days_played: 3, total_spend: 72 },
];

describe("Coach Bot's weekly winner post", () => {
  it("crowns the top row and shows the podium", () => {
    const post = composeWeekly(week1, 1, 2);
    expect(post).not.toBeNull();
    expect(post).toContain("Week 1 is in the books. RA3 takes it — 686 pts over 6 drills.");
    expect(post).toContain("🥈 DakSucks 429 · 🥉 Roberto 397");
    expect(post).toContain("Week 2 starts now");
    expect(post!.length).toBeLessThanOrEqual(300); // Bluesky's limit
  });

  it("never crowns Anonymous or the Coach himself", () => {
    const rows = [
      { name: "Anonymous", week_points: 999, days_played: 7, total_spend: 175 },
      { name: "Coach Bot", week_points: 900, days_played: 7, total_spend: 175 },
      ...week1,
    ];
    expect(composeWeekly(rows, 1, 2)).toContain("RA3 takes it");
  });

  it("stays quiet on a week too small to celebrate", () => {
    expect(composeWeekly(week1.slice(0, 2), 1, 2)).toBeNull();
  });

  it("closes the season after the final week instead of promising another", () => {
    const post = composeWeekly(week1, 17, null);
    expect(post).toContain("That's a wrap on the 2026 Season");
    expect(post).not.toContain("starts now");
  });

  it("survives a long-named podium within the post limit", () => {
    const long = week1.map((r) => ({ ...r, name: "TwentyCharacterName1" }));
    expect(composeWeekly(long, 12, 13)!.length).toBeLessThanOrEqual(300);
  });
});
