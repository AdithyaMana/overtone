#!/usr/bin/env node
/* The JOIN physics, simulated before any of it is wired into the game.
 *
 *   node tools/join-sim.js [--runs 400] [--diff scholar] [--blind]
 *
 * SPEC-the-verb-is-join, migration.md steps 1 to 3: the join classifier, line
 * scoring, and a curve. None of this needs an interface, and if the win rate
 * cannot be brought inside CAP-7's [15%, 30%] with these shapes then that is
 * the moment to stop rather than to keep building.
 *
 * It borrows the real LEXICON, TAGS, DEMANDS and deck construction from the
 * shipped game through the test harness, so the words, their overtones and the
 * shape of a deal are exactly what players would get. Only the scoring is new.
 */
const { api } = require("../tests/harness.js").load();
const TAGS = api.TAGS;

const nameOf = t => TAGS[t][0];
const KEY = {};
Object.keys(TAGS).forEach(k => KEY[nameOf(k)] = k);

/* ---- the opposition table (join-mechanics.md) ---- */
const OPPOSED = [
  ["HEAT", "COLD"], ["DARK", "BRIGHT"], ["NATURE", "TECH"], ["MIND", "BODY"],
  ["WET", "HEAT"], ["ABSTRACT", "BODY"], ["ABSTRACT", "FOOD"], ["ABSTRACT", "TOOL"]
].map(p => [KEY[p[0]], KEY[p[1]]]);

/* ---- constants, all provisional ---- */
const C = {
  JOIN_RESONANCE: 40,
  JOIN_TENSION: 1,
  DEMAND_PTS: 25,
  LINE_MIN: 2,
  LINE_MAX: 5,
  ROUNDS: 6,
  PLAYS: 2,
  DISCARDS: 3,
  HAND: 7,
  FATIGUE_SPAN: 2,
  LENS_SLOTS: 5,
  KEPT_CHIPS: 120,
  KEPT_MULT: 1,
  FIG: {
    ANTITHESIS: { chips:  80, mult: 0 },
    SYNONYMY:   { chips: 120, mult: 0 },
    PARADOX:    { chips: 200, mult: 1 },
    ESCALATION: { chips: 150, mult: 0 },
    CHIASMUS:   { chips: 250, mult: 2 }
  }
};

/* ---- a join ---- */
function sharedTags(a, b){ return a.t.filter(t => b.t.indexOf(t) >= 0); }
function tensionCount(a, b){
  let n = 0;
  for(const p of OPPOSED){
    if((a.t.indexOf(p[0]) >= 0 && b.t.indexOf(p[1]) >= 0) ||
       (a.t.indexOf(p[1]) >= 0 && b.t.indexOf(p[0]) >= 0)) n++;
  }
  return n;
}
function joinOf(a, b, dull){
  const s = sharedTags(a, b).filter(t => !dull || !dull[t]).length;
  const t = tensionCount(a, b);          /* opposition is a fact, never dulled */
  return { s: s, t: t,
           kind: s && t ? "PARADOX" : t ? "TENSION" : s ? "RESONANCE" : "SILENCE" };
}

function figuresOf(joins){
  const f = {};
  joins.forEach(j => {
    if(j.kind === "PARADOX") f.PARADOX = 1;
    else if(j.kind === "TENSION") f.ANTITHESIS = 1;
    if(j.s >= 3) f.SYNONYMY = 1;
  });
  for(let i = 0; i + 1 < joins.length; i++)
    if(joins[i].s < joins[i + 1].s) f.ESCALATION = 1;
  const k = joins.map(j => j.t ? "T" : "R");
  for(let i = 0; i + 2 < k.length; i++)
    if(k[i] === k[i + 2] && k[i] !== k[i + 1]) f.CHIASMUS = 1;
  return Object.keys(f);
}

