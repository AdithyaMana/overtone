#!/usr/bin/env node
/* Headless balance simulator.
 *
 *   node tools/sim.js [seeds]
 *
 * Reports two things a screenshot cannot show: whether any Demand can be dealt
 * a deck that cannot answer it, and how a greedy player with NO Sigils fares
 * against each round's target.
 *
 * It runs the real game through tests/harness.js — real deck construction, real
 * scoring engine. An earlier version reimplemented both from a regex scrape and
 * silently drifted out of sync with the game it was meant to measure.
 */
const { load, wholeDeck } = require("../tests/harness.js");

const SEEDS = parseInt(process.argv[2], 10) || 400;
const { api } = load();

const starved = [];
const ratios = Array.from({ length: api.ROUNDS }, () => []);
let worstCoverage = { n: Infinity, where: "" };

for (let s = 0; s < SEEDS; s++) {
  api.newRun("sim-" + s);
  const cards = wholeDeck(api.G);
  const demands = api.G.demandOrder;

  /* No Sigils: this is the floor a player who ignores the Reliquary plays at. */
  api.G.lenses = [];

  demands.forEach((d, round) => {
    const playable = cards.filter(c => c.t.some(t => d.tags.indexOf(t) >= 0));
    if (playable.length < worstCoverage.n) {
      worstCoverage = { n: playable.length, where: d.n + " r" + (round + 1) + " seed " + s };
    }
    if (playable.length < 5) {
      starved.push({ demand: d.n, round: round + 1, cards: playable.length, seed: s });
    }

    /* A greedy player: rank the whole deck for this Demand, then take the best
       three, the next three, and so on for four plays. Approximates drawing
       well without modelling the shuffle. */
    api.G.demand = d;
    const ranked = cards
      .map(c => ({ c, v: c.base + 25 * c.t.filter(t => d.tags.indexOf(t) >= 0).length }))
      .sort((a, b) => b.v - a.v)
      .map(x => x.c);

    let total = 0;
    for (let p = 0; p < 4; p++) {
      const hand = ranked.slice(p * 3, p * 3 + 3);
      if (hand.length) total += api.resolve(hand).total;
    }
    ratios[round].push(total / api.TARGETS[round]);
  });
}

const checks = SEEDS * api.ROUNDS;
console.log("Simulated " + SEEDS + " runs (" + checks + " Demand checks) against the live engine.\n");

console.log("Deck coverage");
console.log("  Demands dealt fewer than 5 playable cards: " + starved.length + " / " + checks);
console.log("  Worst case: " + worstCoverage.n + " cards — " + worstCoverage.where);
if (starved.length) {
  console.log("  " + starved.slice(0, 5)
    .map(s => s.demand + " r" + s.round + " (" + s.cards + ")").join(" | "));
}

console.log("\nNaive Sigil-less player, score as a multiple of target (needs ~1.0 to survive)");
ratios.forEach((r, i) => {
  r.sort((a, b) => a - b);
  const med = r[Math.floor(r.length / 2)];
  const lo = r[Math.floor(r.length * 0.1)];
  console.log("  round " + (i + 1)
    + "  target " + String(api.TARGETS[i]).padStart(5)
    + "   median x" + med.toFixed(2)
    + "   unlucky-10% x" + lo.toFixed(2));
});

const firstFail = ratios.findIndex(r => r[Math.floor(r.length / 2)] < 1);
console.log("\nA player who ignores the Reliquary stalls at round "
  + (firstFail < 0 ? "never" : firstFail + 1)
  + " — which is the round the shop has to have taught them by.");
