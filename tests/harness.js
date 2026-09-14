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
    resolve, newRun, startRound, draw, toggleSel, winRound, rollOffers,
    makeCard, houseAppraise, deckCount, resonanceName, shareText, endRun, store,
    buy, openShop, coachDone, coachFinish, coachSet,
    cardEl, artNode, isLightHex, hashStr, mulberry32, todayKey,
    LEXICON, LENSES, DEMANDS, TARGETS, TAGS, TAG_KEYS, ICONS, TAG_COLOR,
    LENS_TAG, ROUNDS, HAND_SIZE, MAX_PLAY, LENS_SLOTS, COACH, RESO_NAMES
  };`, ctx);

  return { api: ctx.__api, ctx, byId, storage: store };
}

/* Valid overtone codes, read from the game rather than restated here. */
function tagCodes(api){ return Object.keys(api.TAGS); }

/* Every word currently in the deck, discard and hand. */
function wholeDeck(G){ return G.deck.concat(G.discard, G.hand); }

module.exports = { load, makeEl, tagCodes, wholeDeck, GAME };
