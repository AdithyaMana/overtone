/* The shape of the hand.
 *
 * Figures are the one part of scoring that reads the letters rather than the
 * tags, and the only part a player can change without changing which cards they
 * hold — so the tests that matter here are about ORDER, about what counts as
 * binding every word, and about the figure landing early enough that a Lens
 * still multiplies it.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert");
const { load } = require("./harness.js");

const { api } = load();
const card = w => api.makeCard({ w, t: [] }, false);
const hand = (...words) => words.map(card);
const name = (...words) => { const f = api.figureFor(hand(...words)); return f ? f.id : null; };

/* Score a hand with no Lenses and a round that wants nothing, so the only thing
   moving the numbers is the figure itself. */
function bare(cards, lensIds) {
  api.newRun("figures");
  api.G.demand = { n: "TEST", tags: [] };
  api.G.lenses = (lensIds || []).map(id => api.LENSES.find(l => l.id === id));
  api.G.lensState = {};
  return api.resolve(cards);
}

/* ================================================================== */
describe("what makes a figure", () => {
  test("THE PAIR is two words of the same length", () => {
    assert.strictEqual(name("OAK", "ELM"), "pair");
    assert.strictEqual(name("OAK", "MOSS"), null, "3 and 4 is not a pair");
  });

  test("THE COLUMN is three of exactly the same length", () => {
    assert.strictEqual(name("MOSS", "TIDE", "WOLF"), "column");
    assert.strictEqual(name("MOSS", "TIDE", "EMBER"), "pair", "two of three is only a pair");
  });

  test("THE STAIR climbs or falls by the same step, either way round", () => {
    assert.strictEqual(name("OAK", "MOSS", "EMBER"), "stair", "3, 4, 5");
    assert.strictEqual(name("EMBER", "MOSS", "OAK"), "stair", "5, 4, 3");
    assert.strictEqual(name("OAK", "EMBER", "FURNACE"), "stair", "3, 5, 7");
    assert.strictEqual(name("OAK", "MOSS", "FURNACE"), null, "3, 4, 7 is an uneven step");
    assert.strictEqual(name("MOSS", "OAK", "EMBER"), null,
      "the same three words out of order are not a stair, and 4/3/5 is not a pair");
  });

  test("THE MONOGRAM wants every word on the same letter", () => {
    assert.strictEqual(name("MOSS", "MEMORY"), "mono");
    assert.strictEqual(name("MOSS", "MEMORY", "MARBLE"), "mono");
    assert.strictEqual(name("MOSS", "MEMORY", "TIDE"), "pair",
      "one word off the M breaks it, and you drop to the floor");
    assert.strictEqual(name("MOSS", "MEMORY", "OAK"), null, "with no floor left, nothing");
  });

  test("THE CHAIN wants each word to open where the last one closed", () => {
    assert.strictEqual(name("OAK", "KILN"), "chain", "oaK then Kiln");
    assert.strictEqual(name("OAK", "KILN", "NEEDLE"), "chain", "kilN then Needle");
    assert.strictEqual(name("KILN", "OAK"), null, "the link only runs one way");
  });

  test("one word is never a figure, and neither is none", () => {
    assert.strictEqual(api.figureFor(hand("FURNACE")), null);
    assert.strictEqual(api.figureFor([]), null);
    assert.strictEqual(api.figureFor(null), null);
  });

  test("a figure has to bind every word you play, and THE PAIR is the floor", () => {
    /* OAK then KILN chains. Lay a word beside them that does not, and the chain
       is gone — but two 4-letter words still leave you the floor. */
    assert.strictEqual(name("OAK", "KILN"), "chain");
    assert.strictEqual(name("OAK", "KILN", "MOSS"), "pair", "KILN and MOSS are both 4");
    assert.strictEqual(name("OAK", "KILN", "FURNACE"), null, "nothing left at all");
  });
});

/* ================================================================== */
describe("which figure pays", () => {
  test("only the best one does", () => {
    /* MOSS / MARSH / MEMORY are all on M, and 4, 5, 6 is an even step. Both
       figures are there; the rarer one is the one that pays. */
    const both = api.figuresIn(hand("MOSS", "MARSH", "MEMORY")).map(f => f.id);
    assert.strictEqual(both.join(","), "mono,stair");
    assert.strictEqual(api.figureFor(hand("MOSS", "MARSH", "MEMORY")).id, "mono");
  });

  test("the pay table never rewards an easier figure more", () => {
    /* Measured reachability from a seven-card hand, hardest first: monogram of
       three 8%, chain of three 36%, column 55%, monogram of two 74%, chain of
       two 87%, stair 87%, pair almost always. If a retune ever puts these out
       of order the ladder has stopped meaning anything. */
    const ladder = [
      api.FIG_PAY.mono[3], api.FIG_PAY.chain[3], api.FIG_PAY.column[3],
      api.FIG_PAY.mono[2], api.FIG_PAY.chain[2], api.FIG_PAY.stair[3],
      api.FIG_PAY.pair[2]
    ];
    for (let i = 1; i < ladder.length; i++) {
      assert.ok(api.figValue(ladder[i]) <= api.figValue(ladder[i - 1]),
        "rung " + i + " pays more than the harder figure above it");
      assert.ok(ladder[i].mult >= 1 && ladder[i].chips > 0, "every figure pays something");
    }
  });

  test("a figure binding three words beats the same figure binding two", () => {
    ["mono", "chain"].forEach(id => {
      assert.ok(api.figValue(api.FIG_PAY[id][3]) > api.figValue(api.FIG_PAY[id][2]), id);
    });
  });
});

