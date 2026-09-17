/* The Interpreter's live path.
 *
 * Over file:// there is no window.claude, so game.spec.js only ever exercises
 * the house appraiser. These inject a fake sampler before the page script runs
 * — which is the only way to prove the live branch works, that its reply is
 * validated rather than trusted, and that a refusal degrades instead of
 * breaking.
 */
const { test, expect } = require("@playwright/test");

/* resolved against baseURL in playwright.config.js */
const GAME = "/index.html";

/* The game opens on a main menu now. Every spec starts on the board, so this
   is the one place that knows how to get there. */
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

test.beforeEach(async ({ page }) => {
  /* A fresh profile now starts on APPRENTICE, which is right for a person and
     wrong for a spec: nearly everything here pins the game as balanced. */
  await page.addInitScript(() => {
    /* Only when nothing is stored: a spec starts on the balanced curve, and
       never overrides a choice one of its own tests just made and reloaded. */
    try {
      if (localStorage.getItem("overtone:difficulty") === null)
        localStorage.setItem("overtone:difficulty", JSON.stringify("scholar"));
      /* and as somebody who has already met a flawed Lens, so the shop opens on
         the shop rather than on the card that introduces them. The first
         meeting is flaws.spec.js's subject, not this one's. */
      if (localStorage.getItem("overtone:sawFlaw") === null)
        localStorage.setItem("overtone:sawFlaw", "true");
    } catch (e) {}
  });
});

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
  await enterGame(page);
  const tut = page.locator("#tut");
  if (await tut.isVisible()) { await page.click("#tutSkip"); await expect(tut).toBeHidden(); }
  if (await page.locator("#veil").isVisible()) await page.click("#closeHelp");
  await expect(page.locator("#veil")).toBeHidden();
}

async function appraise(page, word) {
  await page.click("#interpBtn");
  await page.fill("#interpInput", word);
  await page.click("#interpGo");
  await expect(page.locator(".pickgrid")).toBeVisible();
}

/* What the appraisal offered, as the player sees it pre-selected. */
function offered(page) {
  return page.locator('.pickopt[aria-pressed="true"] .lbl');
}

/* Take whatever is offered up to the two the card needs, then add it. */
async function addIt(page) {
  /* by data-tag, not by text: the button holds the overtone's icon glyph as
     well as its name, so an exact-text filter never matches */
  const spare = ["ABS", "MIN", "TIM", "NAT", "BOD"];
  let i = 0;
  while (await page.locator('.pickopt[aria-pressed="true"]').count() < 2) {
    const code = spare[i++];
    if (!code) throw new Error("ran out of overtones to pick");
    const btn = page.locator('.pickopt[data-tag="' + code + '"]');
    if (await btn.getAttribute("aria-pressed") === "false") await btn.click();
  }
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
    await expect(page.locator("#interpInput")).toHaveValue("mitochondria");
    await expect(appraisal.locator(".src")).toContainText("Appraised live by Claude");
    await expect(appraisal).toContainText("A machine that thinks it remembers");

    /* the overtones Claude chose are the ones offered, ready to accept */
    const tags = await offered(page).allTextContents();
    expect(tags.sort()).toEqual(["MIND", "TECH"]);
  });

  test("the card it makes scores by the ordinary rules", async ({ page }) => {
    await withClaude(page, { reply: { tags: ["HEAT", "DANGER"], note: "Hot." } });
    await open(page);
    await appraise(page, "wildfire");
    await addIt(page);
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

    const tags = await offered(page).allTextContents();
    expect(tags.sort()).toEqual(["DANGER", "HEAT"]);
    expect(tags).not.toContain("SPICY");
  });

  test("a reply with no usable overtones falls back to the house", async ({ page }) => {
    await withClaude(page, { reply: { tags: ["NONSENSE", "ALSO NONSENSE"], note: "" } });
    await open(page);
    await appraise(page, "glacier");

    await expect(page.locator("#appraisal .src")).toContainText("House appraisal");
    const tags = await offered(page).allTextContents();
    expect(tags.length).toBeGreaterThan(0);
    expect(tags).toContain("COLD");
  });

  test("a malformed reply does not break the game", async ({ page }) => {
    await withClaude(page, { reply: { note: "no tags field at all" } });
    await open(page);
    await appraise(page, "wildfire");

    await expect(page.locator(".pickgrid")).toBeVisible();
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

      await expect(page.locator("#interpInput")).toHaveValue("glacier");
      await expect(page.locator("#appraisal .src")).toContainText("House appraisal");
      /* the run continues — the card is still real */
      await addIt(page);
      const inDeck = await page.evaluate(() =>
        G.deck.concat(G.discard, G.hand).some(c => c.w === "GLACIER" && c.interpreted));
      expect(inDeck).toBe(true);
    });
  }
});
