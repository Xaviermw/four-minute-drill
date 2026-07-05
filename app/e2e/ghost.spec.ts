import { expect, test } from "@playwright/test";

// Ghost racing round-trip: finish a drive, take the "race my drive" link out of
// the share preview, open it, and confirm the ghost is live -- banner with the
// score to beat and the ghost marker on the field. Exercises encode -> URL ->
// parse -> replay end-to-end against the real datasets.
test("share link carries a raceable ghost", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");

  // Play any drive to completion (rookie practice works fine).
  await page.locator(".player-grid .player-card").first().waitFor();
  for (let pick = 1; pick <= 6; pick++) {
    const affordable = page.locator(".player-grid .player-card:not(.locked)").first();
    if (await affordable.count()) await affordable.click();
    else await page.locator(".scrub-btn").click();
  }
  await page.getByRole("button", { name: /Run the Drive/ }).click();
  const result = page.locator(".result-screen");
  for (let i = 0; i < 60; i++) {
    if (await result.isVisible().catch(() => false)) break;
    await page.locator(".play-option-button:not([disabled])").first().click();
    await page.locator(".result-screen, .play-option-button:not([disabled])").first().waitFor({ timeout: 15_000 });
  }
  await expect(result).toBeVisible({ timeout: 15_000 });

  // The share preview holds the exact clipboard text, including the ghost link.
  const preview = await page.locator(".share-preview").innerText();
  const match = preview.replace(/\s+/g, "").match(/(http:\/\/[\d.:]+\/\?team=\d+&g=[^&\s]+)/);
  expect(match, "share text should contain a ghost link").not.toBeNull();

  // Open the race link: ghost banner + ghost marker on the field.
  await page.goto(match![1]);
  await expect(page.locator(".shared-banner")).toContainText("pts to beat", { timeout: 20_000 });
  await expect(page.locator(".field-ghost")).toBeVisible();
  await expect(page.locator(".ghost-line")).toBeVisible();
});
