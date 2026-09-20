/* The shape of the hand.
 *
 * This file used to test the orthographic figures - THE PAIR, THE COLUMN, THE
 * STAIR, THE MONOGRAM, THE CHAIN - which read the letters of a word and not
 * its meaning. The JOIN rebuild deleted them, and with them the split where
 * the poetic layer and the mechanical layer never touched each other. A hand
 * is now what a LINE makes, out of what each adjacent pair of words does.
 *
 * So the tests that matter here are about ORDER, about which hands a given run
 * of joins makes, about every hand a line makes being paid rather than only
 * the best one, and about the hands landing early enough that a Lens still
 * multiplies them.
 *
 * Fixtures name their overtones rather than borrowing real lexicon words:
 * every assertion below is a statement about a particular arrangement of
 * shared and opposed tags, and a real word would only hide it. The opposed
 * pairs these are built from are HEAT/COLD, DARK/BRIGHT, NATURE/TECH,
 * MIND/BODY, WET/HEAT and ABSTRACT against BODY, FOOD and TOOL.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert");
const { load } = require("./harness.js");

const { api } = load();
api.newRun("figures");

const card = (w, tags) => api.makeCard({ w, t: tags || [] }, false);

/* Dullness is a property of a run in progress; these are statements about two
   words, so it is cleared before every reading. */
function line(...cards) { api.G.dull = {}; return cards; }
/* Joined to a string, NOT compared as an array: api.figuresIn() hands back an
   array carrying the VM realm's Array.prototype, and deepStrictEqual checks
   prototype identity - a cross-realm [] never equals a host []. lenses.test.js
   has been bitten by this twice. */
const ids = (...cards) => api.figuresIn(line(...cards)).map(f => f.id).join(",");
const best = (...cards) => {
  const f = api.figureFor(line(...cards));
  return f ? f.id : null;
};

/* The five hands, each as the smallest line that makes it. */
const CLASH  = () => [card("EMBER", ["HEA"]), card("GLACIER", ["COL"])];
const TWIST  = () => [card("EMBER", ["NAT", "HEA"]), card("GLACIER", ["NAT", "COL"])];
const CHORUS = () => [card("THICKET", ["NAT", "PLA", "ANI"]),
                      card("MEADOW",  ["NAT", "PLA", "ANI"])];
/* one shared overtone, then two: the line climbs */
const BUILD  = () => [card("TIDE", ["NAT"]), card("MOSS", ["NAT", "PLA"]),
                      card("OAK",  ["NAT", "PLA"])];
/* opposed, alike, opposed - the same read either way */
const MIRROR = () => [card("EMBER", ["HEA"]), card("GLACIER", ["COL", "MIN"]),
                      card("DOUBT", ["MIN"]), card("BONE", ["BOD"])];

/* Score a line with no Lenses and a round that wants nothing, so the only
   things moving the numbers are the joins, the hands and the words. */
function bare(cards, lensIds) {
  api.newRun("figures");
  api.G.dull = {};
  api.G.demand = { n: "TEST", tags: [] };
  api.G.lenses = (lensIds || []).map(id => api.LENSES.find(l => l.id === id));
  api.G.lensState = {};
  return api.resolve(cards);
}
const bases = cards => cards.reduce((s, c) => s + c.base, 0);

/* ================================================================== */
describe("what a line makes", () => {
  test("THE CLASH is two words that mean opposite things", () => {
    assert.strictEqual(ids(...CLASH()), "antithesis");
    /* and two words with nothing to say to each other make nothing */
    assert.strictEqual(ids(card("MOSS", ["NAT"]), card("ANVIL", ["TOO"])), "");
  });

  test("THE TWIST is alike and opposite at the same time", () => {
    assert.strictEqual(ids(...TWIST()), "paradox");
    /* Take the shared overtone away and the same opposition is only a clash.
       The rare thing is holding both at once, not the opposition itself. */
    assert.strictEqual(ids(card("EMBER", ["HEA"]), card("GLACIER", ["COL"])),
      "antithesis");
  });

  test("THE CHORUS wants three things in common, not two", () => {
    assert.strictEqual(ids(...CHORUS()), "synonymy");
    assert.strictEqual(
      ids(card("THICKET", ["NAT", "PLA"]), card("MEADOW", ["NAT", "PLA"])), "",
      "two shared overtones is a join, not a hand");
  });

  test("THE BUILD has to climb the whole way, not somewhere", () => {
    assert.strictEqual(ids(...BUILD()), "escalation");
    /* It used to fire if ANY adjacent pair happened to rise, which is nearly
       every line of three words: measured at 98% of optimal plays. */
    const [a, b, c] = BUILD();
    assert.strictEqual(ids(b, c, a), "", "2 then 1 does not climb");
    assert.strictEqual(
      ids(card("A", ["NAT"]), card("B", ["NAT"]), card("C", ["NAT"])), "",
      "1 then 1 is level, and level is not a climb");
  });

  test("THE MIRROR has to hold end to end", () => {
    assert.ok(ids(...MIRROR()).split(",").includes("chiasmus"));
    /* Three joins minimum, because two the same is not a shape */
    const [a, b, c] = MIRROR();
    assert.ok(!ids(a, b, c).split(",").includes("chiasmus"), "two joins cannot mirror");
    /* and the pairs have to mirror in what they ARE and in how much they
       share, not merely in kind: four words on one shared overtone read the
       same backwards and are not a mirror of anything. */
    assert.strictEqual(
      ids(card("A", ["NAT"]), card("B", ["NAT"]),
          card("C", ["NAT"]), card("D", ["NAT"])), "",
      "a line of identical joins is not a mirror");
  });

  test("one word is never a hand, and neither is none", () => {
    assert.strictEqual(api.figureFor([card("FURNACE", ["HEA"])]), null);
    assert.strictEqual(api.figureFor([]), null);
    assert.strictEqual(api.figureFor(null), null);
  });
});

