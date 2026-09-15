/* The findings from a UX audit, turned into things that cannot come back.
 *
 * Every test here is a bug that shipped. The tutorial step that taught the
 * figures mechanic sat on top of the readout it was telling players to watch,
 * and asserted they had made a figure when 43% of the time they had not.
 * Landscape put PLAY 487px below the fold. Scoring labels landed on each other.
 * None of it was visible to the existing suite, which is the point of writing
 * them down here.
 */
const { test, expect } = require("@playwright/test");
const path = require("path");
const { pathToFileURL } = require("url");

const GAME = pathToFileURL(path.resolve(__dirname, "..", "..", "index.html")).href;

/* The game opens on a main menu now. Every spec starts on the board, so this
   is the one place that knows how to get there. */
async function enterGame(page){
  const title = page.locator("#title");
  /* The menu is drawn by start(), which may be deferred a tick by the artifact
     host; asking isVisible() too early answers no and leaves the test on the
     menu it thought it had walked past. */
  await title.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await title.isVisible()) await page.click("#titlePlay");
  await expect(title).toBeHidden();
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
    } catch (e) {}
  });
});

const overlap = (a, b) =>
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) *
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));

/* ------------------------------------------------------------------ */
test.describe("the tutorial teaches the figure it can actually see", () => {
  /* Walk to the shape step: two Nexts, then three cards. */
  async function toShapeStep(page) {
    await page.goto(GAME);
    await enterGame(page);
    await expect(page.locator("#tut")).toBeVisible();
    for (let i = 0; i < 2; i++) { await page.click("#tutNext"); await page.waitForTimeout(120); }
    for (let k = 0; k < 3; k++) {
      await page.locator("#hand .card").nth(k).click();
      await page.waitForTimeout(180);
    }
    await expect(page.locator("#tutStep")).toContainText("5 of");
    await page.waitForTimeout(500);       // let the spotlight settle
  }

  test("does not sit on top of the readout it is pointing at", async ({ page }) => {
    await toShapeStep(page);
    const covered = await page.evaluate(() => {
      const ov = (a, b) =>
        Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) *
        Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const box = document.getElementById("tutBox").getBoundingClientRect();
      const name = document.querySelector(".hand-name").getBoundingClientRect();
      const hint = document.getElementById("stageHint").getBoundingClientRect();
      return {
        name: Math.round(100 * ov(box, name) / (name.width * name.height)),
        hint: Math.round(100 * ov(box, hint) / (hint.width * hint.height))
      };
    });
    expect(covered.name, "the tutorial card is covering the figure name").toBe(0);
    expect(covered.hint, "the tutorial card is covering the readout").toBeLessThanOrEqual(5);
  });

  test("names the figure that is actually on the board", async ({ page }) => {
    await toShapeStep(page);
    const seen = await page.evaluate(() => ({
      onBoard: document.querySelector(".hand-name").textContent.trim(),
      inCard: document.getElementById("tutText").textContent
    }));
    /* whatever the board says, the card has to agree with it */
    if (seen.onBoard === "NO FIGURE") {
      expect(seen.inCard).toMatch(/make <?b?>?nothing|make nothing/i);
    } else {
      expect(seen.inCard, "the card named a different figure than the board")
        .toContain(seen.onBoard);
    }
  });

  test("deals a hand whose first three words make a figure worth naming",
    async ({ page }) => {
      await toShapeStep(page);
      const name = await page.evaluate(() =>
        document.querySelector(".hand-name").textContent.trim());
      expect(name, "the step that teaches figures showed no figure").not.toBe("NO FIGURE");
    });

  test("hands the deal back the way it was dealt when the tutorial ends",
    async ({ page }) => {
      await page.goto(GAME);
      await enterGame(page);
      /* the arrangement is a teaching aid; left in place it pre-sorts a
         player's first three cards into a figure for the whole round */
      const arranged = await page.evaluate(() => G.hand.map(c => c.w));
      await page.click("#tutSkip");
      await page.waitForTimeout(250);
      const restored = await page.evaluate(() => G.hand.map(c => c.w));
      const dealt = await page.evaluate(() => {
        /* what the seed deals with no tutorial at all */
        newRun(G.seed, true);
        return G.hand.map(c => c.w);
      });
      expect(restored.join(","), "the tutorial's arrangement outlived the tutorial")
        .toBe(dealt.join(","));
      expect(arranged.slice().sort().join(","), "it changed the hand, not just its order")
        .toBe(dealt.slice().sort().join(","));
    });
});

