/* Two decisions the player now makes instead of the game making them quietly:
 * which Lens they carry into the next run, and when they are ready for the
 * ones that cost something.
 */
const { test, expect } = require("@playwright/test");

/* resolved against baseURL in playwright.config.js */
const GAME = "/index.html";

/* The overtones are hidden on SCHOLAR until a word has been played, and nearly
   every spec here runs on SCHOLAR while testing something else entirely. Teach
   the profile the lexicon so the cards read the way these tests assume. The
   specs about hiding do their own thing and never call this. */
async function learnEverything(page) {
  await page.evaluate(() => {
    if (typeof LEXICON === "undefined") return;
    LEXICON.forEach(e => { LEARNED[e.w] = 1; });
    store.set("learned", LEARNED);
    if (typeof render === "function" && typeof G !== "undefined" && G) render();
  });
}

async function enterGame(page) {
  const title = page.locator("#title");
  await title.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await title.isVisible()) await page.click("#titlePlay");
  await expect(title).toBeHidden();
  await learnEverything(page);
}

/* Read the key back before reloading, so a spec that meant to test persistence
   fails on the write rather than later on the read. The sleep that used to sit
   here was for a file:// storage quirk the specs no longer run into — see the
   note on reloadKeeping in game.spec.js. */
async function reloadKeeping(page, key, value) {
  await expect.poll(async () =>
    page.evaluate(k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, key),
    { timeout: 3000 }).toContain(value);
  await page.reload();
}

/* ------------------------------------------------------------------ */
test.describe("the Lens you carry in is yours to decide", () => {
  const carrying = () => {
    try {
      localStorage.setItem("overtone:runs", "6");
      localStorage.setItem("overtone:tutorial", "true");
      localStorage.setItem("overtone:coached", "true");
      localStorage.setItem("overtone:memory", JSON.stringify("chron"));
    } catch (e) {}
  };

  test("the menu names it, and offers to leave it behind", async ({ page }) => {
    await page.addInitScript(carrying);
    await page.goto(GAME);
    const carry = page.locator("#title .carry");
    await expect(carry).toContainText("Carrying in");
    await expect(carry).not.toHaveClass(/off/);

    await page.click("#titleCarry");
    await expect(carry).toHaveClass(/off/);
    await expect(carry).toContainText("Starting clean");
    /* the Lens is not destroyed by the choice — it can be taken back */
    expect(await page.evaluate(() => localStorage.getItem("overtone:memory")))
      .toContain("chron");
    await page.click("#titleCarry");
    await expect(carry).toContainText("Carrying in");
  });

  test("and the board does what the menu said", async ({ page }) => {
    await page.addInitScript(carrying);
    await page.goto(GAME);
    await page.click("#titlePlay");
    await expect(page.locator("#rail .lens .mem")).toHaveCount(1);
  });

  test("and starting clean deals a board with nothing on it", async ({ page }) => {
    await page.addInitScript(carrying);
    await page.goto(GAME);
    await page.click("#titleCarry");
    await expect(page.locator("#title .carry")).toHaveClass(/off/);
    await page.click("#titlePlay");
    await expect(page.locator("#rail .lens")).toHaveCount(0);
  });

  test("the strip is about the next run, so it is not offered during one",
    async ({ page }) => {
      await page.addInitScript(carrying);
      await page.goto(GAME);
      await enterGame(page);
      await page.click("#homeBtn");
      await expect(page.locator("#title")).toBeVisible();
      /* changing what you are carrying while you are carrying it would be a
         question with no honest answer */
      await expect(page.locator("#titleCarry")).toHaveCount(0);
      await expect(page.locator("#titleResume")).toBeVisible();
    });

  test("the choice survives a reload", async ({ page }) => {
    await page.addInitScript(carrying);
    await page.goto(GAME);
    await page.click("#titleCarry");
    await reloadKeeping(page, "overtone:carryMemory", "false");
    await expect(page.locator("#title .carry")).toHaveClass(/off/);
    await page.click("#titlePlay");
    await expect(page.locator("#rail .lens")).toHaveCount(0);
  });

  test("leaving a run says what the new one will be holding", async ({ page }) => {
    await page.addInitScript(carrying);
    await page.goto(GAME);
    await enterGame(page);
    await page.locator("#hand .card").first().click();
    await page.click("#playBtn");
    await page.waitForTimeout(2600);
    await page.click("#newRunBtn");
    /* the run had been played, so it asks — and the question includes the Lens */
    await expect(page.locator("#panel h2")).toHaveText("Leave this run?");
    await expect(page.locator("#panel")).toContainText("CHRONICLER");
    await expect(page.locator("#confirmCarry")).toHaveText("ON");
  });
});

/* ------------------------------------------------------------------ */
/* They are on every shelf. What a new player gets is the explanation, once. */
test.describe("the Lenses that cost you something", () => {
  const newPlayer = () => {
    try {
      localStorage.clear();
      localStorage.setItem("overtone:runs", "1");        // SCHOLAR unlocked
      localStorage.setItem("overtone:tutorial", "true");
      localStorage.setItem("overtone:coached", "true");
      localStorage.setItem("overtone:sawFlaw", "false");
    } catch (e) {}
  };

  test("the first one you are offered gets a card of its own, once", async ({ page }) => {
    await page.addInitScript(newPlayer);
    await page.addInitScript(() => {
      try { localStorage.setItem("overtone:difficulty", JSON.stringify("scholar")); } catch (e) {}
    });
    await page.goto(GAME);
    await enterGame(page);
    const shelf = () => page.evaluate(() => {
      const flaw = LENSES.filter(l => l.flaw)[0];
      G.offers = [{ kind: "lens", lens: flaw, cost: flaw.cost }, { kind: "words", cost: 3 }];
      openShop(5);
    });

    await shelf();
    await expect(page.locator("#panel h2")).toHaveText("Something new on the shelf");
    await expect(page.locator("#panel")).toContainText("takes something back");
    await page.click("#seenFlaw");
    await expect(page.locator("#panel h2")).toHaveText("The Bookseller");

    /* the second time, straight to the shop */
    await page.click("#leaveShop");
    await shelf();
    await expect(page.locator("#panel h2")).toHaveText("The Bookseller");
  });

});