/* ---- scoring a line, stopping at the first silence ---- */
function scoreLine(line, demandTags, dull, kept){
  let chips = 0, mult = 1, scored = 1;
  const joins = [];
  for(let i = 0; i < line.length - 1; i++){
    const j = joinOf(line[i], line[i + 1], dull);
    if(j.kind === "SILENCE") break;
    joins.push(j);
    scored = i + 2;
    chips += C.JOIN_RESONANCE * j.s;
    mult  += C.JOIN_TENSION   * j.t;
  }
  const figs = figuresOf(joins);
  figs.forEach(n => { chips += C.FIG[n].chips; mult += C.FIG[n].mult; });
  /* Lines the player kept in earlier rounds pay again whenever the figure they
     made comes back. This is the run's only engine - there is nothing to buy. */
  if(kept) kept.forEach(k => {
    if(figs.indexOf(k) >= 0){ chips += C.KEPT_CHIPS; mult += C.KEPT_MULT; }
  });
  const used = {};
  for(let i = 0; i < scored; i++){
    const c = line[i];
    chips += c.base;
    c.t.forEach(t => {
      if(dull && dull[t]) return;
      if(demandTags.indexOf(t) >= 0){ chips += C.DEMAND_PTS; used[t] = 1; }
    });
  }
  joins.forEach((j, i) => sharedTags(line[i], line[i + 1])
    .forEach(t => { if(!dull || !dull[t]) used[t] = 1; }));
  return { chips: chips, mult: mult, total: chips * mult,
           joins: joins, figs: figs, scored: scored, used: Object.keys(used) };
}

/* ---- the search: every ordered line of LINE_MIN..LINE_MAX ---- */
function bestLine(hand, demandTags, dull, known, kept){
  /* `known` limits what the player can see: a word whose overtones they have
     never seen is played on faith, and they judge it by nothing at all. */
  const see = c => known && !known[c.w]
    ? { w: c.w, base: c.base, t: [] }      /* they know the word, not its rings */
    : c;
  const view = hand.map(see);
  let best = null;
  const walk = (cur, rest) => {
    if(cur.length >= C.LINE_MIN){
      const r = scoreLine(cur, demandTags, dull, kept);
      if(!best || r.total > best.score.total) best = { idx: cur.map(c => c.__i), score: r };
    }
    if(cur.length >= C.LINE_MAX) return;
    rest.forEach((c, i) => walk(cur.concat([c]), rest.filter((_, j) => j !== i)));
  };
  view.forEach((c, i) => { c.__i = i; });
  walk([], view);
  return best;
}

/* ---- one run ---- */
function runOnce(seed, targets, opts){
  opts = opts || {};
  api.newRun(seed);
  const G = api.G;
  /* The real game reshuffles its discard back in when the deck runs out, and
     redeals the hand between rounds. A simulation that throws played cards
     away runs a 26-card deck dry on the fifth play and reports a design
     failure that belongs to the simulation. */
  let deck = G.deck.slice(), discard = (G.discard || []).slice();
  let hand = G.hand.slice();
  let salt = 0;
  const reshuffle = () => {
    const keyed = discard.map(c => [api.hashStr(c.w + ":" + (salt++)) >>> 0, c]);
    keyed.sort((a, b) => a[0] - b[0]);
    deck = keyed.map(k => k[1]);
    discard = [];
  };
  const draw = () => {
    while(hand.length < C.HAND){
      if(!deck.length){ if(!discard.length) return; reshuffle(); }
      hand.push(deck.pop());
    }
  };
  const known = opts.blind ? (opts.known || {}) : null;
  const dullFor = {};          /* tag -> plays remaining */
  let stoppedEarly = 0, plays = 0, figSeen = {}, maxRound = 0;
  const kept = [];

  for(let r = 0; r < C.ROUNDS; r++){
    maxRound = r;
    const demand = api.DEMANDS[(api.hashStr(seed + ":" + r) >>> 0) % api.DEMANDS.length].tags;
    /* a fresh hand each round, as the board does */
    discard = discard.concat(hand); hand = []; draw();
    let score = 0, left = C.PLAYS, disc = C.DISCARDS, bestOfRound = null;
    while(left > 0){
      draw();
      if(hand.length < C.LINE_MIN) break;
      const dull = {};
      Object.keys(dullFor).forEach(t => { if(dullFor[t] > 0) dull[t] = 1; });
      const pick = bestLine(hand, demand, dull, known, kept);
      if(!pick) break;
      /* score it for real, against the true cards rather than the player's view */
      const realLine = pick.idx.map(i => hand[i]);
      const got = scoreLine(realLine, demand, dull, kept);
      if(got.scored < realLine.length) stoppedEarly++;
      score += got.total;
      plays++;
      if(!bestOfRound || got.total > bestOfRound.total) bestOfRound = got;
      got.figs.forEach(f => { figSeen[f] = 1; });
      if(known) realLine.forEach(c => { known[c.w] = 1; });
      Object.keys(dullFor).forEach(t => { dullFor[t] = Math.max(0, dullFor[t] - 1); });
      got.used.forEach(t => { dullFor[t] = C.FATIGUE_SPAN; });
      const taken = {};
      pick.idx.forEach(i => { taken[i] = 1; });
      discard = discard.concat(hand.filter((_, i) => taken[i]));
      hand = hand.filter((_, i) => !taken[i]);
      left--;
      if(score >= targets[r]) break;
    }
    /* The round is cleared, so the player keeps one line they wrote. */
    if(score >= targets[r] && bestOfRound && kept.length < C.LENS_SLOTS && bestOfRound.figs.length)
      kept.push(bestOfRound.figs[0]);
    if(score < targets[r])
      return { won: false, round: r, plays: plays, stoppedEarly: stoppedEarly,
               figs: Object.keys(figSeen).length, kept: kept.length };
  }
  return { won: true, round: C.ROUNDS, plays: plays, stoppedEarly: stoppedEarly,
           figs: Object.keys(figSeen).length, kept: kept.length };
}

