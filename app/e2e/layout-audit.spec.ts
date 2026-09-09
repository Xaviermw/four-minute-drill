import { expect, test, type Page } from "@playwright/test";

const DIR = "C:/Users/XAVIER~1/AppData/Local/Temp/claude/c--Users-Xavier-W-Documents-Final-Drive/24a30976-2c96-4a26-b5e2-8f5c589a2b6a/scratchpad";

// Layout audit: the coverage targets must be PLAYABLE in every game state,
// not just the opening snap. Born from a real bug: from the AWAY 13, medium
// and deep seats overflowed the goal line, clamped to the same edge pixel,
// and read as decoration instead of choices. This drives several full drives
// and asserts, on EVERY down: five enabled targets, all fully on the turf,
// none stacked, and the tapped one genuinely clickable. Red-zone downs get a
// screenshot for eyeballs.


/**
 * The broadcast camera pans for 800ms after each reveal, so measurement has to
 * happen on a still frame. Polling for a repeated transform is not enough on
 * its own: React commits the new transform a frame or two AFTER the targets
 * render, so two quick reads can both catch the OLD value and declare victory
 * before the pan starts -- which reported targets 120px off-screen that were
 * perfectly placed once the camera arrived. Hence the lead-in: give the
 * transition time to start, THEN wait for it to stop.
 */
async function waitForCameraSettled(page: Page): Promise<void> {
  await page.waitForTimeout(200); // let the transition actually begin
  await page.evaluate(() => {
    (window as unknown as { __camPrev?: string }).__camPrev = undefined;
  });
  await page.waitForFunction(
    () => {
      const el = document.querySelector(".field-world");
      if (!el) return true; // camera off (desktop) -- nothing to settle
      const now = getComputedStyle(el).transform;
      const w = window as unknown as { __camPrev?: string };
      const settled = w.__camPrev === now;
      w.__camPrev = now;
      return settled;
    },
    { timeout: 10_000, polling: 150 }
  );
}

