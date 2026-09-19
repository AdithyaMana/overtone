#!/usr/bin/env node
/* Full-run balance simulator.
 *
 *   node tools/balance.js [runs] [--play optimal|greedy] [--buy value|costly|random]
 *   node tools/balance.js --curve [runs]      what a round can produce
 *   node tools/balance.js --floor [runs]      what a beginner can produce
 *   node tools/balance.js --difficulty <id>    which curve to measure
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
const { api, ctx } = load();

const ARGS = process.argv.slice(2);
function flag(name, dflt) {
  const i = ARGS.indexOf("--" + name);
  return i >= 0 && ARGS[i + 1] && !ARGS[i + 1].startsWith("--") ? ARGS[i + 1] : dflt;
}
const RUNS = parseInt(ARGS.find(a => /^\d+$/.test(a)), 10) || 300;
const PLAY = flag("play", "optimal");
/* --nofigures scores the same seeds with the figure layer switched off, so the
   cost of a scoring change can be read on its own rather than inferred from two
   numbers taken a week apart. resolve() reads figureFor off the script's global
   scope, which is what makes the swap possible at all. */
if (ARGS.includes("--nofigures")) ctx.figureFor = () => null;
/* The control the join rebuild needs: no fatigue, so the cost of playing the
   same overtone twice can be read off the difference. */
if (ARGS.includes("--nofatigue")) ctx.dullTags = () => ({});
/* --nojoins flattens the new physics back to a pile of words: no resonance,
   no tension, no silence. The difference against a normal run is what the
   whole rebuild is worth. */
if (ARGS.includes("--nojoins")) ctx.joinsOf = (line) =>
  ({ joins: [], scored: line.length });
/* --targets 1400,3300,... scores a candidate curve without editing the game, so
   a sweep can run several curves at once instead of serially rewriting the one
   file they all read from. */
/* --difficulty <id> picks which curve to measure. Same engine, same deck, same
   Lenses; a mode differs only by the properties it declares in DIFFICULTIES. */
const DIFF = flag("difficulty", null);
if (DIFF) {
  /* An id that is not in the table used to fall through difficulty()'s default
     and measure the gentlest curve under the name you asked for - so a typo
     filed a gentle-curve win rate as the steep mode's. */
  if (!api.DIFF_BY_ID[DIFF]) {
    console.error("unknown difficulty: " + DIFF + "  (have: "
      + api.DIFFICULTIES.map(d => d.id).join(", ") + ")");
    process.exit(1);
  }
  api.setPref("difficulty", DIFF);
}

/* --seenflaw is the player who has already met a flawed Lens in SCHOLAR: the
   drawer is open in APPRENTICE too, and its targets go back up to match. */
if (ARGS.includes("--seenflaw")) api.store.set("sawFlaw", true);

const TOV = flag("targets", null);
if (TOV) {
  const t = TOV.split(",").map(Number);
  if (t.length !== api.TARGETS.length || t.some(isNaN))
    throw new Error("--targets needs " + api.TARGETS.length + " numbers");
  t.forEach((v, i) => { api.TARGETS[i] = v; });
}
/* --noflaw takes the six flawed Lenses out of the shop, which is what
   APPRENTICE does for a player who has not met one yet. They are the biggest
   multipliers in the game, so removing them is as likely to make a curve
   HARDER as easier — the only way to know is to score the same seeds twice. */
if (ARGS.includes("--noflaw")) {
  const keep = api.LENSES.filter(l => !l.flaw);
  api.LENSES.length = 0;
  keep.forEach(l => api.LENSES.push(l));
}

/* --noordeals scores the same curve with the rule-changing rounds switched
   off, which separates "this curve is too steep" from "these rules are".
   The schedule belongs to each mode now, so every one of them is emptied. */
if (ARGS.includes("--noordeals")) {
  api.DIFFICULTIES.forEach(function(d){ d.ordealRounds = []; });
}

const BUY = flag("buy", "value");

/* ------------------------------------------------------------------ player */

/* Every ordered selection of 1..3 cards from a hand. Order is part of the
   puzzle — CARNIVORE eats leftwards, and a +mult Lens landing before a xmult
   one is a different number — so a player looking for their best hand is
   choosing among permutations, not combinations. */
