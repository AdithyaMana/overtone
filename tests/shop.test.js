/* The Bookseller.
 *
 * The shop is the round-3 cliff: a player who does not buy a Lens stalls
 * there. Its economy was the least-tested part of the game.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert");
const { load, wholeDeck } = require("./harness.js");

function fresh() {
  const h = load();
  h.api.newRun("shop");
  return h.api;
}

/* Put the player at the first shop with a known purse. */
function atShop(api, bank) {
  api.G.round = 1;
  api.G.bank = bank === undefined ? 13 : bank;
  api.G.offers = api.rollOffers();
  return api.G.offers;
}

/* ------------------------------------------------------------------ */
describe("what the shop offers", () => {
  test("always two Lenses and a word pack", () => {
    const api = fresh();
    for (let i = 0; i < 30; i++) {
      const offers = atShop(api);
      assert.strictEqual(offers.length, 3);
      assert.strictEqual(offers.filter(o => o.kind === "lens").length, 2);
      assert.strictEqual(offers.filter(o => o.kind === "words").length, 1);
    }
  });

  test("never offers a Lens the player already owns", () => {
    const api = fresh();
    api.G.lenses = api.LENSES.slice(0, 5);
    const owned = api.G.lenses.map(l => l.id);
    for (let i = 0; i < 40; i++) {
      for (const o of atShop(api)) {
        if (o.kind === "lens") {
          assert.ok(!owned.includes(o.lens.id), "re-offered an owned Lens: " + o.lens.id);
        }
      }
    }
  });

  test("never offers the same Lens twice in one roll", () => {
    const api = fresh();
    for (let i = 0; i < 40; i++) {
      const ids = atShop(api).filter(o => o.kind === "lens").map(o => o.lens.id);
      assert.strictEqual(new Set(ids).size, ids.length, "duplicate offer in one roll");
    }
  });

  test("every offer is priced within reach of a cleared round", () => {
    const api = fresh();
    for (let i = 0; i < 30; i++) {
      for (const o of atShop(api)) {
        assert.ok(o.cost > 0 && o.cost <= 8, "an offer cost $" + o.cost);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
describe("buying", () => {
  test("a Lens is equipped and paid for", () => {
    const api = fresh();
    const offers = atShop(api, 13);
    const i = offers.findIndex(o => o.kind === "lens");
    const cost = offers[i].cost;
    const id = offers[i].lens.id;

    api.buy(i, 9);

    assert.strictEqual(api.G.bank, 13 - cost, "purse was not charged correctly");
    assert.strictEqual(api.G.lenses.length, 1);
    assert.strictEqual(api.G.lenses[0].id, id);
    assert.strictEqual(api.G.offers[i].bought, true, "offer was not marked sold");
  });

  test("a word pack adds exactly two new words to the deck", () => {
    const api = fresh();
    const offers = atShop(api, 13);
    const i = offers.findIndex(o => o.kind === "words");
    const before = wholeDeck(api.G);
    const beforeWords = new Set(before.map(c => c.w));

    api.buy(i, 9);

    const after = wholeDeck(api.G);
    assert.strictEqual(after.length, before.length + 2, "wrong number of words added");
    const added = after.filter(c => !beforeWords.has(c.w));
    assert.strictEqual(added.length, 2, "added words duplicated existing ones");
  });

  test("an empty purse buys nothing", () => {
    const api = fresh();
    const offers = atShop(api, 0);
    const i = offers.findIndex(o => o.kind === "lens");
    api.buy(i, 9);
    assert.strictEqual(api.G.lenses.length, 0, "bought a Lens with no money");
    assert.strictEqual(api.G.bank, 0, "purse went negative");
  });

  test("the same offer cannot be bought twice", () => {
    const api = fresh();
    const offers = atShop(api, 20);
    const i = offers.findIndex(o => o.kind === "lens");
    api.buy(i, 9);
    const bankAfterFirst = api.G.bank;
    api.buy(i, 9);
    assert.strictEqual(api.G.lenses.length, 1, "bought the same Lens twice");
    assert.strictEqual(api.G.bank, bankAfterFirst, "charged twice for one Lens");
  });

  test("the Lens slots cannot be overfilled", () => {
    const api = fresh();
    api.G.lenses = api.LENSES.slice(0, api.LENS_SLOTS);
    const offers = atShop(api, 50);
    const i = offers.findIndex(o => o.kind === "lens");
    api.buy(i, 9);
    assert.strictEqual(api.G.lenses.length, api.LENS_SLOTS,
      "took on more Lenses than there are slots");
  });
});

/* ------------------------------------------------------------------ */
describe("rerolling", () => {
  test("costs a dollar and changes what is on offer", () => {
    const api = fresh();
    atShop(api, 10);
    const before = api.G.offers.filter(o => o.kind === "lens").map(o => o.lens.id).join(",");

    /* what the reroll button does */
    api.G.bank -= 1;
    api.G.offers = api.rollOffers();

    assert.strictEqual(api.G.bank, 9);
    let changed = false;
    for (let i = 0; i < 12 && !changed; i++) {
      const after = api.G.offers.filter(o => o.kind === "lens").map(o => o.lens.id).join(",");
      if (after !== before) changed = true;
      else api.G.offers = api.rollOffers();
    }
    assert.ok(changed, "twelve rerolls produced the same two Lenses every time");
  });

  test("a reroll never resurrects a sold offer", () => {
    const api = fresh();
    atShop(api, 20);
    const i = api.G.offers.findIndex(o => o.kind === "lens");
    api.buy(i, 9);
    const ownedId = api.G.lenses[0].id;

    api.G.offers = api.rollOffers();
    for (const o of api.G.offers) {
      if (o.kind === "lens") {
        assert.notStrictEqual(o.lens.id, ownedId, "reroll offered a Lens already bought");
      }
    }
  });
});

/* ------------------------------------------------------------------ */
describe("the round reward", () => {
  test("pays a base plus whatever was not spent", () => {
    const api = fresh();
    /* winRound pays 4 + unused plays + unused discards */
    api.G.round = 0;
    api.G.bank = 0;
    api.G.plays = 2;
    api.G.discards = 3;
    api.winRound();
    assert.strictEqual(api.G.bank, 4 + 2 + 3, "reward did not match plays and discards left");
  });

  test("efficiency is worth money, so clearing fast pays more", () => {
    const api = fresh();
    api.G.round = 0; api.G.bank = 0; api.G.plays = 0; api.G.discards = 0;
    api.winRound();
    const slow = api.G.bank;

    const api2 = fresh();
    api2.G.round = 0; api2.G.bank = 0; api2.G.plays = 3; api2.G.discards = 3;
    api2.winRound();
    assert.ok(api2.G.bank > slow, "clearing a round efficiently paid no more than scraping through");
  });
});

/* ------------------------------------------------------------------ */
describe("the ceiling the Bookseller quotes", () => {
  /* This number carries a strong claim — the shop prints it in red and says
     no order of play reaches the target — so it has to be an upper bound on
     what the deck can do, and it was not one. It scored the best hands out of
     a nine-card pool while four plays of three need twelve, so the fourth play
     always scored nothing, and it picked that pool by raw base value while a
     matching tag pays 25 against words averaging 23.
     Playing a real run, round 4 was quoted at 5,040 against a 5,200 target,
     in red, when the deck could actually make 6,115. */

  test("a fourth play is worth more than a third", () => {
    const api = fresh();
    const round = 4;
    api.G.ordealOrder[round] = null;
    const four = api.deckCeiling(round);

    /* THE CLOCK takes the fourth play away and nothing else. */
    api.G.ordealOrder[round] = api.ORDEALS.find(o => o.id === "clock");
    const three = api.deckCeiling(round);

    assert.ok(three > 0, "three plays scored nothing at all");
    assert.ok(four > three,
      "four plays scored no more than three (" + four + " vs " + three
      + ") — the pool has no cards left for the last play");
  });

  test("it is an upper bound: no real hand beats it", () => {
    const api = fresh();
    const round = 2;
    const shape = api.roundShape(round);
    const ceiling = api.deckCeiling(round);

    /* Score the best single hand the whole deck can make against that round,
       by brute force. One play cannot beat what four plays are supposed to
       top out at. */
    const d = api.G.demandOrder[round];
    api.G.demand = { n: d.n, tags: d.tags.slice() };
    api.G.ordeal = api.G.ordealOrder[round] || null;
    const deck = wholeDeck(api.G);
    let best = 0;
    for (let i = 0; i < deck.length; i++)
      for (let j = 0; j < deck.length; j++)
        for (let k = 0; k < deck.length; k++) {
          if (i === j || j === k || i === k) continue;
          const t = api.resolve([deck[i], deck[j], deck[k]]).total;
          if (t > best) best = t;
        }

    assert.ok(shape.plays >= 2, "this round should have more than one play");
    assert.ok(ceiling >= best,
      "the ceiling (" + ceiling + ") is below a hand the deck can actually play ("
      + best + ")");
  });

  test("it counts what the round pays for, not just the biggest words", () => {
    const api = fresh();
    const round = 2;
    const d = api.G.demandOrder[round];
    const deck = wholeDeck(api.G);
    const matching = deck.filter(c => c.t.some(t => d.tags.indexOf(t) >= 0));
    assert.ok(matching.length >= 3, "no matching words to reason about");

    /* Every matching word is worth 25 a tag. A ceiling that ranked its pool by
       base value alone would leave the small matching words out and quote a
       number the deck beats on a single play. */
    const ceiling = api.deckCeiling(round);
    const bigThree = deck.slice().sort((a, b) => b.base - a.base).slice(0, 3);
    assert.ok(ceiling > api.resolve(bigThree).total,
      "the ceiling is no better than playing the three biggest words once");
  });
});
