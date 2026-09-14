/* The Interpreter's live path.
 *
 * Over file:// there is no window.claude, so game.spec.js only ever exercises
 * the house appraiser. These inject a fake sampler before the page script runs
 * — which is the only way to prove the live branch works, that its reply is
 * validated rather than trusted, and that a refusal degrades instead of
 * breaking.
 */
const { test, expect } = require("@playwright/test");
const path = require("path");
const { pathToFileURL } = require("url");

const GAME = pathToFileURL(path.resolve(__dirname, "..", "..", "index.html")).href;

/* Install a fake `claude.use("sample")` before any page script runs.
   `reply` is returned from sample.json(); `fail` rejects with a code. */
async function withClaude(page, { reply, fail } = {}) {
  await page.addInitScript(({ reply, fail }) => {
    window.claude = {
      use(name) {
        if (name !== "sample") return Promise.resolve(null);
        const sample = () => Promise.resolve({ text: "", truncated: false });
        sample.json = () => fail
          ? Promise.reject({ code: fail, message: "fake " + fail })
          : Promise.resolve(reply);
        return Promise.resolve(sample);
      }
    };
  }, { reply, fail });
}

async function open(page) {
  await page.goto(GAME);
  const tut = page.locator("#tut");
  if (await tut.isVisible()) { await page.click("#tutSkip"); await expect(tut).toBeHidden(); }
  if (await page.locator("#veil").isVisible()) await page.click("#closeHelp");
  await expect(page.locator("#veil")).toBeHidden();
}

async function appraise(page, word) {
  await page.click("#interpBtn");
  await page.fill("#interpInput", word);
  await page.click("#interpGo");
}

/* ------------------------------------------------------------------ */
test.describe("the Interpreter with Claude available", () => {
  test("uses the live appraisal and says that it did", async ({ page }) => {
    await withClaude(page, {
      reply: { tags: ["TECH", "MIND"], note: "A machine that thinks it remembers." }
    });
    await open(page);
    await appraise(page, "mitochondria");

    const appraisal = page.locator("#appraisal");
    await expect(appraisal.locator(".card .wt")).toHaveText("MITOCHONDRIA");
    await expect(appraisal.locator(".src")).toContainText("Appraised live by Claude");
    await expect(appraisal).toContainText("A machine that thinks it remembers");

    /* the overtones Claude chose are the ones the card carries */
    const tags = await appraisal.locator(".card .tg").allTextContents();
    expect(tags.sort()).toEqual(["MIND", "TECH"]);
  });

  test("the card it makes scores by the ordinary rules", async ({ page }) => {
    await withClaude(page, { reply: { tags: ["HEAT", "DANGER"], note: "Hot." } });
    await open(page);
    await appraise(page, "wildfire");
    await page.click("#interpGo");
    await expect(page.locator("#veil")).toBeHidden();

    const scored = await page.evaluate(() => {
      const c = G.deck.concat(G.discard, G.hand).find(x => x.w === "WILDFIRE");
      if (!c) return null;
      G.demand = { n: "T", tags: ["HEA"] };
      G.lenses = [];
      return { interpreted: c.interpreted, total: resolve([c]).total, tags: c.t };
    });
    expect(scored).not.toBeNull();
    expect(scored.interpreted).toBe(true);
    expect(scored.tags).toContain("HEA");
    expect(scored.total).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
test.describe("the Interpreter does not trust what comes back", () => {
  test("invented overtones are discarded, not rendered", async ({ page }) => {
    await withClaude(page, {
      reply: { tags: ["HEAT", "SPICY", "HAUNTED", "DANGER"], note: "Half of these are made up." }
    });
    await open(page);
    await appraise(page, "chilli");

    const tags = await page.locator("#appraisal .card .tg").allTextContents();
    expect(tags.sort()).toEqual(["DANGER", "HEAT"]);
    expect(tags).not.toContain("SPICY");
  });

  test("a reply with no usable overtones falls back to the house", async ({ page }) => {
    await withClaude(page, { reply: { tags: ["NONSENSE", "ALSO NONSENSE"], note: "" } });
    await open(page);
    await appraise(page, "glacier");

    await expect(page.locator("#appraisal .src")).toContainText("House appraisal");
    const tags = await page.locator("#appraisal .card .tg").allTextContents();
    expect(tags.length).toBeGreaterThan(0);
    expect(tags).toContain("COLD");
  });

  test("a malformed reply does not break the game", async ({ page }) => {
    await withClaude(page, { reply: { note: "no tags field at all" } });
    await open(page);
    await appraise(page, "wildfire");

    await expect(page.locator("#appraisal .card")).toBeVisible();
    await expect(page.locator("#appraisal .src")).toContainText("House appraisal");
  });
});

/* ------------------------------------------------------------------ */
test.describe("the Interpreter when Claude refuses", () => {
  for (const code of ["not_granted", "rate_limited"]) {
    test("degrades to the house appraiser on " + code, async ({ page }) => {
      await withClaude(page, { fail: code });
      await open(page);
      await appraise(page, "glacier");

      await expect(page.locator("#appraisal .card .wt")).toHaveText("GLACIER");
      await expect(page.locator("#appraisal .src")).toContainText("House appraisal");
      /* the run continues — the card is still real */
      await page.click("#interpGo");
      const inDeck = await page.evaluate(() =>
        G.deck.concat(G.discard, G.hand).some(c => c.w === "GLACIER" && c.interpreted));
      expect(inDeck).toBe(true);
    });
  }
});