/* ------------------------------------------------------------------ */
test.describe("labels do not land on each other", () => {
  test("nothing overlaps while a hand is scoring", async ({ page }) => {
    await page.goto(GAME);
    await enterGame(page);
    if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
    await page.waitForTimeout(250);
    /* three words on the same letter AND two matching tags each: the busiest
       frame the scoring animation can produce */
    await page.evaluate(() => {
      G.demand = { n: "TEST", tags: ["NAT", "PLA"] };
      G.hand = ["MOSS", "MARSH", "MEMORY", "OAK", "TIDE", "WOLF", "KILN"]
        .map(w => makeCard({ w, t: ["NAT", "PLA"] }, false));
      G.selected = []; render();
    });
    for (const k of ["1", "2", "3"]) { await page.keyboard.press(k); await page.waitForTimeout(90); }
    await page.keyboard.press("Enter");

    let worst = 0, pair = "";
    for (let t = 0; t < 45; t++) {
      const hit = await page.evaluate(() => {
        const ov = (a, b) =>
          Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) *
          Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const els = [...document.querySelectorAll("#stage .float")]
          .filter(e => e.offsetParent)
          .map(e => ({ t: e.textContent.trim(), r: e.getBoundingClientRect() }));
        /* Area is the wrong unit -- a wide label has a lot of it. What matters
           is whether a label is HIDDEN, so measure the fraction of the smaller
           one that the other covers. A word scoring two matching tags printed
           MATCH +25 exactly on top of MATCH +25, and the second was invisible. */
        let big = 0, who = "";
        for (let i = 0; i < els.length; i++)
          for (let j = i + 1; j < els.length; j++) {
            const a = ov(els[i].r, els[j].r);
            const small = Math.min(els[i].r.width * els[i].r.height,
                                   els[j].r.width * els[j].r.height);
            const frac = small ? a / small : 0;
            if (frac > big) { big = frac; who = els[i].t + " / " + els[j].t; }
          }
        /* and the sin that started all this: the same words twice, on top of
           each other, so one of them may as well not have happened */
        /* Two cards can each score two matches; that is the game, and they sit
           on their own cards. The sin is two identical labels in the same
           place, where one may as well not have happened. */
        let dup = false, dupText = "";
        for (let i = 0; i < els.length; i++)
          for (let j = i + 1; j < els.length; j++)
            if (els[i].t === els[j].t && ov(els[i].r, els[j].r) > 0.8 * Math.min(
              els[i].r.width * els[i].r.height, els[j].r.width * els[j].r.height)) {
              dup = true; dupText = els[i].t;
            }
        const texts = els.map(e => e.t);
        return { big: Math.round(big * 100), who, dup, dupText, texts, going: G.animating };
      });
      if (hit.big > worst) { worst = hit.big; pair = hit.who; }
      expect(hit.dup, "two identical labels landed on each other: " + hit.texts.join(" | "))
        .toBe(false);
      if (!hit.going) break;
      await page.waitForTimeout(60);
    }
    expect(worst, "a scoring label was mostly hidden by another: " + pair)
      .toBeLessThanOrEqual(92);
  });

  test("the figure gets its own beat before the cards start", async ({ page }) => {
    await page.goto(GAME);
    await enterGame(page);
    if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      G.hand = ["MOSS", "TIDE", "WOLF", "OAK", "EMBER", "KILN", "FURNACE"]
        .map(w => makeCard({ w, t: ["NAT"] }, false));
      G.selected = []; render();
    });
    for (const k of ["1", "2", "3"]) { await page.keyboard.press(k); await page.waitForTimeout(90); }
    await page.keyboard.press("Enter");
    await page.waitForTimeout(340);
    const alone = await page.evaluate(() =>
      [...document.querySelectorAll("#stage .float")].map(e => e.textContent.trim()));
    expect(alone.length, "something landed on the figure's beat: " + alone.join(" | ")).toBe(1);
    expect(alone[0]).toContain("THE COLUMN");
    expect(alone[0], "double space in the label").not.toContain("  ");
  });
});

