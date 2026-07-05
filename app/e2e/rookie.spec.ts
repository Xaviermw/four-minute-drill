import { expect, test } from "@playwright/test";

// The rookie funnel (macro-review P1): a brand-new visitor must land on a
// no-stakes practice drive, not burn their one daily shot learning the UI --
// then get funneled into the daily the moment practice ends.
test("first visit: practice drive -> graduate -> daily unlocks", async ({ page }) => {
  await page.goto("/");

  // Fresh context (no localStorage) => rookie framing, in free-play mode.
  await expect(page.locator(".draft-header .eyebrow")).toContainText("Rookie Drive");
  // Teaching hints are on for rookies.
  await expect(page.locator(".budget-note")).toBeVisible();

  // Complete the practice draft (first affordable card; scrub fallback).
  for (let pick = 1; pick <= 6; pick++) {
    const affordable = page.locator(".player-grid .player-card:not(.locked)").first();
    if (await affordable.count()) await affordable.click();
    else await page.locator(".scrub-btn").click();
  }
  await page.getByRole("button", { name: /Run the Drive/ }).click();

  // Play the practice drive to its result.
  const result = page.locator(".result-screen");
  for (let i = 0; i < 60; i++) {
    if (await result.isVisible().catch(() => false)) break;
    await page.locator(".play-option-button:not([disabled])").first().click();
    await page.locator(".result-screen, .play-option-button:not([disabled])").first().waitFor({ timeout: 15_000 });
  }
  await expect(result).toBeVisible({ timeout: 15_000 });

  // Graduation CTA replaces the standard actions...
  const cta = page.getByRole("button", { name: /Play Today's Drill/ });
  await expect(cta).toBeVisible();

  // ...and clicking it lands on the real daily draft, hints retired.
  await cta.click();
  await expect(page.locator(".draft-header .eyebrow")).toContainText("Today's Drill");
  await expect(page.locator(".budget-note")).toHaveCount(0);
});
