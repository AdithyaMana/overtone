/* The Interpreter, after a playtester read it exactly right.
 *
 *   "that mechanic where u get to add a word of yr own is nice but idt its
 *    working as intended since the word types seem to be assigned randomly"
 *
 * They were. With no live valuer — which is every player on the public link,
 * because window.claude only exists inside an artifact — the house fell
 * through to overtones drawn from a hash of the letters on 64% of words.
 * The house does not guess now, and the player does the reading.
 */
const { test, expect } = require("@playwright/test");

/* resolved against baseURL in playwright.config.js */
const GAME = "/index.html";

async function atTheBoard(page) {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem("overtone:runs", "4");
      localStorage.setItem("overtone:tutorial", "true");
      localStorage.setItem("overtone:coached", "true");
      localStorage.setItem("overtone:sawFlaw", "true");
    } catch (e) {}
  });
  await page.goto(GAME);
  await page.locator("#title").waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await page.locator("#title").isVisible()) await page.click("#titlePlay");
  await expect(page.locator("#title")).toBeHidden();
  await page.evaluate(() => {
    if (typeof LEXICON === "undefined") return;
    LEXICON.forEach(e => { LEARNED[e.w] = 1; });
    store.set("learned", LEARNED);
    if (typeof render === "function" && typeof G !== "undefined" && G) render();
  });
}

async function appraise(page, word) {
  await page.click("#interpBtn");
  await expect(page.locator("#panel h2")).toHaveText("The Interpreter");
  await page.fill("#interpInput", word);
  await page.click("#interpGo");
  await expect(page.locator(".pickgrid")).toBeVisible();
}

test.describe("the word you add is read by you", () => {
  test("a word the house has nothing on gets no invented overtones",
    async ({ page }) => {
      await atTheBoard(page);
      await appraise(page, "coffee");
      /* it says so rather than dealing something that looks considered */
      await expect(page.locator("#panel .say")).toContainText("will not guess");
      await expect(page.locator('.pickopt[aria-pressed="true"]')).toHaveCount(0);
      /* and it will not let the word in until the player has said something */
      await expect(page.locator("#interpGo")).toBeDisabled();
      await expect(page.locator("#interpGo")).toHaveText("Pick two");
    });

  test("a word it can point at arrives pre-read, and is editable",
    async ({ page }) => {
      await atTheBoard(page);
      await appraise(page, "wildfire");
      await expect(page.locator("#panel .say")).toContainText("Change anything that is wrong");
      await expect(page.locator('.pickopt[data-tag="HEA"]')).toHaveAttribute("aria-pressed", "true");
      /* and the suggestion can be taken back off */
      await page.click('.pickopt[data-tag="HEA"]');
      await expect(page.locator('.pickopt[data-tag="HEA"]')).toHaveAttribute("aria-pressed", "false");
    });

  test("what the player picks is what the card carries", async ({ page }) => {
    await atTheBoard(page);
    await appraise(page, "monsoon");
    for (const t of ["WET", "LOU", "NAT"]) await page.click(`.pickopt[data-tag="${t}"]`);
    await expect(page.locator("#interpGo")).toHaveText("Into the deck →");
    await page.click("#interpGo");
    const w = await page.evaluate(() => G.interpretedWord);
    expect(w.w).toBe("MONSOON");
    expect(w.t.slice().sort()).toEqual(["LOU", "NAT", "WET"]);
    /* and it really is in the deck, as a real card */
    const inDeck = await page.evaluate(() =>
      G.deck.filter(c => c.w === "MONSOON").length);
    expect(inDeck, "the word never reached the deck").toBe(1);
  });

  test("four is the ceiling", async ({ page }) => {
    await atTheBoard(page);
    await appraise(page, "coffee");
    for (const t of ["WET", "HEA", "FOO", "MIN", "DAN"]) {
      await page.click(`.pickopt[data-tag="${t}"]`);
    }
    await expect(page.locator('.pickopt[aria-pressed="true"]')).toHaveCount(4);
    await expect(page.locator('.pickopt[data-tag="DAN"]')).toHaveAttribute("aria-pressed", "false");
  });

  test("and it is still once a run", async ({ page }) => {
    await atTheBoard(page);
    await appraise(page, "coffee");
    for (const t of ["HEA", "FOO"]) await page.click(`.pickopt[data-tag="${t}"]`);
    await page.click("#interpGo");
    await expect(page.locator("#veil")).toBeHidden();
    /* the board says it is spent rather than letting you ask and then refusing */
    await expect(page.locator("#interpBtn")).toBeDisabled();
    await expect(page.locator("#interpBtn")).toContainText("Word added");
  });
});

test.describe("the game says what an overtone is", () => {
  test("the rules open on the reason the game is called this", async ({ page }) => {
    await atTheBoard(page);
    await page.click("#helpBtn");
    const why = page.locator("#panel .why");
    await expect(why).toBeVisible();
    await expect(why).toContainText("overtones");
    await expect(why).toContainText("FURNACE");
    /* the point a playtester could not find: the definition is not the game */
    await expect(why).toContainText("never scores a point");
  });
});
