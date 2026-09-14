/* The end of a run.
 *
 * This is where the day-1 hooks live — the Memory unlock that makes run 2
 * visibly different from run 1, and the share block that is the only thing
 * another person ever sees. Both were previously untested.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert");
const { load } = require("./harness.js");

/* Each test gets its own realm, because run-end writes to storage and the
 * whole point of several of these is what carries between runs. */
function fresh() {
  const h = load();
  return h.api;
}

function finishRun(api, { seed = "end", total = 1000, lenses = [], won = false } = {}) {
  api.newRun(seed);
  api.G.lenses = lenses.map(id => api.LENSES.find(l => l.id === id));
  api.G.total = total;
  api.endRun(won);
}

/* ------------------------------------------------------------------ */
describe("run bookkeeping", () => {
  test("each finished run is counted", () => {
    const api = fresh();
    assert.strictEqual(api.store.get("runs", 0), 0);
    finishRun(api, { seed: "a" });
    assert.strictEqual(api.store.get("runs", 0), 1);
    finishRun(api, { seed: "b" });
    assert.strictEqual(api.store.get("runs", 0), 2);
  });

  test("a personal best is kept, and only beaten scores replace it", () => {
    const api = fresh();
    finishRun(api, { seed: "a", total: 5000 });
    assert.strictEqual(api.store.get("best", 0), 5000);

    finishRun(api, { seed: "b", total: 900 });
    assert.strictEqual(api.store.get("best", 0), 5000, "a worse run overwrote the best");

    finishRun(api, { seed: "c", total: 9001 });
    assert.strictEqual(api.store.get("best", 0), 9001, "a better run did not take the record");
  });

  test("the run is marked over so the board stops accepting input", () => {
    const api = fresh();
    api.newRun("over");
    assert.ok(!api.G.over);
    api.endRun(false);
    assert.strictEqual(api.G.over, true);
  });
});

/* ------------------------------------------------------------------ */
describe("the Memory unlock — the reason run 2 differs from run 1", () => {
  test("a Lens the player actually used is carried forward", () => {
    const api = fresh();
    finishRun(api, { seed: "mem", lenses: ["pyro", "zoo"] });
    const kept = api.store.get("memory", null);
    assert.ok(kept, "nothing was carried into the next run");
    assert.ok(["pyro", "zoo"].includes(kept),
      "carried a Lens the player never owned: " + kept);
  });

  test("the carried Lens is equipped at the start of the next run", () => {
    const api = fresh();
    finishRun(api, { seed: "mem", lenses: ["pyro"] });
    assert.strictEqual(api.store.get("memory", null), "pyro");

    api.newRun("next");
    assert.strictEqual(api.G.lenses.length, 1, "run 2 started with no Lens");
    assert.strictEqual(api.G.lenses[0].id, "pyro");
    /* and it is a working Lens, not just an entry in a list */
    api.G.demand = { n: "T", tags: [] };
    const c = api.makeCard({ w: "EMBER", t: ["HEA"] }, false);
    const withMemory = api.resolve([c]).chips;
    api.G.lenses = [];
    /* 25 base + 110 for the round now under way: startRound() banks a step of
       growth for every Lens in hand as the round opens, and a carried Lens is
       in hand for round 1. */
    const pyro = api.LENSES.find(l => l.id === "pyro");
    assert.strictEqual(withMemory - api.resolve([c]).chips, 25 + pyro.grows,
      "the carried Lens did not actually fire");
  });

  test("a run with no Lenses carries nothing", () => {
    const api = fresh();
    finishRun(api, { seed: "none", lenses: [] });
    assert.strictEqual(api.store.get("memory", null), null);
  });

  test("the unlock does not hand back the same Lens twice running", () => {
    const api = fresh();
    api.store.set("memory", "pyro");
    /* only pyro was owned, so there is nothing new to offer */
    finishRun(api, { seed: "same", lenses: ["pyro"] });
    assert.strictEqual(api.store.get("memory", null), "pyro",
      "storage was cleared when there was no new Lens to give");
  });
});

/* ------------------------------------------------------------------ */
describe("the share block — the only part other people see", () => {
  test("names the game, the seed and the score", () => {
    const api = fresh();
    api.newRun("free-abc123");
    api.G.total = 14320;
    api.G.round = 5;
    const s = api.shareText(false);

    assert.match(s, /OVERTONE/, "the game is not named");
    assert.match(s, /free-abc123/, "the seed is missing, so nobody can race it");
    assert.match(s, /14,320|14320/, "the score is missing");
  });

  test("a loss names the Demand that ended it, a win says so", () => {
    const api = fresh();
    api.newRun("share");
    api.G.demand = { n: "THE ARCHIVE", tags: [] };
    api.G.round = 5;

    assert.match(api.shareText(false), /THE ARCHIVE/, "a loss does not say where it ended");
    assert.match(api.shareText(true), /Cleared all/, "a win does not read as a win");
  });

  test("carries the best play and its multiplier", () => {
    const api = fresh();
    api.newRun("share");
    api.G.best = { word: "AVALANCHE", mult: 18, score: 2430 };
    const s = api.shareText(false);
    assert.match(s, /AVALANCHE/);
    assert.match(s, /18/);
  });

  test("carries the interpreted word, which is the bit worth sending", () => {
    const api = fresh();
    api.newRun("share");
    api.G.interpretedWord = { w: "MITOCHONDRIA", t: ["TEC", "MIN"] };
    const s = api.shareText(false);
    assert.match(s, /MITOCHONDRIA/, "the player's own word is missing from the share");
    assert.match(s, /TECH/, "the overtones it was given are missing");
  });

  test("stays short enough to paste into a message", () => {
    const api = fresh();
    api.newRun("share");
    api.G.total = 14320;
    api.G.best = { word: "AVALANCHE · FURNACE · CRYPT", mult: 18, score: 2430 };
    api.G.interpretedWord = { w: "MITOCHONDRIA", t: ["TEC", "MIN", "BOD"] };
    const s = api.shareText(false);
    assert.ok(s.length < 280, "share block is " + s.length + " chars — too long to paste");
    assert.ok(s.split("\n").length <= 5, "share block runs to too many lines");
  });
});
