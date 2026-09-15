/* APPRENTICE: the same game with room to be wrong in.
 *
 * The rules that matter are the ones that keep it honest — a run cannot change
 * difficulty underneath itself, and a score from the gentler curve never gets
 * compared to one from the steeper.
 */
const { test, expect } = require("@playwright/test");
const path = require("path");
const { pathToFileURL } = require("url");

const GAME = pathToFileURL(path.resolve(__dirname, "..", "..", "index.html")).href;

async function open(page) {
  await page.goto(GAME);
  if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
  if (await page.locator("#veil").isVisible()) await page.click("#closeHelp");
  await expect(page.locator("#veil")).toBeHidden();
}

test.describe("choosing how hard", () => {
  test("the setting is there, and SCHOLAR is what you get by default", async ({ page }) => {
    await open(page);
    await page.click("#soundBtn");
    await expect(page.locator("#panel h2")).toHaveText("Settings");
    const opts = page.locator(".diffopt");
    await expect(opts).toHaveCount(2);
    await expect(page.locator('.diffopt[data-diff="scholar"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('.diffopt[data-diff="apprentice"]')).toHaveAttribute("aria-pressed", "false");
    /* it has to say what it does, not just its name */
    await expect(page.locator('.diffopt[data-diff="apprentice"]')).toContainText("discard");
  });

  test("picking it sticks, and says it lands on the next run", async ({ page }) => {
    await open(page);
    await page.click("#soundBtn");
    await page.click('.diffopt[data-diff="apprentice"]');
    await expect(page.locator('.diffopt[data-diff="apprentice"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".setnote")).toContainText("still");
    /* the run on the table is untouched */
    expect(await page.evaluate(() => runDifficulty().id)).toBe("scholar");
    await page.reload();
    if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
    expect(await page.evaluate(() => difficulty().id), "the choice did not survive a reload")
      .toBe("apprentice");
  });

  test("a new run under it asks for less and hands you another discard", async ({ page }) => {
    await open(page);
    const before = await page.evaluate(() => {
      newRun("diff-test", true);
      return { targets: [0, 3, 7].map(r => roundShape(r).target), discards: roundShape(0).discards };
    });
    const after = await page.evaluate(() => {
      setPref("difficulty", "apprentice");
      newRun("diff-test", true);
      return { targets: [0, 3, 7].map(r => roundShape(r).target), discards: roundShape(0).discards,
               pinned: G.diff };
    });
    expect(after.pinned).toBe("apprentice");
    expect(after.discards, "no extra discard").toBe(before.discards + 1);
    after.targets.forEach((t, i) => {
      expect(t, "round " + i + " is not easier").toBeLessThan(before.targets[i]);
    });
    /* the same deck, though — an easier curve, not a different game */
    const sameDeck = await page.evaluate(() => {
      const easy = G.deck.concat(G.hand, G.discard).map(c => c.w).sort().join(",");
      setPref("difficulty", "scholar");
      newRun("diff-test", true);
      const hard = G.deck.concat(G.hand, G.discard).map(c => c.w).sort().join(",");
      return easy === hard;
    });
    expect(sameDeck, "APPRENTICE changed the deck, not just the curve").toBe(true);
  });

  test("a run cannot change difficulty underneath itself", async ({ page }) => {
    await open(page);
    const held = await page.evaluate(() => {
      setPref("difficulty", "scholar");
      newRun("pin-test", true);
      const was = roundShape(6).target;
      /* a player switching at round 7 to duck the wall */
      setPref("difficulty", "apprentice");
      return { was, now: roundShape(6).target, run: runDifficulty().id, setting: difficulty().id };
    });
    expect(held.now, "the run's targets moved when the setting did").toBe(held.was);
    expect(held.run).toBe("scholar");
    expect(held.setting).toBe("apprentice");
  });

  test("the board and the share block both name it", async ({ page }) => {
    await open(page);
    const out = await page.evaluate(() => {
      setPref("difficulty", "apprentice");
      newRun("name-test", true);
      renderControls();
      G.total = 4321;
      return { label: document.getElementById("seedLabel").textContent, share: shareText(false) };
    });
    expect(out.label).toContain("APPRENTICE");
    expect(out.share).toContain("APPRENTICE");

    const scholar = await page.evaluate(() => {
      setPref("difficulty", "scholar");
      newRun("name-test", true);
      renderControls();
      return { label: document.getElementById("seedLabel").textContent, share: shareText(false) };
    });
    /* the default is not worth saying, so a normal share is unchanged */
    expect(scholar.label).not.toContain("SCHOLAR");
    expect(scholar.share).not.toContain("SCHOLAR");
  });

  test("a gentler total is never a best on the steeper curve", async ({ page }) => {
    await open(page);
    const keys = await page.evaluate(() => {
      localStorage.clear();
      setPref("difficulty", "apprentice");
      newRun("best-test", true);
      G.total = 999999; G.round = 2;
      endRun(false);
      hidePanel();
      return { best: localStorage.getItem("overtone:best"),
               easy: localStorage.getItem("overtone:best:apprentice") };
    });
    expect(keys.easy, "the gentler run was not recorded at all").toBe("999999");
    expect(keys.best, "a gentler total overwrote the real best").toBeNull();
  });
});

test.describe("the offer to somebody the curve is beating", () => {
  const die = (runs, round) => page => page.evaluate(([r, rd]) => {
    localStorage.setItem("overtone:runs", String(r - 1));
    setPref("difficulty", "scholar");
    newRun("offer-test", true);
    G.round = rd; G.total = 500;
    endRun(false);
  }, [runs, round]);

  test("shows up after a few early losses, and starts the gentler run", async ({ page }) => {
    await open(page);
    await die(3, 1)(page);
    await page.waitForTimeout(400);
    await expect(page.locator(".softer")).toBeVisible();
    await expect(page.locator(".softer")).toContainText("APPRENTICE");
    await page.click("#goEasy");
    await expect(page.locator("#veil")).toBeHidden();
    expect(await page.evaluate(() => runDifficulty().id)).toBe("apprentice");
  });

  test("stays quiet on a first run, on a deep run, and once you took it",
    async ({ page }) => {
      await open(page);
      await die(1, 1)(page);                       // first run — too early to say it
      await page.waitForTimeout(300);
      await expect(page.locator(".softer")).toHaveCount(0);

      await page.evaluate(() => hidePanel());
      await die(6, 5)(page);                       // got to round 6 — the curve is not the problem
      await page.waitForTimeout(300);
      await expect(page.locator(".softer")).toHaveCount(0);

      await page.evaluate(() => hidePanel());
      await page.evaluate(() => {
        localStorage.setItem("overtone:runs", "5");
        setPref("difficulty", "apprentice");       // already taking it
        newRun("offer-test", true);
        G.round = 1; G.total = 500;
        endRun(false);
      });
      await page.waitForTimeout(300);
      await expect(page.locator(".softer")).toHaveCount(0);
    });
});
