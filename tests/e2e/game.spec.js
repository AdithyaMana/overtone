/* End-to-end tests: a real browser, real clicks, visible outcomes.
 *
 *   npm run test:e2e
 */
const { test, expect } = require("@playwright/test");
const path = require("path");
const { pathToFileURL } = require("url");

const GAME = pathToFileURL(path.resolve(__dirname, "..", "..", "index.html")).href;

/* Open the game and clear the first-run help card. */
async function open(page) {
  await page.goto(GAME);
  await expect(page.locator("#veil")).toBeVisible();
  await page.click("#closeHelp");
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
  test("loads and explains itself before anything else", async ({ page }) => {
    await page.goto(GAME);
    await expect(page).toHaveTitle("NecroCards");
    const panel = page.locator("#panel");
    await expect(panel).toContainText("How NecroCards works");
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
test.describe("the Reliquary", () => {
  test("opens on clearing a round and teaches the economy", async ({ page }) => {
    await open(page);
    for (let i = 0; i < 4; i++) {
      if (await page.locator("#veil").isVisible()) break;
      await playAHand(page);
    }

    const panel = page.locator("#panel");
    await expect(panel).toContainText("The Reliquary");
    /* the exponential has to be stated in numbers, not implied */
    await expect(panel.locator(".stakes")).toContainText("Sigils multiply");
    await expect(panel.locator(".offer")).toHaveCount(3);
    await expect(panel.locator("#leaveShop")).toContainText("Leave with no Sigil");
  });

  test("buying a Sigil equips it and it survives into the next round", async ({ page }) => {
    await open(page);
    for (let i = 0; i < 4; i++) {
      if (await page.locator("#veil").isVisible()) break;
      await playAHand(page);
    }
    await expect(page.locator("#panel")).toContainText("The Reliquary");

    /* buy the first Sigil the purse can afford */
    const bought = await page.evaluate(() => {
      const i = G.offers.findIndex(o => o.kind === "lens" && G.bank >= o.cost);
      if (i < 0) return null;
      const name = G.offers[i].lens.n;
      buy(i, 9);
      return name;
    });
    test.skip(bought === null, "no affordable Sigil in this roll");

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

  test("help can be reopened at any time", async ({ page }) => {
    await open(page);
    await page.click("#helpBtn");
    await expect(page.locator("#panel")).toContainText("How NecroCards works");
    await page.keyboard.press("Escape");
    await expect(page.locator("#veil")).toBeHidden();
  });
});