/* ---- targets: measured, not guessed ---- */
function measureCeiling(runs){
  const per = [];
  for(let s = 0; s < runs; s++){
    api.newRun("ceil-" + s);
    const hand = api.G.hand.slice(0, C.HAND);
    const demand = api.DEMANDS[s % api.DEMANDS.length].tags;
    const b = bestLine(hand, demand, null, null);
    if(b) per.push(b.score.total);
  }
  per.sort((a, b) => a - b);
  return per;
}

/* ---- report ---- */
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const RUNS = +argOf("--runs", 400);
const BLIND = args.indexOf("--blind") >= 0;

const ceiling = measureCeiling(200);
const p = (a, q) => a[Math.min(a.length - 1, Math.floor(a.length * q))];
console.log("ONE LINE, PLAYED PERFECTLY, ROUND 1");
console.log("  p10 " + p(ceiling, .1).toLocaleString()
  + "   p50 " + p(ceiling, .5).toLocaleString()
  + "   p90 " + p(ceiling, .9).toLocaleString());

/* Two plays a round, and a curve that outgrows a flat deck. */
const BASE_MUL = +argOf("--base", 1.2);
const base = Math.round(p(ceiling, .5) * BASE_MUL);
const CURVE = +argOf("--curve", 1.75);
const TARGETS = [];
for(let r = 0; r < C.ROUNDS; r++) TARGETS.push(Math.round(base * Math.pow(CURVE, r)));
console.log("  TARGETS  " + TARGETS.map(t => t.toLocaleString()).join("  "));

let won = 0; const deaths = {}; const figs = [], stops = [];
const known = BLIND ? {} : null;
for(let s = 0; s < RUNS; s++){
  const r = runOnce("join-" + s, TARGETS, { blind: BLIND, known: known });
  if(r.won) won++; else deaths[r.round + 1] = (deaths[r.round + 1] || 0) + 1;
  figs.push(r.figs); stops.push(r.stoppedEarly);
}
figs.sort((a, b) => a - b); stops.sort((a, b) => a - b);
const rate = 100 * won / RUNS;
const se = Math.sqrt((rate / 100) * (1 - rate / 100) / RUNS) * 100;
console.log("\n" + RUNS + " RUNS" + (BLIND ? ", BLIND PLAYER (learns words as it plays)" : ", FULL INFORMATION"));
console.log("  win rate     " + rate.toFixed(1) + "%   95% CI "
  + (rate - 1.96 * se).toFixed(1) + " - " + (rate + 1.96 * se).toFixed(1)
  + "   " + (rate >= 15 && rate <= 30 ? "BOUND MET" : "outside [15, 30]"));
console.log("  died in round  " + Object.keys(deaths).sort((a, b) => a - b)
  .map(k => k + ":" + (100 * deaths[k] / RUNS).toFixed(1) + "%").join("  "));
console.log("  distinct figures per run   p50 " + p(figs, .5) + "   p90 " + p(figs, .9));
console.log("  lines stopped on a silence p50 " + p(stops, .5) + "   p90 " + p(stops, .9));
