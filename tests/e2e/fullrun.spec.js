/* A whole run, played start to finish.
 *
 * Every other E2E test exercises a slice. This one plays the real arc —
 * rounds, shops, purchases, the result screen — and fails on any console
 * error or unhandled rejection along the way. It is the test that would
 * catch "round 6 throws on a deck that has been reshuffled twice".
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
      await enterGame(page);
      if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
      if (await page.locator("#veil").isVisible()) await page.click("#closeHelp");
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

        /* Pick a line the way the game itself would.

           This used to tap cards 1, 2 and 3 and press Enter. Under PICK that
           was a fine approximation of a player; under JOIN it is not a player
           at all - the order is the decision and a silence stops the line, so
           three cards in dealt order reliably scores too little to clear round
           1, and the run ended before it had ever seen a shop. The assertions
           below are about the ARC (a shop opened, a Lens was affordable), and
           a walk that cannot reach round 2 cannot test any of it. */
        await page.evaluate(() => {
          const best = bestLineFrom(G.hand.slice(), maxPlay());
          G.selected = (best && best.cards.length ? best.cards : G.hand.slice(0, 2))
            .map(c => c.id);
          renderHand(); renderControls(); renderPreview();
        });
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

      /* The arc actually happened. Six rounds of two plays, not the eight of
         four this was written against, so the floor moves with the run. */
      expect(seen.plays, "no hands were played").toBeGreaterThan(2);
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
      await enterGame(page);
      if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");

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
