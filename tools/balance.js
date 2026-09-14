#!/usr/bin/env node
/* Full-run balance simulator.
 *
 *   node tools/balance.js [runs] [--play optimal|greedy] [--buy value|costly|random]
 *   node tools/balance.js --lenses [runs]     per-Lens power ranking
 *   node tools/balance.js --stacks [runs]     the strongest loadouts reachable
 *
 * tools/sim.js answers "can a player who ignores the shop survive?" — it plays
 * with no Lenses at all. That was the right question when the shop was the
 * thing being taught, and the wrong one once the shop became the game: it
 * cannot see a broken Lens, because it never buys one.
 *
 * This plays whole runs through the real engine: real deck, real draws, real
 * scoring, real shop, real purchases. Everything it reports is something the
 * game actually does.
 */
const { load } = require("../tests/harness.js");
const { api } = load();

const ARGS = process.argv.slice(2);
function flag(name, dflt) {
  const i = ARGS.indexOf("--" + name);
  return i >= 0 && ARGS[i + 1] && !ARGS[i + 1].startsWith("--") ? ARGS[i + 1] : dflt;
}
const RUNS = parseInt(ARGS.find(a => /^\d+$/.test(a)), 10) || 300;
const PLAY = flag("play", "optimal");
const BUY = flag("buy", "value");

/* ------------------------------------------------------------------ player */

/* Every ordered selection of 1..3 cards from a hand. Order is part of the
   puzzle — CARNIVORE eats leftwards, and a +mult Lens landing before a xmult
   one is a different number — so a player looking for their best hand is
   choosing among permutations, not combinations. */
function bestPlay(hand, optimal) {
  let best = null;
  const n = hand.length;
  const cap = api.maxPlay();
  const consider = (cards) => {
    if (cards.length > cap) return;
    const r = api.resolve(cards);
    if (!best || r.total > best.total) best = { cards: cards.slice(), total: r.total, mult: r.mult };
  };
  /* A human does not enumerate 259 orderings -- but they do not have to. The
     board scores every selection live, so clicking three cards and swapping
     them about IS a search, just a shallower one. "human" searches the top five
     cards by face value, which is about what a person tries before playing. */
  const pool = optimal === "human"
    ? hand.slice().sort((a, b) => b.base - a.base).slice(0, 5)
    : hand;
  const m = pool.length;
  for (let i = 0; i < m; i++) {
    consider([pool[i]]);
    for (let j = 0; j < m; j++) {
      if (j === i) continue;
      consider([pool[i], pool[j]]);
      if (!optimal) continue;
      for (let k = 0; k < m; k++) {
        if (k === i || k === j) continue;
        consider([pool[i], pool[j], pool[k]]);
      }
    }
  }
  for (let i = 0; i < n; i++) {
    if (optimal === "human") break;
    consider([hand[i]]);
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      consider([hand[i], hand[j]]);
      if (!optimal) continue;
      for (let k = 0; k < n; k++) {
        if (k === i || k === j) continue;
        consider([hand[i], hand[j], hand[k]]);
      }
    }
  }
  /* A greedy player takes three by face value and does not shop the ordering. */
  if (optimal === "human") return best;
  if (!optimal) {
    const d = api.G.demand;
    const ranked = hand.slice().sort((a, b) =>
      (b.base + 25 * b.t.filter(t => d.tags.indexOf(t) >= 0).length) -
      (a.base + 25 * a.t.filter(t => d.tags.indexOf(t) >= 0).length));
    const three = ranked.slice(0, cap);
    const r = api.resolve(three);
    if (!best || r.total > best.total) best = { cards: three, total: r.total, mult: r.mult };
  }
  return best;
}

function playRound(optimal) {
  const G = api.G;
  while (G.plays > 0) {
    const need = G.target - G.roundScore;
    let best = bestPlay(G.hand, optimal);

    /* Discard when this hand cannot keep pace: if the best play is under the
       per-play share of what is left, throw the deadest cards back. */
    const pace = need / G.plays;
    if (G.discards > 0 && best.total < pace * 0.7 && G.deck.length + G.discard.length > 3) {
      const d = G.demand;
      const dead = G.hand.slice()
        .sort((a, b) =>
          (a.base + 25 * a.t.filter(t => d.tags.indexOf(t) >= 0).length) -
          (b.base + 25 * b.t.filter(t => d.tags.indexOf(t) >= 0).length))
        .slice(0, 3);
      G.hand = G.hand.filter(c => dead.indexOf(c) < 0);
      G.discard = G.discard.concat(dead);
      G.discards--;
      api.draw(api.handSize() - G.hand.length);
      continue;
    }

    G.hand = G.hand.filter(c => best.cards.indexOf(c) < 0);
    G.discard = G.discard.concat(best.cards);
    G.plays--;
    G.roundScore += best.total;
    G.total += best.total;
    if (best.mult > G.best.mult) G.best = { word: "", mult: best.mult, score: best.total };
    if (G.roundScore >= G.target) return true;
    api.draw(api.handSize() - G.hand.length);
  }
  return false;
}

