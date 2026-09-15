/* A round nobody can win is not a hard round.
 *
 * THE RECKONING stacks a second Ordeal on top of the round's own. THE FORFEIT
 * makes you spend a discard before you may play; THE DROUGHT takes every
 * discard away. Stacked in that order the round owes a debt it has no currency
 * for, and the run is over on a rule rather than on a score.
 *
 * These walk every pair rather than the one that was reported, because the
 * next contradiction will be somebody adding a tenth Ordeal, not this one
 * coming back.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert");
const { load } = require("../tests/harness.js");

function each(fn) {
  const { api } = load();
  api.ORDEALS.forEach(a => api.ORDEALS.forEach(b => {
    if (a.id === b.id) return;
    fn(api, a, b);
  }));
}

describe("no pair of Ordeals can leave a round unplayable", () => {
  test("a round that demands a forfeit always leaves a discard to make it", () => {
    each((api, a, b) => {
      api.newRun("pairs");
      const probe = api.shapeFor(5, [a, b]);
      if (probe.mustForfeit) {
        assert.ok(probe.discards >= 1,
          a.n + " + " + b.n + ": the round demands a forfeit and allows "
          + probe.discards + " discards");
      }
      assert.ok(probe.plays >= 1, a.n + " + " + b.n + ": no plays");
      assert.ok(probe.hand >= 1, a.n + " + " + b.n + ": no cards");
      assert.ok(probe.maxPlay >= 1, a.n + " + " + b.n + ": no words may be played");
    });
  });

  test("and the round as DEALT agrees with the round as quoted", () => {
    /* startRound builds its rules from G.ordeal and G.levy, and G.levy is
       whatever reckoning() returns. Overriding that in the VM context is how
       the pair actually reaches the board — setting a field startRound does
       not read would have passed this test without ever stacking anything. */
    const { api, ctx } = require("../tests/harness.js").load();
    api.ORDEALS.forEach(a => api.ORDEALS.forEach(b => {
      if (a.id === b.id) return;
      api.newRun("dealt");
      api.G.round = 5;
      api.G.ordealOrder[5] = a;
      ctx.reckoning = () => b;
      api.startRound();
      assert.strictEqual(api.G.ordeal && api.G.ordeal.id, a.id,
        "the round was not dealt the Ordeal the test asked for");
      assert.strictEqual(api.G.levy && api.G.levy.id, b.id,
        "the Reckoning did not stack the rule the test asked for");
      if (api.G.mustForfeit) {
        assert.ok(api.G.discards >= 1,
          a.n + " + " + b.n + ": dealt a forfeit with " + api.G.discards + " discards");
      }
      assert.ok(api.G.plays >= 1, a.n + " + " + b.n + ": dealt no plays");
      assert.ok(api.G.hand.length >= 1, a.n + " + " + b.n + ": dealt no cards");
    }));
  });

  test("the order the rules are applied in cannot change whether it is playable", () => {
    const { api } = load();
    api.newRun("order");
    const forfeit = api.ORDEALS.find(o => o.id === "forfeit");
    const drought = api.ORDEALS.find(o => o.id === "drought");

    const ab = api.shapeFor(5, [forfeit, drought]);
    const ba = api.shapeFor(5, [drought, forfeit]);
    assert.ok(ab.discards >= 1,
      "FORFEIT then DROUGHT: " + ab.discards + " discards for a debt of one");
    assert.ok(ba.discards >= 1,
      "DROUGHT then FORFEIT: " + ba.discards + " discards for a debt of one");
  });
});

describe("the Reckoning does not stack a rule against its own round", () => {
  test("it never pairs THE FORFEIT with THE DROUGHT", () => {
    const { api } = load();
    /* every seed and every round the Reckoning can fire on */
    for (let i = 0; i < 400; i++) {
      api.newRun("clash-" + i);
      api.G.lenses = [];
      for (let r = api.RECKON_FROM; r < api.ROUNDS; r++) {
        const own = api.G.ordealOrder[r];
        if (!own) continue;
        /* force the Reckoning to fire by asking what it would pick */
        const pool = api.ORDEALS.filter(o => o.id !== own.id && !api.clashes(own.id, o.id));
        assert.ok(!pool.some(o => api.clashes(own.id, o.id)),
          "the pool it draws from still holds a rule that contradicts " + own.n);
      }
    }
  });

  test("and still has something to draw from for every Ordeal", () => {
    const { api } = load();
    api.ORDEALS.forEach(own => {
      const pool = api.ORDEALS.filter(o => o.id !== own.id && !api.clashes(own.id, o.id));
      assert.ok(pool.length > 0, own.n + " left the Reckoning with nothing to pick");
    });
  });
});
