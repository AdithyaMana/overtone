/* A whole run, played start to finish.
 *
 * Every other E2E test exercises a slice. This one plays the real arc —
 * rounds, shops, purchases, the result screen — and fails on any console
 * error or unhandled rejection along the way. It is the test that would
 * catch "round 6 throws on a deck that has been reshuffled twice".
 */
const { test, expect } = require("@playwright/test");
const path = require("path");
const { pathToFileURL } = require("url");

const GAME = pathToFileURL(path.resolve(__dirname, "..", "..", "index.html")).href;

/* Watch for anything the page complains about, from the first byte. */
function watchForErrors(page) {
  const problems = [];
  page.on("console", m => {
    if (m.type() === "error") {
      const t = m.text();
      /* Google Fonts can be unreachable in a sandbox; that is not a game bug. */
      if (/fonts\.(googleapis|gstatic)/.test(t)) return;
      if (/Failed to load resource/.test(t) && /font/i.test(t)) return;
      problems.push("console: " + t);
    }
  });
  page.on("pageerror", e => problems.push("pageerror: " + e.message));
  return problems;
}

test.describe("a full run", () => {
  test("plays from the first Demand to the result screen without erroring",
    async ({ page }) => {
      test.setTimeout(180000);
      const problems = watchForErrors(page);

      await page.goto(GAME);
      await page.click("#closeHelp");
      await expect(page.locator("#veil")).toBeHidden();

      const seen = { rounds: 0, shops: 0, bought: 0, plays: 0 };
      let ended = null;

      /* Generous ceiling: 8 rounds x 4 plays, plus shops. */
      for (let step = 0; step < 80 && !ended; step++) {
        if (await page.locator("#veil").isVisible()) {
          const text = await page.locator("#panel").innerText();

          if (/The run ends at|The desk is cleared/.test(text)) { ended = text; break; }

          if (/The Bookseller/.test(text)) {
            seen.shops++;
            /* Buy whatever the purse allows, then leave — this is the path a
               real player takes, and it exercises buy() and the slot cap. */
            const got = await page.evaluate(() => {
              const i = G.offers.findIndex(o => o.kind === "lens" && G.bank >= o.cost
                && G.lenses.length < LENS_SLOTS);
              if (i < 0) return false;
              buy(i, 9);
              return true;
            });
            if (got) seen.bought++;
            await page.click("#leaveShop");
            await expect(page.locator("#veil")).toBeHidden();
            seen.rounds++;
            continue;
          }
          /* anything else on screen mid-run is unexpected */
          throw new Error("unexpected panel during the run:\n" + text.slice(0, 200));
        }

        /* play the first three cards */
        for (const key of ["1", "2", "3"]) await page.keyboard.press(key);
        await page.keyboard.press("Enter");
        seen.plays++;
        for (let i = 0; i < 40; i++) {
          await page.keyboard.press(" ");
          if (await page.evaluate(() => !G.animating)) break;
          await page.waitForTimeout(100);
        }
        await page.waitForFunction(() => !G.animating);
      }

      expect(ended, "the run never reached a result screen").not.toBeNull();

      /* the arc actually happened */
      expect(seen.plays, "no hands were played").toBeGreaterThan(3);
      expect(seen.shops, "the Bookseller never opened").toBeGreaterThan(0);
      expect(seen.bought, "no Lens was ever affordable").toBeGreaterThan(0);

      /* the result screen carries what a player leaves with */
      await expect(page.locator("#panel .share")).toContainText("OVERTONE");
      await expect(page.locator("#panel .stat")).not.toHaveCount(0);

      expect(problems, "the page reported errors during a full run").toEqual([]);
    });

  test("a second run starts clean and carries the Memory forward",
    async ({ page }) => {
      test.setTimeout(120000);
      const problems = watchForErrors(page);

      await page.goto(GAME);
      await page.click("#closeHelp");

      /* End a run holding a Lens, the short way — the long way is covered above.
         coachFinish() is what leaving the Bookseller does; without it the coach
         legitimately returns, because a player who never cleared round one was
         never taught. */
      await page.evaluate(() => {
        coachFinish();
        G.round = ROUNDS - 1;
        G.plays = 1; G.roundScore = 0; G.target = 9999999;
        G.lenses = [LENSES.find(l => l.id === "doom")];
        render();
      });
      for (const key of ["1", "2", "3"]) await page.keyboard.press(key);
      await page.keyboard.press("Enter");
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press(" ");
        if (await page.evaluate(() => !G.animating)) break;
        await page.waitForTimeout(100);
      }
      await expect(page.locator("#panel")).toContainText("The run ends at");

      await page.click("#againNew");
      await expect(page.locator("#veil")).toBeHidden();
      await expect(page.locator("#hand .card")).toHaveCount(7);
      await expect(page.locator("#rail .lens .n")).toContainText("DOOMSAYER");
      await expect(page.locator("#roundLabel")).toContainText("Round 1");
      /* the coach has retired; a returning player is not re-taught */
      await expect(page.locator("#coach")).toBeHidden();

      expect(problems).toEqual([]);
    });
});
