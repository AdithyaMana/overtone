/* APPRENTICE: the same game with room to be wrong in.
 *
 * The rules that matter are the ones that keep it honest — a run cannot change
 * difficulty underneath itself, and a score from the gentler curve never gets
 * compared to one from the steeper.
 */
const { test, expect } = require("@playwright/test");

/* resolved against baseURL in playwright.config.js */
const GAME = "/index.html";

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

/* Read the key back before reloading, so a spec that meant to test persistence
   fails on the write rather than three lines later on the read.

   This used to carry a 150ms sleep as well, on the theory that Chromium was
   losing the write on its way to the browser process. It was not. The specs
   were loading the game over file://, where Chromium keeps its own odd corner
   of localStorage: under load, five to eight reloads in thirty came up with
   the WHOLE area empty, not just the last key, and the suite's own beforeEach
   then wrote its defaults over the top. Over http the same measurement was
   thirty for thirty. The specs serve the game now (playwright.config.js), so
   there is nothing left to sleep for. */
async function reloadKeeping(page, key, value) {
  /* First that the page really wrote what the test thinks it wrote. */
  await expect.poll(async () =>
    page.evaluate(k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, key),
    { timeout: 3000 }).toContain(value);
  await page.reload();
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
        if (localStorage.getItem("overtone:sawFlaw") === null)
          localStorage.setItem("overtone:sawFlaw", "true");
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
      await expect(page.locator("#title .setnote")).toContainText("multiplying");
      await page.click('#title .diffopt[data-diff="apprentice"]');
      await expect(page.locator("#title .setnote")).toContainText("discard");
    });

  test("a first run starts on APPRENTICE, and cannot start anywhere else",
    async ({ page }) => {
      /* nothing stored at all: somebody opening this for the first time */
      await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
      await page.goto(GAME);
      await expect(page.locator("#title")).toBeVisible();
      await expect(page.locator('#title .diffopt[data-diff="apprentice"]'))
        .toHaveAttribute("aria-pressed", "true");
      /* SCHOLAR ends four runs in five; handing it to somebody on their first
         screen is how a first session becomes their only one */
      const scholar = page.locator('#title .diffopt[data-diff="scholar"]');
      await expect(scholar).toBeDisabled();
      await expect(scholar.locator(".tip")).toHaveText("Locked");
      await expect(page.locator("#title .setnote")).toContainText("opens once you finish a run");
      expect(await page.evaluate(() => difficulty().id)).toBe("apprentice");

      /* and pressing it changes nothing */
      await scholar.click({ force: true }).catch(() => {});
      expect(await page.evaluate(() => difficulty().id)).toBe("apprentice");
    });

  test("finishing one run opens it, and says so where they are looking",
    async ({ page }) => {
      await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
      await page.goto(GAME);
      await page.click("#titlePlay");
      if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
      await page.evaluate(() => { G.plays = 0; endRun(false); });
      await expect(page.locator("#panel .unlock.open")).toContainText("SCHOLAR");

      /* and it is live on the menu from then on, with the run they just
         finished left where it was */
      await page.click("#againNew");
      await page.click("#homeBtn");
      const scholar = page.locator('#title .diffopt[data-diff="scholar"]');
      await expect(scholar).toBeEnabled();
      await expect(scholar.locator(".tip")).toHaveCount(0);
      await scholar.click();
      expect(await page.evaluate(() => difficulty().id)).toBe("scholar");
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
    await expect(page.locator('#title .diffopt[data-diff="scholar"]')).toBeEnabled();
  });

  test("picking it sticks, and says it lands on the next run", async ({ page }) => {
    await open(page);
    /* mid-run, from the board: the way back to the menu is a door on the
       masthead, not a line inside a panel */
    await page.click("#homeBtn");
    await expect(page.locator("#title")).toBeVisible();
    await page.click('#title .diffopt[data-diff="apprentice"]');
    await expect(page.locator('#title .diffopt[data-diff="apprentice"]'))
      .toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#title .setnote")).toContainText("still");
    /* the run on the table is untouched, and resuming it does not re-deal */
    expect(await page.evaluate(() => runDifficulty().id)).toBe("scholar");
    await page.click("#titleResume");
    await expect(page.locator("#title")).toBeHidden();
    expect(await page.evaluate(() => runDifficulty().id)).toBe("scholar");

    await reloadKeeping(page, "overtone:difficulty", "apprentice");
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
test.describe("the rules describe the game you are in", () => {
  const onDiff = id => async page => {
    await page.addInitScript(d => {
      try {
        localStorage.clear();
        localStorage.setItem("overtone:tutorial", "true");
        localStorage.setItem("overtone:coached", "true");
        localStorage.setItem("overtone:sawFlaw", "true");
        localStorage.setItem("overtone:runs", "3");
        localStorage.setItem("overtone:difficulty", JSON.stringify(d));
      } catch (e) {}
    }, id);
    await page.goto(GAME);
    await enterGame(page);
    await page.click("#helpBtn");
    await expect(page.locator("#panel h2")).toContainText("How Overtone works");
  };

  test("APPRENTICE is told it meets one Ordeal, at the end", async ({ page }) => {
    await onDiff("apprentice")(page);
    const panel = page.locator("#panel");
    await expect(panel).toContainText("The last round is an Ordeal");
    /* and never named the ones it cannot be dealt */
    await expect(panel).not.toContainText("no discards");
    await expect(panel).not.toContainText("four-card hand");
  });

  test("SCHOLAR is told it meets three", async ({ page }) => {
    await onDiff("scholar")(page);
    await expect(page.locator("#panel")).toContainText("Three rounds are Ordeals");
  });

  test("and APPRENTICE actually is dealt one, at round 8", async ({ page }) => {
    await onDiff("apprentice")(page);
    const met = await page.evaluate(() => {
      const out = [];
      for (let r = 0; r < ROUNDS; r++) if (G.ordealOrder[r]) out.push(r);
      return out;
    });
    expect(met).toEqual([7]);
  });

  test("and SCHOLAR three", async ({ page }) => {
    await onDiff("scholar")(page);
    const met = await page.evaluate(() => {
      const out = [];
      for (let r = 0; r < ROUNDS; r++) if (G.ordealOrder[r]) out.push(r);
      return out;
    });
    expect(met).toEqual([3, 5, 7]);
  });
});

/* ------------------------------------------------------------------ */
test.describe("the menu", () => {
  /* There are two, and they are not the same menu. The title screen holds
     everything you decide BETWEEN runs — how hard, the rules, your record.
     The button on the board holds the one thing you reach for DURING one. */
  test("the board's button is sound, and only sound", async ({ page }) => {
    await open(page);
    await page.click("#menuBtn");
    const panel = page.locator("#panel");
    await expect(panel.locator("h2")).toHaveText("Sound & feel");
    await expect(panel.locator(".switch")).toHaveCount(3);
    /* the second copy of the title screen that used to live in here */
    await expect(panel.locator(".diffopt")).toHaveCount(0);
    await expect(panel.locator(".runstat")).toHaveCount(0);
    /* and one way out of it, not two saying the same thing */
    await expect(panel.locator(".rowend .btn")).toHaveCount(1);
  });

  test("the title screen shows what the game has been quietly keeping",
    async ({ page }) => {
      await page.addInitScript(() => {
        try {
          localStorage.setItem("overtone:runs", "14");
          localStorage.setItem("overtone:best", "41280");
          localStorage.setItem("overtone:best:apprentice", "88120");
        } catch (e) {}
      });
      await page.goto(GAME);
      const stats = page.locator("#title .runstat");
      await expect(stats).toContainText("14");
      await expect(stats).toContainText("41,280");
      await expect(stats).toContainText("88,120");
    });

  test("the board has a door back to the title, and it keeps the run",
    async ({ page }) => {
      await open(page);
      await page.click("#hand .card >> nth=0");
      await page.click("#homeBtn");
      await expect(page.locator("#title")).toBeVisible();
      /* the run is still there, and the menu offers it before it offers a new one */
      await expect(page.locator("#titleResume")).toBeVisible();
      await page.click("#titleResume");
      await expect(page.locator("#title")).toBeHidden();
      await expect(page.locator("#hand .card.sel")).toHaveCount(1);
    });

  test("the tutorial can be run again from the title", async ({ page }) => {
    await open(page);
    await page.click("#homeBtn");
    await page.click("#titleTut");
    await expect(page.locator("#title")).toBeHidden();
    await expect(page.locator("#veil")).toBeHidden();
    await expect(page.locator("#tut")).toBeVisible();
    await expect(page.locator("#tutStep")).toContainText("1 of");
  });

  test("the arrow keys walk it, the way a menu is walked", async ({ page }) => {
    /* somebody with a run behind them, so both difficulties are open and
       left/right has somewhere to go */
    await page.addInitScript(() => {
      try {
        localStorage.setItem("overtone:runs", "3");
        localStorage.setItem("overtone:tutorial", "true");
      } catch (e) {}
    });
    await page.goto(GAME);
    await expect(page.locator("#title")).toBeVisible();
    await page.keyboard.press("ArrowDown");                 // onto PLAY
    expect(await page.evaluate(() => document.activeElement.id)).toBe("titlePlay");
    await page.keyboard.press("ArrowDown");                 // onto how hard
    expect(await page.evaluate(() =>
      document.activeElement.className)).toContain("diffopt");
    /* left and right change the setting you are standing on */
    const was = await page.evaluate(() => difficulty().id);
    await page.keyboard.press("ArrowRight");
    expect(await page.evaluate(() => difficulty().id)).not.toBe(was);
    await page.keyboard.press("ArrowUp");
    expect(await page.evaluate(() => document.activeElement.id)).toBe("titlePlay");
    await page.keyboard.press("Enter");
    await expect(page.locator("#title")).toBeHidden();
  });

  test("the board still says when the sound is off", async ({ page }) => {
    await open(page);
    /* it is one button away, so the state has to be legible without pressing it */
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
