import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// One shot per day, across tabs. Production had 9 device/days with TWO posted
// dailies (different drives, same user_id) by Sep 11, 2026: the one-shot record
// was read from storage once, at page load, so a tab loaded BEFORE another tab
// finished the daily never learned it had been played. The gate is now three
// layers -- cross-tab storage sync, a re-check at "Run the Drive", and
// first-finish-wins at the result -- and each has a case here.
// Supabase is blocked outright: nothing here touches the live database.

async function asReturningPlayer(context: BrowserContext): Promise<void> {
  await context.route(/supabase\.co/, (route) => route.abort());
  await context.addInitScript(() => {
    localStorage.setItem("fmd_rookie_done", "1"); // lands on the daily, no practice gate
    localStorage.setItem("fmd_seen_intro", "1");
  });
}

async function draftDaily(page: Page): Promise<void> {
  await page.locator(".player-grid .player-card").first().waitFor({ timeout: 30_000 });
  for (let pick = 1; pick <= 6; pick++) await page.locator(".scrub-btn").click({ timeout: 10_000 });
}

async function runDrive(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Run the Drive/ }).click({ timeout: 15_000 });
  await page.locator(".field-target").first().waitFor({ timeout: 30_000 });
}

/** Plays the drive to its result, always calling the first (or last) target. */
async function playOut(page: Page, call: "first" | "last" = "first"): Promise<void> {
  await page.bringToFront();
  const result = page.locator(".result-screen");
  for (let down = 1; down <= 60; down++) {
    await page.locator(".result-screen, .field-target:not([disabled])").first().waitFor({ timeout: 30_000 });
    if (await result.isVisible().catch(() => false)) return;
    const targets = page.locator(".field-target:not([disabled])");
    await (call === "first" ? targets.first() : targets.last()).click({ timeout: 10_000 }).catch(() => {});
  }
  await expect(result).toBeVisible({ timeout: 30_000 });
}

/** Today's one-shot record as stored (the date-keyed entry, not fmd_daily_streak). */
function readRecord(page: Page): Promise<{ key: string; value: string } | null> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^fmd_daily_\d{4}-\d{2}-\d{2}$/.test(k));
    return key ? { key, value: localStorage.getItem(key) ?? "" } : null;
  });
}

test("a tab left on the draft can't start a second daily once another tab finishes it", async ({
  context,
  browser,
  baseURL,
}) => {
  test.setTimeout(300_000);
  await asReturningPlayer(context);
  const tabA = await context.newPage();
  const waiting = await context.newPage();
  for (const tab of [tabA, waiting]) await tab.goto("/");
  await draftDaily(waiting);

  await draftDaily(tabA);
  await runDrive(tabA);
  await playOut(tabA);
  await expect(tabA.locator(".result-screen")).toContainText("Today's Drill");
  const banked = await readRecord(tabA);
  expect(banked, "tab A banked today's drill").not.toBeNull();

  // The storage event flips the waiting tab to the recap -- no reload, no tap.
  await expect(waiting.locator(".daily-freeplay-cta")).toBeVisible({ timeout: 10_000 });
  await expect(waiting.getByRole("button", { name: /Run the Drive/ })).toHaveCount(0);

  // Control: a tab opened afterwards gets the recap too.
  const late = await context.newPage();
  await late.goto("/");
  await expect(late.locator(".daily-freeplay-cta")).toBeVisible({ timeout: 30_000 });

  // No event at all: a page's OWN storage write never fires `storage` at itself,
  // so this page holds a stale draft while its storage already has the record.
  // Only the re-check at "Run the Drive" can stop it.
  const isolated = await browser.newContext({ baseURL });
  await asReturningPlayer(isolated);
  const stale = await isolated.newPage();
  await stale.goto("/");
  await draftDaily(stale);
  await stale.evaluate(({ key, value }) => localStorage.setItem(key, value), banked!);
  const run = stale.getByRole("button", { name: /Run the Drive/ });
  await expect(run, "no event reached it, so the draft should still be up").toBeVisible();
  await run.click();
  await expect(stale.locator(".daily-freeplay-cta")).toBeVisible({ timeout: 10_000 });
  await expect(stale.locator(".field-target")).toHaveCount(0);
  await isolated.close();
});

test("when two tabs are mid-drive, the first to finish is the daily", async ({ context }) => {
  test.setTimeout(360_000);
  await asReturningPlayer(context);
  const tabA = await context.newPage();
  const tabB = await context.newPage();
  await tabA.goto("/");
  await tabB.goto("/");
  await draftDaily(tabA);
  await runDrive(tabA);
  await draftDaily(tabB);
  await runDrive(tabB);

  await playOut(tabA);
  const banked = await readRecord(tabA);
  expect(banked, "tab A banked today's drill").not.toBeNull();

  // B must call DIFFERENT plays: the daily is deterministic, so the same lineup,
  // seed and calls would replay A's drive exactly -- the same drive, not a race.
  await playOut(tabB, "last");
  await expect(tabB.locator(".result-screen")).toContainText("another tab");
  await expect(tabB.getByRole("button", { name: /^Post$/ })).toHaveCount(0);
  expect(await readRecord(tabB), "tab B must not overwrite the banked drive").toEqual(banked);
});
