/* The figure ledger — SPEC-figure-ledger.
 *
 * Play a shape and the run remembers; the next one of that shape pays more.
 * This is the first thing in the game that escalates because of what the
 * player did rather than because of what round it is, so what these tests
 * really pin is that the board, the scoring and the reference panel all read
 * the same ledger. A ladder that pays one number and advertises another is
 * worse than no ladder at all.
 */
const { test, expect } = require("@playwright/test");

/* resolved against baseURL in playwright.config.js */
const GAME = "/index.html";

async function enterGame(page){
  const title = page.locator("#title");
  await title.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await title.isVisible()) await page.click("#titlePlay");
  await expect(title).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      if (localStorage.getItem("overtone:difficulty") === null)
        localStorage.setItem("overtone:difficulty", JSON.stringify("scholar"));
      if (localStorage.getItem("overtone:sawFlaw") === null)
        localStorage.setItem("overtone:sawFlaw", "true");
    } catch (e) {}
  });
});

async function open(page){
  await page.goto(GAME);
  await enterGame(page);
  if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
  await expect(page.locator("#tut")).toBeHidden();
  if (await page.locator("#veil").isVisible()) await page.click("#closeHelp");
  await expect(page.locator("#veil")).toBeHidden();
}

/* Deal a known hand. Three words of one length make a COLUMN; the rest are
   there so the hand is a hand. */
async function dealColumn(page){
  await page.evaluate(() => {
    G.hand = ["OAK", "ELM", "ASH", "FURNACE", "MARSHLAND", "TIDE", "KILN"]
      .map(w => makeCard({ w, t: ["NAT"] }, false));
    G.selected = [];
    render();
  });
}