/* ------------------------------------------------------------------ */
test.describe("it can be played sideways", () => {
  for (const vp of [{ w: 740, h: 400 }, { w: 844, h: 390 }, { w: 932, h: 430 }]) {
    test("PLAY is reachable at " + vp.w + "x" + vp.h, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(GAME);
      await enterGame(page);
      if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
      if (await page.locator("#veil").isVisible()) await page.click("#closeHelp");
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => ({
        cut: Math.max(0, Math.round(
          document.getElementById("playBtn").getBoundingClientRect().bottom - innerHeight)),
        sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        /* Cards are fanned, so each one sits a few pixels off its neighbour and
           a raw count of distinct tops says four rows for one. Bucket them. */
        rows: new Set([...document.querySelectorAll("#hand .card")]
          .map(c => Math.round(c.getBoundingClientRect().top / 40))).size
      }));
      expect(m.cut, "PLAY is below the fold").toBe(0);
      expect(m.sideways, "the board scrolls sideways").toBeLessThanOrEqual(1);
      expect(m.rows, "the hand wrapped to more than one row").toBe(1);
    });
  }

  test("no word is broken in half at any size", async ({ page }) => {
    for (const vp of [{ w: 740, h: 400 }, { w: 932, h: 430 }, { w: 393, h: 727 }, { w: 375, h: 667 }]) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(GAME);
      await enterGame(page);
      if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
      await page.waitForTimeout(350);
      /* Range rects count real line boxes, which element height cannot. */
      const broken = await page.evaluate(() => {
        const host = document.querySelector("#hand .card .w");
        if (!host) return ["no card"];
        const keep = host.innerHTML, out = [];
        LEXICON.map(e => e.w).forEach(w => {
          host.innerHTML = '<span class="wt">' + w + "</span>";
          const t = host.querySelector(".wt");
          const rng = document.createRange();
          rng.selectNodeContents(t);
          if (rng.getClientRects().length > 1 && w.indexOf(" ") < 0) out.push(w);
        });
        host.innerHTML = keep;
        return out;
      });
      expect(broken, "words broken mid-word at " + vp.w + "x" + vp.h).toEqual([]);
    }
  });
});

/* ------------------------------------------------------------------ */
test.describe("it can be played without looking at it", () => {
  test("a picked card says so, and says where it sits", async ({ page }) => {
    await page.goto(GAME);
    await enterGame(page);
    if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
    await page.waitForTimeout(250);
    const first = page.locator("#hand .card").first();
    await expect(first).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("1");
    await page.keyboard.press("2");
    await expect(page.locator("#hand .card").first()).toHaveAttribute("aria-pressed", "true");
    /* order is the mechanic, so the position has to be in the label */
    const label = await page.locator("#hand .card").first().getAttribute("aria-label");
    expect(label).toMatch(/word 1 of 2/);
  });

  test("the board announces what the hand is worth", async ({ page }) => {
    await page.goto(GAME);
    await enterGame(page);
    if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
    await page.waitForTimeout(250);
    const say = page.locator("#say");
    /* a live region inside a hidden overlay announces nothing */
    await expect(say).toHaveAttribute("aria-live", "polite");
    const hidden = await page.evaluate(() => {
      let n = document.getElementById("say");
      while (n && n !== document.body) { if (n.hidden) return true; n = n.parentElement; }
      return false;
    });
    expect(hidden, "the live region is inside a hidden subtree").toBe(false);
    await page.keyboard.press("1");
    await page.waitForTimeout(250);
    await expect(say).toContainText("Worth");
  });
});

