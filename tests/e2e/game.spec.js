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

/* Portrait hides the stage's preview cards: the hand already shows the same
   words, selected and numbered, and redrawing them cost 240px of a 667px
   screen. They are still the right thing to measure in a geometry test — the
   only cards on the page with transform:none — so tests that measure them ask
   for them back. Without this they would measure a display:none element, which
   is 0x0, and pass without testing anything. */
async function measurableStageCards(page) {
  await page.addStyleTag({
    content: "#app:not(.resolving) #stageCards .card{ display:block !important }"
  });
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
    await expect(panel).toContainText("points × multiplier");
    /* the question the rules card never used to answer */
    await expect(panel).toContainText("Take three words");
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
    await expect(call).toContainText("+25 points");
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

    /* the numbers are on the cards in hand at every width */
    const held = page.locator("#hand .card.sel .pos");
    await expect(held).toHaveCount(3);
    await expect(held.nth(0)).toHaveText("1");

    await measurableStageCards(page);
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
    await expect(page.locator(".hand-name")).toContainText("MATCH");
    await expect(page.locator("#stageHint")).toContainText("Worth");
  });

  test("does not claim the order matters before any Lens reads it", async ({ page }) => {
    await open(page);
    /* A lens-less player's points are simply summed, so every order gives the
       same number — saying otherwise is a lie the board used to tell on the
       first screen of the first run. */
    await page.evaluate(() => { G.lenses = []; render(); });
    await expect(page.locator("#stageHint")).not.toContainText("left to right");
    await expect(page.locator(".stage-hint .ord")).toHaveCount(0);
  });

  test("says the order matters once a Lens actually reads position", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      G.lenses = [LENSES.find(l => l.id === "carn")];   // eats the word to its LEFT
      render();
    });
    await page.locator("#hand .card").first().click();
    await expect(page.locator(".stage-hint .ord")).toContainText("left to right");
  });

  test("says it for a mixed +mult / ×mult pair too", async ({ page }) => {
    await open(page);
    const matters = await page.evaluate(() => {
      G.lenses = [LENSES.find(l => l.id === "zoo")];              // +2 mult
      const addOnly = orderMatters();
      G.lenses.push(LENSES.find(l => l.id === "brut"));           // ×2 mult
      return { addOnly, mixed: orderMatters() };
    });
    /* (1+2)×2 = 6 but (1×2)+2 = 4, from the very same three words */
    expect(matters.addOnly).toBe(false);
    expect(matters.mixed).toBe(true);
  });

  test("refuses a fourth card and says why", async ({ page }) => {
    await open(page);
    for (const key of ["1", "2", "3", "4"]) await page.keyboard.press(key);
    await expect(page.locator("#hand .card.sel")).toHaveCount(3);
    await expect(page.locator("#toast")).toContainText("Three at a time");
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

    await expect(page.locator("#leaveShop")).toContainText("Back to the table");
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

  test("all seven words and all three buttons are on screen at once",
    async ({ page }, info) => {
      test.skip(info.project.name !== "phone", "portrait budget");
      await open(page);
      /* The invariant is not "no scrollbar" — it is that the decision (which
         words) and the move (which button) are both visible without scrolling.
         The controls are pinned, so the failure mode is the hand's second row
         sliding underneath them. */
      /* Cards deal in from below over ~700ms, so a raw measurement here races
         the animation and reports a row that is only transiently low. */
      await expect.poll(() => page.evaluate(() => {
        const ctl = document.querySelector(".controls").getBoundingClientRect();
        return Array.from(document.querySelectorAll("#hand .card"))
          .filter(c => c.getBoundingClientRect().bottom > ctl.top + 1).length;
      }), { timeout: 4000, message: "hand cards are hidden behind the control row" }).toBe(0);
      await expect(page.locator("#hand .card")).toHaveCount(7);
      await expect(page.locator("#playBtn")).toBeInViewport();
      await expect(page.locator("#discardBtn")).toBeInViewport();
      await expect(page.locator("#interpBtn")).toBeInViewport();
    });

  test("holds on a 375x667 screen too", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "portrait budget");
    /* An iPhone SE is 145px shorter than the viewport this was designed
       against, which is more than a whole row of cards. */
    await page.setViewportSize({ width: 375, height: 667 });
    await open(page);
    await expect.poll(() => page.evaluate(() => {
      const ctl = document.querySelector(".controls").getBoundingClientRect();
      return Array.from(document.querySelectorAll("#hand .card"))
        .filter(c => c.getBoundingClientRect().bottom > ctl.top + 1).length;
    }), { timeout: 4000, message: "the hand does not fit an SE" }).toBe(0);

    const sideways = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways).toBeLessThanOrEqual(1);
    await expect(page.locator("#playBtn")).toBeInViewport();
  });

  test("the board does not repeat the hand back at portrait width",
    async ({ page }, info) => {
      test.skip(info.project.name !== "phone", "portrait layout");
      await open(page);
      for (const key of ["1", "2"]) await page.keyboard.press(key);
      await expect(page.locator("#stageCards .card").first()).toBeHidden();
      await expect(page.locator("#hand .card .pos")).toHaveCount(2);
      await expect(page.locator("#stageHint")).toContainText("Worth");
    });

  test("nothing on a card overlaps the icon plate", async ({ page }) => {
    await open(page);
    /* Measured on the stage cards, not the hand: hand cards are fanned and
       deal in with a rotation, and a rotated element has an inflated
       axis-aligned rect, so an AABB test there reports overlaps that are not
       visually there. Stage cards carry transform:none and render the same
       markup. The value badge used to sit absolutely over the art, where a
       third overtone icon ran underneath it. */
    await measurableStageCards(page);
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
    await measurableStageCards(page);
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
    await expect(coach).toContainText("what this round wants");

    /* step 2: play — and the button it points at is marked */
    await page.keyboard.press("1");
    await expect(coach).toContainText("Hit PLAY");
    await expect(page.locator("#playBtn")).toHaveClass(/hint-pulse/);

    /* deselecting walks it back rather than stranding the player */
    await page.keyboard.press("1");
    await expect(coach).toContainText("what this round wants");

    /* step 3: read the result */
    await playAHand(page);
    if (!(await page.locator("#veil").isVisible())) {
      await expect(coach).toContainText("points × multiplier");
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
    await expect(page.locator("#tutStep")).toContainText("Overtone");
    await expect(page.locator("#tutText")).toContainText("overtones");
    await expect(page.locator("#tutStep")).toContainText("1 of 7");
    await expect(page.locator("#tutDots i")).toHaveCount(7);
    /* the modal no longer opens itself */
    await expect(page.locator("#veil")).toBeHidden();
  });

  test("spotlights the real board, and lets the player touch it", async ({ page }) => {
    await page.goto(GAME);
    await page.click("#tutNext");                       // -> what the round wants
    await expect(page.locator("#tutStep")).toContainText("2 of 7");
    await expect(page.locator("#tutText")).toContainText("wants");

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
    await expect(page.locator("#tutStep")).toContainText("3 of 7");
    await expect(page.locator("#tutNext")).toBeHidden();  // doing it IS the button
    await page.locator("#hand .card").first().click();
    await expect(page.locator("#hand .card.sel")).toHaveCount(1);
    await expect(page.locator("#tutStep")).toContainText("4 of 7");
  });

  test("answers how many words to take, and makes you take a second", async ({ page }) => {
    await page.goto(GAME);
    for (let i = 0; i < 2; i++) await page.click("#tutNext");
    await page.locator("#hand .card").nth(0).click();

    const text = page.locator("#tutText");
    await expect(page.locator("#tutStep")).toContainText("4 of 7");
    await expect(text).toContainText("Take three when you can");
    /* the two reasons, both of which are true of the actual scoring */
    await expect(text).toContainText("three times as much as one");
    await expect(text).toContainText("more money");
    await expect(page.locator("#tutNext")).toBeHidden();

    /* the step teaches "take three", so two is not enough to clear it */
    await page.locator("#hand .card").nth(1).click();
    await expect(page.locator("#hand .card.sel")).toHaveCount(2);
    await expect(page.locator("#tutStep")).toContainText("4 of 7");

    await page.locator("#hand .card").nth(2).click();
    await expect(page.locator("#tutStep")).toContainText("5 of 7");
  });

  test("names the case for playing fewer, so the rule has an exception", async ({ page }) => {
    await page.goto(GAME);
    for (let i = 0; i < 2; i++) await page.click("#tutNext");
    await page.locator("#hand .card").nth(0).click();
    await page.locator("#hand .card").nth(1).click();
    await page.locator("#hand .card").nth(2).click();
    await page.click("#tutNext");                      // -> play
    await page.click("#playBtn");
    await expect(page.locator("#tutStep")).toContainText("7 of 7");
    await expect(page.locator("#tutText")).toContainText("ASCETIC");
  });

  test("advances off a real play, then finishes and stays gone", async ({ page }) => {
    await page.goto(GAME);
    /* straight to the play step */
    for (let i = 0; i < 2; i++) await page.click("#tutNext");
    await page.locator("#hand .card").nth(0).click();
    await expect(page.locator("#tutStep")).toContainText("4 of 7");
    await page.locator("#hand .card").nth(1).click();
    await page.locator("#hand .card").nth(2).click();
    await expect(page.locator("#tutStep")).toContainText("5 of 7");
    await page.click("#tutNext");
    await expect(page.locator("#tutStep")).toContainText("6 of 7");
    await expect(page.locator("#tutNext")).toBeHidden();

    await page.click("#playBtn");
    await expect(page.locator("#tutStep")).toContainText("7 of 7");
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
    await expect(page.locator("#coach")).toContainText("what this round wants");
  });

  test("finishing it retires the coach, which would only repeat itself", async ({ page }) => {
    await page.goto(GAME);
    for (let i = 0; i < 2; i++) await page.click("#tutNext");
    await page.locator("#hand .card").nth(0).click();
    await page.locator("#hand .card").nth(1).click();
    await page.locator("#hand .card").nth(2).click();
    await page.click("#tutNext");
    await page.click("#playBtn");
    await expect(page.locator("#tutStep")).toContainText("7 of 7");
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
    await expect(page.locator("#tutStep")).toContainText("1 of 7");
  });

  test("docks the card clear of the spotlight on a phone", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "phone layout only");
    await page.goto(GAME);
    for (let i = 0; i < 2; i++) await page.click("#tutNext");
    await page.locator("#hand .card").nth(0).click();
    await page.locator("#hand .card").nth(1).click();
    await page.locator("#hand .card").nth(2).click();
    await page.click("#tutNext");                                  // -> Play it

    /* The spotlight sits on the pinned control row at the bottom, so the card
       has to move to the top of the screen or it covers the button it is
       telling the player to press. */
    const clear = await page.evaluate(() => {
      const box = document.getElementById("tutBox").getBoundingClientRect();
      const btn = document.getElementById("playBtn").getBoundingClientRect();
      return box.bottom <= btn.top + 1 || box.top >= btn.bottom - 1;
    });
    expect(clear, "the tutorial card is sitting on top of PLAY").toBe(true);
  });
});

