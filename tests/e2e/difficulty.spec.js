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

/* The game opens on a main menu now. Every spec starts on the board, so this
   is the one place that knows how to get there. */
async function enterGame(page){
  const title = page.locator("#title");
  /* The menu is drawn by start(), which may be deferred a tick by the artifact
     host; asking isVisible() too early answers no and leaves the test on the
     menu it thought it had walked past. */
  await title.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await title.isVisible()) await page.click("#titlePlay");
  await expect(title).toBeHidden();
}

async function open(page) {
  await page.goto(GAME);
  await enterGame(page);
  if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
  if (await page.locator("#veil").isVisible()) await page.click("#closeHelp");
  await expect(page.locator("#veil")).toBeHidden();
}

test.describe("choosing how hard", () => {
  /* Everything below asserts the game as balanced, so it pins SCHOLAR. The two
     tests about what a NEW player gets clear that themselves. */
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      /* Only when nothing is stored, so a test can make a choice, reload, and
         still find it there. */
      try {
        if (localStorage.getItem("overtone:difficulty") === null)
          localStorage.setItem("overtone:difficulty", JSON.stringify("scholar"));
      } catch (e) {}
    });
  });

  test("it is on the main menu, described, with the current one marked",
    async ({ page }) => {
      await page.goto(GAME);
      await expect(page.locator("#title")).toBeVisible();
      const opts = page.locator("#title .diffopt");
      await expect(opts).toHaveCount(2);
      await expect(page.locator('#title .diffopt[data-diff="scholar"]'))
        .toHaveAttribute("aria-pressed", "true");
      /* it has to say what it does, not just its name */
      await expect(page.locator('#title .diffopt[data-diff="apprentice"]')).toContainText("discard");
    });

  test("a first run starts on APPRENTICE, and is told why", async ({ page }) => {
    /* nothing stored at all: somebody opening this for the first time */
    await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto(GAME);
    await expect(page.locator("#title")).toBeVisible();
    await expect(page.locator('#title .diffopt[data-diff="apprentice"]'))
      .toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".diffopt .tip")).toHaveText("START HERE");
    await expect(page.locator(".setnote")).toContainText("Four runs in five");
    expect(await page.evaluate(() => difficulty().id)).toBe("apprentice");
  });

  test("somebody who has played before is left where they were", async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.clear(); localStorage.setItem("overtone:runs", "9"); } catch (e) {}
    });
    await page.goto(GAME);
    await expect(page.locator("#title")).toBeVisible();
    expect(await page.evaluate(() => difficulty().id), "a returning player was moved to the easy curve")
      .toBe("scholar");
    await expect(page.locator(".diffopt .tip")).toHaveCount(0);
  });

  test("picking it sticks, and says it lands on the next run", async ({ page }) => {
    await open(page);
    await page.click("#menuBtn");
    await expect(page.locator("#panel h2")).toHaveText("Menu");
    /* the main menu carries the same control, so scope to the one on screen */
    await page.click('#panel .diffopt[data-diff="apprentice"]');
    await expect(page.locator('#panel .diffopt[data-diff="apprentice"]'))
      .toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#panel .setnote")).toContainText("still");
    /* the run on the table is untouched */
    expect(await page.evaluate(() => runDifficulty().id)).toBe("scholar");
    await page.reload();
    await enterGame(page);
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

/* ------------------------------------------------------------------ */
test.describe("the menu", () => {
  /* Difficulty, sound and the rules used to be behind a music note, which is
     not where anyone looks for how hard a game is. One door now. */
  test("one door holds difficulty, sound, the rules and your runs", async ({ page }) => {
    await open(page);
    await page.click("#menuBtn");
    const panel = page.locator("#panel");
    await expect(panel.locator("h2")).toHaveText("Menu");
    await expect(panel.locator(".diffopt")).toHaveCount(2);        // how hard
    await expect(panel.locator(".switch")).toHaveCount(3);          // sound & feel
    await expect(panel.locator(".menuitem")).toHaveCount(3);        // read up
    await expect(panel.locator(".runstat > div")).toHaveCount(3);   // your runs
    await expect(panel).toContainText("Runs played");
  });

  test("it shows what the game has been quietly keeping", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      localStorage.setItem("overtone:runs", "14");
      localStorage.setItem("overtone:best", "41280");
      localStorage.setItem("overtone:best:apprentice", "88120");
    });
    await page.click("#menuBtn");
    const stats = page.locator(".runstat");
    await expect(stats).toContainText("14");
    await expect(stats).toContainText("41,280");
    await expect(stats).toContainText("88,120");
  });

  test("every door out of it comes back to it", async ({ page }) => {
    await open(page);
    await page.click("#menuBtn");
    await page.click("#menuFigs");
    await expect(page.locator(".figtab")).toBeVisible();
    await page.click("#figsBack");
    await expect(page.locator("#panel h2")).toHaveText("Menu");

    await page.click("#menuHelp");
    await expect(page.locator("#panel h2")).toContainText("How Overtone works");
    await page.click("#helpBack");
    await expect(page.locator("#panel h2")).toHaveText("Menu");
  });

  test("the tutorial can be run again from it", async ({ page }) => {
    await open(page);
    await page.click("#menuBtn");
    await page.click("#menuTut");
    await expect(page.locator("#veil")).toBeHidden();
    await expect(page.locator("#tut")).toBeVisible();
    await expect(page.locator("#tutStep")).toContainText("1 of");
  });

  test("the board still says when the sound is off", async ({ page }) => {
    await open(page);
    /* it moved into the menu, so the state has to be legible without opening it */
    await expect(page.locator("#muteDot")).toBeHidden();
    await page.click("#menuBtn");
    await page.locator('.switch[data-pref="music"]').click();
    await page.locator('.switch[data-pref="sfx"]').click();
    await page.click("#closeSettings");
    await expect(page.locator("#muteDot")).toBeVisible();
  });

  test("it fits a phone", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "portrait budget");
    await open(page);
    await page.click("#menuBtn");
    await page.waitForTimeout(300);
    const fit = await page.evaluate(() => {
      const panel = document.getElementById("panel");
      const r = panel.getBoundingClientRect();
      return { sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
               inView: r.left >= -1 && r.right <= innerWidth + 1,
               reachable: panel.scrollHeight > panel.clientHeight
                 ? getComputedStyle(panel).overflowY !== "visible" : true };
    });
    expect(fit.sideways, "the menu pushes the page sideways").toBeLessThanOrEqual(1);
    expect(fit.inView, "the menu runs off the side").toBe(true);
    expect(fit.reachable, "the menu is taller than the screen and cannot be scrolled").toBe(true);
  });
});