/* ------------------------------------------------------------------ */
test.describe("the screens a player stops at", () => {
  /* A round ending and a run ending are the only two panels a player stops on.
     Everything else is passed through. These take the board away properly. */
  const moment = async (page, how) => {
    await page.goto(GAME);
    await enterGame(page);
    if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
    await page.waitForTimeout(200);
    await page.evaluate(how);
    await page.waitForTimeout(500);
  };

  test("a run ending dims and blurs the board behind it", async ({ page }) => {
    await moment(page, () => {
      newRun("moment", true);
      G.total = 41280; G.round = 5; G.best = { word: "", mult: 26, score: 9100 };
      endRun(false);
    });
    const veil = page.locator("#veil");
    await expect(veil).toHaveClass(/moment/);
    const look = await page.evaluate(() => {
      const cs = getComputedStyle(document.getElementById("veil"));
      return { blur: cs.backdropFilter || cs.webkitBackdropFilter, bg: cs.backgroundImage !== "none" };
    });
    expect(look.blur, "the board behind is not blurred back").toMatch(/blur/);
    expect(look.bg, "no light behind the panel").toBe(true);
  });

  test("a round ending does the same", async ({ page }) => {
    await moment(page, () => { newRun("moment", true); G.round = 2; G.bank = 12; openShop(8); });
    await expect(page.locator("#veil")).toHaveClass(/moment/);
    await expect(page.locator("#panel")).toContainText("cleared");
  });

  test("a screen a player is only passing through does not", async ({ page }) => {
    await moment(page, () => { newRun("moment", true); });
    await page.click("#helpBtn");
    await page.waitForTimeout(250);
    await expect(page.locator("#veil")).not.toHaveClass(/moment/);
  });

  test("the number the player came for is the biggest thing on it", async ({ page }) => {
    await moment(page, () => {
      newRun("moment", true); G.total = 41280; G.round = 5; endRun(false);
    });
    const size = await page.evaluate(() => {
      const gold = document.querySelector("#panel .stat.gold .v");
      const other = document.querySelector("#panel .stat:not(.gold) .v");
      return { gold: parseFloat(getComputedStyle(gold).fontSize),
               other: parseFloat(getComputedStyle(other).fontSize),
               text: gold.textContent.trim() };
    });
    expect(size.text).toBe("41,280");
    expect(size.gold, "the total is not lifted above the other stats")
      .toBeGreaterThan(size.other);
  });
});

/* ------------------------------------------------------------------ */
test.describe("targets big enough to hit", () => {
  test("every control clears 24px of hit area on a touch screen",
    async ({ page }, info) => {
      test.skip(info.project.name !== "phone", "touch only");
      await page.goto(GAME);
      await enterGame(page);
      if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
      await page.waitForTimeout(300);
      const small = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll("button, .figlink").forEach(e => {
          if (!e.offsetParent) return;
          const r = e.getBoundingClientRect();
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          /* measure the real hit area, which a pseudo-element can widen */
          let w = 0, h = 0;
          for (let d = 1; d < 30; d++) {
            const t = document.elementFromPoint(cx - d, cy);
            if (t === e || e.contains(t) || (t && t.contains(e))) w = d * 2; else break;
          }
          for (let d = 1; d < 30; d++) {
            const t = document.elementFromPoint(cx, cy + d);
            if (t === e || e.contains(t) || (t && t.contains(e))) h = d * 2; else break;
          }
          if (w < 24 || h < 24) out.push((e.id || e.className) + " " + w + "x" + h);
        });
        return out;
      });
      expect(small, "controls under the 24px target minimum").toEqual([]);
    });
});

