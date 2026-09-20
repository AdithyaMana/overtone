/* Two curves, and which name carries which.
 *
 * SCHOLAR is the gentler curve and APPRENTICE the steeper one — the roles moved
 * once, so nothing below names a mode. Every test reads the ROLES off the
 * game's own DIFFICULTIES table and asserts the contract: the gentlest mode is
 * what a first run starts on, the steepest is what a finished run unlocks, a
 * run cannot change difficulty underneath itself, and a score from one curve is
 * never compared to a score from another. Relabelling the modes must not
 * require touching this file.
 */
const { test, expect } = require("@playwright/test");

/* resolved against baseURL in playwright.config.js */
const GAME = "/index.html";

/* The game opens on a main menu now. Every spec starts on the board, so this
   is the one place that knows how to get there. */
/* Hiding the overtones is an opt-in preference now rather than a property of a
   difficulty, but a profile that has one set still reads its cards differently.
   Teach the profile the lexicon so the cards read the way these tests assume.
   The specs about hiding do their own thing and never call this. */
async function learnEverything(page) {
  await page.evaluate(() => {
    if (typeof LEXICON === "undefined") return;
    LEXICON.forEach(e => { LEARNED[e.w] = 1; });
    store.set("learned", LEARNED);
    if (typeof render === "function" && typeof G !== "undefined" && G) render();
  });
}

async function enterGame(page){
  const title = page.locator("#title");
  /* The menu is drawn by start(), which may be deferred a tick by the artifact
     host; asking isVisible() too early answers no and leaves the test on the
     menu it thought it had walked past. */
  await title.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await title.isVisible()) await page.click("#titlePlay");
  await expect(title).toBeHidden();
  await learnEverything(page);
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
/* The gentlest and steepest modes, by rank, as the running game reports them.
   Every assertion about "the easy one" or "the hard one" resolves through here
   rather than spelling a name. */
async function roles(page) {
  return page.evaluate(() => {
    const byRank = DIFFICULTIES.slice().sort((a, b) => a.rank - b.rank);
    const g = byRank[0], s = byRank[byRank.length - 1];
    return { gentle: g.id, gentleName: g.n, gentleDesc: g.d,
             steep: s.id, steepName: s.n, steepDesc: s.d,
             gentleOrdeals: g.ordealRounds.length, steepOrdeals: s.ordealRounds.length };
  });
}
const pill = id => `#title .diffopt[data-diff="${id}"]`;

async function reloadKeeping(page, key, value) {
  /* First that the page really wrote what the test thinks it wrote. */
  await expect.poll(async () =>
    page.evaluate(k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, key),
    { timeout: 3000 }).toContain(value);
  await page.reload();
}


