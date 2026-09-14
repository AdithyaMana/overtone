/* Per-Lens arithmetic.
 *
 * The fuzz in logic.test.js proves no Lens crashes or produces nonsense. It
 * does NOT prove ANTONYM ENGINE pays exactly 120 and doubles. These do: each
 * one builds a controlled hand, scores it with and without the Lens, and
 * asserts the exact difference. A Lens whose numbers are retuned in
 * index.html without updating its test will fail here, which is the point.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert");
const { load } = require("./harness.js");

const { api } = load();

const card = (w, tags) => api.makeCard({ w, t: tags }, false);
const sigil = id => {
  const l = api.LENSES.find(x => x.id === id);
  assert.ok(l, "no Lens with id " + id);
  return l;
};

/* Score a hand with no Lenses, then with one, and hand back both. */
function compare(id, cards, demandTags, ctx) {
  api.newRun("sigil-" + id);
  api.G.demand = { n: "TEST", tags: demandTags || [] };
  if (ctx && typeof ctx.discards === "number") api.G.discards = ctx.discards;

  api.G.lenses = [];
  const without = api.resolve(cards);
  api.G.lenses = [sigil(id)];
  const with_ = api.resolve(cards);
  return { without, with_, chips: with_.chips - without.chips, mult: with_.mult / without.mult };
}

/* ------------------------------------------------------------------ */
describe("flat chip Lenses", () => {
  test("PYROMANIAC pays 45 per HEAT word", () => {
    const one = compare("pyro", [card("EMBER", ["HEA"])]);
    assert.strictEqual(one.chips, 45);
    const two = compare("pyro", [card("EMBER", ["HEA"]), card("FORGE", ["HEA"])]);
    assert.strictEqual(two.chips, 90, "did not pay per word");
    const none = compare("pyro", [card("GLACIER", ["COL"])]);
    assert.strictEqual(none.chips, 0, "paid on a word with no HEAT");
  });

  test("DOOMSAYER pays 55 per DANGER word", () => {
    assert.strictEqual(compare("doom", [card("VENOM", ["DAN"])]).chips, 55);
    assert.strictEqual(compare("doom", [card("MOSS", ["PLA"])]).chips, 0);
  });

  test("METAPHYSICIAN pays 90 per ABSTRACT word", () => {
    assert.strictEqual(compare("meta", [card("DOUBT", ["ABS"])]).chips, 90);
    assert.strictEqual(compare("meta", [card("ANVIL", ["TOO"])]).chips, 0);
  });

  test("CHRONICLER pays 80 per TIME word", () => {
    assert.strictEqual(compare("chron", [card("FOSSIL", ["TIM"])]).chips, 80);
  });

  test("PROSPECTOR pays 100 per MONEY word", () => {
    assert.strictEqual(compare("prosp", [card("BULLION", ["MON"])]).chips, 100);
  });

  test("POLYGLOT pays 70 for a word with four or more overtones", () => {
    assert.strictEqual(compare("poly", [card("AVALANCHE", ["COL", "MOT", "DAN", "LOU"])]).chips, 70);
    assert.strictEqual(compare("poly", [card("OAK", ["PLA", "NAT", "TIM"])]).chips, 0, "fired on three");
  });

  test("SESQUIPEDALIAN pays 150 for a word of nine letters or more", () => {
    assert.strictEqual(compare("sesq", [card("AVALANCHE", ["COL"])]).chips, 150); // 9
    assert.strictEqual(compare("sesq", [card("GLACIER", ["COL"])]).chips, 0);     // 7
  });

  test("LEXICOGRAPHER pays 9 per letter of the leftmost word only", () => {
    const r = compare("lexi", [card("FURNACE", ["HEA"]), card("AVALANCHE", ["COL"])]);
    assert.strictEqual(r.chips, 9 * "FURNACE".length, "did not use the leftmost word");
  });

  test("ALCHEMIST pays 250 only when NATURE and TECH both appear", () => {
    assert.strictEqual(compare("alch", [card("RIVER", ["NAT"]), card("SERVER", ["TEC"])]).chips, 250);
    assert.strictEqual(compare("alch", [card("RIVER", ["NAT"]), card("OAK", ["PLA"])]).chips, 0);
  });

  test("ECHO pays 35 for every overtone two played words share", () => {
    /* one shared overtone */
    assert.strictEqual(compare("echo", [card("RIVER", ["NAT", "WET"]), card("OAK", ["NAT"])]).chips, 35);
    /* two shared */
    assert.strictEqual(compare("echo", [card("RIVER", ["NAT", "WET"]), card("DELTA", ["NAT", "WET"])]).chips, 70);
    /* none shared */
    assert.strictEqual(compare("echo", [card("RIVER", ["NAT"]), card("ANVIL", ["TOO"])]).chips, 0);
  });

  test("MISER pays 40 for each discard still in hand", () => {
    assert.strictEqual(compare("miser", [card("OAK", ["PLA"])], [], { discards: 3 }).chips, 120);
    assert.strictEqual(compare("miser", [card("OAK", ["PLA"])], [], { discards: 0 }).chips, 0);
  });
});

