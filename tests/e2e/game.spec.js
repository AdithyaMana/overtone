/* End-to-end tests: a real browser, real clicks, visible outcomes.
 *
 *   npm run test:e2e
 */
const { test, expect } = require("@playwright/test");
const path = require("path");
const { pathToFileURL } = require("url");

const GAME = pathToFileURL(path.resolve(__dirname, "..", "..", "index.html")).href;

/* Open the game and clear the first-run help card. */
/* Open the game past whatever first-run guidance is showing. The spotlight
   tutorial replaced the auto-opening help modal, so handle either. */
async function open(page) {
  await page.goto(GAME);
  const tut = page.locator("#tut");
  if (await tut.isVisible()) {
    await page.click("#tutSkip");
    await expect(tut).toBeHidden();
  }
  if (await page.locator("#veil").isVisible()) await page.click("#closeHelp");
  await expect(page.locator("#veil")).toBeHidden();
}

/* Wait for the scoring animation to finish rather than sleeping. */
async function settle(page) {
  await page.waitForFunction(() => typeof G !== "undefined" && G && !G.animating);
}

/* Play the strongest hand available, skipping the animation. */
async function playAHand(page) {
  await page.keyboard.press("1");
  await page.keyboard.press("2");
  await page.keyboard.press("3");
  await page.keyboard.press("Enter");
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press(" ");
    if (await page.evaluate(() => typeof G !== "undefined" && G && !G.animating)) break;
    await page.waitForTimeout(120);
  }
  await settle(page);
}