/* What a Lens would be worth in THIS deck, right now: play out a notional hand
   with it and without it. A player cannot do this arithmetic, but it is a fair
   stand-in for "this obviously fits my deck", which they can see. */
function lensValue(lens) {
  const G = api.G;
  const sample = G.deck.concat(G.discard, G.hand).slice(0, 12);
  if (sample.length < 3) return 0;
  const before = G.lenses.slice();
  let base = 0, with_ = 0;
  for (let i = 0; i + 3 <= sample.length; i += 3) {
    const trio = sample.slice(i, i + 3);
    G.lenses = before;
    base += api.resolve(trio).total;
    G.lenses = before.concat([lens]);
    with_ += api.resolve(trio).total;
  }
  G.lenses = before;
  return with_ - base;
}

function shop(policy) {
  const G = api.G;
  G.offers = api.rollOffers();

  /* A player with spare cash rerolls until something fits. The first version of
     this simulator never rerolled at all, which quietly modelled a player who
     takes whatever the first roll hands them -- and made the game look harder
     than it is. */
  if (policy === "value") {
    let spins = 0;
    while (G.bank >= 4 && spins < 6) {
      const best = Math.max.apply(null, G.offers.map(o =>
        o.kind === "lens" && G.lenses.length < api.LENS_SLOTS && G.bank - 1 >= o.cost
          ? lensValue(o.lens) : 0).concat([0]));
      if (best > 120) break;                 // good enough, buy it
      G.bank -= 1;
      G.offers = api.rollOffers();
      spins++;
    }
  }

  for (let pass = 0; pass < 4; pass++) {
    const buyable = G.offers
      .map((o, i) => ({ o, i }))
      .filter(x => !x.o.bought && G.bank >= x.o.cost
        && (x.o.kind !== "lens" || G.lenses.length < api.LENS_SLOTS));
    if (!buyable.length) break;

    let pick;
    if (policy === "costly") {
      pick = buyable.sort((a, b) => b.o.cost - a.o.cost)[0];
    } else if (policy === "random") {
      pick = buyable[Math.floor(Math.random() * buyable.length)];
    } else {
      pick = buyable
        .map(x => ({ ...x, v: x.o.kind === "lens" ? lensValue(x.o.lens) : 30 }))
        .sort((a, b) => b.v - a.v)[0];
      if (pick.v <= 0) break;
    }
    if (pick.o.kind === "lens") {
      G.lenses.push(pick.o.lens);
      G.shopSeen.push(pick.o.lens.id);
    } else {
      const owned = G.deck.concat(G.discard, G.hand).map(c => c.w);
      const fresh = api.LEXICON.filter(e => owned.indexOf(e.w) === -1);
      if (fresh.length >= 2) {
        G.deck.push(api.makeCard(fresh[0], false));
        G.deck.push(api.makeCard(fresh[1], false));
      }
    }
    G.bank -= pick.o.cost;
    pick.o.bought = true;
  }

  /* A player reading the Bookseller's reality check. If the deck cannot reach
     the next target however it is played, the only move left is to sell
     something that is costing more than it pays -- which is exactly what the
     warning now tells them. Modelled here so the fairness numbers reflect a
     player who HAS that information rather than one who does not. */
  if (policy === "value" && G.round < api.ROUNDS) {
    for (let bail = 0; bail < 3; bail++) {
      const shape = api.roundShape(G.round);
      if (api.deckCeiling(G.round) >= shape.target) break;
      /* Sell the Lens whose removal most RAISES the ceiling, and only if it
         raises it at all. The first version of this just dumped the flawed one
         whenever the warning fired, which is what a player does if they read
         "sell something" literally -- and it tanked the win rate, because
         stripping the engine is usually worse than the drawback. A warning is
         only as good as the move it suggests. */
      let idx = -1, gain = 0;
      for (let i = 0; i < G.lenses.length; i++) {
        const held = G.lenses[i];
        G.lenses.splice(i, 1);
        const without = api.deckCeiling(G.round);
        G.lenses.splice(i, 0, held);
        if (without - api.deckCeiling(G.round) > gain) {
          gain = without - api.deckCeiling(G.round);
          idx = i;
        }
      }
      if (idx < 0) break;
      const sold = G.lenses[idx];
      G.lenses.splice(idx, 1);
      delete G.lensState[sold.id];
      G.bank += Math.max(1, Math.ceil(sold.cost / 2));
    }
  }
  G.offers = null;
}