/* ================================================================== */
describe("order is the decision", () => {
  test("the same three words make a hand one way round and nothing the other", () => {
    const [a, b, c] = BUILD();
    assert.strictEqual(best(a, b, c), "escalation");
    assert.strictEqual(best(c, b, a), null);
  });

  test("a pair with nothing in common stops the line, so what is past it never lands", () => {
    /* EMBER and GLACIER are alike and opposite at once wherever they meet.
       Put a word between them that neither of them can reach and the line
       stops before it starts - the hand is not merely reduced, it is gone. */
    const [hot, cold] = TWIST();
    assert.strictEqual(ids(hot, cold), "paradox");
    const wedge = card("ANVIL", ["TOO"]);
    assert.strictEqual(ids(hot, wedge, cold), "");
    assert.strictEqual(api.joinsOf(line(hot, wedge, cold)).scored, 1,
      "one word scored, and the two after it written for nothing");
  });
});

/* ================================================================== */
describe("which hand pays", () => {
  test("every hand your line makes pays, not only the best one", () => {
    const m = MIRROR();
    assert.strictEqual(ids(...m), "chiasmus,antithesis");
    const r = bare(m);
    const pay = api.FIG_PAY;
    assert.strictEqual(r.chips - bases(m) - api.JOIN_RESONANCE,
      pay.chiasmus.chips + pay.antithesis.chips,
      "both hands should have paid their points");
    /* 1, plus one for each of the two oppositions, plus the mirror's own +2 */
    assert.strictEqual(r.mult, 1 + 2 * api.JOIN_TENSION
      + pay.chiasmus.mult + pay.antithesis.mult);
  });

  test("the table reads hardest first, and the pay ladder agrees with it", () => {
    /* FIGURES is the display order and the priority order at once, so a retune
       that makes an easier hand pay more silently breaks both. */
    const ladder = api.FIGURES.map(f => api.figValue(api.FIG_PAY[f.id]));
    for (let i = 1; i < ladder.length; i++)
      assert.ok(ladder[i] < ladder[i - 1],
        api.FIGURES[i].n + " pays as much as the harder hand above it");
    api.FIGURES.forEach(f => {
      const p = api.FIG_PAY[f.id];
      assert.ok(p && p.chips > 0, f.n + " pays no points");
      assert.ok(p.mult >= 0, f.n + " has a negative multiplier");
    });
  });

  test("figureFor hands back the best-paying one of them", () => {
    assert.strictEqual(best(...MIRROR()), "chiasmus");
  });
});

