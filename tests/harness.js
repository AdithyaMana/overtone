/* Load the real game into a Node VM.
 *
 * index.html ships as one file with the engine inline, so rather than copying
 * logic into a test double (which then drifts), this stubs just enough DOM for
 * the script to run and hands back its actual functions and state. Every logic
 * test below therefore exercises the code that really ships.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const GAME = path.join(__dirname, "..", "index.html");

/* A DOM node that accepts anything and remembers the little we assert on. */
function makeEl(tag){
  const classes = new Set();
  const el = {
    tagName: (tag || "div").toUpperCase(),
    children: [],
    parentNode: null,
    style: { setProperty(){}, cssText: "", background: "" },
    classList: {
      add(){ for (const c of arguments) classes.add(c); },
      remove(){ for (const c of arguments) classes.delete(c); },
      toggle(c, on){ on ? classes.add(c) : classes.delete(c); },
      contains(c){ return classes.has(c); }
    },
    _classes: classes,
    dataset: {},
    textContent: "", innerHTML: "", value: "", title: "",
    hidden: false, disabled: false, tabIndex: 0, offsetWidth: 0,
    onclick: null, onkeydown: null,
    appendChild(c){ this.children.push(c); if (c) c.parentNode = this; return c; },
    insertBefore(c){ this.children.push(c); if (c) c.parentNode = this; return c; },
    removeChild(c){ const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); },
    remove(){ if (this.parentNode) this.parentNode.removeChild(this); },
    setAttribute(){}, getAttribute(){ return null; },
    addEventListener(){}, removeEventListener(){},
    focus(){}, animate(){ return { cancel(){} }; },
    querySelector(){ return makeEl("div"); },
    querySelectorAll(){ return []; }
  };
  return el;
}

function load(){
  const html = fs.readFileSync(GAME, "utf8");
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error("no inline <script> found in index.html");

  const byId = Object.create(null);
  const store = Object.create(null);
  /* A brand-new profile starts on the GENTLEST curve, which is right for a
     person and wrong for a test: nearly everything here pins the steeper one.
     Tests that care about the gentler curve set it themselves.

     curvesMigrated comes with it, so the one-time storage migration does not
     run on every load() — it would keep copying the old best-score keys over
     whatever a test had just written. */
  store["overtone:curvesMigrated"] = JSON.stringify(true);
  store["overtone:difficulty"] = JSON.stringify("scholar");

  /* The page starts its spotlight tutorial on a first visit, and that runs a
     setInterval which would hold Node's event loop open forever — node --test
     would never exit. Engine tests are not testing onboarding, so arrive as a
     player who has already seen it. (The tutorial itself is covered in
     tests/e2e/game.spec.js, in a browser that has an event loop anyway.) */
  store["overtone:tutorial"] = "true";
  store["overtone:coached"] = "true";

  const win = {
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener(){},
    /* Reduced motion short-circuits the rAF tweens, so state settles
       synchronously and assertions do not race an animation. */
    matchMedia(){ return { matches: true, addEventListener(){} }; },
    claude: undefined
  };

  const documentStub = {
    getElementById(id){ return byId[id] || (byId[id] = makeEl("div")); },
    createElement(tag){ return makeEl(tag); },
    /* A card's word is a text node so that the value can float beside it, and
       a stub that cannot make one fails every test in the suite with
       "document.createTextNode is not a function". */
    createTextNode(text){
      return { nodeType: 3, nodeName: "#text", textContent: String(text),
               parentNode: null, children: [] };
    },
    querySelector(){ return makeEl("div"); },
    querySelectorAll(){ return []; },
    addEventListener(){},
    documentElement: makeEl("html"),
    body: makeEl("body"),
    fonts: undefined
  };

  const sandbox = {
    window: win,
    document: documentStub,
    localStorage: {
      getItem(k){ return k in store ? store[k] : null; },
      setItem(k, v){ store[k] = String(v); },
      removeItem(k){ delete store[k]; },
      clear(){ for (const k in store) delete store[k]; }
    },
    /* No vibrate: buzz() must stay a no-op rather than throwing, which is
       also exactly what an iPhone gives it. */
    navigator: { clipboard: { writeText(){ return Promise.resolve(); } } },
    performance: { now: () => Date.now() },
    requestAnimationFrame(){ return 0; },
    cancelAnimationFrame(){},
    setTimeout, clearTimeout, setInterval, clearInterval,
    Image: function(){ return makeEl("img"); },
    console
  };
  sandbox.globalThis = sandbox;
  win.document = documentStub;

  const ctx = vm.createContext(sandbox);
  vm.runInContext(m[1], ctx, { filename: "necrocards.js" });

  /* Top-level const/let live in the context's lexical scope, not on the
     sandbox object — so export them deliberately. */
  vm.runInContext(`globalThis.__api = {
    get G(){ return G; },
    resolve, newRun, startRound, draw, toggleSel, discardSel, winRound, rollOffers,
    makeCard, houseAppraise, deckCount, resonanceName, shareText, endRun, store,
    handSize, maxPlay, roundShape, baseShape, deckCeiling, sellValue, sellLens,
    reckoning, reckonFor, roundRules, RECKON_AT, RECKON_FROM,
    ORDEALS, ordealRoundsFor, ordealPoolFor,
    buy, openShop, coachDone, coachFinish, coachSet,
    cardEl, artNode, isLightHex, hashStr, mulberry32, todayKey,
    LEXICON, LENSES, DEMANDS, TARGETS, TAGS, TAG_KEYS, ICONS, TAG_COLOR,
    LENS_TAG, ROUNDS, HAND_SIZE, MAX_PLAY, LENS_SLOTS, COACH, RESO_NAMES,
    /* kept lines have their own shelf now, and the line floor is a
       function because two Lenses are bought to play a single word. */
    KEEP_SLOTS, keepsUsed, keepsFull, slotsUsed, slotsLeft, slotsFull,
    /* the round's Demand pays multiplier as well as points now */
    DEMAND_CHIPS, DEMAND_MULT, JOIN_RESONANCE, JOIN_TENSION, demandHits, LINE_MIN,
    minPlay, SOLO_LENSES, FIG_PAY,
    FIGURES, FIG_PAY, figuresIn, figureFor, figureByReorder, figValue, arrangeForTutorial,
    lineWorth, bestLineFrom, OPPOSED, sharedTags, tensionPairs, joinOf, joinsOf, figuresFromJoins,
    JOIN_RESONANCE, JOIN_TENSION, KEPT_CHIPS, KEPT_MULT, FATIGUE_SPAN, LINE_MIN,
    DIFFICULTIES, difficulty, runDifficulty, prefs, setPref,
    flawsSeen, curveScale, shapeFor, clashes, ORDEAL_CLASH,
    DIFF_BY_ID, DIFF_BY_RANK, easiestDiff, diffBelow, diffAbove, modeOpen,
    ordealPoolAt, DISARMING, blindMode, JOIN_NAME, JOIN_SAID,
    PLAYS_PER_ROUND, DISCARDS_PER_ROUND, runTouched
  };`, ctx);

  return { api: ctx.__api, ctx, byId, storage: store };
}

/* Valid overtone codes, read from the game rather than restated here. */
function tagCodes(api){ return Object.keys(api.TAGS); }

/* Every word currently in the deck, discard and hand. */
function wholeDeck(G){ return G.deck.concat(G.discard, G.hand); }

module.exports = { load, makeEl, tagCodes, wholeDeck, GAME };