test.describe("the figure ledger", () => {
  test("only the figure that scored is remembered", async ({ page }) => {
    await open(page);
    await dealColumn(page);

    /* The trio makes a COLUMN and also makes a PAIR — three words of the same
       length contain two words of the same length. Only one of them pays, and
       only one of them may be remembered. */
    const before = await page.evaluate(() => {
      const trio = G.hand.slice(0, 3);
      return {
        best: figureFor(trio).id,
        all: figuresIn(trio).map(f => f.id),
        seen: JSON.parse(JSON.stringify(G.figSeen))
      };
    });
    expect(before.best).toBe("column");
    expect(before.all).toContain("pair");
    expect(before.seen).toEqual({});

    for (const k of ["1", "2", "3"]) { await page.keyboard.press(k); }
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => G.animating), { timeout: 9000 }).toBe(false);

    const after = await page.evaluate(() => JSON.parse(JSON.stringify(G.figSeen)));
    expect(after.column, "the figure that scored was not remembered").toBe(1);
    expect(after.pair, "a figure that was present but did not score was remembered").toBeUndefined();
  });

  test("the second of a shape pays more than the first, exactly", async ({ page }) => {
    await open(page);
    /* Driven through the payout function rather than through four hands of
       animation: the arithmetic is the contract, and the animation is tested
       everywhere else. */
    const pay = await page.evaluate(() => {
      const at = n => { G.figSeen = { column: n }; const p = figPay("column", 3);
                        return { lv: p.lv, chips: p.chips, mult: p.mult }; };
      return { c0: at(0), c1: at(1), c3: at(3), c6: at(6), c10: at(10), c99: at(99) };
    });

    /* Level 0 is the shipped game, untouched. A first-timer's first figure
       must not have moved. */
    expect(pay.c0).toEqual({ lv: 0, chips: 150, mult: 3 });
    expect(pay.c1).toEqual({ lv: 1, chips: 180, mult: 3 });
    expect(pay.c3).toEqual({ lv: 2, chips: 210, mult: 3 });
    expect(pay.c6).toEqual({ lv: 3, chips: 240, mult: 3 });
    expect(pay.c10).toEqual({ lv: 4, chips: 270, mult: 4 });
    /* capped: past the top of the ladder nothing more happens */
    expect(pay.c99).toEqual(pay.c10);
  });

  test("points climb before the multiplier does", async ({ page }) => {
    await open(page);
    const mults = await page.evaluate(() =>
      [0, 1, 3, 6, 10].map(n => { G.figSeen = { mono: n }; return figPay("mono", 3).mult; }));
    /* Points climb the whole way; the multiplier moves exactly once, at the
       top, for a shape the player committed ten plays to. Everything a
       figure pays is multiplied by the whole deck afterwards, so this is
       the term that decides whether the ladder breaks the curve. */
    expect(mults.slice(0, 4)).toEqual([5, 5, 5, 5]);
    expect(mults[4]).toBe(6);

    const chips = await page.evaluate(() =>
      [0, 1, 3, 6, 10].map(n => { G.figSeen = { mono: n }; return figPay("mono", 3).chips; }));
    /* every step strictly up, and never down */
    for (let i = 1; i < chips.length; i++) expect(chips[i]).toBeGreaterThan(chips[i - 1]);
  });

  test("the board and the payout never disagree", async ({ page }) => {
    await open(page);
    await dealColumn(page);
    /* A STAIR levelled to the top out-values an unlevelled COLUMN. Whatever
       figuresIn puts first is what resolve() pays, because they are the same
       call — this asserts that stays true once the ledger is in play. */
    const agree = await page.evaluate(() => {
      G.figSeen = { stair: 10 };
      const trio = G.hand.slice(0, 3);
      const ranked = figuresIn(trio);
      const paid = figureFor(trio);
      return {
        headOfRanking: ranked[0].id,
        whatResolvePays: paid.id,
        headValue: figValue(ranked[0]),
        paidValue: figValue(paid),
        sorted: ranked.every((f, i) => i === 0 || figValue(ranked[i - 1]) >= figValue(f))
      };
    });
    expect(agree.whatResolvePays).toBe(agree.headOfRanking);
    expect(agree.paidValue).toBe(agree.headValue);
    expect(agree.sorted, "figuresIn is not sorted by the levelled value").toBe(true);
  });

  test("the reference panel quotes your numbers, not the table's", async ({ page }) => {
    await open(page);
    await page.evaluate(() => { G.figSeen = { column: 10 }; });
    await page.click("#helpBtn");
    await page.click("#helpFigs");
    const panel = page.locator("#panel");
    await expect(panel.locator("h2")).toHaveText("The figures");
    /* COLUMN is maxed for this player, so the panel must say 360, not 150 */
    const row = panel.locator("tr", { hasText: "THE COLUMN" });
    await expect(row).toContainText("+270");
    await expect(row).not.toContainText("+150");
    await expect(row.locator(".lvtag")).toHaveText("INSTINCT");
    /* and a shape they have never played still reads as the shipped game */
    await expect(panel.locator("tr", { hasText: "THE STAIR" })).toContainText("+80");
  });

  test("the ledger is on the board, and the level is on the figure", async ({ page }) => {
    await open(page);
    await dealColumn(page);

    /* with nothing selected, the run's five shapes are all readable */
    const bar = page.locator("#figBar");
    await expect(bar.locator(".figp")).toHaveCount(5);
    /* toContainText reads textContent and passes on display:none, and the
       names ARE hidden below 1080px — so on the phone project the old
       assertion here was green while the thing it claimed to check was
       invisible. Assert what each width actually shows. */
    const wide = (page.viewportSize()?.width ?? 1280) > 1080;
    const names = bar.locator(".figp b");
    if (wide) {
      await expect(names.first()).toBeVisible();
      await expect(bar).toContainText("COLUMN");
      await expect(bar).toContainText("MONOGRAM");
    } else {
      await expect(names.first()).toBeHidden();
    }
    /* the pips are the part that has to survive at every width */
    await expect(bar.locator(".figp i").first()).toBeVisible();
    await expect(bar.locator(".figp i")).toHaveCount(20);
    /* nothing played yet, so nothing is lit */
    await expect(bar.locator(".figp.lit")).toHaveCount(0);
    await expect(bar.locator(".figp i.on")).toHaveCount(0);

    await page.evaluate(() => { G.figSeen = { column: 6 }; render(); });
    await expect(bar.locator(".figp.lit")).toHaveCount(1);
    /* level 3 of 4 */
    await expect(bar.locator(".figp i.on")).toHaveCount(3);

    /* and with cards selected, the figure names its level where the choice is made */
    for (const k of ["1", "2", "3"]) await page.keyboard.press(k);
    const hint = page.locator("#stageHint");
    await expect(hint.locator(".hand-name")).toHaveText("THE COLUMN");
    await expect(hint.locator(".figlv")).toHaveText("FLUENT");
  });

  test("levelling changes what a played hand actually scores", async ({ page }) => {
    await open(page);

    /* The gap this closes: every other arithmetic test here drives figPay()
       directly, so a regression where resolve() went back to reading the flat
       FIG_PAY table would pass all of them. This one plays the same three
       words twice from the same state and compares the totals. */
    const score = async (count) => {
      return await page.evaluate((n) => {
        G.hand = ["OAK", "ELM", "ASH", "FURNACE", "MARSHLAND", "TIDE", "KILN"]
          .map(w => makeCard({ w, t: ["NAT"] }, false));
        G.figSeen = n ? { column: n } : {};
        const trio = G.hand.slice(0, 3);
        const r = resolve(trio);
        return { total: r.total, chips: r.chips, fig: figureFor(trio).id };
      }, count);
    };

    /* Counts 1 and 10, not 0 and 10: the first of a shape in a run also
       carries the discovery bonus, and this test is about the ladder. */
    const first = await score(1);
    const maxed = await score(10);
    expect(first.fig).toBe("column");
    expect(maxed.fig).toBe("column");
    /* level 1 pays 180, level 4 pays 270 */
    expect(maxed.chips - first.chips).toBe(90);
    expect(maxed.total).toBeGreaterThan(first.total);
  });

  test("the reorder nudge ranks by the ledger too", async ({ page }) => {
    await open(page);
    /* The board offers "the same words make X in another order". If that
       nudge ranked by the flat table while resolve() paid by the ledger, it
       would point at a reorder worth less than the one already on screen. */
    const same = await page.evaluate(() => {
      /* OAK / OIL / ASH: as dealt these are three 3-letter words (COLUMN).
         Reordered they still are, so the nudge has nothing better to offer —
         what matters is that both sides agree about the value. */
      G.hand = ["OAK", "OIL", "ASH", "EMBER", "TIDE", "KILN", "FURNACE"]
        .map(w => makeCard({ w, t: ["NAT"] }, false));
      const out = [];
      [0, 10].forEach(n => {
        G.figSeen = n ? { column: n, mono: n } : {};
        const trio = G.hand.slice(0, 3);
        const held = figureFor(trio);
        const better = figureByReorder(trio);
        out.push({
          held: held && held.id,
          heldValue: figValue(held),
          better: better && better.id,
          /* the nudge may only ever point at something worth MORE */
          betterIsBetter: !better || figValue(better) > figValue(held)
        });
      });
      return out;
    });
    for (const r of same) {
      expect(r.betterIsBetter, "the nudge pointed at a figure worth no more").toBe(true);
    }
    /* and the ledger really did move the value it is ranking on */
    expect(same[1].heldValue).toBeGreaterThan(same[0].heldValue);
  });

  test("a finished run stops advertising its levels", async ({ page }) => {
    await open(page);
    /* G outlives the run that made it. Before this was fixed, finishing a run
       with a maxed COLUMN and then opening The figures from the menu quoted
       +270 at somebody whose next run starts COLUMN at +150. */
    await page.evaluate(() => { G.figSeen = { column: 10 }; G.over = true; });
    await page.click("#helpBtn");
    await page.click("#helpFigs");
    const row = page.locator("#panel tr", { hasText: "THE COLUMN" });
    await expect(row).toContainText("+150");
    await expect(row).not.toContainText("+270");
    await expect(row.locator(".lvtag")).toHaveCount(0);
  });

  test("spreading your plays thin keeps every shape low", async ({ page }) => {
    await open(page);
    /* CAP-3 promises the ladder rewards commitment rather than volume. A run
       that plays all five shapes evenly has 32 plays to give, so roughly six
       each — which must not be enough to top anything out. */
    const spread = await page.evaluate(() => {
      const even = {};
      FIGURES.forEach(f => { even[f.id] = 6; });   // 5 shapes x 6 = 30 of 32 plays
      G.figSeen = even;
      return FIGURES.map(f => figLevel(f.id));
    });
    /* six plays of a shape is level 3 of 4 — real progress, and short of the
       top, which costs ten of one shape */
    for (const lv of spread) expect(lv).toBeLessThan(4);

    const committed = await page.evaluate(() => {
      G.figSeen = { column: 10 };
      return { column: figLevel("column"), others: figLevel("mono") };
    });
    expect(committed.column).toBe(4);
    expect(committed.others).toBe(0);
  });

  test("the ledger row never clips itself", async ({ page }) => {
    await open(page);
    await page.evaluate(() => { G.figSeen = { column: 10, mono: 6, chain: 3 }; render(); });
    /* .figbar is overflow:hidden so it can never push PLAY off a phone — the
       cost of that is it would clip in silence if the Lens header ever ran
       out of width. 1100 is the width that matters: just above the 1080px
       breakpoint, so the five shape names are still being drawn. */
    for (const w of [1280, 1180, 1100, 900, 700, 420, 375]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(80);
      const clipped = await page.evaluate(() => {
        const b = document.getElementById("figBar");
        return { over: b.scrollWidth - b.clientWidth, shapes: b.children.length };
      });
      expect(clipped.shapes, "a shape went missing at " + w + "px").toBe(5);
      expect(clipped.over, "the ledger row is clipped at " + w + "px").toBeLessThanOrEqual(1);
    }
  });

  test("a levelled figure still obeys the Ordeals", async ({ page }) => {
    await open(page);
    /* The ladder multiplies what a figure is worth, and three Ordeals rewrite
       what scoring means. Nothing exercised the two together, so this pins
       what actually happens rather than what anyone assumed.

       THE FOG is the interesting one: it acts per CARD, so a maxed figure
       pays its chips in full underneath it. That was true before the ledger
       too — the ladder just makes the hole bigger. Pinned here as current
       behaviour, not endorsed as correct. */
    const out = await page.evaluate(() => {
      const setup = (ordealId, count) => {
        G.hand = ["OAK", "ELM", "ASH", "FURNACE", "MARSHLAND", "TIDE", "KILN"]
          .map(w => makeCard({ w, t: ["NAT"] }, false));
        G.figSeen = count ? { column: count } : {};
        G.ordeal = ordealId ? ORDEALS.find(o => o.id === ordealId) : null;
        return resolve(G.hand.slice(0, 3));
      };
      /* count 1, not 0 — the first of a shape carries the discovery bonus
         and would swamp the thing being measured */
      return {
        plainL0:  setup(null, 1).total,
        plainL4:  setup(null, 10).total,
        fogL0:    setup("fog", 1).total,
        fogL4:    setup("fog", 10).total,
        halfL0:   setup("halflight", 1).total,
        halfL4:   setup("halflight", 10).total
      };
    });

    /* levelling is worth something in every one of them */
    expect(out.plainL4).toBeGreaterThan(out.plainL0);
    expect(out.fogL4).toBeGreaterThan(out.fogL0);
    expect(out.halfL4).toBeGreaterThan(out.halfL0);
    /* and an Ordeal still costs you: neither is free money */
    expect(out.fogL4).toBeLessThan(out.plainL4);
    expect(out.halfL4).toBeLessThanOrEqual(out.plainL4);
  });

  test("finding a shape for the first time pays once", async ({ page }) => {
    await open(page);
    const out = await page.evaluate(() => {
      const trio = () => ["OAK", "ELM", "ASH"].map(w => makeCard({ w, t: ["NAT"] }, false));
      G.figSeen = {};
      const virgin = resolve(trio());
      G.figSeen = { column: 1 };
      const known = resolve(trio());
      return {
        virginChips: virgin.chips, knownChips: known.chips,
        virginTxt: virgin.events[0].txt, knownTxt: known.events[0].txt,
        bonus: FIG_FOUND
      };
    });
    /* level 0 + the bonus (150 + 150 = 300) against level 1 alone (180) */
    expect(out.virginChips - out.knownChips).toBe(out.bonus - 30);
    expect(out.virginTxt).toContain("FIRST");
    expect(out.knownTxt).not.toContain("FIRST");
  });

  test("breadth and depth actually compete", async ({ page }) => {
    await open(page);
    /* The point of the bonus: going and finding a shape you have never
       played must be worth a real comparison against deepening one you have.
       If the bonus were proportional, the cheap shapes would stay worthless
       and there would be no decision — so it is flat on purpose. */
    const out = await page.evaluate(() => {
      const val = (id, count) => {
        G.figSeen = {}; G.figSeen[id] = count;
        const bind = FIG_PAY[id][3] ? 3 : 2;
        return figPay(id, bind).chips + (count === 0 ? FIG_FOUND : 0);
      };
      return {
        freshStair: val("stair", 0),   // 80 + 150
        deepStair:  val("stair", 10),  // 144
        freshMono:  val("mono", 0),    // 320 + 150
        deepColumn: val("column", 10)  // 270
      };
    });
    /* a shape you have never touched beats the same shape maxed out — which
       is what makes "go and find one" a live option every hand */
    expect(out.freshStair).toBeGreaterThan(out.deepStair);
    /* and the bonus is flat, so it is worth proportionally far more on a
       cheap shape than on an expensive one */
    expect(out.freshStair / 80).toBeGreaterThan(out.freshMono / 320);
  });

  test("a new run forgets", async ({ page }) => {
    await open(page);
    await dealColumn(page);
    for (const k of ["1", "2", "3"]) await page.keyboard.press(k);
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => G.animating), { timeout: 9000 }).toBe(false);
    expect(await page.evaluate(() => G.figSeen.column)).toBe(1);

    /* A run is a story and the ledger is part of it, so it dies with the run.
       Nothing here checks a reload: the game has no mid-run persistence at
       all, and a reload already discards the round, the score, the deck and
       the Lenses. A test asserting the ledger survives one would be pinning
       a behaviour the game does not have for anything else. */
    await page.evaluate(() => newRun("ledger-fresh", true));
    expect(await page.evaluate(() => G.figSeen)).toEqual({});
  });

  test("an unplayed shape pays exactly what it always paid", async ({ page }) => {
    await open(page);
    /* The whole ladder is additive on top of the shipped balance. Somebody who
       has never seen a figure before must meet the game as it was. */
    const shipped = await page.evaluate(() => {
      G.figSeen = {};
      return FIGURES.map(f => {
        const bind = FIG_PAY[f.id][3] ? 3 : 2;
        const p = figPay(f.id, bind), base = FIG_PAY[f.id][bind];
        return { id: f.id, ok: p.chips === base.chips && p.mult === base.mult, lv: p.lv };
      });
    });
    for (const f of shipped) {
      expect(f.lv, f.id + " starts above level 0").toBe(0);
      expect(f.ok, f.id + " at level 0 does not pay the shipped value").toBe(true);
    }
  });
});