/* A cheap read of what a line is worth: joins, figures, kept lines, the words
   themselves, and whatever the round wants. It knows nothing about Lenses or
   Ordeals, so it is not the score — it is a ranking, good enough to say which
   forty of three thousand orderings deserve the real engine's attention.

   resolve() builds an event list and runs every Lens hook on every candidate,
   which is the right thing to do once and the wrong thing to do 3,612 times a
   play. The old search looked at 259 candidates and could afford it; this one
   cannot. */
function lineWorth(line) {
  const G = api.G;
  const dull = (G && G.dull) || {};
  const jr = api.joinsOf(line, dull);
  let chips = 0, mult = 1;
  jr.joins.forEach(j => { chips += api.JOIN_RESONANCE * j.s; mult += api.JOIN_TENSION * j.t; });
  const figs = api.figuresFromJoins(jr.joins);
  figs.forEach(f => { chips += f.chips; mult += f.mult; });
  (G.kept || []).forEach(k => {
    if (figs.some(f => f.id === k.fig)) { chips += api.KEPT_CHIPS; mult += api.KEPT_MULT; }
  });
  for (let i = 0; i < jr.scored; i++) {
    chips += line[i].base;
    chips += 25 * line[i].t.filter(t => G.demand.tags.indexOf(t) >= 0 && !dull[t]).length;
  }
  return chips * mult;
}

function bestPlay(hand, optimal) {
  /* The verb changed, so the search had to. Scoring reads ADJACENT PAIRS now,
     which means the order of a line is part of the candidate rather than a
     tidy-up afterwards: the same three words can be worth six times more one
     way round than the other. Subsets of three no longer describe the space.

     Lines are 2 to maxPlay() words, every ordering — P(7,2)+…+P(7,5) = 3,612
     per play against the old 259. They are ranked cheaply by lineWorth() and
     only the shortlist is put through the real engine, which is what keeps a
     1,200-run confirmation inside a coffee break. */
  const cap = api.maxPlay();
  const pool = optimal === "human"
    ? hand.slice().sort((a, b) => b.base - a.base).slice(0, 5)
    : hand;
  const limit = optimal ? cap : Math.min(cap, 3);
  const seen = [];
  const walk = (cur, rest) => {
    if (cur.length >= 2) seen.push({ cards: cur.slice(), worth: lineWorth(cur) });
    if (cur.length >= limit) return;
    for (let i = 0; i < rest.length; i++)
      walk(cur.concat([rest[i]]), rest.slice(0, i).concat(rest.slice(i + 1)));
  };
  walk([], pool);
  if (!seen.length) return null;
  seen.sort((a, b) => b.worth - a.worth);

  /* A Lens can reorder the top of that list — THE ORACLE pays the first word
     and silences the rest, ANTONYM ENGINE doubles a tension — so the shortlist
     is deliberately wide rather than a single pick. */
  const SHORTLIST = 40;
  let best = null;
  for (let i = 0; i < Math.min(SHORTLIST, seen.length); i++) {
    const r = api.resolve(seen[i].cards);
    if (!best || r.total > best.total)
      best = { cards: seen[i].cards, total: r.total, mult: r.mult };
  }
  return best;
}

