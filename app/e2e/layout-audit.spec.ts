import { expect, test, type Page } from "@playwright/test";

const DIR = "C:/Users/XAVIER~1/AppData/Local/Temp/claude/c--Users-Xavier-W-Documents-Final-Drive/24a30976-2c96-4a26-b5e2-8f5c589a2b6a/scratchpad";

// Layout audit: the coverage targets must be PLAYABLE in every game state,
// not just the opening snap. Born from a real bug: from the AWAY 13, medium
// and deep seats overflowed the goal line, clamped to the same edge pixel,
// and read as decoration instead of choices. This drives several full drives
// and asserts, on EVERY down: five enabled targets, all fully on the turf,
// none stacked, and the tapped one genuinely clickable. Red-zone downs get a
// screenshot for eyeballs.

async function auditDown(page: Page, drive: number, down: number): Promise<void> {
  const situation = (await page.locator(".scoreboard").innerText().catch(() => "?")).replace(/\s+/g, " ");
  const where = `drive ${drive}, down ${down} [${situation}]`;

  const targets = page.locator(".field-target");
  await expect(targets, `${where}: expected the 5-spot coverage`).toHaveCount(5);

  const area = await page.locator(".field-playing-area").boundingBox();
  expect(area, `${where}: playing area missing`).not.toBeNull();

  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const t = targets.nth(i);
    await expect(t, `${where}: target ${i} disabled`).toBeEnabled();
    const box = await t.boundingBox();
    expect(box, `${where}: target ${i} has no box`).not.toBeNull();
    // Fully on the turf (small tolerance for borders/shadows).
    expect(box!.x, `${where}: target ${i} spills off the LEFT of the field`).toBeGreaterThanOrEqual(area!.x - 4);
    expect(
      box!.x + box!.width,
      `${where}: target ${i} spills off the RIGHT of the field (the AWAY-13 bug)`
    ).toBeLessThanOrEqual(area!.x + area!.width + 4);
    expect(box!.y, `${where}: target ${i} spills off the TOP`).toBeGreaterThanOrEqual(area!.y - 4);
    expect(box!.y + box!.height, `${where}: target ${i} spills off the BOTTOM`).toBeLessThanOrEqual(
      area!.y + area!.height + 4
    );
    boxes.push({ x: box!.x, y: box!.y, w: box!.width, h: box!.height });

    // The label chip overflows the fixed-width button, so check it separately.
    const chip = await t.locator(".field-target-chip").boundingBox();
    expect(chip, `${where}: target ${i} chip has no box`).not.toBeNull();
    expect(chip!.x, `${where}: target ${i} CHIP spills off the LEFT of the field`).toBeGreaterThanOrEqual(
      area!.x - 4
    );
    expect(
      chip!.x + chip!.width,
      `${where}: target ${i} CHIP spills off the RIGHT of the field`
    ).toBeLessThanOrEqual(area!.x + area!.width + 4);
  }

  // No two targets stacked: centers must be meaningfully apart.
  for (let a = 0; a < boxes.length; a++) {
    for (let b = a + 1; b < boxes.length; b++) {
      const dx = boxes[a].x + boxes[a].w / 2 - (boxes[b].x + boxes[b].w / 2);
      const dy = boxes[a].y + boxes[a].h / 2 - (boxes[b].y + boxes[b].h / 2);
      const dist = Math.hypot(dx, dy);
      expect(dist, `${where}: targets ${a} & ${b} are stacked (${Math.round(dist)}px apart)`).toBeGreaterThan(26);
    }
  }

  // Red-zone states are the historically broken ones -- keep a picture.
  const redZone = /AWAY (\d+)/.exec(situation);
  if (redZone && Number(redZone[1]) <= 15) {
    await page.screenshot({ path: `${DIR}/audit-redzone.png` });
  }

  // The page itself must never scroll sideways.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${where}: horizontal page overflow`).toBeLessThanOrEqual(1);
}

test("layout audit: every down of five drives has a playable field", async ({ page }) => {
  // Five full drives with real play-resolution animation run ~7 minutes.
  test.setTimeout(560_000);
  await page.setViewportSize({ width: 480, height: 1000 });
  await page.goto("/");
  const gateButton = page.getByRole("button", { name: /practice drive/i });
  if (await gateButton.isVisible().catch(() => false)) await gateButton.click();

  const result = page.locator(".result-screen");
  const t0 = Date.now();
  for (let drive = 1; drive <= 5; drive++) {
    await page.locator(".player-grid .player-card").first().waitFor({ timeout: 20_000 });
    await page.locator(".coach-dismiss").click({ timeout: 3_000 }).catch(() => {});
    for (let pick = 1; pick <= 6; pick++) {
      // Drive 1 exercises the real card-pick flow; later drives take the
      // one-button scrub path (roster quality is irrelevant to layout).
      // Explicit timeouts everywhere: Playwright's default is UNLIMITED, so a
      // never-actionable element hangs the whole audit instead of failing.
      if (drive === 1) {
        const affordable = page.locator(".player-grid .player-card:not(.locked)").first();
        if (await affordable.count()) {
          await affordable.click({ timeout: 10_000 });
          continue;
        }
      }
      await page.locator(".scrub-btn").click({ timeout: 10_000 });
    }
    await page.getByRole("button", { name: /Run the Drive/ }).click({ timeout: 15_000 });
    await page.locator(".field-target").first().waitFor({ timeout: 20_000 });
    console.log(`drive ${drive} underway at +${Math.round((Date.now() - t0) / 1000)}s`);

    for (let down = 1; down <= 20; down++) {
      if (await result.isVisible().catch(() => false)) break;
      await auditDown(page, drive, down);
      // March downfield fast (rightmost target = deepest) so red-zone states
      // get exercised; the click itself is the tappability assertion.
      const handles = await page.locator(".field-target:not([disabled])").elementHandles();
      let deepest = handles[0];
      let maxX = -1;
      for (const h of handles) {
        const b = await h.boundingBox();
        if (b && b.x > maxX) {
          maxX = b.x;
          deepest = h;
        }
      }
      await deepest.click({ timeout: 10_000 });
      await page.locator(".result-screen, .field-target:not([disabled])").first().waitFor({ timeout: 20_000 });
      await page.waitForTimeout(150);
    }
    await expect(result).toBeVisible({ timeout: 20_000 });
    console.log(`drive ${drive} done at +${Math.round((Date.now() - t0) / 1000)}s`);
    await page.getByRole("button", { name: /New Draft|One more practice/ }).first().click({ timeout: 10_000 });
  }
});