/* Play one whole run. Returns how far it got and what it was holding. */
function runOnce(seed, opts) {
  api.newRun(seed);
  const G = api.G;
  /* Memory: from run 2 onward a real player starts holding a Lens they earned.
     The simulator never called endRun, so it never banked one, and every run it
     measured was somebody's first. */
  if (opts.memory !== false && !opts.force && !opts.solo) {
    const carried = api.LENSES[Math.abs(api.hashStr(seed)) % api.LENSES.length];
    if (G.lenses.length === 0) G.lenses.push(carried);
  }
  if (opts.force) G.lenses = opts.force.slice();
  if (opts.noShop) G.bank = 0;

  for (let round = 0; round < api.ROUNDS; round++) {
    const cleared = playRound(opts.optimal);
    if (!cleared) {
      return { reached: round + 1, won: false, total: G.total,
               lenses: G.lenses.map(l => l.id), bestMult: G.best.mult };
    }
    let reward = 4 + G.plays + G.discards;
    G.lenses.forEach(l => { if (l.onReward) reward = l.onReward(reward); });
    G.bank += Math.max(0, Math.round(reward));
    G.round++;
    if (G.round >= api.ROUNDS) break;
    if (!opts.noShop && !opts.solo) shop(opts.buy);
    api.startRound();
  }
  return { reached: api.ROUNDS, won: true, total: G.total,
           lenses: G.lenses.map(l => l.id), bestMult: G.best.mult };
}

/* ------------------------------------------------------------------ report */
function pct(n, d) { return (100 * n / d).toFixed(1) + "%"; }
function bar(n, d, width) {
  const k = Math.round((n / d) * (width || 28));
  return "#".repeat(k) + ".".repeat((width || 28) - k);
}

function headline() {
  const opts = { optimal: PLAY === "greedy" ? false : PLAY, buy: BUY };
  const res = [];
  for (let s = 0; s < RUNS; s++) res.push(runOnce("bal-" + s, opts));

  const wins = res.filter(r => r.won).length;
  const reach = Array.from({ length: api.ROUNDS + 1 }, () => 0);
  res.forEach(r => reach[r.reached]++);
  const mults = res.map(r => r.bestMult).sort((a, b) => a - b);

  console.log("=".repeat(64));
  console.log("FULL RUNS  ·  " + RUNS + " runs  ·  play=" + PLAY + "  buy=" + BUY);
  console.log("=".repeat(64));
  console.log("\nWin rate (cleared all " + api.ROUNDS + "):  " + pct(wins, RUNS)
    + "   [healthy roguelite: 15-30%]");
  console.log("\nHow far a run gets");
  for (let i = 1; i <= api.ROUNDS; i++) {
    console.log("  round " + i + "  " + String(reach[i]).padStart(4) + "  "
      + bar(reach[i], RUNS) + "  " + pct(reach[i], RUNS));
  }
  console.log("\nBest multiplier reached in a run");
  [0.1, 0.5, 0.9, 0.99].forEach(q => {
    console.log("  p" + String(Math.round(q * 100)).padStart(2)
      + "  x" + mults[Math.floor(mults.length * q)].toFixed(1));
  });
  console.log("  max  x" + mults[mults.length - 1].toFixed(1));
  return res;
}