test.describe("choosing how hard", () => {
  /* Everything below asserts the steeper curve, so it pins the steepest mode by
     rank rather than by name. The two tests about what a NEW player gets clear
     that themselves. curvesMigrated is set so the one-time role swap does not
     rewrite what a test just stored. */
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      /* Only when nothing is stored, so a test can make a choice, reload, and
         still find it there. */
      try {
        localStorage.setItem("overtone:curvesMigrated", "true");
        if (localStorage.getItem("overtone:difficulty") === null)
          /* A literal, unavoidably: addInitScript runs before the page loads,
             so DIFFICULTIES does not exist yet to be read. */
          localStorage.setItem("overtone:difficulty", JSON.stringify("scholar"));
        if (localStorage.getItem("overtone:sawFlaw") === null)
          localStorage.setItem("overtone:sawFlaw", "true");
        if (localStorage.getItem("overtone:runs") === null)
          localStorage.setItem("overtone:runs", "9");
      } catch (e) {}
    });
  });

  test("it is on the main menu, described, with the current one marked",
    async ({ page }) => {
      await page.goto(GAME);
      await expect(page.locator("#title")).toBeVisible();
      const opts = page.locator("#title .diffopt");
      await expect(opts).toHaveCount(2);
      const r = await roles(page);
      await expect(page.locator(pill(r.steep))).toHaveAttribute("aria-pressed", "true");
      /* It has to say what it DOES, not just its name — the names run against
         their ordinary sense, so the description is what a player reads. */
      await expect(page.locator("#title .setnote")).toContainText("harder");
      await page.click(pill(r.gentle));
      await expect(page.locator("#title .setnote")).toContainText("easier");
    });

  test("a first run starts on the gentlest mode, and cannot start anywhere else",
    async ({ page }) => {
      /* nothing stored at all: somebody opening this for the first time */
      await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
      await page.goto(GAME);
      await expect(page.locator("#title")).toBeVisible();
      const r = await roles(page);
      await expect(page.locator(pill(r.gentle))).toHaveAttribute("aria-pressed", "true");
      /* The steeper curve loses most of its runs; handing it to somebody on
         their first screen is how a first session becomes their only one. */
      const steep = page.locator(pill(r.steep));
      await expect(steep).toBeDisabled();
      await expect(steep.locator(".tip")).toHaveText("Locked");
      await expect(page.locator("#title .setnote")).toContainText("opens once you finish a run");
      expect(await page.evaluate(() => difficulty().id)).toBe(r.gentle);

      /* and pressing it changes nothing */
      await steep.click({ force: true }).catch(() => {});
      expect(await page.evaluate(() => difficulty().id)).toBe(r.gentle);
    });

  test("finishing one run opens it, and says so where they are looking",
    async ({ page }) => {
      await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
      await page.goto(GAME);
      await page.click("#titlePlay");
      if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
      const r = await roles(page);
      await page.evaluate(() => { G.plays = 0; endRun(false); });
      await expect(page.locator("#panel .unlock.open")).toContainText(r.steepName);

      /* and it is live on the menu from then on, with the run they just
         finished left where it was */
      await page.click("#againNew");
      await page.click("#homeBtn");
      const steep = page.locator(pill(r.steep));
      await expect(steep).toBeEnabled();
      await expect(steep.locator(".tip")).toHaveCount(0);
      await steep.click();
      expect(await page.evaluate(() => difficulty().id)).toBe(r.steep);
    });

  test("somebody who has played before has both curves open", async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        localStorage.setItem("overtone:runs", "9");
        localStorage.setItem("overtone:curvesMigrated", "true");
      } catch (e) {}
    });
    await page.goto(GAME);
    await expect(page.locator("#title")).toBeVisible();
    await expect(page.locator(".diffopt .tip"), "a finished run did not open everything")
      .toHaveCount(0);
    const r = await roles(page);
    await expect(page.locator(pill(r.gentle))).toBeEnabled();
    await expect(page.locator(pill(r.steep))).toBeEnabled();
  });

  test("picking it sticks, and says it lands on the next run", async ({ page }) => {
    await open(page);
    /* mid-run, from the board: the way back to the menu is a door on the
       masthead, not a line inside a panel */
    await page.click("#homeBtn");
    await expect(page.locator("#title")).toBeVisible();
    const r = await roles(page);
    await page.click(pill(r.gentle));
    await expect(page.locator(pill(r.gentle))).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#title .setnote")).toContainText("still");
    /* the run on the table is untouched, and resuming it does not re-deal */
    expect(await page.evaluate(() => runDifficulty().id)).toBe(r.steep);
    await page.click("#titleResume");
    await expect(page.locator("#title")).toBeHidden();
    expect(await page.evaluate(() => runDifficulty().id)).toBe(r.steep);

    await reloadKeeping(page, "overtone:difficulty", r.gentle);
    await enterGame(page);
    if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
    expect(await page.evaluate(() => difficulty().id), "the choice did not survive a reload")
      .toBe(r.gentle);
  });

  test("a new run under the gentler curve asks for less at every round, and hands you another discard",
    async ({ page }) => {
    await open(page);
    const r = await roles(page);
    const before = await page.evaluate(() => {
      newRun("diff-test", true);
      const rounds = [...Array(ROUNDS).keys()];
      return { targets: rounds.map(i => roundShape(i).target), discards: roundShape(0).discards };
    });
    const after = await page.evaluate(gentle => {
      setPref("difficulty", gentle);
      newRun("diff-test", true);
      const rounds = [...Array(ROUNDS).keys()];
      return { targets: rounds.map(i => roundShape(i).target), discards: roundShape(0).discards,
               pinned: G.diff };
    }, r.gentle);
    expect(after.pinned).toBe(r.gentle);
    expect(after.discards, "no extra discard").toBe(before.discards + 1);
    after.targets.forEach((t, i) => {
      expect(t, "round " + (i + 1) + " is not easier on the gentler curve")
        .toBeLessThan(before.targets[i]);
    });
    /* and the curve climbs — the old gentle curve DIPPED at round 2, which is
       why nothing ever died there */
    after.targets.forEach((t, i) => {
      if (i === 0) return;
      expect(t, "round " + (i + 1) + " asks for less than round " + i)
        .toBeGreaterThan(after.targets[i - 1]);
    });
    /* the same deck, though — an easier curve, not a different game */
    const sameDeck = await page.evaluate(steep => {
      const easy = G.deck.concat(G.hand, G.discard).map(c => c.w).sort().join(",");
      setPref("difficulty", steep);
      newRun("diff-test", true);
      const hard = G.deck.concat(G.hand, G.discard).map(c => c.w).sort().join(",");
      return easy === hard;
    }, r.steep);
    expect(sameDeck, "the gentler curve changed the deck, not just the numbers").toBe(true);
  });

  test("a run cannot change difficulty underneath itself", async ({ page }) => {
    await open(page);
    const r = await roles(page);
    const held = await page.evaluate(([steep, gentle]) => {
      setPref("difficulty", steep);
      newRun("pin-test", true);
      const was = roundShape(ROUNDS - 1).target;
      /* a player switching at the last round to duck the wall */
      setPref("difficulty", gentle);
      return { was, now: roundShape(ROUNDS - 1).target,
               run: runDifficulty().id, setting: difficulty().id };
    }, [r.steep, r.gentle]);
    expect(held.now, "the run's targets moved when the setting did").toBe(held.was);
    expect(held.run, "the run did not keep the curve it started on").toBe(r.steep);
    expect(held.setting, "the setting did not move").toBe(r.gentle);
  });

  test("the board and the share block both name it", async ({ page }) => {
    await open(page);
    const r = await roles(page);
    const out = await page.evaluate(steep => {
      setPref("difficulty", steep);
      newRun("name-test", true);
      renderControls();
      G.total = 4321;
      return { label: document.getElementById("seedLabel").textContent, share: shareText(false) };
    }, r.steep);
    expect(out.label).toContain(r.steepName);
    expect(out.share).toContain(r.steepName);

    const dflt = await page.evaluate(gentle => {
      setPref("difficulty", gentle);
      newRun("name-test", true);
      renderControls();
      return { label: document.getElementById("seedLabel").textContent, share: shareText(false) };
    }, r.gentle);
    /* the default curve is not worth saying, so a normal share is unchanged */
    expect(dflt.label, "the default curve names itself on the board").not.toContain(r.gentleName);
    expect(dflt.share, "the default curve names itself in the share block").not.toContain(r.gentleName);
  });

  test("a gentler total is never a best on the steeper curve", async ({ page }) => {
    await open(page);
    const r = await roles(page);
    const keys = await page.evaluate(gentle => {
      localStorage.clear();
      localStorage.setItem("overtone:curvesMigrated", "true");
      setPref("difficulty", gentle);
      newRun("best-test", true);
      G.total = 999999; G.round = 2;
      endRun(false);
      hidePanel();
      const key = k => localStorage.getItem("overtone:" + k);
      const byRank = DIFFICULTIES.slice().sort((a, b) => a.rank - b.rank);
      return { gentleBest: key(byRank[0].bestKey),
               steepBest:  key(byRank[byRank.length - 1].bestKey) };
    }, r.gentle);
    expect(keys.gentleBest, "the gentler run was not recorded at all").toBe("999999");
    expect(keys.steepBest, "a gentler total overwrote the steeper curve's best").toBeNull();
  });
});