/* ------------------------------------------------------------------ */
test.describe("sound, vibration and motion", () => {
  test("three separate switches, and they stick", async ({ page }) => {
    await open(page);
    await page.click("#soundBtn");
    const panel = page.locator("#panel");
    await expect(panel).toContainText("Sound & feel");
    await expect(panel.locator(".switch")).toHaveCount(3);
    /* the iPhone gap is stated rather than quietly shipped */
    await expect(panel).toContainText("Android only");

    const music = panel.locator('.switch[data-pref="music"]');
    await expect(music).toHaveText("ON");
    await music.click();
    await expect(music).toHaveText("OFF");
    await expect(page.locator("#soundBtn")).toHaveAttribute("aria-pressed", "true"); // sfx still on

    await panel.locator('.switch[data-pref="sfx"]').click();
    await expect(page.locator("#soundBtn")).toHaveAttribute("aria-pressed", "false");

    await page.click("#closeSettings");
    await page.reload();
    if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
    await page.click("#soundBtn");
    await expect(page.locator('.switch[data-pref="music"]')).toHaveText("OFF");
  });

  test("the theme starts on the first gesture, and loops", async ({ page }) => {
    await open(page);                      // clicking Skip is the gesture
    await page.locator("#hand .card").first().click();
    const state = await page.evaluate(async () => {
      await new Promise(r => setTimeout(r, 500));
      return typeof music !== "undefined" && music
        ? { loop: music.loop, src: music.src, vol: music.volume } : null;
    });
    expect(state, "no audio element was ever created").not.toBeNull();
    expect(state.loop, "the theme does not loop").toBe(true);
    expect(state.src).toContain("audio/theme.mp3");
    /* Whether it is actually audible depends on the browser's autoplay policy,
       which is not ours to assert — but the element must exist, point at the
       right file and be set to loop, and a blocked play() must not throw. */
  });

  test("muting the music actually stops it", async ({ page }) => {
    await open(page);
    await page.locator("#hand .card").first().click();
    await page.click("#soundBtn");
    await page.locator('.switch[data-pref="music"]').click();
    await page.click("#closeSettings");
    await expect.poll(() => page.evaluate(() =>
      typeof music !== "undefined" && music ? music.paused || music.volume < 0.02 : true
    ), { timeout: 3000 }).toBe(true);
  });

  test("the theme is never fetched before the player touches anything", async ({ page }) => {
    const asked = [];
    page.on("request", r => { if (/theme\.mp3/.test(r.url())) asked.push(r.url()); });
    await page.goto(GAME);
    await expect(page.locator("#tut")).toBeVisible();
    expect(asked, "2MB of audio was pulled before the first frame").toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
test.describe("throwaway motion cleans up after itself", () => {
  test("no particle is ever left sitting on the board", async ({ page }) => {
    await open(page);
    for (const k of ["1", "2", "3"]) await page.keyboard.press(k);
    await page.click("#playBtn");

    /* A Web Animation with no `fill` reverts its element to the element's own
       static style the instant it finishes. Every particle in this page used to
       be animated that way and removed by a separate, longer setTimeout — so
       between the two, each one SNAPPED BACK to its start position at full
       opacity and sat there. The sparks were the visible case: 700-1220ms of
       animation, removed at 1300ms, leaving a solid square parked dead centre
       of the board for up to half a second after every single hand.

       So: sample every frame of the whole scoring window, and fail if any
       particle is still visible after its animation has finished. */
    const bad = await page.evaluate(async () => {
      const noHold = new Set(), parked = new Set();
      const t0 = performance.now();
      while (performance.now() - t0 < 7000) {
        document.querySelectorAll(".spark, .confetto, .flyer, .shock").forEach(el => {
          const anims = el.getAnimations();
          /* The guarantee is in the timing, not in the cleanup: an animation
             that holds its last frame cannot snap back no matter how late the
             removal is. Assert that directly — a finished-but-present element
             is a sub-frame window that sampling cannot reliably observe, so
             checking only for a visible leftover would pass either way. */
          anims.forEach(a => {
            const fill = a.effect && a.effect.getTiming().fill;
            if (fill !== "forwards" && fill !== "both") {
              noHold.add(el.className.trim() + " fill=" + fill);
            }
          });
          if (anims.length && anims.every(a => a.playState === "finished")) {
            const op = parseFloat(getComputedStyle(el).opacity);
            if (op > 0.05) parked.add(el.className.trim() + " at opacity " + op.toFixed(2));
          }
        });
        await new Promise(r => requestAnimationFrame(r));
      }
      return { noHold: Array.from(noHold), parked: Array.from(parked) };
    });
    expect(bad.noHold, "a particle animation does not hold its last frame").toEqual([]);
    expect(bad.parked, "a finished particle was still visible").toEqual([]);

    /* and nothing outlives the hand */
    await settle(page);
    await expect.poll(() => page.evaluate(() =>
      document.querySelectorAll(".spark, .confetto, .flyer, .shock").length
    ), { timeout: 6000, message: "particles outlived the hand" }).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
test.describe("the Bookseller tells the truth", () => {
  async function shopAt(page, round, ids, ordealId) {
    return page.evaluate(({ round, ids, ordealId }) => {
      G.round = round;
      G.lenses = ids.map(id => LENSES.find(l => l.id === id));
      G.lensState = {};
      if (ordealId) G.ordealOrder[round] = ORDEALS.find(o => o.id === ordealId);
      G.bank = 12; G.offers = null;
      openShop(9);
      return { raw: TARGETS[round], shape: roundShape(round) };
    }, { round, ids, ordealId });
  }

  test("it quotes the target you will actually face, not the one on the table",
    async ({ page }) => {
      await open(page);
      /* THE CURSE doubles every target. The shop used to print TARGETS[round]
         straight, so it said 11,500 and the round then demanded 23,000 — the
         game lying at the exact moment you are deciding what to buy. */
      const r = await shopAt(page, 4, ["curse"]);
      expect(r.shape.target).toBe(r.raw * 2);
      await expect(page.locator("#panel")).toContainText(r.shape.target.toLocaleString());
      await expect(page.locator("#panel")).toContainText("the usual");
    });

  test("it states the shape of the round, not just its number", async ({ page }) => {
    await open(page);
    /* THE WAGER takes a play, THE FAMINE three cards and a discard. Buying a
       Lens that costs you a play should show that cost here, before you
       commit, rather than on the board a minute later. */
    const r = await shopAt(page, 4, ["wager", "famine"]);
    expect(r.shape.plays).toBe(3);
    expect(r.shape.hand).toBe(4);
    const shape = page.locator(".panel p.shape");
    await expect(shape).toContainText("3");
    await expect(shape).toContainText("hand of 4");
  });

  test("it says plainly when the deck cannot reach the next target", async ({ page }) => {
    await open(page);
    /* A losing build is the genre. An INVISIBLE losing build is a bug: the
       measurement said 15.6% of rounds held while holding a flawed Lens cannot
       be won by any sequence of plays. */
    await page.evaluate(() => {
      G.round = 6;                       // a 23,500 target
      G.lenses = [LENSES.find(l => l.id === "curse")];   // doubled to 47,000
      G.lensState = {}; G.bank = 12; G.offers = null;
      openShop(9);
    });
    const reality = page.locator(".reality");
    await expect(reality).toBeVisible();
    await expect(reality).toHaveClass(/short/);
    await expect(reality).toContainText("THIS DOES NOT REACH");
    await expect(reality).toContainText("No order of play gets there");
    await expect(reality).toContainText("sell a Lens");
  });

  test("and says so when the deck is fine", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      /* Round 1's 250, which a bare deck clears at about x1.4. Round 2 is
         deliberately NOT a safe example: a Lens-less deck tops out around 334
         against a 700 target, which is the shop teaching itself and not a bug. */
      G.round = 0; G.lenses = []; G.lensState = {}; G.bank = 12; G.offers = null;
      openShop(9);
    });
    const reality = page.locator(".reality");
    await expect(reality).toBeVisible();
    await expect(reality).not.toHaveClass(/short/);
    await expect(reality).toContainText("YOU CAN MAKE THIS");
  });

  test("the reality check does not disturb the round it is looking past",
    async ({ page }) => {
      await open(page);
      /* deckCeiling borrows G.demand, G.ordeal and G.discards to score against
         a future round. Leaving any of them changed would corrupt the board. */
      const same = await page.evaluate(() => {
        const before = JSON.stringify({
          demand: G.demand, ordeal: G.ordeal && G.ordeal.id, discards: G.discards
        });
        deckCeiling(5); deckCeiling(7);
        const after = JSON.stringify({
          demand: G.demand, ordeal: G.ordeal && G.ordeal.id, discards: G.discards
        });
        return before === after;
      });
      expect(same, "deckCeiling left the board changed").toBe(true);
    });
});

/* ------------------------------------------------------------------ */
test.describe("Ordeals", () => {
  async function enterOrdeal(page, id) {
    return page.evaluate(id => {
      G.round = 3;
      G.ordealOrder[3] = ORDEALS.find(o => o.id === id);
      startRound();
      return { plays: G.plays, discards: G.discards, hand: G.hand.length, cap: maxPlay() };
    }, id);
  }

  test("three rounds of every run change a rule, not a number", async ({ page }) => {
    await open(page);
    const shape = await page.evaluate(() => {
      const out = [];
      for (let r = 0; r < ROUNDS; r++) {
        G.round = r; startRound();
        out.push(G.ordeal ? G.ordeal.id : null);
      }
      return out;
    });
    /* Rounds 4, 6 and 8 — and round 8 always, so a run ends on a wall rather
       than on a slightly larger number. */
    expect(shape.map((o, i) => o ? i : null).filter(i => i !== null)).toEqual([3, 5, 7]);
    expect(new Set(shape.filter(Boolean)).size, "the same Ordeal three times").toBe(3);
  });

  test("the board states the rule before a card is played", async ({ page }) => {
    await open(page);
    await enterOrdeal(page, "fog");
    const ord = page.locator("#ordeal");
    await expect(ord).toBeVisible();
    await expect(ord).toContainText("THE FOG");
    await expect(ord).toContainText("Only matching tags pay");
  });

  test("the Bookseller names the Ordeal so you can spend money answering it",
    async ({ page }) => {
      await open(page);
      await page.evaluate(() => {
        G.round = 3;
        G.ordealOrder[3] = ORDEALS.find(o => o.id === "vice");
        G.bank = 12; G.offers = null;
        openShop(9);
      });
      const warn = page.locator(".ordeal-warn");
      await expect(warn).toBeVisible();
      await expect(warn).toContainText("NEXT ROUND IS AN ORDEAL");
      await expect(warn).toContainText("THE VICE");
    });

  test("THE VICE actually refuses a third word", async ({ page }) => {
    await open(page);
    const state = await enterOrdeal(page, "vice");
    expect(state.cap).toBe(2);
    for (const k of ["1", "2", "3"]) await page.keyboard.press(k);
    await expect(page.locator("#hand .card.sel")).toHaveCount(2);
    await expect(page.locator("#toast")).toContainText("THE VICE allows 2");
  });

  test("THE DROUGHT, THE CLOCK and THE LEAN YEAR take what they say they take",
    async ({ page }) => {
      await open(page);
      expect((await enterOrdeal(page, "drought")).discards).toBe(0);
      expect((await enterOrdeal(page, "clock")).plays).toBe(3);
      expect((await enterOrdeal(page, "lean")).hand).toBe(4);
    });

  test("THE FOG takes a word's own value but leaves its matching tags", async ({ page }) => {
    await open(page);
    const r = await page.evaluate(() => {
      G.lenses = []; G.lensState = {};
      G.demand = { n: "T", tags: ["HEA"] };
      const c = makeCard({ w: "FURNACE", t: ["HEA"] }, false);
      G.ordeal = null;
      const clear = resolve([c]).chips;
      G.ordeal = ORDEALS.find(o => o.id === "fog");
      const fogged = resolve([c]).chips;
      return { clear, fogged, base: c.base };
    });
    expect(r.clear).toBe(r.base + 25);
    expect(r.fogged, "the matching tag should still pay").toBe(25);
  });

  test("THE MIRROR pays only words with two matching tags", async ({ page }) => {
    await open(page);
    const r = await page.evaluate(() => {
      G.lenses = []; G.lensState = {};
      G.demand = { n: "T", tags: ["HEA", "DAN"] };
      G.ordeal = ORDEALS.find(o => o.id === "mirror");
      const both = makeCard({ w: "WILDFIRE", t: ["HEA", "DAN"] }, false);
      const one = makeCard({ w: "EMBER", t: ["HEA"] }, false);
      return { both: resolve([both]).chips, one: resolve([one]).chips };
    });
    expect(r.both).toBeGreaterThan(0);
    expect(r.one, "a single match should score nothing under THE MIRROR").toBe(0);
  });

  test("an Ordeal never lands on the round a first-timer is being taught",
    async ({ page }) => {
      await page.goto(GAME);
      /* The tutorial runs on round 1. Meeting a rule-breaking round while
         still learning the rules would be indefensible. */
      const first = await page.evaluate(() => G.ordeal);
      expect(first).toBeNull();
    });
});

/* ------------------------------------------------------------------ */
test.describe("selling a Lens", () => {
  async function shopWith(page, ids, bank) {
    await page.evaluate(({ ids, bank }) => {
      G.lenses = ids.map(id => LENSES.find(l => l.id === id));
      G.lensState = {};
      G.bank = bank; G.round = 3; G.offers = null;
      openShop(9);
    }, { ids, bank });
  }

  test("frees the slot and pays back half", async ({ page }) => {
    await open(page);
    /* Five slots against thirty Lenses meant the only interesting decision —
       the one where you give something up — happened once, on the purchase
       that filled your last slot. After that the shop was a wall. */
    await shopWith(page, ["pyro", "reso", "glut", "zoo", "night"], 2);
    await expect(page.locator(".own")).toHaveCount(5);
    await expect(page.locator("#panel")).toContainText("5 of 5 slots full");
    /* every Lens offer is dead while the slots are full */
    const lensOffers = page.locator(".offer").filter({ hasNotText: "TWO NEW WORDS" });
    expect(await lensOffers.first().isDisabled()).toBe(true);

    const before = await page.evaluate(() => ({ bank: G.bank, n: G.lenses.length }));
    await page.locator(".sellbtn").first().click();

    const after = await page.evaluate(() => ({ bank: G.bank, n: G.lenses.length }));
    expect(after.n, "the slot was not freed").toBe(before.n - 1);
    /* PYROMANIAC costs $5, so it sells for $3 — half, rounded up. Always a
       loss, or the shop could be churned for money. */
    expect(after.bank).toBe(before.bank + 3);
    await expect(page.locator("#panel")).toContainText("4 of 5 slots used");
  });

  test("selling a grown Lens loses what it grew, and says so first", async ({ page }) => {
    await open(page);
    await shopWith(page, ["pyro"], 5);
    await page.evaluate(() => { G.lensState.pyro = 440; openShop(9); });

    await expect(page.locator(".grown")).toContainText("grown to +440");
    await expect(page.locator(".grown")).toContainText("selling loses it");

    await page.locator(".sellbtn").first().click();
    const kept = await page.evaluate(() => G.lensState.pyro);
    expect(kept, "the growth survived the sale").toBeUndefined();
  });

  test("the slot freed can immediately be spent", async ({ page }) => {
    await open(page);
    await shopWith(page, ["pyro", "reso", "glut", "zoo", "night"], 12);
    await page.locator(".sellbtn").first().click();
    const lensOffer = page.locator(".offer").filter({ hasNotText: "TWO NEW WORDS" }).first();
    expect(await lensOffer.isDisabled(), "still blocked after freeing a slot").toBe(false);
  });
});

/* ------------------------------------------------------------------ */
test.describe("Lenses that cost you something", () => {
  test("the shop marks a flawed Lens rather than burying the catch", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      G.bank = 20; G.round = 3;
      G.offers = [
        { kind: "lens", lens: LENSES.find(l => l.id === "curse"), cost: 7 },
        { kind: "lens", lens: LENSES.find(l => l.id === "zoo"), cost: 5 },
        { kind: "words", cost: 3 }
      ];
      openShop(9);
    });
    const flawed = page.locator(".offer.flawed");
    await expect(flawed).toHaveCount(1);
    await expect(flawed).toContainText("COSTS YOU SOMETHING");
    await expect(flawed).toContainText("doubled");
  });

  test("THE WAGER actually takes the play it charges for", async ({ page }) => {
    await open(page);
    const meters = await page.evaluate(() => {
      G.lenses = [LENSES.find(l => l.id === "wager")];
      startRound();
      return { plays: G.plays, shown: document.getElementById("playsLeft").textContent };
    });
    expect(meters.plays).toBe(3);
    expect(meters.shown, "the meter still claims four").toBe("3");
  });

  test("THE FAMINE actually deals a smaller hand", async ({ page }) => {
    await open(page);
    const n = await page.evaluate(() => {
      G.lenses = [LENSES.find(l => l.id === "famine")];
      startRound();
      return G.hand.length;
    });
    expect(n).toBe(4);
    await expect(page.locator("#hand .card")).toHaveCount(4);
  });
});

/* ------------------------------------------------------------------ */
test.describe("Lenses that grow", () => {
  test("the rail shows what a Lens has grown to", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      G.lenses = [LENSES.find(l => l.id === "prosp")];
      G.lensState = { prosp: 570 };
      renderRail();
    });
    await expect(page.locator("#rail .lens .lv")).toContainText("+570 so far");
  });

  test("a hand scored twice gives the same number both times", async ({ page }) => {
    await open(page);
    /* renderPreview calls resolve() on every click. If scoring advanced a
       growing Lens, the board would show one number and pay another. */
    const scores = await page.evaluate(() => {
      G.lenses = [LENSES.find(l => l.id === "pyro")];
      G.lensState = { pyro: 110 };
      const hand = G.hand.slice(0, 3);
      return [resolve(hand).total, resolve(hand).total, resolve(hand).total, G.lensState.pyro];
    });
    expect(scores[0]).toBe(scores[1]);
    expect(scores[1]).toBe(scores[2]);
    expect(scores[3], "previewing a hand grew the Lens").toBe(110);
  });
});