/* ------------------------------------------------------------------ */
test.describe("the main menu", () => {
  test("is what you land on, and PLAY is always reachable", async ({ page }) => {
    for (const vp of [{ w: 1280, h: 900 }, { w: 393, h: 727 }, { w: 375, h: 667 },
                      { w: 740, h: 400 }, { w: 932, h: 430 }]) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(GAME);
      await expect(page.locator("#title")).toBeVisible();
      const m = await page.evaluate(() => {
        const b = document.getElementById("titlePlay").getBoundingClientRect();
        return { cut: Math.max(0, Math.round(b.bottom - innerHeight)),
                 above: Math.round(b.top),
                 sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      expect(m.cut, "PLAY is below the fold at " + vp.w + "x" + vp.h).toBe(0);
      expect(m.above, "PLAY is above the fold at " + vp.w + "x" + vp.h).toBeGreaterThanOrEqual(0);
      expect(m.sideways, "the menu scrolls sideways at " + vp.w + "x" + vp.h).toBeLessThanOrEqual(1);
    }
  });

  test("the board is not playable until you press it", async ({ page }) => {
    await page.goto(GAME);
    await expect(page.locator("#title")).toBeVisible();
    /* the cards are dealt behind it so PLAY is instant, but nothing on the
       board can be reached through the menu */
    const blocked = await page.evaluate(() => {
      const card = document.querySelector("#hand .card");
      if (!card) return "no card dealt";
      const r = card.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit && (hit.closest("#title") ? "menu" : "board");
    });
    expect(blocked, "the board was clickable underneath the main menu").toBe("menu");
    await page.click("#titlePlay");
    await expect(page.locator("#title")).toBeHidden();
    await expect(page.locator("#hand .card")).toHaveCount(7);
  });

  test("a returning player sees what they have done", async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("overtone:runs", "12");
        localStorage.setItem("overtone:best", "38400");
        localStorage.setItem("overtone:tutorial", "true");
      } catch (e) {}
    });
    await page.goto(GAME);
    await expect(page.locator("#title .runstat")).toContainText("12");
    await expect(page.locator("#title .runstat")).toContainText("38,400");
    await expect(page.locator("#titlePlay")).toContainText("daily");
    /* and is not told where to start, because they know */
    await expect(page.locator(".diffopt .tip")).toHaveCount(0);
  });

  test("the Lens the next run starts with is named before you press play",
    async ({ page }) => {
      /* A Lens sitting on the board at round 1 with nothing said about it
         reads as the game dealing at random. It is Memory, and the menu is
         where it belongs. */
      await page.addInitScript(() => {
        try {
          localStorage.setItem("overtone:runs", "4");
          localStorage.setItem("overtone:tutorial", "true");
          localStorage.setItem("overtone:memory", JSON.stringify("chron"));
        } catch (e) {}
      });
      await page.goto(GAME);
      const name = await page.evaluate(() =>
        LENSES.find(l => l.id === "chron").n);
      await expect(page.locator("#title .carry")).toContainText(name);

      await page.click("#titlePlay");
      /* and the same Lens is on the board, marked as the one that was carried */
      await expect(page.locator("#rail .lens .mem")).toHaveCount(1);
      await expect(page.locator("#rail .lens").first()).toContainText(name);
    });

  test("a profile that has finished nothing carries nothing in", async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto(GAME);
    await expect(page.locator("#title .carry")).toHaveCount(0);
    await page.click("#titlePlay");
    await expect(page.locator("#rail .lens")).toHaveCount(0);
  });

  test("every door on it comes back to it", async ({ page }) => {
    await page.goto(GAME);
    await page.click("#titleFigs");
    await expect(page.locator(".figtab")).toBeVisible();
    await page.click("#figsBack");
    await expect(page.locator("#title")).toBeVisible();
    await expect(page.locator("#veil")).toBeHidden();

    await page.click("#titleHelp");
    await expect(page.locator("#panel h2")).toContainText("How Overtone works");
    await page.click("#helpBack");
    await expect(page.locator("#title")).toBeVisible();

    await page.click("#titleSound");
    await expect(page.locator("#panel h2")).toHaveText("Sound & feel");
    /* and one button out of it, not two both saying "Back to the menu" */
    await expect(page.locator("#panel .rowend .btn")).toHaveCount(1);
    await page.click("#closeSettings");
    await expect(page.locator("#title")).toBeVisible();
  });

  test("the game can be left and come back to", async ({ page }) => {
    await page.goto(GAME);
    await page.click("#titlePlay");
    await expect(page.locator("#title")).toBeHidden();
    await page.locator("#tutSkip").click().catch(() => {});
    await page.click("#homeBtn");
    await expect(page.locator("#title")).toBeVisible();
    await expect(page.locator("#veil")).toBeHidden();
  });
});

/* ------------------------------------------------------------------ */
test.describe("round over reads as a popup", () => {
  test("the board is taken away behind the stamp", async ({ page }) => {
    await page.goto(GAME);
    await enterGame(page);
    if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
    await page.waitForTimeout(200);
    await page.evaluate(() => stamp("ROUND CLEAR", false, 3000));
    await page.waitForTimeout(300);
    const look = await page.evaluate(() => {
      const el = document.getElementById("stamp");
      const cs = getComputedStyle(el);
      return { shown: !el.hidden,
               blur: cs.backdropFilter || cs.webkitBackdropFilter,
               ground: cs.backgroundImage !== "none",
               text: document.getElementById("stampText").textContent };
    });
    expect(look.shown).toBe(true);
    expect(look.text).toBe("ROUND CLEAR");
    expect(look.blur, "the board behind the stamp is not blurred back").toMatch(/blur/);
    expect(look.ground, "nothing dims the board behind the stamp").toBe(true);
  });

  test("and comes back afterwards", async ({ page }) => {
    await page.goto(GAME);
    await enterGame(page);
    if (await page.locator("#tut").isVisible()) await page.click("#tutSkip");
    await page.evaluate(() => stamp("OUT OF PLAYS", true, 700));
    await expect(page.locator("#stamp")).toBeVisible();
    await page.waitForTimeout(1100);
    await expect(page.locator("#stamp")).toBeHidden();
  });
});