async function auditDown(page: Page, drive: number, down: number): Promise<void> {
  const situation = (await page.locator(".scoreboard").innerText().catch(() => "?")).replace(/\s+/g, " ");
  const where = `drive ${drive}, down ${down} [${situation}]`;

  const targets = page.locator(".field-target");
  await expect(targets, `${where}: expected the 5-spot coverage`).toHaveCount(5);

  // ATOMIC MEASUREMENT. Reading the field box and then each target one await
  // at a time let layout shift mid-measurement -- the two-minute-warning
  // banner appearing between reads reported a target as off-screen when it
  // never was (flake, ~1 run in 4). One evaluate, one layout, one truth.
  // Containment is judged against the visible track: the broadcast camera
  // makes .field-playing-area wider than the screen, so the playing area
  // would no longer catch targets panned out of frame.
  const snap = await page.evaluate(() => {
    const track = document.querySelector(".field-track");
    const els = [...document.querySelectorAll(".field-target")];
    const r = (e: Element | null) => {
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    };
    return {
      area: r(track),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      targets: els.map((e) => ({
        box: r(e),
        chip: r(e.querySelector(".field-target-chip")),
        text: (e.textContent ?? "").replace(/\s+/g, " ").trim(),
        above: e.className.includes("chip-above"),
        disabled: (e as HTMLButtonElement).disabled,
      })),
    };
  });
  const area = snap.area;
  expect(area, `${where}: field track missing`).not.toBeNull();

  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  const chips: { x: number; y: number; w: number; h: number }[] = [];
  const chipDescs: string[] = [];
  for (let i = 0; i < snap.targets.length; i++) {
    const t = snap.targets[i];
    expect(t.disabled, `${where}: target ${i} disabled`).toBe(false);
    expect(t.box, `${where}: target ${i} has no box`).not.toBeNull();
    expect(t.chip, `${where}: target ${i} chip has no box`).not.toBeNull();
    const box = t.box!;
    const chip = t.chip!;
    expect(
      box.x,
      `${where}: target ${i} ("${t.text}") spills off the LEFT — box.x=${Math.round(box.x)} area.x=${Math.round(area!.x)} area.w=${Math.round(area!.w)} short by ${Math.round(area!.x - box.x)}px`
    ).toBeGreaterThanOrEqual(area!.x - 4);
    expect(
      box.x + box.w,
      `${where}: target ${i} spills off the RIGHT of the field (the AWAY-13 bug)`
    ).toBeLessThanOrEqual(area!.x + area!.w + 4);
    expect(box.y, `${where}: target ${i} spills off the TOP`).toBeGreaterThanOrEqual(area!.y - 4);
    expect(box.y + box.h, `${where}: target ${i} spills off the BOTTOM`).toBeLessThanOrEqual(area!.y + area!.h + 4);
    expect(chip.x, `${where}: target ${i} CHIP spills off the LEFT of the field`).toBeGreaterThanOrEqual(area!.x - 4);
    expect(chip.x + chip.w, `${where}: target ${i} CHIP spills off the RIGHT of the field`).toBeLessThanOrEqual(
      area!.x + area!.w + 4
    );
    expect(chip.y, `${where}: target ${i} CHIP spills off the TOP of the field`).toBeGreaterThanOrEqual(area!.y - 4);
    expect(chip.y + chip.h, `${where}: target ${i} CHIP spills off the BOTTOM of the field`).toBeLessThanOrEqual(
      area!.y + area!.h + 4
    );
    boxes.push({ x: box.x, y: box.y, w: box.w, h: box.h });
    chips.push({ x: chip.x, y: chip.y, w: chip.w, h: chip.h });
    chipDescs.push(`"${t.text}" ${t.above ? "above" : "below"} @${Math.round(chip.x)}..${Math.round(chip.x + chip.w)},y${Math.round(chip.y)}`);
  }

  // No two labels may overlap -- the mobile "texts mash together" bug. A 2px
  // tolerance forgives borders kissing; real overlap fails.
  for (let a = 0; a < chips.length; a++) {
    for (let b = a + 1; b < chips.length; b++) {
      const xOver = Math.min(chips[a].x + chips[a].w, chips[b].x + chips[b].w) - Math.max(chips[a].x, chips[b].x);
      const yOver = Math.min(chips[a].y + chips[a].h, chips[b].y + chips[b].h) - Math.max(chips[a].y, chips[b].y);
      if (xOver > 2 && yOver > 2) await page.screenshot({ path: `${DIR}/audit-mash.png` });
      expect(
        xOver > 2 && yOver > 2,
        `${where}: chips overlap (${Math.round(xOver)}x${Math.round(yOver)}px): ${chipDescs[a]} vs ${chipDescs[b]}`
      ).toBe(false);
    }
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

  // NOTE deliberately absent: a short<med<deep ring-ordering assertion. It
  // was written when chips carried visible depth tags that could contradict
  // position; the owner then removed the tags (names only), so position
  // can't lie -- and duplicate-depth deals (two SHORTs) make strict ordering
  // geometrically unsatisfiable across three lanes. Seating still PREFERS
  // depth bands (DriveScreen offsets); spacing outranks ordering.

  // Red-zone states are the historically broken ones -- keep a picture.
  const redZone = /AWAY (\d+)/.exec(situation);
  if (redZone && Number(redZone[1]) <= 15) {
    await page.screenshot({ path: `${DIR}/audit-redzone.png` });
  }

  // The page itself must never scroll sideways (from the same snapshot).
  expect(snap.overflow, `${where}: horizontal page overflow`).toBeLessThanOrEqual(1);
}

test("layout audit: every down of five drives has a playable field", async ({ page }) => {
  // Five full drives with real play-resolution animation run ~7 minutes.
  test.setTimeout(560_000);
  // Phone width: the tightest layout -- every px-overlap check is strictest
  // here, and the wider desktop field passes a fortiori.
  await page.setViewportSize({ width: 360, height: 800 });
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
    await waitForCameraSettled(page);
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
      await waitForCameraSettled(page);
    }
    await expect(result).toBeVisible({ timeout: 20_000 });
    console.log(`drive ${drive} done at +${Math.round((Date.now() - t0) / 1000)}s`);
    await page.getByRole("button", { name: /New Draft|One more practice/ }).first().click({ timeout: 10_000 });
  }
});