/* ------------------------------------------------------------------ */
test.describe("reading a Lens you own", () => {
  async function equip(page, ids) {
    await page.evaluate(list => {
      G.lenses = list.map(id => LENSES.find(l => l.id === id));
      G.openLens = null;
      render();
    }, ids);
  }

  test("tapping one opens it out to the whole rule", async ({ page }) => {
    await open(page);
    /* The rail clamps a rule to two lines, and `title` — the only other way to
       read it — is a hover tooltip, which a touch screen does not have. So the
       rule a player just paid $6 for was unreadable on a phone. */
    await equip(page, ["anton", "literal", "carn"]);

    const first = page.locator("#rail .lens").first();
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await first.click();
    await expect(first).toHaveAttribute("aria-expanded", "true");

    const readable = await page.evaluate(() => {
      const d = document.querySelector(".lens.open .d");
      return {
        clamped: getComputedStyle(d).webkitLineClamp !== "none",
        cut: d.scrollHeight > d.clientHeight + 1,
        text: d.textContent
      };
    });
    expect(readable.clamped, "the open rule is still clamped").toBe(false);
    expect(readable.cut, "the open rule is still cut off").toBe(false);
    expect(readable.text).toContain("COLD");
  });

  test("only one is open at a time, and tapping again closes it", async ({ page }) => {
    await open(page);
    await equip(page, ["anton", "literal", "carn"]);
    const lenses = page.locator("#rail .lens");

    await lenses.nth(0).click();
    await lenses.nth(1).click();
    await expect(lenses.nth(0)).toHaveAttribute("aria-expanded", "false");
    await expect(lenses.nth(1)).toHaveAttribute("aria-expanded", "true");

    await lenses.nth(1).click();
    await expect(page.locator("#rail .lens.open")).toHaveCount(0);
  });

  test("opening one does not push the hand off a phone", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "portrait budget");
    await open(page);
    /* Letting the rail wrap to a second row cost 53px, which is enough to put
       the hand's bottom row behind the pinned controls. The open Lens stays on
       the one row, stopping short of full width so the next one peeks in. */
    await equip(page, ["anton", "literal", "carn"]);
    const railBefore = (await page.locator("#rail").boundingBox()).height;

    await page.locator("#rail .lens").first().click();
    await expect(page.locator("#rail .lens.open")).toHaveCount(1);

    const railAfter = (await page.locator("#rail").boundingBox()).height;
    expect(railAfter, "the rail grew a second row").toBeLessThanOrEqual(railBefore + 2);

    await expect.poll(() => page.evaluate(() => {
      const ctl = document.querySelector(".controls").getBoundingClientRect();
      return Array.from(document.querySelectorAll("#hand .card"))
        .filter(c => c.getBoundingClientRect().bottom > ctl.top + 1).length;
    }), { timeout: 4000, message: "an open Lens pushed the hand behind the controls" }).toBe(0);
  });

  test("every Lens rule fits when opened, however long it is", async ({ page }) => {
    await open(page);
    const cut = await page.evaluate(async () => {
      const bad = [];
      const byLength = LENSES.slice().sort((a, b) => b.d.length - a.d.length).slice(0, 5);
      for (const l of byLength) {
        G.lenses = [l]; G.openLens = l.id; render();
        await new Promise(r => requestAnimationFrame(r));
        const d = document.querySelector(".lens.open .d");
        if (d.scrollHeight > d.clientHeight + 1) bad.push(l.n);
      }
      return bad;
    });
    expect(cut, "a Lens rule is cut off even when open").toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
test.describe("the shape of a hand", () => {
  test("every card in the hand is the same rectangle", async ({ page }) => {
    await open(page);
    /* Sized by their own content, cards came out as seven different heights:
       a word takes one line or two, and its tags one row to five.

       Measured with offsetHeight, NOT getBoundingClientRect. The hand is
       fanned, and a rotated element has an inflated axis-aligned rect whose
       inflation depends on its angle — so the rect reports four different
       heights for seven cards that are all laid out at exactly 196px. Same
       trap the overlap test fell into; offsetHeight is layout, not paint. */
    await expect.poll(() => page.evaluate(() => {
      const hs = Array.from(document.querySelectorAll("#hand .card"))
        .map(c => c.offsetHeight);
      return new Set(hs).size;
    }), { timeout: 4000, message: "hand cards are different heights" }).toBe(1);
  });

  test("a tag that matches the round is never the one pushed out of sight",
    async ({ page }) => {
      await open(page);
      /* The tag row is capped at two lines on a phone, so cardEl sorts matching
         tags to the front — what a fourth long tag displaces is never one that
         scores. */
      const hidden = await page.evaluate(() => {
        const bad = [];
        document.querySelectorAll("#hand .card").forEach(card => {
          const box = card.querySelector(".tags").getBoundingClientRect();
          card.querySelectorAll(".tg.match").forEach(t => {
            const r = t.getBoundingClientRect();
            if (r.bottom > box.bottom + 1 || r.height === 0) bad.push(t.textContent);
          });
        });
        return bad;
      });
      expect(hidden, "a matching tag was clipped out of the card").toEqual([]);
    });
});

/* ------------------------------------------------------------------ */
test.describe("the counters", () => {
  test("a rolling counter lands on the exact number", async ({ page }) => {
    await open(page);
    for (const k of ["1", "2"]) await page.keyboard.press(k);
    /* The roll scrambles digits on its way, so the only thing that matters is
       that it settles on the truth rather than on whatever it was showing when
       the animation stopped. */
    const want = await page.evaluate(() => {
      const cards = G.selected.map(id => G.hand.find(c => c.id === id));
      const r = resolve(cards);
      return { points: String(r.chips), mult: String(Math.round(r.mult * 10) / 10) };
    });
    await expect(page.locator("#chipsV")).toHaveText(want.points);
    await expect(page.locator("#multV")).toHaveText(want.mult);
  });

  test("the total counts up and locks on the real score", async ({ page }) => {
    await open(page);
    for (const k of ["1", "2", "3"]) await page.keyboard.press(k);
    const want = await page.evaluate(() => {
      const cards = G.selected.map(id => G.hand.find(c => c.id === id));
      return "+" + resolve(cards).total.toLocaleString();
    });
    await page.click("#playBtn");
    const total = page.locator(".stage-total");
    await total.waitFor({ state: "visible", timeout: 15000 });
    /* it starts at zero and arrives at the number, rather than appearing as it */
    await expect(total).toHaveText(want, { timeout: 6000 });
    await settle(page);
  });
});

/* ------------------------------------------------------------------ */
test.describe("the sound engine", () => {
  test("builds its bus and plays without throwing", async ({ page }) => {
    const problems = [];
    page.on("pageerror", e => problems.push(e.message));
    await open(page);
    await page.keyboard.press("1");

    const state = await page.evaluate(() => {
      /* every named sound, back to back — any one of them throwing would take
         the hand down with it, since they are called from inside play() */
      Object.keys(SFX).forEach(k => SFX[k](2, true));
      return { ctx: !!actx, running: actx ? actx.state : null, sounds: Object.keys(SFX).length };
    });
    expect(state.ctx, "no AudioContext was ever built").toBe(true);
    expect(state.sounds).toBeGreaterThan(8);
    expect(problems).toEqual([]);
  });

  test("silence means silence", async ({ page }) => {
    await open(page);
    await page.click("#soundBtn");
    await page.locator('.switch[data-pref="sfx"]').click();
    await page.click("#closeSettings");
    /* With effects off, a voice must not even build a node — not merely be
       inaudible. Otherwise a muted tab still pays for the graph. */
    const built = await page.evaluate(() => {
      const before = actx ? actx.currentTime : 0;
      SFX.total(3);
      return { sfxOff: prefs.sfx === false, ok: true, before: before >= 0 };
    });
    expect(built.sfxOff).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
test.describe("the scoring readout", () => {
  test("the board takes the room while a hand resolves", async ({ page }) => {
    await open(page);
    for (const k of ["1", "2"]) await page.keyboard.press(k);
    const before = await page.locator("#stage").boundingBox();
    await page.click("#playBtn");

    await expect(page.locator("#app")).toHaveClass(/resolving/);
    await expect.poll(async () => {
      const b = await page.locator("#stage").boundingBox();
      return b.height > before.height;
    }, { timeout: 2000, message: "the stage never grew for the scoring" }).toBe(true);

    await settle(page);
    await expect(page.locator("#app")).not.toHaveClass(/resolving/);
  });

  test("the total is never cut off by the box it sits in", async ({ page }) => {
    await open(page);
    for (const k of ["1", "2", "3"]) await page.keyboard.press(k);
    await page.click("#playBtn");

    const total = page.locator(".stage-total");
    await total.waitFor({ state: "visible", timeout: 15000 });

    /* The total slams in from scale(2.2) while the stage is still growing, so
       the first frame is legitimately oversized and out of place. Poll for the
       resting state rather than measuring the entrance. */
    await expect.poll(() => page.evaluate(() => {
      const t = document.querySelector(".stage-total");
      if (!t) return null;
      const r = t.getBoundingClientRect();
      return r.width > 20 && r.height > 20
        && r.top >= 0 && r.bottom <= window.innerHeight
        && r.left >= 0 && r.right <= window.innerWidth;
    }), { timeout: 6000, message: "the total never settled inside the viewport" }).toBe(true);

    /* the old bug: overflow:hidden on a 76px-tall stage cut the readout in half */
    const clips = await page.evaluate(() =>
      getComputedStyle(document.getElementById("stage")).overflow === "hidden");
    expect(clips, "the stage is clipping its own scoring popup").toBe(false);
    await settle(page);
  });

  test("the green wash only fires on a hand that actually cleared", async ({ page }) => {
    await open(page);
    /* A target far out of reach: one hand must not wash the board green.
       The old test was roundScore + total >= target with roundScore already
       carrying total, so it fired a full hand early. */
    await page.evaluate(() => { G.target = 9999999; renderDemand(); });
    for (const k of ["1", "2", "3"]) await page.keyboard.press(k);
    await page.click("#playBtn");
    await settle(page);
    await expect(page.locator("#stage")).not.toHaveClass(/clear/);
  });
});