function playRound(optimal) {
  const G = api.G;
  while (G.plays > 0) {
    const need = G.target - G.roundScore;
    let best = bestPlay(G.hand, optimal);

    /* THE FORFEIT will not let a hand be played until a word has been given
       up, so the simulator pays it the same way a player has to: with its
       worst three cards, out of the discard the rule guarantees it. */
    const owed = G.mustForfeit && !G.forfeited && G.discards > 0;

    /* Discard when this hand cannot keep pace: if the best play is under the
       per-play share of what is left, throw the deadest cards back. */
    const pace = need / G.plays;
    if (owed || (G.discards > 0 && best.total < pace * 0.7 && G.deck.length + G.discard.length > 3)) {
      const d = G.demand;
      const dead = G.hand.slice()
        .sort((a, b) =>
          (a.base + 25 * a.t.filter(t => d.tags.indexOf(t) >= 0).length) -
          (b.base + 25 * b.t.filter(t => d.tags.indexOf(t) >= 0).length))
        .slice(0, 3);   /* three dead cards, whatever the line length */
      G.hand = G.hand.filter(c => dead.indexOf(c) < 0);
      G.discard = G.discard.concat(dead);
      G.discards--;
      G.forfeited = true;
      api.draw(api.handSize() - G.hand.length);
      continue;
    }

    G.hand = G.hand.filter(c => best.cards.indexOf(c) < 0);
    G.discard = G.discard.concat(best.cards);
    G.plays--;
    /* play() tires the overtones a line used once the hand commits; this loop
       never calls play(), so it does it here. Without it every simulated run
       would play the same overtone every turn and the win rate would describe
       a game with no fatigue in it.

       bestPlay() scores through api.resolve(), which reads G.dull, so the
       policy avoids tired overtones WITHOUT being told to. What it does not do
       is plan around them — it never takes a weaker line now to keep an
       overtone fresh for later — so this is a FLOOR on what fatigue costs,
       not a ceiling. */
    const res = api.resolve(best.cards);
    if (ctx.__noteLine) ctx.__noteLine(best.cards);
    G.dull = G.dull || {};
    Object.keys(G.dull).forEach(t => { if (--G.dull[t] <= 0) delete G.dull[t]; });
    const tired = {};
    const paid = best.cards.slice(0, res.scored);
    for (let i = 0; i + 1 < paid.length; i++)
      api.sharedTags(paid[i], paid[i + 1], {}).forEach(t => { tired[t] = 1; });
    paid.forEach(c => c.t.forEach(t => { if (G.demand.tags.indexOf(t) >= 0) tired[t] = 1; }));
    Object.keys(tired).forEach(t => { G.dull[t] = api.FATIGUE_SPAN; });
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

  /* Keep the best lines this round produced, before spending anything.
     This block did not exist: G.kept was read in lensValue's scoring clone
     and written nowhere, so the simulator modelled a player who never once
     pressed "keep it" - free, permanent, and on its own shelf. Every win
     rate measured before this described somebody nobody will be.

     Keeps are free and capped at KEEP_SLOTS, so the policy is simply: take
     the highest-scoring line the round made, best first. */
  G.kept = G.kept || [];
  (G.roundLines || [])
    .filter(l => l.fig)
    .sort((a, b) => b.total - a.total)
    .forEach(function(l){
      if (G.kept.length >= api.KEEP_SLOTS) return;
      if (G.kept.some(k => k.fig === l.fig)) return;   // a second copy pays on the same figure
      G.kept.push({ n: l.ws.join(" · "), fig: l.fig, figName: l.figName });
    });

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
  /* The highest figure level this run reached, reported so a regression that
     stops the ledger banking shows up as a zero rather than as silence. */
  /* How many distinct figures this run managed to write. A run that makes one
     figure over and over is a run where the physics is not doing anything. */
  const seenFig = {};
  const topFig = () => Object.keys(seenFig).length;
  const noteLine = (cards) => {
    const r = api.resolve(cards);
    (r.figs || []).forEach(f => { seenFig[f.id] = 1; });
  };
  ctx.__noteLine = noteLine;
  /* Memory: from run 2 onward a real player starts holding a Lens they earned.
     The simulator never called endRun, so it never banked one, and every run it
     measured was somebody's first. */
  if (opts.memory !== false && !opts.force && !opts.solo) {
    /* Never a flawed one: the game stopped handing those down, because a Lens
       that doubles every target is a bargain you accept with a deck and a
       purse and a sentence when it is dealt to you on round 1. */
    const pool = api.LENSES.filter(l => !l.flaw);
    const carried = pool[Math.abs(api.hashStr(seed)) % pool.length];
    if (G.lenses.length === 0) G.lenses.push(carried);
  }
  if (opts.force) G.lenses = opts.force.slice();
  if (opts.noShop) G.bank = 0;

  for (let round = 0; round < api.ROUNDS; round++) {
    const cleared = playRound(opts.optimal);
    if (!cleared) {
      return { reached: round + 1, won: false, total: G.total, topFig: topFig(),
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
  return { reached: api.ROUNDS, won: true, total: G.total, topFig: topFig(),
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

  /* What the lines actually did. This exists to be a regression alarm: if
     playRound ever stops tiring overtones, or resolve stops reading joins,
     every number above still prints and every one of them silently describes
     a game nobody is playing. Zeroes here are that failure, made visible. */
  const tops = res.map(r => r.topFig || 0).sort((a, b) => a - b);
  const banked = res.filter(r => (r.topFig || 0) > 0).length;

  const wins = res.filter(r => r.won).length;
  const reach = Array.from({ length: api.ROUNDS + 1 }, () => 0);
  res.forEach(r => reach[r.reached]++);
  const mults = res.map(r => r.bestMult).sort((a, b) => a - b);

  console.log("=".repeat(64));
  /* Name the mode that was actually measured. Reading a win rate out of a
     report that does not say which curve produced it is how the wrong number
     ends up in a spec. */
  console.log("FULL RUNS  ·  " + RUNS + " runs  ·  " + api.difficulty().n
    + "  ·  play=" + PLAY + "  buy=" + BUY);
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
  console.log("\nFigures written  (0 across the board = the joins are not being read)");
  console.log("  runs that made any figure at all  " + banked + " of " + res.length
    + "  (" + (banked / res.length * 100).toFixed(1) + "%)");
  console.log("  distinct figures in a run   p50 " + tops[Math.floor(tops.length * 0.5)]
    + "   p90 " + tops[Math.floor(tops.length * 0.9)]
    + "   max " + tops[tops.length - 1]);
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
/* The floor player.
 *
 * curve() asks what a round can PRODUCE, which is a question about the best
 * hand in the deck. The opening rounds are not aimed at that player. They are
 * aimed at someone thirty seconds into their first run who takes the first
 * three cards as dealt, does not reorder them, does not discard, and has not
 * yet noticed that the shape of a hand is worth anything.
 *
 * Round 1 has to sit UNDER this distribution or a beginner loses their first
 * round to a rule nobody has shown them yet. Round 2 is allowed to sit just
 * above its median: that is the round where clicking stops working.
 */
function floor() {
  const n = Math.max(200, RUNS);
  console.log("=".repeat(64));
  console.log("WHAT A PLAYER WHO HAS UNDERSTOOD NOTHING CAN MAKE  ·  " + n + " runs");
  console.log("=".repeat(64));
  console.log("");
  console.log("round      p5      p20      p50      p80    current target");
  for (let round = 0; round < api.ROUNDS; round++) {
    const out = [];
    for (let s = 0; s < n; s++) {
      api.newRun("floor-" + s, true);
      api.G.round = round;
      api.startRound();
      api.G.target = Infinity;
      let score = 0;
      while (api.G.plays > 0) {
        const cards = api.G.hand.slice(0, Math.min(3, api.maxPlay()));
        if (!cards.length) break;
        score += api.resolve(cards).total;
        api.G.hand = api.G.hand.filter(c => cards.indexOf(c) < 0);
        api.G.discard = api.G.discard.concat(cards);
        api.G.plays--;
        api.draw(api.handSize() - api.G.hand.length);
      }
      out.push(score);
    }
    out.sort((a, b) => a - b);
    const q = f => Math.round(out[Math.floor(out.length * f)]);
    console.log("  " + (round + 1) + "   " + [q(.05), q(.2), q(.5), q(.8)]
      .map(v => String(v).padStart(8)).join("")
      + "    " + String(api.TARGETS[round]).padStart(8));
  }
  console.log("");
  console.log("Only rounds 1 and 2 are set from this. Everything after them assumes");
  console.log("  a player who has read the board at least once.");
}

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
  const CUTS = [0.03, 0.05, 0.1, 0.14, 0.18, 0.22, 0.26, 0.45];
  console.log("round" + CUTS.map(c => ("p" + Math.round(c * 100)).padStart(9)).join("")
    + "   current target");
  per.forEach((r, i) => {
    r.sort((x, y) => x - y);
    const q = f => Math.round(r[Math.floor(r.length * f)]);
    console.log("  " + (i + 1) + "  " + CUTS.map(c => String(q(c)).padStart(9)).join("")
      + "    " + String(api.TARGETS[i]).padStart(7)
      + "  (p" + Math.round(100 * r.filter(x => x < api.TARGETS[i]).length / r.length) + ")");
  });
  console.log("");
  console.log("The shipped curve sits at p3/p5/p10/p14/p18/p22/p26/p45 - read the");
  console.log("  diagonal of this table to re-derive it after a scoring change.");
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
else if (ARGS.includes("--floor")) floor();
else if (ARGS.includes("--lenses")) lensPower();
else if (ARGS.includes("--stacks")) stacks();
else {
  headline();
  console.log("\n" + "-".repeat(64));
  console.log("also: --lenses (per-Lens power)   --stacks (the ceiling)");
}