/* ================================================================== */
describe("the figure in the score", () => {
  test("it adds its points and its multiplier to a bare hand", () => {
    const pay = api.FIG_PAY.column[3];
    const cards = hand("MOSS", "TIDE", "WOLF");
    const words = cards.reduce((s, c) => s + c.base, 0);
    const r = bare(cards);
    assert.strictEqual(r.chips, words + pay.chips);
    assert.strictEqual(r.mult, 1 + pay.mult);
  });

  test("it lands before the Lenses, so a Lens that multiplies multiplies it", () => {
    /* BRUTALIST is ×1.6 on every word of four letters or fewer. Three of them
       is also THE COLUMN. If the figure were a bonus stapled on at the end the
       multiplier would be 1 × 1.6³ + 3; it is (1 + 3) × 1.6³. */
    const r = bare(hand("MOSS", "TIDE", "WOLF"), ["brut"]);
    const want = (1 + api.FIG_PAY.column[3].mult) * Math.pow(1.6, 3);
    assert.ok(Math.abs(r.mult - want) < 1e-9, "got " + r.mult + ", wanted " + want);
  });

  test("a hand with no figure scores exactly as it did before figures existed", () => {
    const cards = hand("OAK", "KILN", "FURNACE");
    assert.strictEqual(api.figureFor(cards), null);
    const r = bare(cards);
    assert.strictEqual(r.chips, cards.reduce((s, c) => s + c.base, 0));
    assert.strictEqual(r.mult, 1);
  });

  test("the board is told about it, by name, before anything else", () => {
    const r = bare(hand("MOSS", "TIDE", "WOLF"));
    const ev = r.events.filter(e => e.fig);
    assert.strictEqual(ev.length, 1, "exactly one figure event");
    assert.strictEqual(ev[0].fig, "column");
    assert.strictEqual(ev[0].txt.indexOf("THE COLUMN"), 0, "should lead with the name: " + ev[0].txt);
    assert.strictEqual(r.events.indexOf(ev[0]), 0, "and it should come first");
  });
});

/* ================================================================== */
describe("the nudge that says you have it in the wrong order", () => {
  test("it names the better figure these same words would make", () => {
    /* 4, 3, 5 is nothing. 3, 4, 5 is THE STAIR. */
    const better = api.figureByReorder(hand("MOSS", "OAK", "EMBER"));
    assert.ok(better, "should have found the stair");
    assert.strictEqual(better.id, "stair");
  });

  test("it stays quiet when the order you have is already the best one", () => {
    assert.strictEqual(api.figureByReorder(hand("OAK", "MOSS", "EMBER")), null, "already a stair");
    assert.strictEqual(api.figureByReorder(hand("MOSS", "TIDE", "WOLF")), null,
      "a column reads the same in any order");
    assert.strictEqual(api.figureByReorder(hand("OAK", "KILN", "FURNACE")), null,
      "no order of these makes anything");
    assert.strictEqual(api.figureByReorder(hand("FURNACE")), null, "one word");
  });

  test("it will not talk you out of the better hand", () => {
    /* OAK then KILN is a chain; reversed it is nothing at all. */
    assert.strictEqual(api.figureByReorder(hand("OAK", "KILN")), null);
  });
});

/* ================================================================== */
describe("figures against the real deck", () => {
  test("every word in the lexicon can be read as a shape", () => {
    api.newRun("figures-deck", true);
    const deck = api.G.deck.concat(api.G.hand, api.G.discard);
    assert.ok(deck.length > 20, "expected a real deck, got " + deck.length);
    deck.forEach(c => {
      assert.ok(/^[A-Z]+$/.test(String(c.w).toUpperCase()),
        "a word the figure rules cannot read: " + c.w);
      assert.ok(c.w.length >= 2, "a one-letter word would make THE CHAIN meaningless: " + c.w);
    });
  });

  test("a hand's worth of orderings never throws and never invents a figure", () => {
    api.newRun("figures-fuzz", true);
    const deck = api.G.deck.concat(api.G.hand, api.G.discard);
    const rng = api.mulberry32(api.hashStr("fuzz"));
    for (let t = 0; t < 800; t++) {
      const n = 1 + Math.floor(rng() * 3);
      const cards = [];
      while (cards.length < n) cards.push(deck[Math.floor(rng() * deck.length)]);
      const f = api.figureFor(cards);
      if (!f) continue;
      assert.ok(n > 1, "a single word made " + f.id);
      assert.ok(api.FIG_PAY[f.id], "unknown figure " + f.id);
      assert.ok(f.chips > 0 && f.mult > 0, f.id + " paid nothing");
      assert.ok(api.figuresIn(cards).some(x => x.id === f.id),
        "the best figure should be one of the figures");
    }
  });
});
