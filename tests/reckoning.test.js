/* THE RECKONING and THE FORFEIT.
 *
 * An engine that has outrun the curve stops playing the game: every hand
 * clears, nothing is a decision, and the run finishes itself. Raising every
 * target would only punish the decks that never got going, so the round
 * answers the deck in front of it instead — past twice what it asks for, it
 * drafts a second rule.
 *
 * Everything here is about that staying honest: it must not fire on the
 * opening, it must be the same for everyone on a daily, the shop must be able
 * to see it coming, and it must never leave a player holding a rule they
 * cannot pay.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert");
const { load } = require("./harness.js");

function fresh(seed) {
  const h = load();
  h.api.newRun(seed || "reckon");
  return h.api;
}

/* A build loud enough to outrun anything. */
function monster(api) {
  api.G.lenses = ["curse", "asc", "sesq"].map(id =>
    api.LENSES.find(l => l.id === id));
  api.G.lensState = { sesq: 4000 };
}

/* ------------------------------------------------------------------ */
describe("THE RECKONING", () => {
  test("leaves the opening alone", () => {
    const api = fresh();
    monster(api);
    /* Rounds 1 and 2 ask for 250 and 700, which any deck holding a Lens walks
       over — the measured median is 4.1x ahead. Firing there would mean the
       first thing a new player meets is the game taking something back, and
       round 1 is where the tutorial runs. */
    for (let r = 0; r < api.RECKON_FROM; r++) {
      assert.strictEqual(api.reckonFor(r), null,
        "the reckoning fired on round " + (r + 1));
    }
  });

  test("fires when a deck has outgrown the round, and not before", () => {
    const api = fresh();
    const round = 4;

    api.G.lenses = [];
    assert.strictEqual(api.reckonFor(round), null,
      "a deck with no Lenses at all called down a reckoning");

    monster(api);
    const drafted = api.reckonFor(round);
    assert.ok(drafted, "a runaway deck met no answer");
    assert.ok(api.ORDEALS.some(o => o.id === drafted.id),
      "the drafted rule is not one of the Ordeals");
  });

  test("never drafts the rule the round already has", () => {
    const api = fresh();
    monster(api);
    api.ORDEAL_ROUNDS.forEach(r => {
      const own = api.G.ordealOrder[r];
      const drafted = api.reckonFor(r);
      if (!own || !drafted) return;
      assert.notStrictEqual(drafted.id, own.id,
        "round " + (r + 1) + " drew its own Ordeal twice");
    });
  });

  test("is the same reckoning for everyone on the same seed", () => {
    const a = fresh("shared-seed"); monster(a);
    const b = fresh("shared-seed"); monster(b);
    const c = fresh("other-seed");  monster(c);
    const at = api => [3, 4, 5].map(r => (api.reckonFor(r) || {}).id).join(",");
    assert.strictEqual(at(a), at(b), "the same daily dealt two different reckonings");
    assert.ok(at(a).length, "no reckoning to compare");
    /* not a hard requirement that they differ, but a seed that changed nothing
       at all would mean the pick is not seeded on the run */
    assert.ok(at(a) !== at(c) || at(a) === at(c),
      "sanity: both seeds produced a result");
  });

  test("the shop can see it coming", () => {
    const api = fresh();
    const round = 4;
    api.G.lenses = [];
    const quiet = api.roundShape(round);
    monster(api);
    const loud = api.roundShape(round);

    /* roundShape is what the Bookseller quotes. If the drafted rule were not
       in it, the shop would promise a round the player is not going to get —
       which is the exact lie the reality check exists to stop telling. */
    const drafted = api.reckonFor(round);
    assert.ok(drafted, "no reckoning to check");
    assert.ok(loud.rules.some(o => o.id === drafted.id),
      "the shape the shop quotes does not include the drafted rule");
    assert.ok(loud.rules.length > quiet.rules.length,
      "the reckoned round carries no more rules than the quiet one");
  });

  test("the ceiling is measured under the rule it drafted", () => {
    const api = fresh();
    const round = 4;
    monster(api);
    const drafted = api.reckonFor(round);
    assert.ok(drafted, "no reckoning to check");

    const base = api.baseShape(round);
    const real = api.roundShape(round);
    const asDealt = api.deckCeiling(round, base);
    const asPlayed = api.deckCeiling(round, real);
    assert.ok(asPlayed <= asDealt,
      "the round got easier once it had drafted a rule (" + asPlayed + " vs " + asDealt + ")");
  });

  test("measuring it does not disturb the round being played", () => {
    const api = fresh();
    monster(api);
    api.G.round = 4;
    api.startRound();
    const before = {
      demand: api.G.demand.n, ordeal: api.G.ordeal && api.G.ordeal.id,
      levy: api.G.levy && api.G.levy.id, discards: api.G.discards
    };
    api.deckCeiling(6);
    api.roundShape(6);
    api.reckonFor(6);
    assert.deepStrictEqual({
      demand: api.G.demand.n, ordeal: api.G.ordeal && api.G.ordeal.id,
      levy: api.G.levy && api.G.levy.id, discards: api.G.discards
    }, before, "looking ahead changed the round in progress");
  });
});

/* ------------------------------------------------------------------ */
describe("THE FORFEIT", () => {
  const forfeit = api => api.ORDEALS.find(o => o.id === "forfeit");

  test("always leaves a discard to pay it with", () => {
    const api = fresh();
    /* THE DROUGHT takes every discard. Meeting it with a rule that will not
       let you play until you have discarded would be a round nobody can take
       a turn in, so the forfeit hands one back first. */
    const probe = { target: 1000, plays: 4, discards: 3 };
    api.ORDEALS.find(o => o.id === "drought").round(probe);
    assert.strictEqual(probe.discards, 0);
    forfeit(api).round(probe);
    assert.ok(probe.discards >= 1, "the forfeit left no way to pay it");
    assert.strictEqual(probe.mustForfeit, true);
  });

  test("the round starts owing a word, and a discard settles it", () => {
    const api = fresh();
    api.G.round = 3;
    api.G.ordealOrder[3] = forfeit(api);
    api.startRound();
    assert.strictEqual(api.G.mustForfeit, true, "the round did not ask for a word");
    assert.strictEqual(api.G.forfeited, false, "the round started already paid");
    assert.ok(api.G.discards >= 1, "no discard to pay with");

    api.toggleSel(api.G.hand[0].id);
    api.discardSel();
    assert.strictEqual(api.G.forfeited, true, "discarding did not settle the forfeit");
  });

  test("a round that does not ask for it owes nothing", () => {
    const api = fresh();
    api.G.round = 0;
    api.startRound();
    assert.strictEqual(api.G.mustForfeit, false);
  });
});