function lensPower() {
  const n = Math.max(60, Math.floor(RUNS / 3));
  console.log("=".repeat(64));
  console.log("PER-LENS POWER  ·  " + n + " runs each, that Lens owned from round 1");
  console.log("=".repeat(64));
  console.log("\nA fair Lens sits near the baseline. One far above it is doing the");
  console.log("work the other four slots were supposed to do.\n");

  const base = [];
  for (let s = 0; s < n; s++) base.push(runOnce("pw-" + s, { optimal: true, buy: "value" }));
  const baseWin = base.filter(r => r.won).length / n;

  const rows = api.LENSES.map(l => {
    const res = [], solo = [];
    for (let s = 0; s < n; s++) {
      res.push(runOnce("pw-" + s, { optimal: true, buy: "value", force: [l] }));
      solo.push(runOnce("pw-" + s, { optimal: true, force: [l], solo: true }));
    }
    const win = res.filter(r => r.won).length / n;
    const reach = res.reduce((a, r) => a + r.reached, 0) / n;
    const mult = res.map(r => r.bestMult).sort((a, b) => a - b)[Math.floor(n / 2)];
    const alone = solo.reduce((a, r) => a + r.reached, 0) / n;
    return { id: l.id, n: l.n, cost: l.cost, win, reach, mult, alone };
  }).sort((a, b) => b.win - a.win);

  console.log("  baseline (buy freely, nothing forced):  win " + pct(baseWin * n, n) + "\n");
  console.log("  LENS              $  win     med.mult  alone");
  rows.forEach(r => {
    const flagged = r.win > baseWin + 0.14 ? "  <-- OUTLIER"
      : (r.alone >= 6.5 ? "  <-- carries alone"
      : (r.win < baseWin - 0.14 ? "  (weak)" : ""));
    console.log("  " + r.n.padEnd(16) + " " + String(r.cost).padStart(2)
      + "  " + pct(r.win * n, n).padStart(6)
      + "  x" + r.mult.toFixed(1).padStart(7)
      + "  r" + r.alone.toFixed(1).padStart(4) + flagged);
  });
  console.log("");
  console.log("  alone = rounds reached holding ONLY that Lens, no shopping.");
  return rows;
}

function stacks() {
  const n = Math.max(40, Math.floor(RUNS / 6));
  console.log("=".repeat(64));
  console.log("THE CEILING  ·  what the best reachable loadout actually does");
  console.log("=".repeat(64) + "\n");

  /* Every pair and triple of multiplicative Lenses: this is where a runaway
     lives, because xmult compounds and everything else adds. */
  const xs = api.LENSES.filter(l => /multiplier .([\d.]+)|×/.test(l.d));
  const combos = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      combos.push([xs[i], xs[j]]);
      for (let k = j + 1; k < xs.length; k++) combos.push([xs[i], xs[j], xs[k]]);
    }
  }
  const scored = combos.map(c => {
    let win = 0, mult = [];
    for (let s = 0; s < n; s++) {
      const r = runOnce("st-" + s, { optimal: true, buy: "value", force: c });
      if (r.won) win++;
      mult.push(r.bestMult);
    }
    mult.sort((a, b) => a - b);
    return { names: c.map(l => l.n).join(" + "), cost: c.reduce((a, l) => a + l.cost, 0),
             win: win / n, mult: mult[Math.floor(n / 2)] };
  }).sort((a, b) => b.win - a.win || b.mult - a.mult);

  console.log("  top 12 multiplicative loadouts (forced from round 1)\n");
  console.log("  win    median mult  $   loadout");
  scored.slice(0, 12).forEach(r => {
    console.log("  " + pct(r.win * n, n).padStart(6) + "  x" + r.mult.toFixed(1).padStart(9)
      + "  " + String(r.cost).padStart(2) + "  " + r.names);
  });
  return scored;
}

/* What a round can actually PRODUCE, with every play spent and nothing to
   stop it. Targets should be set from this, not guessed: a target is a
   percentile of what the engine at that point in a run is capable of. */
function curve() {
  const n = Math.max(120, RUNS);
  const per = Array.from({ length: api.ROUNDS }, () => []);
  for (let s = 0; s < n; s++) {
    api.newRun("cv-" + s);
    const G = api.G;
    for (let round = 0; round < api.ROUNDS; round++) {
      G.target = Infinity;                 // never clears, so all four plays are spent
      playRound(true);
      per[round].push(G.roundScore);
      G.bank += 9;                         // a typical round's takings
      G.round++;
      if (G.round >= api.ROUNDS) break;
      shop("value");
      api.startRound();
    }
  }
  console.log("=".repeat(64));
  console.log("WHAT A ROUND CAN PRODUCE  ·  " + n + " runs, all four plays spent");
  console.log("=".repeat(64));
  console.log("");
  console.log("round   p20      p50       p80       current target");
  per.forEach((r, i) => {
    r.sort((x, y) => x - y);
    const q = f => Math.round(r[Math.floor(r.length * f)]);
    console.log("  " + (i + 1) + "     " + String(q(0.2)).padStart(7)
      + "  " + String(q(0.5)).padStart(8)
      + "  " + String(q(0.8)).padStart(8)
      + "      " + String(api.TARGETS[i]).padStart(7)
      + "   (target is p" + Math.round(100 * r.filter(x => x < api.TARGETS[i]).length / r.length) + ")");
  });
  console.log("");
  console.log("A target at p20 kills four runs in five at that round.");
  console.log("  A target at p80 kills one in five. Stacked over 8 rounds, a");
  console.log("  flat p80 per round gives a ~17% win rate.");
}