/* ================================================================== */
describe("the hand in the score", () => {
  test("it adds its points and its multiplier to the line", () => {
    const c = CLASH();
    const r = bare(c);
    /* an opposition pays no points, so the only points here are the words and
       the hand they make */
    assert.strictEqual(r.chips, bases(c) + api.FIG_PAY.antithesis.chips);
    assert.strictEqual(r.mult, 1 + api.JOIN_TENSION + api.FIG_PAY.antithesis.mult);
  });

  test("it lands before the Lenses, so a Lens that multiplies multiplies it", () => {
    /* BRUTALIST is x1.6 on every word carrying a single overtone. Three of the
       mirror's four words do. If the hand were a bonus stapled on at the end
       the multiplier would be 3 x 1.6^3 + 2; it is (3 + 2) x 1.6^3. */
    const m = MIRROR();
    const plain = bare(m);
    const withLens = bare(m, ["brut"]);
    const want = plain.mult * Math.pow(1.6, 3);
    assert.ok(Math.abs(withLens.mult - want) < 1e-9,
      "got " + withLens.mult + ", wanted " + want);
  });

  test("a line that makes no hand is worth its words and its joins, and no more", () => {
    const cards = [card("MOSS", ["NAT"]), card("TIDE", ["NAT"])];
    assert.strictEqual(ids(...cards), "");
    const r = bare(cards);
    assert.strictEqual(r.chips, bases(cards) + api.JOIN_RESONANCE);
    assert.strictEqual(r.mult, 1);
  });

  test("the board is told about it by name, after the joins and before the words", () => {
    const r = bare(MIRROR());
    const figs = r.events.filter(e => e.fig);
    assert.strictEqual(figs.map(e => e.fig).join(","), "chiasmus,antithesis");
    figs.forEach(e => {
      const f = api.FIGURES.find(x => x.id === e.fig);
      assert.strictEqual(e.txt.indexOf(f.n), 0, "should lead with the name: " + e.txt);
    });
    /* The joins are what MADE the hand, so they are read first; the words are
       counted after, which is what lets a Lens on a word multiply the hand. */
    const lastJoin = r.events.map(e => e.k).lastIndexOf("join");
    const firstFig = r.events.indexOf(figs[0]);
    const firstCard = r.events.findIndex(e => e.k === "card" && !e.fig);
    assert.ok(lastJoin < firstFig, "a hand was announced before the joins that made it");
    assert.ok(firstFig < firstCard, "the words were counted before the hand");
  });
});

/* ================================================================== */
describe("the nudge that says you have it in the wrong order", () => {
  test("it names the better hand these same words would make", () => {
    const [a, b, c] = BUILD();
    const better = api.figureByReorder(line(c, b, a));
    assert.ok(better, "should have found the build");
    assert.strictEqual(better.id, "escalation");
  });

  test("it stays quiet when the order you have is already the best one", () => {
    assert.strictEqual(api.figureByReorder(line(...BUILD())), null, "already a build");
    assert.strictEqual(api.figureByReorder(line(...CLASH())), null,
      "a clash reads the same either way round");
    assert.strictEqual(
      api.figureByReorder(line(card("MOSS", ["NAT"]), card("ANVIL", ["TOO"]))), null,
      "no order of these makes anything");
    assert.strictEqual(api.figureByReorder(line(card("FURNACE", ["HEA"]))), null,
      "one word");
  });

  test("it does not search a five-word line, and says so by staying quiet", () => {
    /* 120 orderings on every click. The nudge is worth having and is not worth
       that, so it looks past four. */
    const five = BUILD().concat(CLASH());
    assert.strictEqual(api.figureByReorder(line(...five)), null);
  });
});

/* ================================================================== */
describe("hands against the real deck", () => {
  test("every word in the lexicon carries at least one overtone", () => {
    api.newRun("figures-deck", true);
    const deck = api.G.deck.concat(api.G.hand, api.G.discard);
    assert.ok(deck.length > 20, "expected a real deck, got " + deck.length);
    deck.forEach(c => {
      assert.ok(Array.isArray(c.t) && c.t.length >= 1,
        "a word nothing can ever join to: " + c.w);
      c.t.forEach(t => assert.ok(api.TAGS[t], c.w + " carries an unknown overtone " + t));
    });
  });

  test("a hand's worth of orderings never throws and never invents a hand", () => {
    api.newRun("figures-fuzz", true);
    api.G.dull = {};
    const deck = api.G.deck.concat(api.G.hand, api.G.discard);
    const rng = api.mulberry32(api.hashStr("fuzz"));
    for (let t = 0; t < 800; t++) {
      const n = 1 + Math.floor(rng() * 5);
      const cards = [];
      while (cards.length < n) cards.push(deck[Math.floor(rng() * deck.length)]);
      const made = api.figuresIn(cards);
      const f = api.figureFor(cards);
      if (!f) {
        assert.strictEqual(made.length, 0, "a best hand should exist if any do");
        continue;
      }
      assert.ok(n > 1, "a single word made " + f.id);
      assert.ok(api.FIG_PAY[f.id], "unknown hand " + f.id);
      assert.ok(f.chips > 0 && f.mult >= 0, f.id + " paid nothing");
      assert.strictEqual(made[0].id, f.id, "the best hand should be the first one listed");
      /* a hand can only be made out of joins the line actually reads */
      assert.ok(api.joinsOf(cards).joins.length >= 1, f.id + " came out of no joins");
    }
  });
});
