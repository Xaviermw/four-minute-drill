import { expect, test } from "@playwright/test";

// The rookie funnel (macro-review P1, opt-in per owner): a brand-new visitor is
// ASKED -- practice drive or straight to the daily -- instead of silently
// defaulted. Practice is loudly framed (banner), and completing it funnels
// them into the daily.
test("first visit: choose practice -> loud framing -> graduate -> daily unlocks", async ({ page }) => {
  await page.goto("/");

  // Fresh context => the gate asks first.
  const gate = page.getByRole("dialog");
  await expect(gate).toContainText("First time here?");
  await gate.getByRole("button", { name: /practice drive/i }).click();

  // Practice framing: banner + rookie eyebrow + teaching hints.
  await expect(page.locator(".shared-banner")).toContainText("Practice drive");
  await expect(page.locator(".draft-header .eyebrow")).toContainText("Rookie Drive");
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
    await page.locator(".field-target:not([disabled])").first().click();
    await page.locator(".result-screen, .field-target:not([disabled])").first().waitFor({ timeout: 15_000 });
  }
  await expect(result).toBeVisible({ timeout: 15_000 });

  // Graduation CTA replaces the standard actions...
  const cta = page.getByRole("button", { name: /Play Today's Drill/ });
  await expect(cta).toBeVisible();

  // ...and clicking it lands on the real daily draft, hints retired, banner gone.
  await cta.click();
  await expect(page.locator(".draft-header .eyebrow")).toContainText("Today's Drill");
  await expect(page.locator(".budget-note")).toHaveCount(0);
  await expect(page.locator(".shared-banner")).toHaveCount(0);
});

test("first visit: skip goes straight to the daily", async ({ page }) => {
  await page.goto("/");
  const gate = page.getByRole("dialog");
  await expect(gate).toContainText("First time here?");
  await gate.getByRole("button", { name: /Skip to Today's Drill/i }).click();

  await expect(page.locator(".draft-header .eyebrow")).toContainText("Today's Drill");
  // Still their first drive: teaching hints stay on until they complete one.
  await expect(page.locator(".budget-note")).toBeVisible();
  // No practice banner -- they're playing the real thing, on purpose.
  await expect(page.locator(".shared-banner")).toHaveCount(0);
});
