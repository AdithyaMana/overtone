/* Engine tests. These run the real shipped script (see harness.js), so a
 * regression in index.html fails here rather than in someone's first run.
 *
 *   npm test
 */
const { test, describe } = require("node:test");
const assert = require("node:assert");
const { load, wholeDeck } = require("./harness.js");

const { api } = load();
const TAG_CODES = Object.keys(api.TAGS);

/* ------------------------------------------------------------------ */
describe("lexicon", () => {
  test("is a decent size and every entry parsed", () => {
    assert.ok(api.LEXICON.length >= 200, "expected 200+ words, got " + api.LEXICON.length);
    for (const e of api.LEXICON) {
      assert.match(e.w, /^[A-Z'-]+$/, "odd word: " + e.w);
      assert.ok(e.t.length >= 1, e.w + " has no overtones");
    }
  });

  test("every overtone is a real one", () => {
    for (const e of api.LEXICON) {
      for (const t of e.t) {
        assert.ok(TAG_CODES.includes(t), e.w + " carries unknown overtone " + t);
      }
    }
  });

  test("no duplicate words", () => {
    const seen = new Set();
    for (const e of api.LEXICON) {
      assert.ok(!seen.has(e.w), "duplicate word: " + e.w);
      seen.add(e.w);
    }
  });

  test("every overtone has enough words to build a round on", () => {
    for (const t of TAG_CODES) {
      const n = api.LEXICON.filter(e => e.t.includes(t)).length;
      assert.ok(n >= 15, api.TAGS[t][0] + " only appears on " + n + " words");
    }
  });
});

/* ------------------------------------------------------------------ */
describe("deck construction", () => {
  test("a run deals exactly 26 distinct words", () => {
    for (let i = 0; i < 40; i++) {
      api.newRun("deck-" + i);
      const all = wholeDeck(api.G);
      assert.strictEqual(all.length, 26, "seed " + i + " deck size");
      const words = new Set(all.map(c => c.w));
      assert.strictEqual(words.size, 26, "seed " + i + " had duplicate words");
    }
  });

  test("no Demand in a run is starved — the unwinnable-round bug", () => {
    /* The lexicon is uneven (FOOD sits on ~21 of 249 words), so a purely
       random deck could deal a Demand with nothing to answer it. Deck
       construction guarantees FLOOR answers per Demand; this holds that line.
       The floor is per Demand, not per overtone: words average 3.2 overtones,
       so a per-overtone floor was satisfiable by cards that all overlapped. */
    const worst = { n: Infinity, where: "" };
    for (let i = 0; i < 200; i++) {
      api.newRun("starve-" + i);
      const all = wholeDeck(api.G);
      api.G.demandOrder.forEach((d, round) => {
        const n = all.filter(c => c.t.some(t => d.tags.includes(t))).length;
        if (n < worst.n) { worst.n = n; worst.where = d.n + " r" + (round + 1) + " seed " + i; }
        assert.ok(n >= 5, "starved: " + d.n + " had " + n + " playable cards (seed " + i + ")");
      });
    }
    assert.ok(worst.n >= 5, "worst case was " + worst.n + " at " + worst.where);
  });

  test("the same seed always produces the same run", () => {
    api.newRun("fixed-seed");
    const a = wholeDeck(api.G).map(c => c.w).sort().join(",");
    const da = api.G.demandOrder.map(d => d.n).join(">");
    api.newRun("fixed-seed");
    const b = wholeDeck(api.G).map(c => c.w).sort().join(",");
    const db = api.G.demandOrder.map(d => d.n).join(">");
    assert.strictEqual(a, b, "deck differed across identical seeds");
    assert.strictEqual(da, db, "demand order differed across identical seeds");
  });

  test("different seeds produce different runs", () => {
    api.newRun("seed-A");
    const a = wholeDeck(api.G).map(c => c.w).sort().join(",");
    api.newRun("seed-B");
    const b = wholeDeck(api.G).map(c => c.w).sort().join(",");
    assert.notStrictEqual(a, b, "two seeds gave an identical deck");
  });
});

/* ------------------------------------------------------------------ */
describe("scoring", () => {
  test("a card is worth 5 + 3 per letter", () => {
    const c = api.makeCard({ w: "VOLCANO", t: ["NAT"] }, false);
    assert.strictEqual(c.base, 5 + 3 * 7);
  });

  test("each matching overtone pays +25", () => {
    api.newRun("score-1");
    api.G.lenses = [];
    api.G.demand = { n: "TEST", tags: ["HEA", "DAN"] };

    const none = api.makeCard({ w: "OAK", t: ["PLA"] }, false);
    const one = api.makeCard({ w: "OAK", t: ["HEA"] }, false);
    const two = api.makeCard({ w: "OAK", t: ["HEA", "DAN"] }, false);

    assert.strictEqual(api.resolve([none]).chips, none.base);
    assert.strictEqual(api.resolve([one]).chips, one.base + 25);
    assert.strictEqual(api.resolve([two]).chips, two.base + 50);
  });

  test("order changes the score — CARNIVORE eats leftward", () => {
    api.newRun("score-2");
    api.G.demand = { n: "TEST", tags: [] };
    const carn = api.LENSES.find(l => l.id === "carn");
    assert.ok(carn, "CARNIVORE missing from the Lens pool");
    api.G.lenses = [carn];

    const wolf = api.makeCard({ w: "WOLF", t: ["ANI"] }, false);
    const oak = api.makeCard({ w: "OAK", t: ["PLA"] }, false);

    const eats = api.resolve([oak, wolf]).total;   // wolf devours oak
    const doesnt = api.resolve([wolf, oak]).total; // wolf is leftmost, eats nothing
    assert.ok(eats > doesnt,
      "order did not matter: " + eats + " vs " + doesnt);
    assert.strictEqual(eats - doesnt, oak.base * 4, "CARNIVORE paid the wrong amount");
  });

  test("chips never go negative and mult never hits zero", () => {
    /* LITERALIST voids abstract words by subtracting their base, which is the
       one rule that can drive the running total below zero. */
    api.newRun("score-3");
    api.G.demand = { n: "TEST", tags: [] };
    api.G.lenses = [api.LENSES.find(l => l.id === "literal")];
    const abstract = api.makeCard({ w: "DOUBT", t: ["ABS", "MIN"] }, false);
    const r = api.resolve([abstract]);
    assert.ok(r.chips >= 0, "chips went negative: " + r.chips);
    assert.ok(r.mult > 0, "mult hit zero: " + r.mult);
    assert.ok(Number.isFinite(r.total), "total was not finite");
  });
});

/* ------------------------------------------------------------------ */
describe("Lenses", () => {
  test("every Lens is well formed", () => {
    for (const l of api.LENSES) {
      assert.ok(l.id && typeof l.id === "string", "Lens without an id");
      assert.ok(l.n && l.n.length, l.id + " has no name");
      assert.ok(l.d && l.d.length > 10, l.id + " has no readable description");
      assert.ok(typeof l.cost === "number" && l.cost > 0, l.id + " has a bad cost");
      assert.ok(l.onCard || l.onPlay, l.id + " never fires");
    }
  });

  test("Lens ids are unique", () => {
    const ids = api.LENSES.map(l => l.id);
    assert.strictEqual(new Set(ids).size, ids.length, "duplicate Lens id");
  });

  test("no Lens throws or produces nonsense on any hand — fuzz", () => {
    /* Lenses read neighbours, letter counts and play size, so the risky
       cases are 1-card plays, edge positions and stacked multipliers. */
    api.newRun("fuzz");
    const rng = api.mulberry32(api.hashStr("fuzz"));
    let plays = 0;

    for (let i = 0; i < 600; i++) {
      const pool = api.LEXICON.slice();
      const hand = [];
      const size = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < size; k++) {
        hand.push(api.makeCard(pool[Math.floor(rng() * pool.length)], false));
      }
      const loadout = [];
      const n = Math.floor(rng() * (api.LENS_SLOTS + 1));
      while (loadout.length < n) {
        const l = api.LENSES[Math.floor(rng() * api.LENSES.length)];
        if (!loadout.includes(l)) loadout.push(l);
      }
      api.G.lenses = loadout;
      const tags = Object.keys(api.TAGS);
      api.G.demand = {
        n: "FUZZ",
        tags: [tags[Math.floor(rng() * tags.length)], tags[Math.floor(rng() * tags.length)]]
      };

      const label = hand.map(c => c.w).join("+") + " with [" + loadout.map(l => l.id).join(",") + "]";
      let r;
      assert.doesNotThrow(() => { r = api.resolve(hand); }, label);
      assert.ok(Number.isFinite(r.chips) && r.chips >= 0, "bad chips on " + label + ": " + r.chips);
      assert.ok(Number.isFinite(r.mult) && r.mult > 0, "bad mult on " + label + ": " + r.mult);
      assert.ok(Number.isFinite(r.total) && r.total >= 0, "bad total on " + label + ": " + r.total);
      assert.ok(Array.isArray(r.events), "no event timeline for " + label);
      plays++;
    }
    assert.strictEqual(plays, 600);
  });

  test("the 'fits your deck' hint only names single-overtone Lenses", () => {
    for (const id of Object.keys(api.LENS_TAG)) {
      const tag = api.LENS_TAG[id];
      assert.ok(api.LENSES.some(l => l.id === id), "LENS_TAG names unknown Lens " + id);
      if (tag !== null) {
        assert.ok(TAG_CODES.includes(tag), id + " maps to unknown overtone " + tag);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
describe("run shape", () => {
  test("targets climb and never plateau", () => {
    for (let i = 1; i < api.TARGETS.length; i++) {
      assert.ok(api.TARGETS[i] > api.TARGETS[i - 1],
        "round " + (i + 1) + " is not harder than round " + i);
    }
    assert.strictEqual(api.TARGETS.length, api.ROUNDS);
  });

  test("the climb is steep enough to force an engine", () => {
    const ratio = api.TARGETS[api.ROUNDS - 1] / api.TARGETS[0];
    assert.ok(ratio >= 15, "final target is only " + ratio.toFixed(1) + "x the first");
  });

  test("a run starts with a full hand and spendable resources", () => {
    api.newRun("shape");
    assert.strictEqual(api.G.hand.length, api.HAND_SIZE);
    assert.strictEqual(api.G.round, 0);
    assert.strictEqual(api.G.plays, 4);
    assert.strictEqual(api.G.discards, 3);
    assert.ok(api.G.bank > 0, "player starts broke");
    assert.strictEqual(api.G.demandOrder.length, api.ROUNDS);
  });

  test("the first shop is always affordable", () => {
    /* Comprehension is the barrier at the Bookseller, not money — this keeps
       that true. Worst case: clear round 1 using every play and discard. */
    const cheapest = Math.min.apply(null, api.LENSES.map(l => l.cost));
    api.newRun("economy");
    const worstReward = 4 + 0 + 0;           // no plays or discards left over
    assert.ok(api.G.bank + worstReward >= cheapest,
      "a player can reach the first shop unable to afford any Lens");
  });

  test("no Demand repeats inside a run", () => {
    for (let i = 0; i < 30; i++) {
      api.newRun("dupe-" + i);
      const names = api.G.demandOrder.map(d => d.n);
      assert.strictEqual(new Set(names).size, names.length, "repeated Demand on seed " + i);
    }
  });
});

/* ------------------------------------------------------------------ */
describe("the Interpreter falls back safely", () => {
  test("the house appraiser always returns usable overtones", () => {
    const words = ["MITOCHONDRIA", "BLOOMBERG", "XYZZY", "AA", "SELF-DOUBT",
                   "firetruck", "happiness", "Q", "ZZZZZZZZZZZZZZZZZZZZ"];
    for (const w of words) {
      const r = api.houseAppraise(w);
      assert.ok(Array.isArray(r.tags), w + " produced no tags array");
      assert.ok(r.tags.length >= 1 && r.tags.length <= 4,
        w + " produced " + r.tags.length + " overtones");
      for (const t of r.tags) {
        assert.ok(TAG_CODES.includes(t), w + " produced unknown overtone " + t);
      }
      assert.strictEqual(new Set(r.tags).size, r.tags.length, w + " produced duplicate overtones");
    }
  });

  test("appraisal is stable for the same word", () => {
    const a = api.houseAppraise("MITOCHONDRIA").tags.join(",");
    const b = api.houseAppraise("MITOCHONDRIA").tags.join(",");
    assert.strictEqual(a, b, "the same word was appraised two different ways");
  });

  test("known vocabulary is read from its shape", () => {
    assert.ok(api.houseAppraise("WILDFIRE").tags.includes("HEA"), "missed HEAT in WILDFIRE");
    assert.ok(api.houseAppraise("GLACIER").tags.includes("COL"), "missed COLD in GLACIER");
    assert.ok(api.houseAppraise("KINDNESS").tags.includes("ABS"), "missed ABSTRACT in KINDNESS");
  });

  test("an interpreted word becomes a real, scorable card", () => {
    api.newRun("interp");
    api.G.demand = { n: "TEST", tags: ["HEA"] };
    api.G.lenses = [];
    const appraised = api.houseAppraise("WILDFIRE");
    const card = api.makeCard({ w: "WILDFIRE", t: appraised.tags }, true);
    assert.strictEqual(card.interpreted, true);
    assert.ok(card.base > 0);
    const r = api.resolve([card]);
    assert.ok(r.total > 0, "an interpreted card scored nothing");
  });
});

/* ------------------------------------------------------------------ */
describe("presentation rules", () => {
  test("every overtone has an icon and a colour", () => {
    for (const t of TAG_CODES) {
      assert.ok(api.ICONS[t], api.TAGS[t][0] + " has no icon");
      assert.match(api.TAG_COLOR[t], /^#[0-9A-Fa-f]{6}$/, api.TAGS[t][0] + " has a bad colour");
    }
  });

  test("bright plates are detected so icons stay legible", () => {
    assert.strictEqual(api.isLightHex("#FFEC27"), true, "arcade yellow read as dark");
    assert.strictEqual(api.isLightHex("#6FD8F5"), true, "pale cyan read as dark");
    assert.strictEqual(api.isLightHex("#1B1B3A"), false, "indigo read as light");
    assert.strictEqual(api.isLightHex("#7E2553"), false, "maroon read as light");
  });

  test("hand names cover every possible number of resonances", () => {
    for (let i = 0; i <= 12; i++) {
      const n = api.resonanceName(i);
      assert.ok(typeof n === "string" && n.length > 0, "no hand name for " + i + " resonances");
    }
    assert.notStrictEqual(api.resonanceName(0), api.resonanceName(1));
  });
});

/* ------------------------------------------------------------------ */
describe("the daily seed", () => {
  /* The daily is a retention mechanic: everyone gets the same deck and the
     same eight Demands on a given date, which is what makes a score worth
     comparing. todayKey() had been trusted rather than tested. */
  const { load } = require("./harness.js");

  function onDate(y, m, d) {
    const h = load();
    const Real = Date;
    h.ctx.Date = class extends Real {
      constructor(...a) { return a.length ? new Real(...a) : new Real(y, m - 1, d, 12, 0, 0); }
      static now() { return new Real(y, m - 1, d, 12, 0, 0).getTime(); }
    };
    return h.api;
  }

  test("the key is a plain sortable date", () => {
    assert.strictEqual(onDate(2026, 9, 14).todayKey(), "2026-09-14");
    assert.strictEqual(onDate(2026, 1, 5).todayKey(), "2026-01-05", "month and day are not zero-padded");
    assert.strictEqual(onDate(2026, 12, 31).todayKey(), "2026-12-31");
  });

  test("the same date gives every player the same run", () => {
    const a = onDate(2026, 9, 14);
    a.newRun(null);
    const deckA = wholeDeck(a.G).map(c => c.w).sort().join(",");
    const demandsA = a.G.demandOrder.map(d => d.n).join(">");

    const b = onDate(2026, 9, 14);
    b.newRun(null);
    assert.strictEqual(wholeDeck(b.G).map(c => c.w).sort().join(","), deckA);
    assert.strictEqual(b.G.demandOrder.map(d => d.n).join(">"), demandsA);
    assert.ok(b.G.isDaily, "a run started with no seed is not flagged as the daily");
  });

  test("the run changes when the date does", () => {
    const a = onDate(2026, 9, 14); a.newRun(null);
    const b = onDate(2026, 9, 15); b.newRun(null);
    assert.notStrictEqual(
      wholeDeck(a.G).map(c => c.w).sort().join(","),
      wholeDeck(b.G).map(c => c.w).sort().join(","),
      "two different days produced an identical deck");
  });

  test("a named seed is not treated as the daily", () => {
    const a = onDate(2026, 9, 14);
    a.newRun("free-abc");
    assert.ok(!a.G.isDaily, "a free run was flagged as the daily");
  });

  test("the year rolls over cleanly", () => {
    const a = onDate(2026, 12, 31); a.newRun(null);
    const b = onDate(2027, 1, 1); b.newRun(null);
    assert.notStrictEqual(a.todayKey(), b.todayKey());
    assert.notStrictEqual(
      wholeDeck(a.G).map(c => c.w).sort().join(","),
      wholeDeck(b.G).map(c => c.w).sort().join(","));
  });
});
