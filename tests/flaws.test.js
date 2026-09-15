/* The flawed Lenses, and who is ready for them.
 *
 * APPRENTICE keeps them off the shelf until the player has met one in SCHOLAR.
 * The rules that matter are that the gentler mode does not become the harder
 * one by losing its ceiling, that the shop never quotes a target the round will
 * not ask for, and that nobody is shown a rule they cannot encounter.
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

describe("who gets the flawed Lenses", () => {
  test("a first-timer on APPRENTICE does not", () => {
    const api = fresh();
    api.setPref("difficulty", "apprentice");
    assert.strictEqual(api.flawsOpen(), false);
  });

  test("SCHOLAR always does, met one or not", () => {
    const api = fresh();
    api.setPref("difficulty", "scholar");
    assert.strictEqual(api.flawsOpen(), true,
      "the game as balanced was missing six of its Lenses");
  });

  test("once met, APPRENTICE does too", () => {
    const api = fresh();
    api.setPref("difficulty", "apprentice");
    assert.strictEqual(api.flawsOpen(), false);
    api.store.set("sawFlaw", true);
    assert.strictEqual(api.flawsOpen(), true,
      "a mechanic was taken back off a player who had already learned it");
  });

  test("the shelf holds none of them while the drawer is shut", () => {
    const api = fresh();
    api.setPref("difficulty", "apprentice");
    api.newRun("shelf-test");
    /* roll it enough times that a 6-in-30 draw would have shown up */
    for (let i = 0; i < 200; i++) {
      const offers = api.rollOffers();
      const flawed = offers.filter(o => o.kind === "lens" && o.lens.flaw);
      assert.strictEqual(flawed.length, 0,
        "a flawed Lens reached a shelf it was meant to be off: " +
        flawed.map(o => o.lens.n).join(", "));
    }
  });

  test("and holds them again once it is open", () => {
    const api = fresh();
    api.store.set("sawFlaw", true);
    api.setPref("difficulty", "apprentice");
    api.newRun("shelf-test-2");
    let seen = 0;
    for (let i = 0; i < 200; i++) {
      seen += api.rollOffers().filter(o => o.kind === "lens" && o.lens.flaw).length;
    }
    assert.ok(seen > 0, "the drawer was open and nothing came out of it in 200 shelves");
  });
});

describe("losing the ceiling cannot cost the gentler mode its floor", () => {
  test("the targets come down while the flawed Lenses are away", () => {
    const api = fresh();
    api.setPref("difficulty", "apprentice");

    api.newRun("soft");
    const shut = api.G.target;

    api.store.set("sawFlaw", true);
    api.newRun("open");
    const open = api.G.target;

    assert.ok(shut < open,
      "APPRENTICE asked for the same score with six fewer Lenses to reach it " +
      "(" + shut + " vs " + open + ")");
  });

  test("SCHOLAR is untouched by any of it", () => {
    const api = fresh();
    api.setPref("difficulty", "scholar");
    api.newRun("hard");
    const shut = api.G.target;
    api.store.set("sawFlaw", true);
    api.newRun("hard");
    assert.strictEqual(api.G.target, shut,
      "the game as balanced moved when the apprentice's drawer opened");
    assert.strictEqual(shut, api.TARGETS[0],
      "SCHOLAR round 1 is not the number the curve was tuned to");
  });

  test("a run keeps the curve it was dealt, even if the drawer opens mid-run", () => {
    const api = fresh();
    api.setPref("difficulty", "apprentice");
    api.newRun("mid");
    const before = api.G.target;
    /* this is what showing the introduction does */
    api.store.set("sawFlaw", true);
    api.startRound();
    assert.strictEqual(api.G.target, before,
      "the target moved under a run that was already being played");
  });
});

describe("the shop never quotes a round the player will not get", () => {
  test("shapeFor and startRound agree, on both halves of APPRENTICE", () => {
    [false, true].forEach(open => {
      const api = fresh();
      api.store.set("sawFlaw", open);
      api.setPref("difficulty", "apprentice");
      api.newRun("agree-" + open);
      for (let r = 0; r < api.TARGETS.length; r++) {
        const quoted = api.shapeFor(r, []);
        api.G.round = r;
        api.startRound();
        assert.strictEqual(api.G.target, quoted.target,
          "round " + (r + 1) + " with the drawer " + (open ? "open" : "shut")
          + ": the shop said " + quoted.target + " and the round asked " + api.G.target);
        assert.strictEqual(api.G.discards, quoted.discards,
          "round " + (r + 1) + ": discards disagreed");
      }
    });
  });
});