/* Is a round you are about to play actually completable?
 *
 * "Impossible" has to mean something precise, so: take the WHOLE deck, not the
 * hand you happened to draw, and play the best `plays` hands it contains with
 * this loadout. That is a ceiling no real draw can beat. If the ceiling is
 * under the target, the round was lost when you bought the Lens, not when you
 * played the card — and that is a design bug rather than a difficulty.
 */
function ceilingFor() {
  const G = api.G;
  const pool = G.deck.concat(G.discard, G.hand);
  const cap = api.maxPlay();
  const used = new Set();
  let total = 0;
  for (let p = 0; p < G.plays; p++) {
    let best = null;
    /* top 8 by face value is plenty to find the ceiling and keeps this cheap */
    const avail = pool.filter(c => !used.has(c)).sort((a, b) => b.base - a.base).slice(0, 8);
    const pick = (cards) => {
      if (cards.length && cards.length <= cap) {
        const r = api.resolve(cards);
        if (!best || r.total > best.total) best = { total: r.total, cards: cards.slice() };
      }
      if (cards.length >= cap) return;
      avail.forEach(c => { if (cards.indexOf(c) < 0) pick(cards.concat([c])); });
    };
    pick([]);
    if (!best) break;
    best.cards.forEach(c => used.add(c));
    total += best.total;
  }
  return total;
}

function fairness() {
  const n = Math.max(80, Math.floor(RUNS / 3));
  let rounds = 0, impossible = 0, impossibleFlawed = 0, flawedRounds = 0;
  const worst = [];
  for (let s = 0; s < n; s++) {
    api.newRun("fair-" + s);
    const G = api.G;
    for (let round = 0; round < api.ROUNDS; round++) {
      const ceiling = ceilingFor();
      const holdsFlaw = G.lenses.some(l => l.flaw);
      rounds++;
      if (holdsFlaw) flawedRounds++;
      if (ceiling < G.target) {
        impossible++;
        if (holdsFlaw) impossibleFlawed++;
        if (worst.length < 6) {
          worst.push("round " + (round + 1) + "  ceiling " + Math.round(ceiling)
            + " vs target " + G.target + "  holding ["
            + G.lenses.map(l => l.n + (l.flaw ? "*" : "")).join(", ") + "]");
        }
      }
      if (!playRound("human")) break;
      let reward = 4 + G.plays + G.discards;
      G.lenses.forEach(l => { if (l.onReward) reward = l.onReward(reward); });
      G.bank += Math.max(0, Math.round(reward));
      G.round++;
      if (G.round >= api.ROUNDS) break;
      shop("value");
      api.startRound();
    }
  }
  console.log("=".repeat(64));
  console.log("CAN THE ROUND BE WON AT ALL?  ·  " + n + " runs");
  console.log("=".repeat(64));
  console.log("");
  console.log("  Ceiling = the best score the WHOLE deck could produce this round,");
  console.log("  with perfect draws and perfect ordering. Below the target means the");
  console.log("  round was lost at the shop, not at the table.");
  console.log("");
  console.log("  rounds played                 " + rounds);
  console.log("  ceiling under target          " + impossible + "  (" + pct(impossible, rounds) + ")");
  console.log("  ...of those, holding a flaw   " + impossibleFlawed);
  console.log("  rounds holding a flawed Lens  " + flawedRounds + "  (" + pct(flawedRounds, rounds) + ")");
  if (worst.length) {
    console.log("");
    console.log("  examples:");
    worst.forEach(w => console.log("    " + w));
  }
}

if (ARGS.includes("--fair")) fairness();
else if (ARGS.includes("--curve")) curve();
else if (ARGS.includes("--lenses")) lensPower();
else if (ARGS.includes("--stacks")) stacks();
else {
  headline();
  console.log("\n" + "-".repeat(64));
  console.log("also: --lenses (per-Lens power)   --stacks (the ceiling)");
}