/* ------------------------------------------------------------------ */
test.describe("first visit", () => {
  test("greets with the tutorial, not a wall of rules", async ({ page }) => {
    await page.goto(GAME);
    await expect(page).toHaveTitle("Overtone");
    await expect(page.locator("#tut")).toBeVisible();
    await expect(page.locator("#veil"), "a rules modal opened itself").toBeHidden();
  });

  test("keeps the full rules one click away", async ({ page }) => {
    await open(page);
    await page.click("#helpBtn");
    const panel = page.locator("#panel");
    await expect(panel).toContainText("How Overtone works");
    await expect(panel).toContainText("Chips × Mult");
    /* the worked example and the overtone legend both carry the rules */
    await expect(panel.locator(".worked")).toBeVisible();
    await expect(panel.locator(".legend .leg")).toHaveCount(19);
  });

  test("deals a full hand once the help card is dismissed", async ({ page }) => {
    await open(page);
    await expect(page.locator("#hand .card")).toHaveCount(7);
    await expect(page.locator("#demandName")).not.toBeEmpty();
    await expect(page.locator("#roundScore")).toHaveText("0");
    await expect(page.locator("#playsLeft")).toHaveText("4");
    await expect(page.locator("#discardsLeft")).toHaveText("3");
  });

  test("states the round's rule in the middle of the screen", async ({ page }) => {
    await open(page);
    const call = page.locator(".demand-call");
    await expect(call).toBeVisible();
    await expect(call).toContainText("+25 chips");
    /* one icon per demanded overtone */
    const wanted = await page.evaluate(() => G.demand.tags.length);
    await expect(call.locator(".dc-icons .ms")).toHaveCount(wanted);
  });

  test("marks the cards that can actually score", async ({ page }) => {
    await open(page);
    const live = await page.locator("#hand .card.live").count();
    const expected = await page.evaluate(() =>
      G.hand.filter(c => c.t.some(t => G.demand.tags.indexOf(t) >= 0)).length);
    expect(live).toBe(expected);
    expect(live).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
test.describe("playing a hand", () => {
  test("selecting a card lifts it, numbers it, and scores it live", async ({ page }) => {
    await open(page);
    await expect(page.locator("#chipsV")).toHaveText("0");

    await page.locator("#hand .card").first().click();

    await expect(page.locator("#hand .card.sel")).toHaveCount(1);
    await expect(page.locator("#hand .card.sel .pos")).toHaveText("1");
    await expect(page.locator("#stageCards .card")).toHaveCount(1);
    await expect(page.locator("#chipsV")).not.toHaveText("0");
    await expect(page.locator("#playBtn")).toBeEnabled();
  });

  test("shows the order the cards will resolve in", async ({ page }) => {
    await open(page);
    for (const key of ["1", "2", "3"]) await page.keyboard.press(key);

    await expect(page.locator("#stageCards .card")).toHaveCount(3);
    const badges = page.locator("#stageCards .pos");
    await expect(badges).toHaveCount(3);
    await expect(badges.nth(0)).toHaveText("1");
    await expect(badges.nth(1)).toHaveText("2");
    await expect(badges.nth(2)).toHaveText("3");
  });

  test("names the shape of the hand", async ({ page }) => {
    await open(page);
    await page.locator("#hand .card.live").first().click();
    await expect(page.locator(".hand-name")).toContainText("RESONANCE");
  });

  test("refuses a fourth card and says why", async ({ page }) => {
    await open(page);
    for (const key of ["1", "2", "3", "4"]) await page.keyboard.press(key);
    await expect(page.locator("#hand .card.sel")).toHaveCount(3);
    await expect(page.locator("#toast")).toContainText("Three words at a time");
  });

  test("deselecting clears the stage and the tally", async ({ page }) => {
    await open(page);
    await page.keyboard.press("1");
    await expect(page.locator("#stageCards .card")).toHaveCount(1);
    await page.keyboard.press("1");
    await expect(page.locator("#hand .card.sel")).toHaveCount(0);
    await expect(page.locator("#chipsV")).toHaveText("0");
    await expect(page.locator(".demand-call")).toBeVisible();
  });

  test("playing scores, spends a play, and refills the hand", async ({ page }) => {
    await open(page);
    await playAHand(page);

    await expect(page.locator("#playsLeft")).toHaveText("3");
    await expect(page.locator("#hand .card")).toHaveCount(7);
    const score = await page.evaluate(() => G.roundScore);
    expect(score).toBeGreaterThan(0);
    await expect(page.locator("#roundScore")).not.toHaveText("0");
  });

  test("discarding spends a discard and replaces the cards", async ({ page }) => {
    await open(page);
    const before = await page.evaluate(() => G.hand.map(c => c.w).join(","));
    await page.keyboard.press("1");
    await page.keyboard.press("2");
    await page.click("#discardBtn");

    await expect(page.locator("#discardsLeft")).toHaveText("2");
    await expect(page.locator("#playsLeft")).toHaveText("4");
    await expect(page.locator("#hand .card")).toHaveCount(7);
    const after = await page.evaluate(() => G.hand.map(c => c.w).join(","));
    expect(after).not.toBe(before);
  });
});

/* ------------------------------------------------------------------ */
test.describe("the Bookseller", () => {
  test("opens on clearing a round and teaches the economy", async ({ page }) => {
    await open(page);
    for (let i = 0; i < 4; i++) {
      if (await page.locator("#veil").isVisible()) break;
      await playAHand(page);
    }

    const panel = page.locator("#panel");
    await expect(panel).toContainText("The Bookseller");
    /* the exponential has to be stated in numbers, not implied */
    await expect(panel.locator(".stakes")).toContainText("Lenses multiply");
    await expect(panel.locator(".offer")).toHaveCount(3);
    await expect(panel.locator("#leaveShop")).toContainText("Leave with no Lens");
  });

  test("buying a Lens equips it and it survives into the next round", async ({ page }) => {
    await open(page);
    for (let i = 0; i < 4; i++) {
      if (await page.locator("#veil").isVisible()) break;
      await playAHand(page);
    }
    await expect(page.locator("#panel")).toContainText("The Bookseller");

    /* buy the first Lens the purse can afford */
    const bought = await page.evaluate(() => {
      const i = G.offers.findIndex(o => o.kind === "lens" && G.bank >= o.cost);
      if (i < 0) return null;
      const name = G.offers[i].lens.n;
      buy(i, 9);
      return name;
    });
    test.skip(bought === null, "no affordable Lens in this roll");

    await expect(page.locator("#leaveShop")).toContainText("To the table");
    await page.click("#leaveShop");
    await expect(page.locator("#veil")).toBeHidden();

    await expect(page.locator("#rail .lens")).toHaveCount(1);
    await expect(page.locator("#rail .lens .n")).toContainText(bought);
    await expect(page.locator("#lensCount")).toHaveText("1/5");
  });
});

/* ------------------------------------------------------------------ */
test.describe("the Interpreter", () => {
  test("turns any typed word into a real card", async ({ page }) => {
    await open(page);
    await page.click("#interpBtn");
    await expect(page.locator("#panel")).toContainText("The Interpreter");

    await page.fill("#interpInput", "mitochondria");
    await page.click("#interpGo");

    /* No window.claude over file://, so the house appraiser answers and says so. */
    const appraisal = page.locator("#appraisal");
    await expect(appraisal.locator(".card")).toBeVisible();
    await expect(appraisal.locator(".card .w")).toHaveText("MITOCHONDRIA");
    await expect(appraisal.locator(".src")).toContainText("House appraisal");

    await page.click("#interpGo");
    await expect(page.locator("#veil")).toBeHidden();

    const inDeck = await page.evaluate(() =>
      G.deck.concat(G.discard, G.hand).some(c => c.w === "MITOCHONDRIA" && c.interpreted));
    expect(inDeck).toBe(true);
    await expect(page.locator("#interpBtn")).toBeDisabled();
  });

  test("rejects a word too short to appraise", async ({ page }) => {
    await open(page);
    await page.click("#interpBtn");
    await page.fill("#interpInput", "a");
    await page.click("#interpGo");
    await expect(page.locator("#appraisal")).toContainText("Two letters or more");
    await expect(page.locator("#appraisal .card")).toHaveCount(0);
  });
});

/* ------------------------------------------------------------------ */
test.describe("layout", () => {
  test("never scrolls sideways", async ({ page }) => {
    await open(page);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("the controls stay reachable without scrolling past them", async ({ page }) => {
    await open(page);
    await expect(page.locator("#playBtn")).toBeInViewport();
    await expect(page.locator("#interpBtn")).toBeInViewport();
  });

  test("the hand stays in one row beside the sidebar", async ({ page }, testInfo) => {
    const w = page.viewportSize().width;
    test.skip(w < 1080, "the two-column layout only applies above 1080px");
    await open(page);
    /* Cards are fanned, so their tops differ by a dozen pixels on purpose —
       a wrapped second row differs by a whole card height. */
    const tops = await page.locator("#hand .card")
      .evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
    const spread = Math.max(...tops) - Math.min(...tops);
    expect(spread, "the hand wrapped to a second row at " + w + "px").toBeLessThan(60);
  });

  test("nothing on a card overlaps the icon plate", async ({ page }) => {
    await open(page);
    /* Measured on the stage cards, not the hand: hand cards are fanned and
       deal in with a rotation, and a rotated element has an inflated
       axis-aligned rect, so an AABB test there reports overlaps that are not
       visually there. Stage cards carry transform:none and render the same
       markup. The value badge used to sit absolutely over the art, where a
       third overtone icon ran underneath it. */
    for (const key of ["1", "2", "3"]) await page.keyboard.press(key);
    await expect(page.locator("#stageCards .card")).toHaveCount(3);

    const clashes = await page.locator("#stageCards .card").evaluateAll(cards =>
      cards.map(card => {
        if (getComputedStyle(card).transform !== "none") return null;
        const icons = card.querySelector(".icons").getBoundingClientRect();
        const base = card.querySelector(".base").getBoundingClientRect();
        const w = card.querySelector(".w").getBoundingClientRect();
        const hits = (a, b) => !(b.right <= a.left + 0.5 || b.left >= a.right - 0.5 ||
                                 b.bottom <= a.top + 0.5 || b.top >= a.bottom - 0.5);
        const word = card.querySelector(".w").textContent;
        if (hits(icons, base)) return word + ": value on the icons";
        if (hits(w, base)) return word + ": value on the word";
        return null;
      }).filter(Boolean));
    expect(clashes).toEqual([]);
  });

  test("card words are not broken mid-word", async ({ page }) => {
    await open(page);
    for (const key of ["1", "2", "3"]) await page.keyboard.press(key);
    await expect(page.locator("#stageCards .card")).toHaveCount(3);
    /* A word that wraps is fine; a word that wraps because something else is
       taking its width is not — SOLSTICE once rendered as "SOLSTIC / E". */
    const cramped = await page.locator("#stageCards .card .w").evaluateAll(ws =>
      ws.map(w => {
        const line = parseFloat(getComputedStyle(w).lineHeight);
        const lines = Math.round(w.getBoundingClientRect().height / line);
        const chars = w.textContent.trim().length;
        return (lines > 1 && chars <= 9) ? w.textContent + " wrapped onto " + lines + " lines" : null;
      }).filter(Boolean));
    expect(cramped).toEqual([]);
  });

  test("help can be reopened at any time", async ({ page }) => {
    await open(page);
    await page.click("#helpBtn");
    await expect(page.locator("#panel")).toContainText("How Overtone works");
    await page.keyboard.press("Escape");
    await expect(page.locator("#veil")).toBeHidden();
  });
});

/* ------------------------------------------------------------------ */
test.describe("first-run coaching", () => {
  test("walks the player through round one, then retires", async ({ page }) => {
    await open(page);
    const coach = page.locator("#coach");

    /* step 1: pick */
    await expect(coach).toBeVisible();
    await expect(coach).toContainText("Gold tags match the Demand");

    /* step 2: play — and the button it points at is marked */
    await page.keyboard.press("1");
    await expect(coach).toContainText("press PLAY");
    await expect(page.locator("#playBtn")).toHaveClass(/hint-pulse/);

    /* deselecting walks it back rather than stranding the player */
    await page.keyboard.press("1");
    await expect(coach).toContainText("Gold tags match the Demand");

    /* step 3: read the result */
    await playAHand(page);
    if (!(await page.locator("#veil").isVisible())) {
      await expect(coach).toContainText("Chips");
    }
  });

  test("does not come back on a later run", async ({ page }) => {
    await open(page);
    await expect(page.locator("#coach")).toBeVisible();
    /* finishing the shop retires the coach for good */
    await page.evaluate(() => coachFinish());
    await expect(page.locator("#coach")).toBeHidden();

    await page.click("#newRunBtn");
    await expect(page.locator("#hand .card")).toHaveCount(7);
    await expect(page.locator("#coach")).toBeHidden();
  });
});

/* ------------------------------------------------------------------ */
test.describe("the end of a run", () => {
  test("running out of plays ends the run and offers the result", async ({ page }) => {
    await open(page);
    /* Drop the player on the last Demand with one play and an impossible
       target, so the real play -> endRun path runs without 30 hands first. */
    await page.evaluate(() => {
      G.round = ROUNDS - 1;
      G.plays = 1;
      G.roundScore = 0;
      G.target = 9999999;
      G.total = 4321;
      G.lenses = [LENSES.find(l => l.id === "pyro")];
      G.best = { word: "AVALANCHE", mult: 12, score: 1800 };
      render();
    });
    await playAHand(page);

    const panel = page.locator("#panel");
    await expect(panel).toContainText("The run ends at");
    await expect(panel.locator(".share")).toContainText("OVERTONE");
    await expect(panel.locator(".share")).toContainText("AVALANCHE");
    /* a Lens was owned, so something carries into the next run */
    await expect(panel.locator(".unlock")).toBeVisible();
    await expect(panel).toContainText("PYROMANIAC");

    /* and the run is genuinely restartable */
    await page.click("#againNew");
    await expect(page.locator("#veil")).toBeHidden();
    await expect(page.locator("#hand .card")).toHaveCount(7);
    await expect(page.locator("#roundLabel")).toContainText("Round 1");
  });

  test("the carried Lens is equipped at the start of the next run", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      G.round = ROUNDS - 1; G.plays = 1; G.roundScore = 0; G.target = 9999999;
      G.lenses = [LENSES.find(l => l.id === "zoo")];
      render();
    });
    await playAHand(page);
    await expect(page.locator("#panel")).toContainText("The run ends at");
    await page.click("#againNew");

    await expect(page.locator("#rail .lens")).toHaveCount(1);
    await expect(page.locator("#rail .lens .n")).toContainText("ZOOLOGIST");
    await expect(page.locator("#lensCount")).toHaveText("1/5");
  });
});

/* ------------------------------------------------------------------ */
test.describe("the opening tutorial", () => {
  test("greets a first-time player instead of a rules modal", async ({ page }) => {
    await page.goto(GAME);
    await expect(page.locator("#tut")).toBeVisible();
    await expect(page.locator("#tutText")).toContainText("Overtone");
    await expect(page.locator("#tutStep")).toContainText("1 of 6");
    /* the modal no longer opens itself */
    await expect(page.locator("#veil")).toBeHidden();
  });

  test("spotlights the real board, and lets the player touch it", async ({ page }) => {
    await page.goto(GAME);
    await page.click("#tutNext");                       // -> the Demand
    await expect(page.locator("#tutStep")).toContainText("2 of 6");
    await expect(page.locator("#tutText")).toContainText("pays for");

    /* The cutout slides between targets on a CSS transition, so poll until it
       settles rather than measuring it mid-flight. */
    await expect.poll(async () => page.evaluate(() => {
      const hole = document.getElementById("tutHole").getBoundingClientRect();
      const blind = document.querySelector(".blind").getBoundingClientRect();
      return Math.abs(hole.left - (blind.left - 8)) < 3 &&
             Math.abs(hole.top - (blind.top - 8)) < 3;
    }), { timeout: 3000, message: "the spotlight never settled over the Demand" }).toBe(true);

    /* the overlay must not swallow clicks — the next step needs a card tapped */
    await page.click("#tutNext");
    await expect(page.locator("#tutStep")).toContainText("3 of 6");
    await expect(page.locator("#tutNext")).toBeHidden();  // doing it IS the button
    await page.locator("#hand .card").first().click();
    await expect(page.locator("#hand .card.sel")).toHaveCount(1);
    await expect(page.locator("#tutStep")).toContainText("4 of 6");
  });

  test("advances off a real play, then finishes and stays gone", async ({ page }) => {
    await page.goto(GAME);
    /* straight to the play step */
    for (let i = 0; i < 2; i++) await page.click("#tutNext");
    await page.locator("#hand .card").first().click();
    await expect(page.locator("#tutStep")).toContainText("4 of 6");
    await page.click("#tutNext");
    await expect(page.locator("#tutStep")).toContainText("5 of 6");
    await expect(page.locator("#tutNext")).toBeHidden();

    await page.click("#playBtn");
    await expect(page.locator("#tutStep")).toContainText("6 of 6");
    await page.click("#tutNext");
    await expect(page.locator("#tut")).toBeHidden();

    /* and it does not ambush a returning player */
    await page.reload();
    await expect(page.locator("#hand .card")).toHaveCount(7);
    await expect(page.locator("#tut")).toBeHidden();
  });

  test("can be skipped, and skipping sticks", async ({ page }) => {
    await page.goto(GAME);
    await page.click("#tutSkip");
    await expect(page.locator("#tut")).toBeHidden();
    await expect(page.locator("#hand .card")).toHaveCount(7);
    await page.reload();
    await expect(page.locator("#tut")).toBeHidden();
  });

  test("skipping leaves the lighter coach running", async ({ page }) => {
    await page.goto(GAME);
    await page.click("#tutSkip");
    /* they opted out of the overlay, not out of ever being helped */
    await expect(page.locator("#coach")).toBeVisible();
    await expect(page.locator("#coach")).toContainText("Gold tags match the Demand");
  });

  test("finishing it retires the coach, which would only repeat itself", async ({ page }) => {
    await page.goto(GAME);
    for (let i = 0; i < 2; i++) await page.click("#tutNext");
    await page.locator("#hand .card").first().click();
    await page.click("#tutNext");
    await page.click("#playBtn");
    await expect(page.locator("#tutStep")).toContainText("6 of 6");
    await page.click("#tutNext");
    await expect(page.locator("#tut")).toBeHidden();
    await expect(page.locator("#coach")).toBeHidden();
  });

  test("only one guide runs at a time", async ({ page }) => {
    await page.goto(GAME);
    await expect(page.locator("#tut")).toBeVisible();
    /* the coach would otherwise be giving its own instructions underneath */
    await expect(page.locator("#coach")).toBeHidden();
  });

  test("can be replayed from the help card", async ({ page }) => {
    await open(page);
    await expect(page.locator("#tut")).toBeHidden();
    await page.click("#helpBtn");
    await page.click("#replayTut");
    await expect(page.locator("#veil")).toBeHidden();
    await expect(page.locator("#tut")).toBeVisible();
    await expect(page.locator("#tutStep")).toContainText("1 of 6");
  });
});