/* ------------------------------------------------------------------ */
describe("mult Lenses", () => {
  test("ZOOLOGIST adds 2 mult per ANIMAL word", () => {
    assert.strictEqual(compare("zoo", [card("WOLF", ["ANI"])]).with_.mult, 3);          // 1 + 2
    assert.strictEqual(compare("zoo", [card("WOLF", ["ANI"]), card("CROW", ["ANI"])]).with_.mult, 5);
    assert.strictEqual(compare("zoo", [card("OAK", ["PLA"])]).with_.mult, 1);
  });

  test("HYDROLOGIST adds 2 mult per WET word", () => {
    assert.strictEqual(compare("hydro", [card("RIVER", ["WET"])]).with_.mult, 3);
  });

  test("PHRENOLOGIST adds 2 mult per MIND word", () => {
    assert.strictEqual(compare("phren", [card("DREAM", ["MIN"])]).with_.mult, 3);
  });

  test("NIGHTWATCH adds 1 mult per DARK word", () => {
    assert.strictEqual(compare("night", [card("CRYPT", ["DAR"])]).with_.mult, 2);
  });

  test("SYNESTHETE triples for a word that is both LOUD and BRIGHT", () => {
    assert.strictEqual(compare("syn", [card("SIREN", ["LOU", "BRI"])]).with_.mult, 3);
    assert.strictEqual(compare("syn", [card("DRUM", ["LOU"])]).with_.mult, 1, "fired on LOUD alone");
  });

  test("BRUTALIST doubles for words of four letters or fewer", () => {
    assert.strictEqual(compare("brut", [card("OAK", ["PLA"])]).with_.mult, 2);
    assert.strictEqual(compare("brut", [card("GLACIER", ["COL"])]).with_.mult, 1);
    /* multiplicative, so two short words compound */
    assert.strictEqual(compare("brut", [card("OAK", ["PLA"]), card("RAT", ["ANI"])]).with_.mult, 4);
  });

  test("GLUTTON multiplies by 2.5 on exactly three words", () => {
    const three = [card("OAK", ["PLA"]), card("RAT", ["ANI"]), card("ASH", ["HEA"])];
    assert.strictEqual(compare("glut", three).with_.mult, 2.5);
    assert.strictEqual(compare("glut", three.slice(0, 2)).with_.mult, 1);
  });

  test("ASCETIC multiplies by 5 on exactly one word", () => {
    assert.strictEqual(compare("asc", [card("OAK", ["PLA"])]).with_.mult, 5);
    assert.strictEqual(compare("asc", [card("OAK", ["PLA"]), card("RAT", ["ANI"])]).with_.mult, 1);
  });

  test("RESONATOR doubles once, on the first matching word only", () => {
    const two = [card("EMBER", ["HEA"]), card("FORGE", ["HEA"])];
    assert.strictEqual(compare("reso", two, ["HEA"]).with_.mult, 2, "fired more than once");
    assert.strictEqual(compare("reso", [card("OAK", ["PLA"])], ["HEA"]).with_.mult, 1);
  });

  test("LITERALIST rewards the concrete and voids the abstract", () => {
    /* concrete: +1 mult each */
    assert.strictEqual(compare("literal", [card("ANVIL", ["TOO"])]).with_.mult, 2);
    assert.strictEqual(compare("literal", [card("ANVIL", ["TOO"]), card("OAK", ["PLA"])]).with_.mult, 3);
    /* abstract: its own base chips are taken back */
    const abs = card("DOUBT", ["ABS"]);
    const r = compare("literal", [abs]);
    assert.strictEqual(r.chips, -abs.base, "abstract word was not voided");
  });
});

/* ------------------------------------------------------------------ */
describe("Lenses that read the hand's shape", () => {
  test("CARNIVORE lets an ANIMAL word devour the word to its left", () => {
    const oak = card("OAK", ["PLA"]);
    const wolf = card("WOLF", ["ANI"]);
    assert.strictEqual(compare("carn", [oak, wolf]).chips, oak.base, "did not eat leftward");
    assert.strictEqual(compare("carn", [wolf, oak]).chips, 0, "ate from the leftmost position");
  });

  test("ANTONYM ENGINE detonates when heat follows cold, and the reverse", () => {
    const cold = card("FROST", ["COL"]);
    const hot = card("EMBER", ["HEA"]);
    const a = compare("anton", [cold, hot]);
    assert.strictEqual(a.chips, 120);
    assert.strictEqual(a.with_.mult, 2);

    const b = compare("anton", [hot, cold]);
    assert.strictEqual(b.chips, 120, "did not fire in the reverse order");

    const neither = compare("anton", [card("OAK", ["PLA"]), card("RAT", ["ANI"])]);
    assert.strictEqual(neither.chips, 0);
  });

  test("ENTROPY doubles per word only while each is shorter than the last", () => {
    const falling = [card("AVALANCHE", ["COL"]), card("RIVER", ["WET"]), card("OAK", ["PLA"])];
    /* fires per card: 2^3 */
    assert.strictEqual(compare("entropy", falling).with_.mult, 8);

    const rising = [card("OAK", ["PLA"]), card("RIVER", ["WET"]), card("AVALANCHE", ["COL"])];
    assert.strictEqual(compare("entropy", rising).with_.mult, 1, "fired on an ascending hand");

    /* a single word is not a descent */
    assert.strictEqual(compare("entropy", [card("OAK", ["PLA"])]).with_.mult, 1);
  });
});

/* ------------------------------------------------------------------ */
describe("coverage", () => {
  test("every Lens in the pool has an arithmetic test", () => {
    /* Guards against adding a Lens and forgetting to pin its numbers. */
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(path.join(__dirname, "lenses.test.js"), "utf8");
    const untested = api.LENSES
      .map(l => l.id)
      .filter(id => !src.includes('compare("' + id + '"'));
    /* Compare length, not the array: LENSES lives in the VM realm, so its
       .map() carries the VM's Array.prototype and deepStrictEqual — which
       checks prototype identity — never matches a host-realm []. */
    assert.strictEqual(untested.length, 0,
      "these Lenses have no arithmetic test: " + untested.join(", "));
  });
});
