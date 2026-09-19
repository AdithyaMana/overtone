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

/* The schedule and the ban are properties of a mode now, so these read the
   mode rather than naming one — the roles moved once already. */
const gentleId = () => load().api.DIFF_BY_RANK[0].id;
const steepId  = () => { const r = load().api.DIFF_BY_RANK; return r[r.length - 1].id; };

describe("one rule, at the end", () => {
  test("the gentler mode meets a single Ordeal, and it is the last round", () => {
    const api = on(gentleId());
    const met = ordealsIn(api);
    const want = api.DIFF_BY_RANK[0].ordealRounds;
    assert.strictEqual(met.length, want.length,
      "the gentler mode was dealt " + met.length + " Ordeals: "
      + met.map(m => "round " + (m.round + 1) + " " + m.ordeal.n).join(", "));
    assert.strictEqual(met[0].round, api.ROUNDS - 1,
      "the one Ordeal is not the last round, so a run still ends on a number");
  });

  test("the steeper mode meets more of them", () => {
    const api = on(steepId());
    const r = api.DIFF_BY_RANK;
    const steep = r[r.length - 1], gentle = r[0];
    assert.strictEqual(ordealsIn(api).length, steep.ordealRounds.length,
      "the steeper curve lost its walls");
    assert.ok(steep.ordealRounds.length > gentle.ordealRounds.length,
      "the steeper mode does not meet more Ordeals than the gentler one");
  });

  test("and it is never one that deletes a mechanic", () => {
    /* THE DROUGHT takes discards, THE LEAN YEAR takes three cards, THE FOG
       makes words worth nothing on their own. Each removes something the
       tutorial taught; the rest make the same game cost more. The list is
       DISARMING now, and the mode's ban IS that list. */
    for (let i = 0; i < 300; i++) {
      const api = on(gentleId(), "ban-" + i);
      const ban = api.DIFF_BY_RANK[0].ordealBan;
      ordealsIn(api).forEach(m => {
        assert.ok(ban.indexOf(m.ordeal.id) < 0,
          "the gentler mode was dealt " + m.ordeal.n + ", which takes a tool away");
      });
    }
  });

  test("the steeper mode can still be dealt all nine", () => {
    const seen = {};
    for (let i = 0; i < 200; i++) {
      ordealsIn(on(steepId(), "all-" + i)).forEach(m => { seen[m.ordeal.id] = 1; });
    }
    /* joined, not deepStrictEqual: an array built inside the VM realm has a
       different Array prototype and never compares equal out here, even empty. */
    const missing = load().api.ORDEALS.filter(o => !seen[o.id]).map(o => o.n).join(", ");
    assert.strictEqual(missing, "", "the steeper curve stopped dealing: " + missing);
  });

  test("only the LAST Ordeal of a run may be a disarming one", () => {
    /* The wall the measurements chased: an Ordeal that takes discards, cards
       or plays cannot be answered by a player two shops in. */
    const id = steepId();
    for (let i = 0; i < 200; i++) {
      const api = on(id, "slot-" + i);
      const met = ordealsIn(api);
      met.slice(0, -1).forEach(m => {
        assert.ok(api.DISARMING.indexOf(m.ordeal.id) < 0,
          "round " + (m.round + 1) + " was dealt " + m.ordeal.n
          + ", which disarms, before the last slot");
      });
    }
  });
});

describe("and no second rule stacked on the one", () => {
  test("THE RECKONING never fires in a mode that declares reckon:false", () => {
    for (let i = 0; i < 12; i++) {
      const api = on(gentleId(), "reck-" + i);
      assert.strictEqual(api.runDifficulty().reckon, false,
        "the gentler mode now allows a second rule to be drafted");
      /* the runaway build the Reckoning exists to answer, as reckoning.test.js
         defines it — a slice of arbitrary Lenses is not loud enough to fire */
      api.G.lenses = ["curse", "asc", "sesq"].map(id => api.LENSES.find(l => l.id === id));
      api.G.lensState = { sesq: 4000 };
      for (let r = api.RECKON_FROM; r < api.ROUNDS; r++) {
        assert.strictEqual(api.reckonFor(r), null,
          "the gentler mode's round " + (r + 1) + " stacked a second rule on its only one");
      }
    }
  });

  test("but still answers a runaway build where reckon is on", () => {
    let fired = 0;
    for (let i = 0; i < 12; i++) {
      const api = on(steepId(), "reck-" + i);
      api.G.lenses = ["curse", "asc", "sesq"].map(id => api.LENSES.find(l => l.id === id));
      api.G.lensState = { sesq: 4000 };
      for (let r = api.RECKON_FROM; r < api.ROUNDS; r++) {
        if (api.reckonFor(r)) fired++;
      }
    }
    assert.ok(fired > 0,
      "the Reckoning stopped firing for everybody, not just the gentler mode");
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
