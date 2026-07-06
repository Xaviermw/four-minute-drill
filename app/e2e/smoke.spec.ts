import { expect, test } from "@playwright/test";

// End-to-end happy path: draft a full roster, run the drive to completion always
// taking the first offered play, and confirm the result screen renders a score.
// This is the coverage unit tests can't give (the earlier "Play Again no-op" bug
// was exactly this class). It asserts the flow completes, not a specific outcome.
test("draft -> drive -> result renders a score", async ({ page }) => {
  await page.goto("/");

  // Fresh context => the first-visit gate asks; take the practice path.
  const gateButton = page.getByRole("button", { name: /practice drive/i });
  if (await gateButton.isVisible().catch(() => false)) await gateButton.click();

  // Draft: six picks, each taking the first affordable card (cap draft locks any
  // card over the remaining budget); fall back to the $0 scrub gamble if all
  // three are locked. Scope to the picker grid -- TeamPanel also renders cards.
  for (let pick = 1; pick <= 6; pick++) {
    const affordable = page.locator(".player-grid .player-card:not(.locked)").first();
    if (await affordable.count()) await affordable.click();
    else await page.locator(".scrub-btn").click();
    if (pick < 6) {
      await expect(page.locator(".draft-progress-count")).toContainText(`Pick ${pick + 1}`);
    }
  }

  await page.getByRole("button", { name: /Run the Drive/ }).click();

  // Drive: keep taking the first enabled play option until the result appears.
  // Each call disables the buttons for a ~700ms anticipation beat, then either
  // re-enables (next down) or transitions to the result screen.
  const result = page.locator(".result-screen");
  for (let i = 0; i < 60; i++) {
    if (await result.isVisible().catch(() => false)) break;
    await page.locator(".play-option-button:not([disabled])").first().click();
    await page.locator(".result-screen, .play-option-button:not([disabled])").first().waitFor({ timeout: 15_000 });
  }

  await expect(result).toBeVisible({ timeout: 15_000 });
  // Both win and loss result screens render a "points" unit.
  await expect(page.locator(".result-score-unit")).toContainText("points");
});
