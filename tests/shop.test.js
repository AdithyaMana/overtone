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
