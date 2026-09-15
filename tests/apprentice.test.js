/* What APPRENTICE actually is.
 *
 * Not a smaller game — the same game with nothing taken out of your hands
 * mid-run. Every decision survives: which words, in which order, for which
 * figure, against which Lens. What it drops is the Ordeals, because those do
 * not ask a new player to think harder, they take away the tool the tutorial
 * just spent a step teaching and ask the same question with one hand tied.
 *
 * Round 6 killed 14.4% of APPRENTICE runs against round 5's 2.6%, and rounds
 * 4, 6 and 8 are the Ordeal rounds. The number was never what ended them.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert");
const { load } = require("../tests/harness.js");

function on(id, seed) {
  const { api } = load();
  api.setPref("difficulty", id);
  api.newRun(seed || "appr-test");
  return api;
}

function ordealsIn(api) {
  const out = [];
  for (let r = 0; r < api.ROUNDS; r++) {
    if (api.G.ordealOrder[r]) out.push({ round: r, ordeal: api.G.ordealOrder[r] });
  }
  return out;
}

describe("one rule, at the end", () => {
  test("APPRENTICE meets a single Ordeal, and it is round 8", () => {
    const api = on("apprentice");
    const met = ordealsIn(api);
    assert.strictEqual(met.length, 1,
      "APPRENTICE was dealt " + met.length + " Ordeals: "
      + met.map(m => "round " + (m.round + 1) + " " + m.ordeal.n).join(", "));
    assert.strictEqual(met[0].round, api.ROUNDS - 1,
      "the one Ordeal is not the last round, so a run still ends on a number");
  });

  test("SCHOLAR still meets all three", () => {
    const api = on("scholar");
    assert.strictEqual(ordealsIn(api).length, 3,
      "the game as balanced lost its walls");
  });

  test("and it is never one that deletes a mechanic", () => {
    /* THE DROUGHT takes discards, THE LEAN YEAR takes three cards, THE FOG
       makes words worth nothing on their own. Each removes something the
       tutorial taught; the rest make the same game cost more. */
    for (let i = 0; i < 300; i++) {
      const api = on("apprentice", "ban-" + i);
      ordealsIn(api).forEach(m => {
        assert.ok(api.APPRENTICE_ORDEAL_BAN.indexOf(m.ordeal.id) < 0,
          "APPRENTICE was dealt " + m.ordeal.n + ", which takes a tool away");
      });
    }
  });

  test("SCHOLAR can still be dealt all nine", () => {
    const seen = {};
    for (let i = 0; i < 80; i++) {
      ordealsIn(on("scholar", "all-" + i)).forEach(m => { seen[m.ordeal.id] = 1; });
    }
    /* joined, not deepStrictEqual: an array built inside the VM realm has a
       different Array prototype and never compares equal out here, even empty. */
    const missing = load().api.ORDEALS.filter(o => !seen[o.id]).map(o => o.n).join(", ");
    assert.strictEqual(missing, "", "SCHOLAR stopped dealing: " + missing);
  });
});

describe("and no second rule stacked on the one", () => {
  test("THE RECKONING never fires in APPRENTICE", () => {
    for (let i = 0; i < 12; i++) {
      const api = on("apprentice", "reck-" + i);
      /* the runaway build the Reckoning exists to answer, as reckoning.test.js
         defines it — a slice of arbitrary Lenses is not loud enough to fire */
      api.G.lenses = ["curse", "asc", "sesq"].map(id => api.LENSES.find(l => l.id === id));
      api.G.lensState = { sesq: 4000 };
      for (let r = api.RECKON_FROM; r < api.ROUNDS; r++) {
        assert.strictEqual(api.reckonFor(r), null,
          "APPRENTICE round " + (r + 1) + " stacked a second rule on its only one");
      }
    }
  });

  test("but still answers a runaway build in SCHOLAR", () => {
    let fired = 0;
    for (let i = 0; i < 12; i++) {
      const api = on("scholar", "reck-" + i);
      api.G.lenses = ["curse", "asc", "sesq"].map(id => api.LENSES.find(l => l.id === id));
      api.G.lensState = { sesq: 4000 };
      for (let r = api.RECKON_FROM; r < api.ROUNDS; r++) {
        if (api.reckonFor(r)) fired++;
      }
    }
    assert.ok(fired > 0, "the Reckoning stopped firing for everybody, not just APPRENTICE");
  });
});

describe("the same seed is the same words", () => {
  test("changing difficulty changes the curve, not the deck", () => {
    /* The Ordeal pool is filtered AFTER the shuffle for exactly this reason:
       shuffling a shorter list draws fewer numbers from the seeded stream, and
       every draw after it — the deck included — comes out different. */
    const deck = api => api.G.deck.concat(api.G.discard, api.G.hand)
      .map(c => c.w).sort().join(",");
    const hard = on("scholar", "same-seed");
    const easy = on("apprentice", "same-seed");
    assert.strictEqual(deck(easy), deck(hard),
      "APPRENTICE dealt different words for the same seed");
  });

  test("and the Demands are the same too", () => {
    const names = api => api.G.demandOrder.map(d => d.n).join(",");
    assert.strictEqual(names(on("apprentice", "same-seed")),
                       names(on("scholar", "same-seed")),
                       "APPRENTICE asked for different things on the same seed");
  });
});