test.describe("the offer to somebody the curve is beating", () => {
  /* Dies on the STEEPEST curve, since the offer only exists for somebody who
     has a gentler one to be offered. */
  const die = (runs, round) => page => page.evaluate(([r, rd]) => {
    const byRank = DIFFICULTIES.slice().sort((a, b) => a.rank - b.rank);
    localStorage.setItem("overtone:runs", String(r - 1));
    setPref("difficulty", byRank[byRank.length - 1].id);
    newRun("offer-test", true);
    G.round = rd; G.total = 500;
    endRun(false);
  }, [runs, round]);

  test("shows up after a few early losses, and starts the gentler run", async ({ page }) => {
    await open(page);
    const r = await roles(page);
    await die(3, 1)(page);
    await page.waitForTimeout(400);
    await expect(page.locator(".softer")).toBeVisible();
    await expect(page.locator(".softer")).toContainText(r.gentleName);
    await page.click("#goEasy");
    await expect(page.locator("#veil")).toBeHidden();
    expect(await page.evaluate(() => runDifficulty().id)).toBe(r.gentle);
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
        const byRank = DIFFICULTIES.slice().sort((a, b) => a.rank - b.rank);
        setPref("difficulty", byRank[0].id);       // already taking it
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
        /* Before the difficulty: clear() wiped the migration flag, so the
           one-time role swap would otherwise flip whatever is set here. */
        localStorage.setItem("overtone:curvesMigrated", "true");
        localStorage.setItem("overtone:difficulty", JSON.stringify(d));
      } catch (e) {}
    }, id);
    await page.goto(GAME);
    await enterGame(page);
    await page.click("#helpBtn");
    await expect(page.locator("#panel h2")).toContainText("How to play");
  };

  test("the gentler mode is told it meets one Ordeal, at the end", async ({ page }) => {
    await page.goto(GAME);
    const r = await roles(page);
    expect(r.gentleOrdeals, "the gentler mode no longer meets exactly one").toBe(1);
    await onDiff(r.gentle)(page);
    const panel = page.locator("#panel");
    await expect(panel).toContainText("The last round is an Ordeal");
    /* and never named the ones it cannot be dealt */
    await expect(panel).not.toContainText("no discards");
    await expect(panel).not.toContainText("four-card hand");
  });

  test("the steeper mode is told how many it meets, and it is more", async ({ page }) => {
    await page.goto(GAME);
    const r = await roles(page);
    expect(r.steepOrdeals, "the steeper mode does not meet more Ordeals")
      .toBeGreaterThan(r.gentleOrdeals);
    await onDiff(r.steep)(page);
    const WORDS = ["no", "One", "Two", "Three", "Four", "Five", "Six"];
    await expect(page.locator("#panel"))
      .toContainText(WORDS[r.steepOrdeals] + " rounds are Ordeals");
  });

  test("and the gentler mode actually is dealt one, at the last round", async ({ page }) => {
    await page.goto(GAME);
    const r = await roles(page);
    await onDiff(r.gentle)(page);
    const met = await page.evaluate(() => {
      const out = [];
      for (let r = 0; r < ROUNDS; r++) if (G.ordealOrder[r]) out.push(r);
      return out;
    });
    /* the last round of six, so a run ends on a wall rather than a bigger number */
    expect(met).toEqual([5]);
  });

  test("and the steeper mode is dealt every one its schedule names", async ({ page }) => {
    await page.goto(GAME);
    const r = await roles(page);
    await onDiff(r.steep)(page);
    const out = await page.evaluate(() => {
      const met = [];
      for (let r = 0; r < ROUNDS; r++) if (G.ordealOrder[r]) met.push(r);
      return { met, scheduled: runDifficulty().ordealRounds.slice() };
    });
    expect(out.met, "the rounds dealt an Ordeal are not the rounds scheduled one")
      .toEqual(out.scheduled);
    expect(out.met.length, "the steeper mode is not dealt more than one")
      .toBeGreaterThan(1);
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
    await expect(panel.locator(".switch")).toHaveCount(4);
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
          localStorage.setItem("overtone:curvesMigrated", "true");
          localStorage.setItem("overtone:best:steep", "41280");
          localStorage.setItem("overtone:best:gentle", "88120");
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

/* ---------- the day the names changed hands ----------
   SCHOLAR used to be the steeper curve and APPRENTICE the gentler one. Anybody
   already playing chose a CURVE, not a name, so the migration moves them by
   ROLE: whoever was on the gentle curve stays on the gentle curve and simply
   sees its new name. Their record moves with them for the same reason - a total
   is a total on the curve it was set on. */
test.describe("migrating a profile from before the names moved", () => {
  const legacy = state => async page => {
    await page.addInitScript(s => {
      try {
        localStorage.clear();
        Object.keys(s).forEach(k => localStorage.setItem("overtone:" + k, s[k]));
      } catch (e) {}
    }, state);
    await page.goto(GAME);
    await expect(page.locator("#title")).toBeVisible();
  };

  /* The rest of this file reads the roles off DIFFICULTIES, which means it
     asserts the table against itself: swap the two ranks and every test still
     passes while every existing player's curve inverts. The migration block is
     name-specific: two old storage KEYS, frozen as the strings the builds
     that wrote them used. What it must never do is move somebody between
     modes, which is what the next two tests are for. */
  test("the migration does not move anybody off the mode they chose", async ({ page }) => {
    await legacy({ runs: "7", difficulty: JSON.stringify("apprentice") })(page);
    expect(await page.evaluate(() => difficulty().id),
      "the migration moved a player off the mode they picked").toBe("apprentice");
    await legacy({ runs: "7", difficulty: JSON.stringify("scholar") })(page);
    expect(await page.evaluate(() => difficulty().id),
      "the migration moved a player off the mode they picked").toBe("scholar");
  });

  test("somebody on the gentle curve stays on the gentle curve", async ({ page }) => {
    /* "apprentice" has meant the gentler one since the first build */
    await legacy({ runs: "7", difficulty: JSON.stringify("apprentice") })(page);
    const r = await roles(page);
    expect(await page.evaluate(() => difficulty().rank),
      "a player on the gentle curve was moved onto the steep one").toBe(0);
    expect(await page.evaluate(() => difficulty().id)).toBe(r.gentle);
  });

  test("somebody on the steep curve stays on the steep curve", async ({ page }) => {
    /* and "scholar" the steeper one */
    await legacy({ runs: "7", difficulty: JSON.stringify("scholar") })(page);
    const r = await roles(page);
    expect(await page.evaluate(() => difficulty().id)).toBe(r.steep);
  });

  test("each best score follows the curve it was set on", async ({ page }) => {
    await legacy({
      runs: "7",
      difficulty: JSON.stringify("scholar"),
      best: "41280",                 // the old STEEP curve's record
      "best:apprentice": "88120"     // the old GENTLE curve's record
    })(page);
    const out = await page.evaluate(() => {
      const byRank = DIFFICULTIES.slice().sort((a, b) => a.rank - b.rank);
      const read = d => store.get(d.bestKey, 0);
      return { gentle: read(byRank[0]), steep: read(byRank[byRank.length - 1]) };
    });
    expect(out.gentle, "the gentle curve's record did not follow it").toBe(88120);
    expect(out.steep, "the steep curve's record did not follow it").toBe(41280);
  });

  test("it runs once — a reload does not swap them back", async ({ page }) => {
    await legacy({ runs: "7", difficulty: JSON.stringify("apprentice") })(page);
    const first = await page.evaluate(() => difficulty().id);
    await page.reload();
    await expect(page.locator("#title")).toBeVisible();
    const second = await page.evaluate(() => difficulty().id);
    expect(second, "the migration ran twice and swapped the player back").toBe(first);
    expect(await page.evaluate(() => store.get("curvesMigrated", false))).toBe(true);
  });

  test("a returning profile that never stored a difficulty keeps the steep curve",
    async ({ page }) => {
      /* The old code defaulted a returning player to the steep curve, so that
         is what they were playing even though nothing was written down. */
      await legacy({ runs: "7", best: "41280" })(page);
      const r = await roles(page);
      expect(await page.evaluate(() => difficulty().id),
        "a returning player was quietly moved onto the gentle curve").toBe(r.steep);
    });

  test("a profile with nothing stored is left to the first-boot default",
    async ({ page }) => {
      await legacy({})(page);
      const r = await roles(page);
      expect(await page.evaluate(() => difficulty().id),
        "a brand new player did not land on the gentlest curve").toBe(r.gentle);
    });
});
