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

    /* This used to sample from the test process: 45 round trips, 60ms apart,
       each landing wherever the machine let it. Under load the instants move,
       and one of the instants they can land on is a single frame where a
       card's +20 slides under 2 MATCHES +50 at 98%. Measured across twenty
       runs: that crossing lasts ONE frame in ninety, and half the runs never
       reach 92% at all -- so "no instant may exceed 92%" failed about one run
       in six for a 16ms pass-by.

       Two labels crossing is not the sin this test was written for. Its own
       note says it: the second one "was invisible", "may as well not have
       happened". So record every frame from inside the page, where nothing can
       be missed, and ask whether a label is HIDDEN -- covered that far for
       long enough to be read as gone -- rather than covered that far once
       while floating past. A label lives a few hundred milliseconds, so 120ms
       buried is gone; a frame or two is two labels passing. */
    await page.evaluate(() => {
      window.__labels = { frames: 0, peak: 0, peakWho: "", longestOver: 0,
                          overWho: "", dup: false, dupText: "" };
      const area = r => r.width * r.height;
      const ov = (a, b) =>
        Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) *
        Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      let runStart = null, started = false;
      (function sample() {
        const s = window.__labels;
        const els = [...document.querySelectorAll("#stage .float")]
          .filter(e => e.offsetParent)
          .map(e => ({ t: e.textContent.trim(), r: e.getBoundingClientRect() }));
        let big = 0, who = "";
        for (let i = 0; i < els.length; i++)
          for (let j = i + 1; j < els.length; j++) {
            const small = Math.min(area(els[i].r), area(els[j].r));
            const frac = small ? ov(els[i].r, els[j].r) / small : 0;
            if (frac > big) { big = frac; who = els[i].t + " / " + els[j].t; }
            /* the sin that started all this: the same words twice, in the same
               place, so one of them may as well not have happened */
            if (els[i].t === els[j].t && ov(els[i].r, els[j].r) > 0.8 * small) {
              s.dup = true; s.dupText = els[i].t;
            }
          }
        const pct = Math.round(big * 100);
        if (pct > s.peak) { s.peak = pct; s.peakWho = who; }
        const now = performance.now();
        if (pct > 92) {
          if (runStart === null) runStart = now;
          if (now - runStart > s.longestOver) { s.longestOver = now - runStart; s.overWho = who; }
        } else runStart = null;
        s.frames++;
        /* installed before Enter, so wait for the hand to START before taking
           "not animating" as the end of it */
        if (G.animating) started = true;
        if (s.frames < 3000 && (!started || G.animating)) requestAnimationFrame(sample);
      })();
    });

    await page.keyboard.press("Enter");
    await page.waitForFunction(() => typeof G !== "undefined" && G && !G.animating,
      null, { timeout: 20000 });

    const seen = await page.evaluate(() => window.__labels);
    expect(seen.frames, "the scoring animation was never sampled").toBeGreaterThan(20);
    expect(seen.dup, "two identical labels landed on each other: " + seen.dupText)
      .toBe(false);
    expect(Math.round(seen.longestOver),
      "a scoring label stayed buried under another (peak " + seen.peak
      + "% on " + (seen.overWho || seen.peakWho) + ")").toBeLessThanOrEqual(120);
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

    /* This used to sleep a flat 340ms and then look, betting that a round trip
       would land inside the figure's beat. The beat is Math.max(400, gap * 4)
       and the look actually arrived anywhere from 368ms to 532ms after Enter,
       so the bet came off most of the time and not always.

       Record the arrivals instead. It also lets the test say what it means:
       the figure's beat is not "400ms", it is LONGER THAN the beat the cards
       get — which is the whole claim, and it holds however the budget is
       retuned. */
    await page.evaluate(() => {
      window.__beats = [];
      new MutationObserver(ms => {
        for (const m of ms) for (const n of m.addedNodes)
          if (n.nodeType === 1 && n.classList && n.classList.contains("float"))
            window.__beats.push({ at: performance.now(), text: n.textContent.trim() });
      }).observe(document.getElementById("stage"), { childList: true, subtree: true });
    });

    await page.keyboard.press("Enter");
    await page.waitForFunction(() => typeof G !== "undefined" && G && !G.animating,
      null, { timeout: 20000 });

    const beats = await page.evaluate(() => window.__beats.map((b, i, a) =>
      ({ text: b.text, gap: i ? Math.round(b.at - a[i - 1].at) : 0 })));
    expect(beats.length, "the hand printed no labels at all").toBeGreaterThan(2);

    /* the figure announces itself first, and by itself */
    expect(beats[0].text, "the figure did not open the hand: "
      + beats.map(b => b.text).join(" | ")).toContain("THE COLUMN");
    expect(beats[0].text, "double space in the label").not.toContain("  ");

    /* and then holds the stage longer than any card that follows it */
    const figureBeat = beats[1].gap;
    const cardBeats = beats.slice(2).map(b => b.gap);
    expect(figureBeat, "the cards started on top of the figure's beat: "
      + JSON.stringify(beats)).toBeGreaterThan(Math.max(...cardBeats));
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

  /* The deal. It is the one thing on the front door that only this game
     could put there, and the whole of its value is that it is TRUE — three
     of the cards the run is about to be played with, not decoration. */
  test("the hand on the menu is the hand the run starts with", async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem("overtone:tutorial", "true"); } catch (e) {}
    });
    await page.goto(GAME);
    const shown = await page.evaluate(() =>
      [].map.call(document.querySelectorAll("#titleDeal .card .wt"), n => n.textContent));
    expect(shown).toHaveLength(3);

    await page.click("#titlePlay");
    const dealt = await page.evaluate(() =>
      [].map.call(document.querySelectorAll("#hand .card .wt"), n => n.textContent).slice(0, 3));
    expect(dealt).toEqual(shown);
  });

  test("and it says so, rather than saying today", async ({ page }) => {
    await page.goto(GAME);
    const cap = page.locator("#titleDeal .cap");
    await expect(cap).toContainText("opening hand");
    await enterGame(page);
    await page.click("#homeBtn");
    /* mid-run those same cards are not an opening hand any more */
    await expect(cap).toContainText("on the table");

    /* toContainText reads textContent and passes on display:none, so say out
       loud where the caption is actually drawn: on a phone the cards go above
       the wordmark, where three cards over the name of the game need no label
       and the label would cost the door its room. */
    const wide = page.viewportSize().width > 880;
    if (wide) await expect(cap).toBeVisible();
    else await expect(cap).toBeHidden();
  });

  test("a finished run is not offered as today's hand", async ({ page }) => {
    /* G outlives the run, so the cards are still sitting there. Captioning a
       dead run as the hand you are about to play would be the menu lying. */
    await page.goto(GAME);
    await page.evaluate(() => { G.over = true; showTitle(); });
    await expect(page.locator("#titleDeal")).toBeHidden();
    /* and the column closes rather than standing empty beside the door */
    await expect(page.locator("#titleCard")).toHaveClass(/solo/);
    await expect(page.locator("#titlePlay")).toBeVisible();
  });

  test("the record shows the numbers that exist and no others", async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("overtone:runs", "6");
        localStorage.setItem("overtone:best", "31000");
        localStorage.setItem("overtone:tutorial", "true");
      } catch (e) {}
    });
    await page.goto(GAME);
    const line = page.locator("#title .runstat");
    await expect(line).toContainText("31,000");
    /* BEST · APPRENTICE none was an empty stat holding room on the one
       screen with none to spare */
    await expect(line).not.toContainText("apprentice");
    /* with one number there is nothing to tell apart, so it is just "best" */
    await expect(line).toContainText("best");
  });

  test("the arrow keys reach every door on it", async ({ page }) => {
    /* The stops used to be .mrow and .segs. They are a button, a segmented
       control, a swap and four text links now, and the walk has to cover all
       of them or part of the menu is keyboard-only by accident. */
    await page.addInitScript(() => {
      try {
        localStorage.setItem("overtone:runs", "4");
        localStorage.setItem("overtone:tutorial", "true");
        localStorage.setItem("overtone:memory", JSON.stringify("chron"));
      } catch (e) {}
    });
    await page.goto(GAME);
    const ids = [];
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press("ArrowDown");
      ids.push(await page.evaluate(() =>
        document.activeElement.id || document.activeElement.className));
    }
    expect(ids[0]).toBe("titlePlay");
    expect(ids[1]).toContain("diffopt");
    expect(ids.slice(2)).toEqual(
      ["titleCarry", "titleHelp", "titleFigs", "titleTut", "titleSound"]);
    /* and the row under the cursor is marked, not just focused */
    await page.keyboard.press("ArrowUp");
    await expect(page.locator("#title .sel")).toHaveCount(1);
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
