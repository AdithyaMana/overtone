/* End-to-end tests: a real browser, real clicks, visible outcomes.
 *
 *   npm run test:e2e
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
      /* Pin the STEEP curve, and the migration flag with it so the one-time
         storage migration does not run underneath these tests. Most of this
         file asserts the game as balanced. */
      localStorage.setItem("overtone:curvesMigrated", "true");
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
async function reloadKeeping(page, key, value) {
  /* First that the page really wrote what the test thinks it wrote. */
  await expect.poll(async () =>
    page.evaluate(k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, key),
    { timeout: 3000 }).toContain(value);
  await page.reload();
}

/* Open the game and clear the first-run help card. */
/* Open the game past whatever first-run guidance is showing. The spotlight
   tutorial replaced the auto-opening help modal, so handle either. */
async function open(page) {
  await page.goto(GAME);
  await enterGame(page);
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

/* The scoring readout is a transient. play() builds .stage-total near the end
   of the resolve and removes it Math.round(820 * animScale()) — 451ms — later,
   and waiting for it from the test process is a race the suite loses: three
   runs in twelve under six workers, with the element present, laid out and
   visible for that entire window.

   Measured rather than guessed. In a failing run the hand was fine — all three
   keys registered, play() ran with all three card ids — and a MutationObserver
   inside the page saw .stage-total inserted and removed on time, display:block,
   visibility:visible, a 207x172 box the whole way. page.waitForFunction and
   locator.count() both saw it. Only locator.waitFor missed it, and the same
   call then resolved on the NEXT hand's readout a second and a half later. So
   the element is not the problem and neither is the timeout: an out-of-process
   poll just does not reliably sample inside 451ms.

   Record it from inside the page instead. The observer fires on the insertion
   itself, so nothing can be missed, and the whole life of the readout is
   measured rather than whichever frame a round trip happens to land on. Call
   this before the hand is played; read window.__total once it has settled. */
async function recordTotal(page) {
  await page.evaluate(() => {
    window.__total = { texts: [], rects: [] };
    const stage = document.getElementById("stage");
    new MutationObserver(() => {
      const t = stage.querySelector(".stage-total");
      if (!t || t.dataset.watched) return;
      t.dataset.watched = "1";
      (function sample() {
        if (!t.isConnected) return;
        const r = t.getBoundingClientRect();
        window.__total.texts.push(t.textContent);
        window.__total.rects.push({
          w: r.width, h: r.height, top: r.top, bottom: r.bottom,
          left: r.left, right: r.right,
          vw: window.innerWidth, vh: window.innerHeight
        });
        requestAnimationFrame(sample);
      })();
    }).observe(stage, { childList: true, subtree: true });
  });
}

/* The stage grows only while #app is .resolving, which is on for about a
   second and a half — so measuring the growth with boundingBox() round trips
   is the same race recordTotal describes, with a wider window. Sample it in
   the page instead: start this after the words are picked and before Play,
   then read window.__stage once the hand has settled. */
async function recordStageGrowth(page) {
  await page.evaluate(() => {
    const app = document.getElementById("app");
    const stage = document.getElementById("stage");
    window.__stage = {
      base: stage.getBoundingClientRect().height, max: 0, sawResolving: false
    };
    (function sample() {
      const resolving = app.classList.contains("resolving");
      if (resolving) {
        window.__stage.sawResolving = true;
        const h = stage.getBoundingClientRect().height;
        if (h > window.__stage.max) window.__stage.max = h;
      } else if (window.__stage.sawResolving) {
        return;                       /* the hand is done; stop sampling */
      }
      requestAnimationFrame(sample);
    })();
  });
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
    await enterGame(page);
    await expect(page).toHaveTitle("Overtone");
    await expect(page.locator("#tut")).toBeVisible();
    await expect(page.locator("#veil"), "a rules modal opened itself").toBeHidden();
  });

  test("keeps the full rules one click away", async ({ page }) => {
    await open(page);
    await page.click("#helpBtn");
    const panel = page.locator("#panel");
    await expect(panel).toContainText("How to play");
    await expect(panel).toContainText("points × multiplier");
    /* how long a line is, which is the first thing a player needs and which
       the card answered with "Take three words" for a release after a line
       stopped being three of anything */
    await expect(panel).toContainText("two to five words");
    /* the worked example and the overtone legend both carry the rules */
    await expect(panel.locator(".worked")).toBeVisible();
    await expect(panel.locator(".legend .leg")).toHaveCount(19);

    /* The keep rule was stated wrong for a release: a kept line is free and
       kept lines have a shelf of their own, and the card said you BOUGHT one
       out of the five slots the Lenses use. Read off the constants, because
       the wrong version was wrong for a reason nobody would notice reading it
       - it was true before KEEP_SLOTS existed. */
    const keep = await page.evaluate(() => ({
      chips: KEPT_CHIPS, mult: KEPT_MULT, keeps: KEEP_SLOTS, lenses: LENS_SLOTS
    }));
    await expect(panel, "the card does not say what a kept line pays")
      .toContainText("+" + keep.chips + " points");
    await expect(panel).toContainText("+" + keep.mult + " multiplier");
    await expect(panel, "the card gets the two shelves wrong")
      .toContainText(keep.keeps + " kept lines and " + keep.lenses + " Lenses");
    await expect(panel, "the card sells a line the Bookseller gives away")
      .not.toContainText("buy it and it pays");

    /* Rule 5 used to carry two unrelated rules: a tag going quiet on the table
       and the Bookseller handing a line back in the shop. They are numbered
       separately now, and the count in the subhead has to agree with how many
       there actually are or the card is lying in its own first line. */
    const rules = panel.locator(".teach-row");
    await expect(rules).toHaveCount(6);
    await expect(panel.locator(".sub").first()).toHaveText("Six rules");
    await expect(rules.nth(4), "the resting rule is not on its own")
      .toContainText("rests");
    await expect(rules.nth(4), "the keep rule leaked back into the resting one")
      .not.toContainText("Bookseller");
    await expect(rules.nth(5)).toContainText("Bookseller");
  });

  test("deals a full hand once the help card is dismissed", async ({ page }) => {
    await open(page);
    await expect(page.locator("#hand .card")).toHaveCount(7);
    await expect(page.locator("#demandName")).not.toBeEmpty();
    await expect(page.locator("#roundScore")).toHaveText("0");
    /* Read off the game, not typed in: the round's budget has been 4, then 2,
       then 3, and a hardcoded number here only ever fails a release late. */
    const budget = await page.evaluate(() => [PLAYS_PER_ROUND, DISCARDS_PER_ROUND]);
    await expect(page.locator("#playsLeft")).toHaveText(String(budget[0]));
    await expect(page.locator("#discardsLeft")).toHaveText(String(budget[1]));
  });

  test("states the round's rule in the middle of the screen", async ({ page }) => {
    await open(page);
    const call = page.locator(".demand-call");
    await expect(call).toBeVisible();
    const paid = await page.evaluate(() => DEMAND_CHIPS);
    await expect(call).toContainText("+" + paid + " points");
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
    /* For a while this asserted the opposite: blank counters, on the spec
       line that says the board never shows the score of an uncommitted line.
       Accurate, and it reads as a game that has stopped adding up - which is
       the first thing a player said about it. The beads carry the lesson
       about what the words are doing; the counters say what it is worth. */
    await open(page);
    await expect(page.locator("#chipsV")).toHaveText("0");

    await page.locator("#hand .card").first().click();

    await expect(page.locator("#hand .card.sel")).toHaveCount(1);
    await expect(page.locator("#hand .card.sel .pos")).toHaveText("1");
    await expect(page.locator("#stageCards .card")).toHaveCount(1);
    await expect(page.locator("#chipsV"), "the board did not price the selection").not.toHaveText("0");
    /* One word is not a line. LINE_MIN used to live only in the tutorial's
       copy while play() took a single card, so ASCETIC's "play exactly 1
       word" was selling a play everybody already had. */
    await expect(page.locator("#playBtn"), "a one-word line was playable").toBeDisabled();
    await page.locator("#hand .card").nth(1).click();
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

  test("says what a lone word is, and asks for another", async ({ page }) => {
    await open(page);
    await page.locator("#hand .card.live").first().click();
    /* One word is not a line. There is nothing beside it yet, so there is
       nothing for the board to read - and it says so rather than printing a
       score, because it no longer prints scores at all. */
    await expect(page.locator(".hand-name")).toContainText("MATCH");
    await expect(page.locator("#stageHint")).toContainText("Lay another beside it");
    await expect(page.locator("#stageHint")).not.toContainText("worth");
  });

  test("does not blame the Lenses for an order no Lens is reading", async ({ page }) => {
    await open(page);
    /* Order matters from the first hand now, because a figure reads the words
       left to right. What must never appear is the LENS explanation for it
       when the player owns no Lens that reads position. */
    await page.evaluate(() => { G.lenses = []; G.selected = []; render(); });
    await expect(page.locator("#stageHint")).not.toContainText("Your Lenses read left to right");
    await expect(page.locator(".stage-hint .ord")).toHaveCount(0);
  });

  test("stops arguing with the Lens it just sold you about how long a line is",
    async ({ page }) => {
      await open(page);
      /* ASCETIC pays x5 for a single word. The board was still printing "Three
         words beat one" underneath it — the game arguing with the build the
         game just sold you. The general advice is different now, because a
         long line under JOIN finds more hands AND has further to fall, but the
         rule is the same: a Lens that reshapes the hand gets the last word. */
      const bare = await page.evaluate(() => {
        G.lenses = []; G.selected = []; render();
        return document.getElementById("stageHint").textContent;
      });
      expect(bare).toContain("A longer line pays more and risks more");

      const ascetic = await page.evaluate(() => {
        G.lenses = [LENSES.find(l => l.id === "asc")];
        G.selected = []; render();
        return document.getElementById("stageHint").textContent;
      });
      expect(ascetic).not.toContain("A longer line");
      expect(ascetic).toContain("ASCETIC");
    });

  test("says which overtones are resting, and stops gilding the ones that are",
    async ({ page }) => {
      /* An overtone that has just scored pays nothing for ALIKE and nothing
         for the round until it recovers - demandHits() has always excluded it
         - and the card drew it exactly like one that pays, in gold when the
         round wanted it. A rule the help panel stated and the board hid. */
      await open(page);
      const seen = await page.evaluate(() => {
        const want = G.demand.tags[0];
        const mk = (w, t) => makeCard({ w, t }, false);
        G.hand = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN"]
          .map(w => mk(w, [want, "NAT"]));
        /* exactly what a play that scored it leaves behind */
        G.dull = {}; G.dull[want] = FATIGUE_SPAN;
        G.selected = []; render();
        const tg = [...document.querySelectorAll("#hand .card .tg")];
        return {
          want: TAGS[want][0],
          live: TAGS.NAT[0],
          dull: tg.filter(e => e.classList.contains("dull")).map(e => e.textContent),
          gold: tg.filter(e => e.classList.contains("match")).map(e => e.textContent),
          told: tg.filter(e => e.classList.contains("dull")).every(e => /resting/.test(e.title))
        };
      });
      expect(seen.dull, "a resting overtone is drawn like one that pays")
        .toContain(seen.want);
      expect(seen.dull, "an overtone that is awake was drawn as resting")
        .not.toContain(seen.live);
      expect(seen.gold, "the board gilded an overtone it has decided not to pay for")
        .not.toContain(seen.want);
      expect(seen.told, "a resting overtone does not say when it wakes").toBe(true);
    });

  test("says the order matters once a Lens actually reads position", async ({ page }) => {
    await open(page);
    /* On the idle board, which is where the hint lives: lay a word and the
       readout takes the space over to say what the line is doing. The `.ord`
       span is a different thing now - it is the nudge that names a better
       hand the same words would make in another order. */
    const said = await page.evaluate(() => {
      G.lenses = [LENSES.find(l => l.id === "carn")];   // eats the word to its LEFT
      G.selected = []; render();
      return document.getElementById("stageHint").textContent;
    });
    expect(said).toContain("left to right");
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

  test("refuses a sixth word and says why", async ({ page }) => {
    /* A line is two to five words now. The cap moved with the verb, and the
       message that names it is generated from MAX_PLAY rather than spelled
       out, so it cannot drift again. */
    await open(page);
    for (const key of ["1", "2", "3", "4", "5", "6"]) await page.keyboard.press(key);
    await expect(page.locator("#hand .card.sel")).toHaveCount(5);
    await expect(page.locator("#toast")).toContainText("five words at most");
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

    const left = await page.evaluate(() => PLAYS_PER_ROUND - 1);
    await expect(page.locator("#playsLeft")).toHaveText(String(left));
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
    await expect(page.locator("#playsLeft"), "discarding cost a play")
      .toHaveText(String(await page.evaluate(() => PLAYS_PER_ROUND)));
    await expect(page.locator("#hand .card")).toHaveCount(7);
    const after = await page.evaluate(() => G.hand.map(c => c.w).join(","));
    expect(after).not.toBe(before);
  });
});

/* ------------------------------------------------------------------ */
test.describe("the figure on the board", () => {
  /* Deal a known hand: the shape of three words is the whole subject here, so
     it cannot be left to the shuffle. */
  /* Their REAL overtones, out of the lexicon. This used to stamp every card
     with the round's Demand tags, which was right when a figure read spelling
     and became wrong the moment it read meaning: two words given identical
     tags always ring and can never pull, so every join test would have been
     measuring the fixture rather than the game. */
  async function deal(page, words){
    await page.evaluate((ws) => {
      G.hand = ws.map(w => {
        const e = LEXICON.find(x => x.w === w);
        if (!e) throw new Error(w + " is not in the lexicon");
        return makeCard(e, false);
      });
      G.selected = [];
      render();
    }, words);
  }
  const pick = async (page, keys) => { for(const k of keys) await page.keyboard.press(k); };

  test("names what two words are doing to each other", async ({ page }) => {
    await open(page);
    await deal(page, ["WOLF", "BEAR"]);            // share two overtones
    await pick(page, ["1", "2"]);
    await expect(page.locator("#stageHint .jn.resonance")).toHaveCount(1);
  });

  test("tells a pull from a ring, because they pay differently", async ({ page }) => {
    await open(page);
    await deal(page, ["SHARK", "PEPPER"]);         // opposed, nothing shared
    await pick(page, ["1", "2"]);
    await expect(page.locator("#stageHint .jn.tension")).toHaveCount(1);
    await expect(page.locator("#stageHint .jn.resonance")).toHaveCount(0);
  });

  test("names the rare one when both happen at once", async ({ page }) => {
    await open(page);
    await deal(page, ["EMBER", "GLACIER"]);        // NATURE shared, heat/cold and wet/heat opposed
    await pick(page, ["1", "2"]);
    await expect(page.locator("#stageHint .jn.paradox")).toHaveCount(1);
    /* Read off the table rather than typed in: this hand has been THE PARADOX
       and is THE TWIST, and the id is the part that has not moved. */
    const named = await page.evaluate(() => FIGURES.find(f => f.id === "paradox").n);
    await expect(page.locator(".hand-name")).toHaveText(named);
  });

  test("says where a line falls silent rather than going quiet", async ({ page }) => {
    await open(page);
    await deal(page, ["WOLF", "OAK"]);             // nothing in common at all
    await pick(page, ["1", "2"]);
    await expect(page.locator("#stageHint .jn.silence")).toHaveCount(1);
    await expect(page.locator(".hand-name")).toHaveText("NOTHING YET");
  });

  test("prices the line, and still says what it can see", async ({ page }) => {
    /* For a while the board refused to price an uncommitted line, on the
       reasoning that a board which does the arithmetic takes the decision
       away. The constraint is withdrawn: two counters reading 0 and 1 under a
       hand you just built are indistinguishable from a game that has stopped
       adding up, which is what the first player to see it said. What the
       counters cannot tell you is whether some OTHER five words pay more, and
       the readout is still the thing that helps with that - it names what
       each pair is doing rather than handing over a total. */
    await open(page);
    await deal(page, ["EMBER", "GLACIER"]);
    await pick(page, ["1", "2"]);

    const truth = await page.evaluate(() => {
      const r = resolve(G.selected.map(id => G.hand.find(c => c.id === id)));
      return { chips: String(r.chips), mult: String(Math.round(r.mult * 10) / 10) };
    });
    await expect(page.locator("#chipsV"), "the board did not price the line")
      .toHaveText(truth.chips);
    await expect(page.locator("#multV")).toHaveText(truth.mult);

    /* and the readout is still about the relation, not the arithmetic.
       Which relation is the fixture's business, not this test's - EMBER and
       GLACIER are alike AND opposite, which is BOTH, not OPPOSITE. */
    const beads = await page.locator("#stageHint .jn").allTextContents();
    expect(beads.length, "the readout named no relation at all").toBeGreaterThan(0);
    beads.forEach(b => expect(b).toMatch(/ALIKE|OPPOSITE|BOTH|NOTHING/));
  });

  test("the order is the decision, and the board says so without fixing it",
    async ({ page }) => {
      await open(page);
      /* WOLF has nothing to say to OAK. THORN reaches both - DANGER with the
         wolf, PLANT with the oak - so one order reads all the way through and
         the other stops dead after two words. */
      await deal(page, ["WOLF", "OAK", "THORN"]);
      await pick(page, ["1", "2", "3"]);
      await expect(page.locator("#stageHint .stops")).toHaveCount(1);

      await page.evaluate(() => { G.selected = []; render(); });
      await pick(page, ["1", "3", "2"]);
      await expect(page.locator("#stageHint .stops")).toHaveCount(0);
    });

  test("a pull actually moves the multiplier", async ({ page }) => {
    await open(page);
    await deal(page, ["EMBER", "GLACIER"]);
    await pick(page, ["1", "2"]);
    const res = await page.evaluate(() => {
      const line = G.selected.map(id => G.hand.find(c => c.id === id));
      /* The Demand pays a multiplier per matching word, and the seed decides
         whether these two match it - which has nothing to do with the pull. */
      G.demand = { n: "TEST", tags: [] };
      G.lenses = [];
      const j = joinOf(line[0], line[1], {});
      return { t: j.t, per: JOIN_TENSION, mult: resolve(line).mult,
               figs: figuresIn(line).reduce((s, f) => s + f.mult, 0) };
    });
    expect(res.t).toBeGreaterThan(0);
    /* one per opposed pair, plus whatever the hands they make are worth */
    expect(res.mult).toBe(1 + res.t * res.per + res.figs);
  });

  test("the figure name opens the table of all five", async ({ page }) => {
    await open(page);
    await deal(page, ["EMBER", "GLACIER"]);
    await pick(page, ["1", "2"]);
    await page.click(".hand-name");
    await expect(page.locator("#veil")).toBeVisible();
    await expect(page.locator(".figtab tbody tr")).toHaveCount(5);
    /* Read the names off the game rather than restating them here — they have
       been renamed once already, into words a player can keep. */
    const names = await page.evaluate(() => FIGURES.map(f => f.n));
    expect(names).toHaveLength(5);
    for (const n of names) await expect(page.locator(".figtab")).toContainText(n);
  });
  test("the idle board points at the figures before anything is picked", async ({ page }) => {
    await open(page);
    await page.evaluate(() => { G.selected = []; render(); });
    await page.click(".dc-text .figlink");
    await expect(page.locator(".figtab")).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/* COLUMN, STAIR and PAIR - three figures defined on how long a word is - went
   when the verb became JOIN, and with them the reason to print a letter count
   on every card. spec-the-verb-is-join: "Nothing in scoring may read spelling.
   Word length, first letter and last letter stop being mechanical inputs
   entirely, including in Lenses." */
test.describe("spelling is not a mechanic", () => {
  test("no card shows a letter count", async ({ page }) => {
    await open(page);
    await expect(page.locator("#hand .card .len"),
      "the length badge outlived the figures that used it").toHaveCount(0);
  });

  test("two words of different lengths and the same overtones are worth the same",
    async ({ page }) => {
      await open(page);
      const [short, long] = await page.evaluate(() => {
        const t = ["NAT", "HEA", "DAR"];
        return [makeCard({ w: "ASH", t }, false).base,
                makeCard({ w: "CONFLAGRATION", t }, false).base];
      });
      expect(short, "a card's base value still reads its spelling").toBe(long);
    });

  test("and nothing in the scoring path reads a word's length", async ({ page }) => {
    await open(page);
    const readers = await page.evaluate(() =>
      LENSES.filter(l => ["onCard", "onPlay", "onRound", "onReward"]
        .some(h => l[h] && /\.w\.length/.test(String(l[h]))))
        .map(l => l.n));
    expect(readers, "these Lenses still score on spelling").toEqual([]);
  });
});

test.describe("the Bookseller", () => {
  /* Play a real hand, then clear what is left of the target and let the game
     open the shop itself. Three blind hands used to get there; against the
     current curve they do not, and these tests are about the shop rather than
     about whether three arbitrary cards can beat round 1. */
  async function toTheShop(page) {
    await playAHand(page);
    await page.evaluate(() => { G.roundScore = G.target; winRound(); });
    await expect(page.locator("#veil")).toBeVisible();
  }

  test("opens on clearing a round and teaches the economy", async ({ page }) => {
    await open(page);
    await toTheShop(page);

    const panel = page.locator("#panel");
    await expect(panel).toContainText("The Bookseller");
    /* the exponential has to be stated in numbers, not implied */
    await expect(panel.locator(".stakes")).toContainText("Lenses multiply");
    /* Two Lenses and the extra words. A line the round kept is a fourth
       .offer and does not belong to the shelf, so it is excluded by name. */
    await expect(panel.locator(".offer:not(.keep)")).toHaveCount(3);
    await expect(panel.locator("#leaveShop")).toContainText("Leave with no Lens");
  });

  test("buying a Lens equips it and it survives into the next round", async ({ page }) => {
    await open(page);
    await toTheShop(page);
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

  /* A kept line is the only rule in the run the player wrote, and it pays on
     every hand that matches it. It used to be written down in the shop and
     then never shown again until the next shop - a rule you are playing under
     with no way to read it back. */
  test("a kept line stays readable on the board all round", async ({ page }) => {
    await open(page);

    /* Nothing on the shelf when nothing has been kept: the strip is for the
       players who have one, and it costs the stage its height. */
    await expect(page.locator("#keptBar")).toBeHidden();

    await toTheShop(page);
    const line = await page.evaluate(() => {
      const box = document.getElementById("keeps");
      if (!box || !box.children.length) return null;
      box.children[0].click();
      return G.kept[0] ? { n: G.kept[0].n, fig: G.kept[0].figName } : null;
    });
    test.skip(line === null, "this hand made no figure to keep");

    await page.click("#leaveShop");
    await expect(page.locator("#veil")).toBeHidden();

    const chip = page.locator("#keptRail .keptline");
    await expect(page.locator("#keptBar")).toBeVisible();
    await expect(chip).toHaveCount(1);
    await expect(chip.locator(".n")).toHaveText(line.n);

    /* Closed it is the words. Open it says what it pays, and what it pays on
       is the hand rather than those words - the part a player gets wrong. */
    await expect(chip).toHaveAttribute("aria-expanded", "false");
    await chip.click();
    await expect(chip).toHaveAttribute("aria-expanded", "true");
    const pays = await page.evaluate(() => ({ c: KEPT_CHIPS, m: KEPT_MULT }));
    await expect(chip).toContainText(line.fig);
    await expect(chip).toContainText("+" + pays.c + " and +" + pays.m + " mult");

    await chip.click();
    await expect(chip).toHaveAttribute("aria-expanded", "false");
  });

  /* The shelves are separate in the rules and have separate counts, so they
     have to be separate on the board too. Keeps in the Lens rail would say
     they compete for the same five slots. */
  test("keeps its own shelf rather than crowding the Lenses", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      G.kept = [{ n: "ONE \u00b7 TWO", fig: "antithesis", figName: "THE CLASH" }];
      render();
    });
    await expect(page.locator("#rail .keptline")).toHaveCount(0);
    await expect(page.locator("#keptRail .keptline")).toHaveCount(1);
    await expect(page.locator("#lensCount"), "a kept line was counted as a Lens")
      .toHaveText("0/5");
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

    /* No window.claude over file://, so the house answers — and for a word it
       has nothing on it says exactly that rather than inventing a reading. */
    const appraisal = page.locator("#appraisal");
    await expect(page.locator(".pickgrid")).toBeVisible();
    await expect(page.locator("#interpInput")).toHaveValue("mitochondria");
    await expect(appraisal.locator(".src")).toContainText("House appraisal");

    /* the player says what it rings of */
    await page.click('.pickopt[data-tag="TEC"]');
    await page.click('.pickopt[data-tag="MIN"]');
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

  test("the picked words go up to the board at portrait width, small",
    async ({ page }, info) => {
      test.skip(info.project.name !== "phone", "portrait layout");
      /* Drawn at full size they were 240px of a 667px screen spent repeating
         the hand; not drawn at all, tapping a card sent it nowhere and the
         board looked broken. They go up small, into room the stage already
         had. */
      await open(page);
      for (const key of ["1", "2"]) await page.keyboard.press(key);

      const preview = page.locator("#stageCards .card");
      await expect(preview).toHaveCount(2);
      await expect(preview.first()).toBeVisible();
      await expect(page.locator("#hand .card .pos")).toHaveCount(2);
      /* The readout names what the pair is doing; the price is on the two
         counters above it. It used to say "worth", and that word moved. */
      await expect(page.locator("#stageHint")).toContainText(/ALIKE|OPPOSITE|BOTH|NOTHING/);

      const size = await page.evaluate(() => {
        const up = document.querySelector("#stageCards .card");
        const inHand = document.querySelector("#hand .card");
        const ctl = document.querySelector(".controls").getBoundingClientRect();
        const lowest = Math.max(...[...document.querySelectorAll("#hand .card")]
          .map(c => c.getBoundingClientRect().bottom));
        return {
          up: up.offsetHeight, hand: inHand.offsetHeight,
          tagsDrawn: [...up.querySelectorAll(".tg")]
            .some(t => t.getBoundingClientRect().height > 0),
          handClear: Math.round(ctl.top - lowest)
        };
      });
      expect(size.up, "the preview is as big as the hand again")
        .toBeLessThan(size.hand * 0.6);
      expect(size.tagsDrawn, "the preview is repeating the tags too").toBe(false);
      expect(size.handClear, "the preview pushed the hand under the controls")
        .toBeGreaterThanOrEqual(0);
    });

  test("the spotlight follows the board when the board moves", async ({ page }) => {
    /* The hole was aimed once, when the step was drawn, and the board does not
       hold still — a hand resolving folds the hand away and grows the stage.
       On the last step the spotlight ended up 56px clear of the Lens bar it
       was pointing at. It is the portrait run that catches this — at desktop
       width the Lens bar barely moves — but the check is cheap on both. */
    await page.goto(GAME);
    await enterGame(page);
    await expect(page.locator("#tut")).toBeVisible();

    const drift = () => page.evaluate(() => {
      const s = TUT[tutStep];
      if (!s || !s.sel) return null;
      const hole = document.getElementById("tutHole").getBoundingClientRect();
      const target = document.querySelector(s.sel).getBoundingClientRect();
      return { step: tutStep, sel: s.sel, off: Math.round((hole.top + 8) - target.top) };
    });

    /* walk to the step that waits on a pick, then play the hand out */
    await page.click("#tutNext");
    await page.click("#tutNext");
    await page.evaluate(() => {
      const live = G.hand.filter(c => c.t.some(t => G.demand.tags.includes(t)));
      const rest = G.hand.filter(c => live.indexOf(c) < 0);
      [...live, ...rest].slice(0, 3).forEach(c => toggleSel(c.id));
    });
    await expect.poll(() => page.evaluate(() => tutStep)).toBeGreaterThanOrEqual(4);
    await expect.poll(async () => Math.abs((await drift()).off),
      { timeout: 3000, message: "the spotlight drifted while picking" })
      .toBeLessThanOrEqual(4);

    await page.evaluate(() => { while (tutStep < 5) tutAdvance(); play(); });
    await settle(page);
    /* the aim is corrected on a tick, so give it one */
    await expect.poll(async () => Math.abs((await drift()).off),
      { timeout: 4000, message: "the spotlight never caught up with the board" })
      .toBeLessThanOrEqual(4);
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
        /* The word's own text, not the band it sits in: the value lives in
           that band too, floated to the end of the word's line. */
        const w = card.querySelector(".wt").getBoundingClientRect();
        const plate = card.querySelector(".art").getBoundingClientRect();
        const hits = (a, b) => !(b.right <= a.left + 0.5 || b.left >= a.right - 0.5 ||
                                 b.bottom <= a.top + 0.5 || b.top >= a.bottom - 0.5);
        const word = card.querySelector(".wt").textContent;
        if (hits(icons, base)) return word + ": value on the icons";
        if (hits(w, base)) return word + ": value on the word";
        if (hits(plate, base)) return word + ": value on the plate";
        if (base.bottom > card.getBoundingClientRect().bottom + 0.5)
          return word + ": value hanging off the card";
        return null;
      }).filter(Boolean));
    expect(clashes).toEqual([]);
  });

  test("every word in the lexicon makes the same shaped card", async ({ page }) => {
    await open(page);
    /* The bug a player reported as "the cards are misaligned and bad": the
       card was a fixed height with a flex column inside it, so .art's 56px was
       a starting size rather than a rule. A word carrying five overtones
       overflowed, and flexbox took the difference out of the plate — one card
       in a hand with a 40px plate beside a neighbour with 56px, its word and
       its tags each starting on a different line.

       Every word, not the seven in this hand: the three worst cases in the
       lexicon are three cards in 249, and a dealt hand almost never holds one. */
    const shapes = await page.evaluate(() => {
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;left:-9999px;top:0;display:flex;flex-wrap:wrap;width:4000px";
      document.body.appendChild(host);
      const cards = LEXICON.map((row, i) => {
        const el = cardEl({ id: "lex" + i, w: row.w, t: row.t, base: 20 }, true);
        host.appendChild(el);
        return el;
      });
      const uniq = f => [...new Set(cards.map(f))];
      const clipped = cards.filter(el => {
        const tags = el.querySelector(".tags").getBoundingClientRect();
        return [...el.querySelectorAll(".tg")].some(t => {
          const r = t.getBoundingClientRect();
          return r.bottom > tags.bottom + 1 && r.top < tags.bottom - 1;
        });
      }).map(el => el.querySelector(".wt").textContent);
      /* And the plate has to stay inside the card it belongs to. A grid item
         will not shrink below its min-content width, so the moment the plate's
         icons and value were wider than the card, the plate painted straight
         out over the card's edges instead of clipping. */
      const escaped = cards.filter(el => {
        const c = el.getBoundingClientRect();
        const pad = parseFloat(getComputedStyle(el).paddingLeft);
        const a = el.querySelector(".art").getBoundingClientRect();
        return a.left < c.left + pad - 0.5 || a.right > c.right - pad + 0.5
            || a.top < c.top + pad - 0.5;
      }).map(el => el.querySelector(".wt").textContent);
      const spilled = cards.filter(el => {
        const icons = el.querySelector(".icons");
        return icons.scrollWidth - icons.clientWidth > 1;
      }).map(el => el.querySelector(".wt").textContent);

      /* The value belongs in the card's bottom corner: below the plate, clear
         of everything that is actually drawn, and inside the card. */
      const onThePlate = cards.filter(el => {
        const plate = el.querySelector(".art").getBoundingClientRect();
        const v = el.querySelector(".base").getBoundingClientRect();
        return v.top < plate.bottom - 0.5;
      }).map(el => el.querySelector(".wt").textContent);
      const overlapping = cards.filter(el => {
        const v = el.querySelector(".base").getBoundingClientRect();
        const hits = e => { const a = e.getBoundingClientRect();
          return !(v.right <= a.left + 0.5 || v.left >= a.right - 0.5 ||
                   v.bottom <= a.top + 0.5 || v.top >= a.bottom - 0.5); };
        /* Tags below the band's edge are clipped out of sight; their rects
           still sit where they would have been, which is under the value. */
        const band = el.querySelector(".tags").getBoundingClientRect();
        const drawn = [...el.querySelectorAll(".tg")]
          .filter(t => t.getBoundingClientRect().bottom <= band.bottom + 1);
        return hits(el.querySelector(".icons")) ||
               hits(el.querySelector(".wt")) || drawn.some(hits);
      }).map(el => el.querySelector(".wt").textContent);
      const valueCut = cards.filter(el => {
        const card = el.getBoundingClientRect();
        const v = el.querySelector(".base").getBoundingClientRect();
        return v.bottom > card.bottom + 0.5 || v.right > card.right + 0.5;
      }).map(el => el.querySelector(".wt").textContent);

      const out = {
        n: cards.length,
        cardHeights: uniq(el => el.offsetHeight),
        plateHeights: uniq(el => el.querySelector(".art").offsetHeight),
        wordTops: uniq(el => el.querySelector(".w").offsetTop),
        tagTops: uniq(el => el.querySelector(".tags").offsetTop),
        halfCutTags: clipped,
        plateOutsideCard: escaped,
        iconsTooWideForPlate: spilled,
        valueOnThePlate: onThePlate,
        valueOverlapping: overlapping,
        valueCutOff: valueCut
      };
      host.remove();
      return out;
    });

    expect(shapes.n).toBeGreaterThan(200);
    expect(shapes.cardHeights, "cards came out different heights").toHaveLength(1);
    expect(shapes.plateHeights, "the icon plate was squashed on some words").toHaveLength(1);
    expect(shapes.wordTops, "the word starts on a different line card to card").toHaveLength(1);
    expect(shapes.tagTops, "the tags start on a different line card to card").toHaveLength(1);
    expect(shapes.halfCutTags, "a tag row was cut in half").toEqual([]);
    expect(shapes.plateOutsideCard, "the icon plate painted outside the card").toEqual([]);
    expect(shapes.iconsTooWideForPlate, "the icons do not fit the plate").toEqual([]);
    expect(shapes.valueOnThePlate, "the value is sitting on the icon plate").toEqual([]);
    expect(shapes.valueOverlapping, "the value is sitting on the icons or a tag").toEqual([]);
    expect(shapes.valueCutOff, "the value hangs off the card").toEqual([]);
  });

  test("picking a word does not move the board under you", async ({ page }) => {
    /* 1366x768 is the most common screen there is; maximised it gives about
       640px of viewport. The whole board came to 915px there, PLAY sat 270px
       below the fold, and picking your first word grew the stage by another 73
       and pushed the hand down with it. */
    await page.setViewportSize({ width: 1366, height: 640 });
    await open(page);
    const where = async () => page.evaluate(() => {
      const b = document.querySelector(".controls .btn").getBoundingClientRect();
      const hand = document.querySelector(".hand").getBoundingClientRect();
      return { play: Math.round(b.bottom), hand: Math.round(hand.top), vh: innerHeight };
    });
    const idle = await where();
    expect(idle.play, "PLAY starts below the fold").toBeLessThanOrEqual(idle.vh);

    await page.keyboard.press("1");
    await expect(page.locator("#stageCards .card")).toHaveCount(1);
    const one = await where();
    expect(Math.abs(one.play - idle.play), "PLAY moved when a word was picked").toBeLessThanOrEqual(4);
    expect(Math.abs(one.hand - idle.hand), "the hand moved when a word was picked").toBeLessThanOrEqual(4);

    await page.keyboard.press("2");
    await page.keyboard.press("3");
    const three = await where();
    expect(Math.abs(three.play - idle.play), "PLAY moved as more words were picked").toBeLessThanOrEqual(4);
    expect(three.play, "PLAY ended below the fold").toBeLessThanOrEqual(three.vh);
  });

  test("card words are not broken mid-word", async ({ page }) => {
    await open(page);
    await measurableStageCards(page);
    for (const key of ["1", "2", "3"]) await page.keyboard.press(key);
    await expect(page.locator("#stageCards .card")).toHaveCount(3);
    /* A word that wraps is fine; a word that wraps because something else is
       taking its width is not — SOLSTICE once rendered as "SOLSTIC / E". */
    /* Count the text's own line boxes, not the element's height: the word sits
       in a box two lines tall on every card whether it needs the second line
       or not, which is what keeps the tags below it on one line across a hand.
       Dividing that box by the line height says "2" for every word alive. */
    const cramped = await page.locator("#stageCards .card .w").evaluateAll(ws =>
      ws.map(w => {
        /* The word's own element, not the band: the band also carries the
           floated value, whose rect would count as a line of its own. */
        const text = w.querySelector(".wt");
        if (!text) return null;
        const r = document.createRange();
        r.selectNodeContents(text);
        const lines = r.getClientRects().length;
        const chars = text.textContent.trim().length;
        return (lines > 1 && chars <= 9) ? text.textContent + " wrapped onto " + lines + " lines" : null;
      }).filter(Boolean));
    expect(cramped).toEqual([]);
  });

  test("help can be reopened at any time", async ({ page }) => {
    await open(page);
    await page.click("#helpBtn");
    await expect(page.locator("#panel")).toContainText("How to play");
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
      /* Keyed on score now rather than on multiplier, so this has to be a
         total the hand below cannot beat, or the run's best play is simply
         the last one it played and the share text says so. */
      G.best = { word: "AVALANCHE", mult: 12, score: 9999999 };
      render();
    });
    await playAHand(page);

    const panel = page.locator("#panel");
    await expect(panel).toContainText("The run ends at");
    await expect(panel.locator(".share")).toContainText("OVERTONE");
    await expect(panel.locator(".share")).toContainText("AVALANCHE");
    /* a Lens was owned, so something carries into the next run */
    await expect(panel.locator(".unlock:not(.open)")).toBeVisible();
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
  /* Every assertion below counts steps. Stating the length once means adding a
     step breaks one test with a clear message instead of ten with cryptic ones.
     The step ORDER still has to be checked by hand when that happens. */
  const STEPS = 8;
  const at = n => n + " of " + STEPS;

  test("is as long as it says it is", async ({ page }) => {
    await page.goto(GAME);
    await enterGame(page);
    expect(await page.evaluate(() => TUT.length)).toBe(STEPS);
  });

  test("greets a first-time player instead of a rules modal", async ({ page }) => {
    await page.goto(GAME);
    await enterGame(page);
    await expect(page.locator("#tut")).toBeVisible();
    await expect(page.locator("#tutStep")).toContainText("Overtone");
    await expect(page.locator("#tutText")).toContainText("overtones");
    await expect(page.locator("#tutStep")).toContainText(at(1));
    await expect(page.locator("#tutDots i")).toHaveCount(STEPS);
    /* the modal no longer opens itself */
    await expect(page.locator("#veil")).toBeHidden();
  });

  test("spotlights the real board, and lets the player touch it", async ({ page }) => {
    await page.goto(GAME);
    await enterGame(page);
    await page.click("#tutNext");                       // -> what the round wants
    await expect(page.locator("#tutStep")).toContainText(at(2));
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
    await expect(page.locator("#tutStep")).toContainText(at(3));
    await expect(page.locator("#tutNext")).toBeHidden();  // doing it IS the button
    await page.locator("#hand .card").first().click();
    await expect(page.locator("#hand .card.sel")).toHaveCount(1);
    await expect(page.locator("#tutStep")).toContainText(at(4));
  });

  test("teaches what a second word DOES, and makes you lay one", async ({ page }) => {
    await page.goto(GAME);
    await enterGame(page);
    for (let i = 0; i < 2; i++) await page.click("#tutNext");
    await page.locator("#hand .card").nth(0).click();

    /* The lesson stopped being "take three" when the verb became JOIN. The step
       that used to count words now names the three things two words can do. */
    const text = page.locator("#tutText");
    await expect(page.locator("#tutStep")).toContainText(at(4));
    const say = await page.evaluate(() => JOIN_NAME);
    await expect(text).toContainText(say.resonance);
    await expect(text).toContainText(say.tension);
    await expect(text).toContainText(say.silence);
    await expect(page.locator("#tutNext")).toBeHidden();

    /* and it waits for a SECOND word, because one word does nothing */
    await page.locator("#hand .card").nth(1).click();
    await expect(page.locator("#tutStep")).toContainText(at(5));
  });

  test("names the case for playing fewer, so the rule has an exception", async ({ page }) => {
    await page.goto(GAME);
    await enterGame(page);
    for (let i = 0; i < 2; i++) await page.click("#tutNext");
    await page.locator("#hand .card").nth(0).click();
    await page.locator("#hand .card").nth(1).click();
    await page.locator("#hand .card").nth(2).click();
    await page.click("#tutNext");                      // -> the shape of your hand
    await page.click("#tutNext");                      // -> the two buttons
    await page.click("#tutNext");                      // -> why you come back
    await expect(page.locator("#tutStep")).toContainText(at(STEPS));
    /* The last step names the reason to come back: overtones tire, and the
       Bookseller hands you back a line you wrote. It used to name a Lens. */
    const last = page.locator("#tutText");
    await expect(last).toContainText("dull");
    await expect(last).toContainText("Bookseller");
  });

  test("runs end to end on taps alone, then finishes and stays gone", async ({ page }) => {
    await page.goto(GAME);
    await enterGame(page);
    for (let i = 0; i < 2; i++) await page.click("#tutNext");
    await page.locator("#hand .card").nth(0).click();
    await expect(page.locator("#tutStep")).toContainText(at(4));
    await page.locator("#hand .card").nth(1).click();
    await page.locator("#hand .card").nth(2).click();
    await expect(page.locator("#tutStep")).toContainText(at(5));
    /* Step 5 reads the board back rather than naming a figure — it says what
       the words the player actually laid are doing to each other. */
    await expect(page.locator("#tutText")).toContainText("Watch");
    await page.click("#tutNext");
    await expect(page.locator("#tutStep")).toContainText(at(6));
    await page.click("#tutNext");
    await expect(page.locator("#tutStep")).toContainText(at(7));
    await page.click("#tutNext");
    await expect(page.locator("#tutStep")).toContainText(at(STEPS));
    await page.click("#tutNext");
    await expect(page.locator("#tut")).toBeHidden();

    /* and it does not ambush a returning player */
    await reloadKeeping(page, "overtone:tutorial", "true");
    await enterGame(page);
    await expect(page.locator("#hand .card")).toHaveCount(7);
    await expect(page.locator("#tut")).toBeHidden();
  });

  test("cannot spend the round it is teaching in", async ({ page }) => {
    /* The lesson used to ask for a PLAY, and that step had no Next, so the
       only way past it was Skip: a player who did not want to commit a line
       they had not chosen had to quit the thing teaching them. Asking was the
       wrong shape. PLAY and DISCARD are simply off for the length of it, so
       there is no play to ask for, no play to hand back, and no way for the
       lesson to leave a first-timer worse off than somebody who skipped. */
    await page.goto(GAME);
    await enterGame(page);
    for (let i = 0; i < 2; i++) await page.click("#tutNext");
    await page.locator("#hand .card").nth(0).click();
    await page.locator("#hand .card").nth(1).click();
    await expect(page.locator("#tutStep")).toContainText(at(5));

    /* a full line is selected and both buttons still say no, with a reason */
    await expect(page.locator("#playBtn")).toBeDisabled();
    await expect(page.locator("#playBtn")).toHaveAttribute("title", /lesson/i);
    await expect(page.locator("#discardBtn")).toBeDisabled();
    /* and the keyboard reaches the same two functions, so it is barred too */
    await page.keyboard.press("Enter");
    await page.keyboard.press("d");
    const mid = await page.evaluate(() => ({ plays: G.plays, discards: G.discards }));

    for (let i = 0; i < 4; i++) await page.click("#tutNext");
    await expect(page.locator("#tut")).toBeHidden();

    const after = await page.evaluate(() => ({
      plays: G.plays, discards: G.discards, score: G.roundScore,
      budget: PLAYS_PER_ROUND
    }));
    expect(mid).toEqual({ plays: after.budget, discards: after.discards });
    expect(after.plays, "the lesson spent a play").toBe(after.budget);
    expect(after.score, "the lesson scored something").toBe(0);
    /* the two words it had them lay are still down, and now playable */
    await expect(page.locator("#hand .card.sel")).toHaveCount(2);
    await expect(page.locator("#playBtn")).toBeEnabled();
  });

  test("can be skipped, and skipping sticks", async ({ page }) => {
    await page.goto(GAME);
    await enterGame(page);
    await page.click("#tutSkip");
    await expect(page.locator("#tut")).toBeHidden();
    await expect(page.locator("#hand .card")).toHaveCount(7);
    await reloadKeeping(page, "overtone:tutorial", "true");
    await enterGame(page);
    await expect(page.locator("#tut")).toBeHidden();
  });

  test("skipping leaves the lighter coach running", async ({ page }) => {
    await page.goto(GAME);
    await enterGame(page);
    await page.click("#tutSkip");
    /* they opted out of the overlay, not out of ever being helped */
    await expect(page.locator("#coach")).toBeVisible();
    await expect(page.locator("#coach")).toContainText("what this round wants");
  });

  test("finishing it retires the coach, which would only repeat itself", async ({ page }) => {
    await page.goto(GAME);
    await enterGame(page);
    for (let i = 0; i < 2; i++) await page.click("#tutNext");
    await page.locator("#hand .card").nth(0).click();
    await page.locator("#hand .card").nth(1).click();
    await page.locator("#hand .card").nth(2).click();
    for (let i = 0; i < 3; i++) await page.click("#tutNext");
    await expect(page.locator("#tutStep")).toContainText(at(STEPS));
    await page.click("#tutNext");
    await expect(page.locator("#tut")).toBeHidden();
    await expect(page.locator("#coach")).toBeHidden();
  });

  test("only one guide runs at a time", async ({ page }) => {
    await page.goto(GAME);
    await enterGame(page);
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
    await expect(page.locator("#tutStep")).toContainText(at(1));
  });

  test("docks the card clear of the spotlight on a phone", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "phone layout only");
    await page.goto(GAME);
    await enterGame(page);
    for (let i = 0; i < 2; i++) await page.click("#tutNext");
    await page.locator("#hand .card").nth(0).click();
    await page.locator("#hand .card").nth(1).click();
    await page.locator("#hand .card").nth(2).click();
    for (let i = 0; i < 2; i++) await page.click("#tutNext");      // -> Play it

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
  test("four separate switches, and they stick", async ({ page }) => {
    await open(page);
    await page.click("#menuBtn");
    const panel = page.locator("#panel");
    /* the board's button is sound; everything else is on the title screen */
    await expect(panel).toContainText("Sound & feel");
    await expect(panel.locator(".switch")).toHaveCount(4);
    /* the iPhone gap is stated rather than quietly shipped */
    await expect(panel).toContainText("Android only");

    const music = panel.locator('.switch[data-pref="music"]');
    await expect(music).toHaveText("ON");
    await music.click();
    await expect(music).toHaveText("OFF");
    /* the board shows the state on the button itself */
    await expect(page.locator("#muteDot")).toBeHidden(); // sfx still on

    await panel.locator('.switch[data-pref="sfx"]').click();
    await expect(page.locator("#muteDot")).toBeVisible(); // everything off, and the board says so

    await page.click("#closeSettings");
    await reloadKeeping(page, "overtone:music", "false");
    await enterGame(page);
    if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
    await page.click("#menuBtn");
    await expect(page.locator('.switch[data-pref="music"]')).toHaveText("OFF");
  });

  test("music and effects get a level, not only a mute", async ({ page }) => {
    await open(page);
    await page.click("#menuBtn");
    const panel = page.locator("#panel");
    /* two levels under three mutes: vibration has nothing to be loud about */
    await expect(panel.locator(".vol input")).toHaveCount(2);

    const sfx = panel.locator('.vol input[data-vol="sfxVol"]');
    /* the default is the level the game was mixed at, so a player who never
       opens this panel hears exactly what the mix intended */
    await expect(sfx).toHaveValue("100");

    /* driven from the keyboard, which is the path that has to work anyway */
    await sfx.focus();
    for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowLeft");
    await expect(sfx).toHaveValue("40");
    await expect(panel.locator('.vol:has(input[data-vol="sfxVol"]) .volv')).toHaveText("40");
    expect(await page.evaluate(() => prefs.sfxVol)).toBeCloseTo(0.4, 5);

    /* muting takes the level away rather than forgetting it */
    await panel.locator('.switch[data-pref="sfx"]').click();
    await expect(sfx).toBeDisabled();
    await panel.locator('.switch[data-pref="sfx"]').click();
    await expect(sfx).toBeEnabled();
    await expect(sfx).toHaveValue("40");

    /* and it is still 40 on the device tomorrow */
    await page.click("#closeSettings");
    await reloadKeeping(page, "overtone:sfxVol", "0.4");
    await enterGame(page);
    if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
    await page.click("#menuBtn");
    await expect(page.locator('.vol input[data-vol="sfxVol"]')).toHaveValue("40");
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
    await page.click("#menuBtn");
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
    /* The main menu is the first frame now, and nobody has pressed anything on
       it. PLAY is a real gesture and may legitimately start the theme. */
    await expect(page.locator("#title")).toBeVisible();
    await page.waitForTimeout(400);
    expect(asked, "2MB of audio was pulled before the player pressed anything").toEqual([]);
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
      /* `par` is what this round asks on the mode's OWN curve before anything
         held has touched it. `raw` is the unscaled table entry, which stopped
         being any mode's target when each one got its own curve. */
      return { raw: TARGETS[round],
               par: Math.round(TARGETS[round] * curveScale(round)),
               shape: roundShape(round) };
    }, { round, ids, ordealId });
  }

  test("it quotes the target you will actually face, not the one on the table",
    async ({ page }) => {
      await open(page);
      /* THE CURSE doubles every target. The shop used to print TARGETS[round]
         straight, so it said 11,500 and the round then demanded 23,000 — the
         game lying at the exact moment you are deciding what to buy. */
      const r = await shopAt(page, 4, ["curse"]);
      expect(r.shape.target).toBe(r.par * 2);
      await expect(page.locator("#panel")).toContainText(r.shape.target.toLocaleString());
      await expect(page.locator("#panel")).toContainText("the usual");
    });

  test("it states the shape of the round, not just its number", async ({ page }) => {
    await open(page);
    /* THE WAGER takes a play, THE FAMINE three cards and a discard. Buying a
       Lens that costs you a play should show that cost here, before you
       commit, rather than on the board a minute later. */
    const r = await shopAt(page, 4, ["wager", "famine"]);
    const budget = await page.evaluate(() => PLAYS_PER_ROUND);
    expect(r.shape.plays, "THE WAGER should cost exactly one play").toBe(budget - 1);
    expect(r.shape.hand).toBe(4);
    const shape = page.locator(".panel p.shape");
    await expect(shape).toContainText(String(budget - 1));
    await expect(shape).toContainText("hand of 4");
  });

  test("it says plainly when nothing on the shelf reaches the next target", async ({ page }) => {
    await open(page);
    /* A losing build is the genre. An INVISIBLE losing build is a bug. But
       being short at a shop is the NORMAL state — the deck never keeps up on
       its own — so the red version has to mean what it says: not "you are
       behind", but "nothing here closes it". */
    await page.evaluate(() => {
      G.round = ROUNDS - 1;                              // the last round
      G.lenses = [LENSES.find(l => l.id === "curse")];   // and THE CURSE doubles it
      G.lensState = {}; G.bank = 0; G.offers = null;     // and nothing affordable
      openShop(9);
    });
    const reality = page.locator(".reality");
    await expect(reality).toBeVisible();
    await expect(reality).toHaveClass(/short/);
    await expect(reality).toContainText("NOTHING HERE CLOSES THIS");
    await expect(reality).toContainText("short");
  });

  test("when the shelf does close it, it names the Lens instead of crying wolf", async ({ page }) => {
    await open(page);
    const named = await page.evaluate(() => {
      /* Pinned, because whether a gap is closeable depends on which Demand and
         which Ordeal the seed dealt that round — and the default seed is the
         date, which would make this test start failing on a Tuesday for no
         reason anyone could find.

         On this seed a bare deck tops out at 24,954 against round 4's
         26,051. ALCHEMIST pays for NATURE and TECH in the same hand, which
         takes it to 27,954 and covers it.

         Seed and round have moved five times now - the figure ledger, the
         JOIN rebuild, the per-mode curves, the pass that took spelling out of
         scoring (a card's base value was its letter count, so every deck
         ceiling in the game moved), and the move to three plays a round. What
         a deck can reach depends on the scoring and what it is measured
         against depends on the mode. Found by probing rather than guessed;
         re-running the probe beats hunting. */
      newRun("probe2", true);
      G.round = 3; G.lenses = []; G.lensState = {}; G.bank = 20;
      G.offers = [{ kind: "lens", lens: LENSES.find(l => l.id === "alch"), cost: 5 }];
      openShop(9);
      const el = document.querySelector(".reality");
      return { cls: el.className, text: el.textContent };
    });
    expect(named.cls).toContain("near");
    expect(named.text).toContain("YOUR DECK ALONE IS SHORT");
    expect(named.text).toContain("ALCHEMIST");
    expect(named.text).toMatch(/covers it/);
  });

  test("a flawed Lens is judged on what it costs, not just what it pays", async ({ page }) => {
    await open(page);
    const shown = await page.evaluate(() => {
      /* THE CURSE is x3.5 on every hand, the loudest multiplier in the game,
         and it doubles the target. On this seed round 4 asks 16,961 and the
         bare deck reaches 8,236; cursed, the deck reaches 28,825 against a
         target of 33,922, so x3.5 does NOT cover it and the shop must not say
         it does. The shop has to re-read the SHAPE of the round with the
         candidate equipped to know that; measuring the cursed ceiling against
         the target the curse has not applied yet is the version that lies. */
      newRun("near-c", true);
      G.round = 3; G.lenses = []; G.lensState = {}; G.bank = 20;
      G.offers = [{ kind: "lens", lens: LENSES.find(l => l.id === "curse"), cost: 7 }];
      openShop(9);
      const el = document.querySelector(".reality");
      return { cls: el.className, text: el.textContent };
    });
    expect(shown.cls).toContain("short");
    expect(shown.text).not.toContain("covers it");
  });

  test("and says so when the deck is fine", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      /* Round 1's 450, which a bare deck clears many times over. The opening
         rounds are set from what a player who has understood nothing can make,
         so a deck being comfortably ahead of them is the design and not a bug. */
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
        deckCeiling(3); deckCeiling(5);
        /* and a round that does not exist answers 0 rather than throwing */
        if (deckCeiling(ROUNDS) !== 0) throw new Error("deckCeiling(ROUNDS) should be 0");
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

  test("the rounds that change a rule are the rounds the mode scheduled",
    async ({ page }) => {
    await open(page);
    /* The schedule is a property of the difficulty now, and it asserted [3,5,7]
       here long after the run stopped being eight rounds. Read it. */
    const out = await page.evaluate(() => {
      const shape = [];
      for (let r = 0; r < ROUNDS; r++) {
        G.round = r; startRound();
        shape.push(G.ordeal ? G.ordeal.id : null);
      }
      return { shape, scheduled: runDifficulty().ordealRounds.slice(), rounds: ROUNDS };
    });
    const dealt = out.shape.map((o, i) => o ? i : null).filter(i => i !== null);
    expect(dealt, "a rule landed on a round the mode did not schedule one for")
      .toEqual(out.scheduled);
    expect(new Set(out.shape.filter(Boolean)).size, "the same Ordeal twice in a run")
      .toBe(out.scheduled.length);
    /* and the run still ends on one, so it ends on a wall rather than a bigger
       number */
    expect(out.scheduled).toContain(out.rounds - 1);
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

  test("THE VICE actually refuses a fourth word", async ({ page }) => {
    /* It capped a line at two, which collapsed chips and multiplier together:
       forced onto the schedule it measured 22.0% against a 73.0% no-Ordeal
       ceiling on the gentle curve. Three is a squeeze; two was a wall. */
    await open(page);
    const state = await enterOrdeal(page, "vice");
    expect(state.cap).toBe(3);
    for (const k of ["1", "2", "3", "4"]) await page.keyboard.press(k);
    await expect(page.locator("#hand .card.sel")).toHaveCount(3);
    await expect(page.locator("#toast")).toContainText("THE VICE allows 3");
  });

  test("THE DROUGHT, THE CLOCK and THE LEAN YEAR take what they say they take",
    async ({ page }) => {
      await open(page);
      expect((await enterOrdeal(page, "drought")).discards).toBe(0);
      /* THE CLOCK read `g.plays = 3` under "Three plays this round instead of
         four" — written when a round WAS four plays. A round is two, so it was
         handing the player a play. It takes one now, floored at one. */
      const base = await page.evaluate(() => { newRun("clock-base", true); return G.plays; });
      expect((await enterOrdeal(page, "clock")).plays).toBe(Math.max(1, base - 1));
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
      return { clear, fogged, base: c.base, pay: DEMAND_CHIPS };
    });
    /* DEMAND_CHIPS, not a literal: the round's overtones used to pay 25 flat,
       which measured about a twentieth of a line. */
    expect(r.clear).toBe(r.base + r.pay);
    expect(r.fogged, "the matching tag should still pay").toBe(r.pay);
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
      await enterGame(page);
      /* The tutorial runs on round 1. Meeting a rule-breaking round while
         still learning the rules would be indefensible. */
      const first = await page.evaluate(() => G.ordeal);
      expect(first).toBeNull();
    });
});

/* ------------------------------------------------------------------ */
test.describe("selling a Lens", () => {
  /* Selling asks twice now, so the tests have to answer twice. */
  async function sell(page, i) {
    const b = page.locator(".sellbtn").nth(i);
    await b.click();
    await expect(b).toContainText("Tap again");
    await b.click();
  }

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
    await sell(page, 0);

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

    await sell(page, 0);
    const kept = await page.evaluate(() => G.lensState.pyro);
    expect(kept, "the growth survived the sale").toBeUndefined();
  });

  test("one click does not sell", async ({ page }) => {
    await open(page);
    /* The sell buttons sit one row under the offers in a panel that scrolls,
       and selling is the only irreversible thing in the shop — it takes the
       Lens, every round of growth on it, and returns half the price. Playing a
       run to see how it felt, I destroyed my own build twice with stray clicks
       meant for an offer. */
    await shopWith(page, ["pyro"], 5);
    const before = await page.evaluate(() => ({ bank: G.bank, n: G.lenses.length }));
    const b = page.locator(".sellbtn").first();
    await b.click();

    const after = await page.evaluate(() => ({ bank: G.bank, n: G.lenses.length }));
    expect(after.n, "one click sold the Lens").toBe(before.n);
    expect(after.bank, "one click paid out").toBe(before.bank);
    await expect(b).toContainText("Tap again");

    await b.click();
    expect(await page.evaluate(() => G.lenses.length)).toBe(before.n - 1);
  });

  test("the slot freed can immediately be spent", async ({ page }) => {
    await open(page);
    await shopWith(page, ["pyro", "reso", "glut", "zoo", "night"], 12);
    await sell(page, 0);
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
    const budget = await page.evaluate(() => PLAYS_PER_ROUND);
    expect(meters.plays, "THE WAGER should cost exactly one play").toBe(budget - 1);
    expect(meters.shown, "the meter and the state disagree").toBe(String(budget - 1));
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
    await expect(page.locator("#chipsV")).toHaveText(want.points, { timeout: 15000 });
    await expect(page.locator("#multV")).toHaveText(want.mult, { timeout: 15000 });
  });

  test("the total counts up and locks on the real score", async ({ page }) => {
    await open(page);
    await recordTotal(page);
    for (const k of ["1", "2", "3"]) await page.keyboard.press(k);
    const want = await page.evaluate(() => {
      const cards = G.selected.map(id => G.hand.find(c => c.id === id));
      return "+" + resolve(cards).total.toLocaleString();
    });
    await page.click("#playBtn");
    await settle(page);

    /* it starts at zero and arrives at the number, rather than appearing as it */
    const texts = await page.evaluate(() => window.__total.texts);
    expect(texts.length, "the scoring readout never appeared").toBeGreaterThan(0);
    expect(texts[texts.length - 1]).toBe(want);
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
    await page.click("#menuBtn");
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
    await recordStageGrowth(page);
    await page.click("#playBtn");
    await settle(page);

    const s = await page.evaluate(() => window.__stage);
    expect(s.sawResolving, "the board never took the room for the scoring").toBe(true);
    expect(s.max, "the stage never grew for the scoring").toBeGreaterThan(s.base);
    await expect(page.locator("#app")).not.toHaveClass(/resolving/);
  });

  test("the total is never cut off by the box it sits in", async ({ page }) => {
    await open(page);
    await recordTotal(page);
    for (const k of ["1", "2", "3"]) await page.keyboard.press(k);
    /* #playBtn is disabled while nothing is picked, so a hand that never landed
       would hang the click rather than fail here. Say the precondition out loud:
       three words chosen is what the rest of this test measures. */
    await expect.poll(() => page.evaluate(() => G.selected.length),
      { timeout: 3000, message: "the three keypresses never reached the hand" }).toBe(3);
    await page.click("#playBtn");
    await settle(page);

    const seen = await page.evaluate(() => window.__total.rects);
    expect(seen.length, "the scoring readout never appeared").toBeGreaterThan(0);

    /* The total slams in from scale(2.2) while the stage is still growing, so
       the opening frames are legitimately oversized and out of place. Ask that
       it came to rest inside the viewport, not that the entrance did. */
    const settled = seen.some(r => r.w > 20 && r.h > 20
      && r.top >= 0 && r.bottom <= r.vh && r.left >= 0 && r.right <= r.vw);
    expect(settled, "the total never settled inside the viewport; last frame was "
      + JSON.stringify(seen[seen.length - 1])).toBe(true);

    /* the old bug: overflow:hidden on a 76px-tall stage cut the readout in half */
    const clips = await page.evaluate(() =>
      getComputedStyle(document.getElementById("stage")).overflow === "hidden");
    expect(clips, "the stage is clipping its own scoring popup").toBe(false);
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
