/* The Lenses that cost you something.
 *
 * They were briefly kept off APPRENTICE's shelf until a player had met one.
 * That made the gentler mode HARDER — six of the biggest multipliers in the
 * game are what its curve is built to be climbed with — so they are back on
 * the shelf for everybody, and what a new player gets instead is the
 * explanation: one card, the first time one is offered.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert");
const { load } = require("../tests/harness.js");

function fresh() {
  const { api } = load();
  api.store.set("runs", 0);
  api.store.set("sawFlaw", false);
  return api;
}

describe("everybody gets them", () => {
  test("the shelf holds them on either difficulty", () => {
    ["apprentice", "scholar"].forEach(id => {
      const api = fresh();
      api.setPref("difficulty", id);
      api.newRun("shelf-" + id);
      let seen = 0;
      for (let i = 0; i < 200; i++) {
        seen += api.rollOffers().filter(o => o.kind === "lens" && o.lens.flaw).length;
      }
      assert.ok(seen > 0,
        id + " was never offered a flawed Lens in 200 shelves — they are the "
        + "most interesting decision in the shop and its curve assumes them");
    });
  });

  test("every mode's round 1 is its own curve's round 1", () => {
    /* `scale` was one number for a whole run and is gone; a mode carries a
       per-round curve now, so the assertion reads the entry rather than
       multiplying by a flat factor. */
    const api = fresh();
    api.DIFFICULTIES.forEach(d => {
      api.setPref("difficulty", d.id);
      api.newRun("curve");
      assert.strictEqual(api.G.target, Math.round(api.TARGETS[0] * d.curve[0]),
        d.n + " round 1 is not its own curve's round 1");
    });
  });

  test("the gentler curve asks for less than the steeper one at every round", () => {
    const api = fresh();
    const byRank = api.DIFF_BY_RANK;
    const gentle = byRank[0], steep = byRank[byRank.length - 1];
    for (let r = 0; r < api.ROUNDS; r++) {
      assert.ok(Math.round(api.TARGETS[r] * gentle.curve[r])
              < Math.round(api.TARGETS[r] * steep.curve[r]),
        "round " + (r + 1) + ": the gentler curve does not ask for less");
    }
  });

  test("and every curve climbs", () => {
    /* The curve this replaced DIPPED at round 2 — it asked for fewer points
       than round 1 — which is why almost nothing ever ended there. */
    const api = fresh();
    api.DIFFICULTIES.forEach(d => {
      for (let r = 1; r < api.ROUNDS; r++) {
        assert.ok(Math.round(api.TARGETS[r] * d.curve[r])
                > Math.round(api.TARGETS[r - 1] * d.curve[r - 1]),
          d.n + " round " + (r + 1) + " asks for less than round " + r);
      }
    });
  });

  test("a curve has exactly one entry per round", () => {
    const api = fresh();
    api.DIFFICULTIES.forEach(d => {
      assert.strictEqual(d.curve.length, api.ROUNDS,
        d.n + " has " + d.curve.length + " curve entries for " + api.ROUNDS + " rounds");
    });
  });
});

describe("the introduction", () => {
  test("is owed to a player who has not had it", () => {
    const api = fresh();
    assert.strictEqual(api.flawsSeen(), false);
  });

  test("and never twice", () => {
    const api = fresh();
    api.store.set("sawFlaw", true);
    assert.strictEqual(api.flawsSeen(), true);
  });

  test("somebody with a run behind them has already met one", () => {
    /* written down on the first boot after the change, not inferred later */
    const { api } = load();
    api.store.set("runs", 4);
    assert.ok(api.store.get("runs", 0) > 0);
  });
});

describe("the shop never quotes a round the player will not get", () => {
  test("shapeFor and startRound agree on both difficulties", () => {
    ["apprentice", "scholar"].forEach(id => {
      const api = fresh();
      api.setPref("difficulty", id);
      api.newRun("agree-" + id);
      for (let r = 0; r < api.TARGETS.length; r++) {
        const quoted = api.shapeFor(r, []);
        api.G.round = r;
        api.startRound();
        assert.strictEqual(api.G.target, quoted.target,
          id + " round " + (r + 1) + ": the shop said " + quoted.target
          + " and the round asked " + api.G.target);
        assert.strictEqual(api.G.discards, quoted.discards,
          id + " round " + (r + 1) + ": discards disagreed");
      }
    });
  });
});
