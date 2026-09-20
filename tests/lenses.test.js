/* Per-Lens arithmetic.
 *
 * The fuzz in logic.test.js proves no Lens crashes or produces nonsense. It
 * does NOT prove ANTONYM ENGINE pays exactly 180 and doubles. These do: each
 * one builds a controlled hand, scores it with and without the Lens, and
 * asserts the exact difference. A Lens whose numbers are retuned in
 * index.html without updating its test will fail here, which is the point —
 * and a whole balance pass went through this file precisely because of it.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert");
const { load } = require("./harness.js");

const { api } = load();

const card = (w, tags) => api.makeCard({ w, t: tags }, false);
const sigil = id => {
  const l = api.LENSES.find(x => x.id === id);
  assert.ok(l, "no Lens with id " + id);
  return l;
};

/* Score a hand with no Lenses, then with one, and hand back both.
   `opts.level` pre-seeds what a growing Lens has already grown to. */
function compare(id, cards, demandTags, opts) {
  api.newRun("sigil-" + id);
  api.G.demand = { n: "TEST", tags: demandTags || [] };
  if (opts && typeof opts.discards === "number") api.G.discards = opts.discards;

  api.G.lenses = [];
  api.G.lensState = {};
  const without = api.resolve(cards);

  api.G.lenses = [sigil(id)];
  api.G.lensState = opts && opts.level ? { [id]: opts.level } : {};
  const with_ = api.resolve(cards);
  /* `add` and `mult` are the Lens's own contribution, isolated from whatever the
     hand was already worth. That matters more than it used to: a hand is scored
     for its FIGURE before any Lens is consulted, so the multiplier on two words
     of the same length does not start at 1. A Lens test should fail when the
     Lens changes, not when its fixture happens to rhyme. */
  return { without, with_, chips: with_.chips - without.chips,
           mult: with_.mult / without.mult, add: with_.mult - without.mult };
}

/* ================================================================== */
describe("Lenses that grow with the run", () => {
  /* Each is "base now, +grows for every round you have held it". The base is
     what it pays on the round you buy it; the level is what startRound() has
     banked into G.lensState since. */
  const scalers = [
    { id: "doom",  base: 30, grows: 40,  hit: card("VENOM", ["DAN"]),        miss: card("MOSS", ["PLA"]) },
    { id: "chron", base: 35, grows: 80,  hit: card("FOSSIL", ["TIM"]),       miss: card("ANVIL", ["TOO"]) },
    { id: "pyro",  base: 25, grows: 110, hit: card("EMBER", ["HEA"]),        miss: card("GLACIER", ["COL"]) },
    { id: "meta",  base: 40, grows: 120, hit: card("DOUBT", ["ABS"]),        miss: card("ANVIL", ["TOO"]) },
    { id: "prosp", base: 40, grows: 190, hit: card("BULLION", ["MON"]),      miss: card("MOSS", ["PLA"]) },
    /* SESQUIPEDALIAN was "7 letters or more" and is "3 or more overtones"
       now, so the fixture is a word that means three things. */
    { id: "sesq",  base: 60, grows: 95,
      hit: card("AVALANCHE", ["COL", "MOT", "DAN"]),  miss: card("OAK", ["PLA"]) },
    { id: "poly",  base: 90, grows: 75,
      hit: card("AVALANCHE", ["COL", "MOT", "DAN", "LOU"]), miss: card("OAK", ["PLA", "NAT", "TIM"]) }
  ];

  scalers.forEach(s => {
    test(sigil(s.id).n + " pays " + s.base + " fresh, and " + s.base + "+level once grown", () => {
      assert.strictEqual(compare(s.id, [s.hit]).chips, s.base, "wrong base payout");
      assert.strictEqual(compare(s.id, [s.miss]).chips, 0, "fired on a word it should ignore");

      /* two rounds' worth of growth */
      const grown = compare(s.id, [s.hit], [], { level: s.grows * 2 });
      assert.strictEqual(grown.chips, s.base + s.grows * 2, "growth not read back");

      /* and it pays per word, not per hand */
      const two = compare(s.id, [s.hit, s.hit], [], { level: s.grows });
      assert.strictEqual(two.chips, (s.base + s.grows) * 2, "did not pay per word");
    });

    test(sigil(s.id).n + " declares the growth its own description promises", () => {
      const l = sigil(s.id);
      assert.strictEqual(l.grows, s.grows, "grows field does not match the tuning");
      assert.ok(l.d.indexOf("+" + s.grows + " more") >= 0,
        l.n + " says \"" + l.d + "\" but grows by " + l.grows);
    });
  });

  test("growth is banked once per round, by startRound", () => {
    api.newRun("growth");
    api.G.lenses = [sigil("pyro")];
    api.G.lensState = {};
    api.startRound();
    assert.strictEqual(api.G.lensState.pyro, 110, "one round should bank one step");
    api.startRound();
    assert.strictEqual(api.G.lensState.pyro, 220, "growth did not accumulate");
  });

  test("resolve never advances growth on its own", () => {
    /* renderPreview calls resolve on every click. If scoring a hand grew a
       Lens, the board would show one number and pay another — and "the board
       shows what you would score before you commit" is the promise the whole
       design rests on. */
    api.newRun("pure");
    api.G.lenses = [sigil("pyro")];
    api.G.lensState = { pyro: 110 };
    const hand = [card("EMBER", ["HEA"]), card("FORGE", ["HEA"])];
    const a = api.resolve(hand).total;
    const b = api.resolve(hand).total;
    const c = api.resolve(hand).total;
    assert.strictEqual(a, b);
    assert.strictEqual(b, c, "scoring the same hand twice gave two answers");
    assert.strictEqual(api.G.lensState.pyro, 110, "resolve mutated the Lens level");
  });
});

/* ================================================================== */
describe("flat chip Lenses", () => {
  test("LEXICOGRAPHER pays for the overtones of the leftmost word only", () => {
    /* Was per LETTER. Nothing in scoring reads spelling any more, so it counts
       what the head word MEANS: 2 + 2 per overtone. */
    const head = card("HAMMER", ["TOO", "HEA"]);           // two overtones -> x6
    const one = compare("lexi", [head, card("EMBER", ["HEA"])]);
    assert.strictEqual(one.chips, 22 * 6, "22 x (2 + 2 per overtone) for HAMMER alone");
    const grown = compare("lexi", [card("HAMMER", ["TOO", "HEA"])], [], { level: 14 });
    assert.strictEqual(grown.chips, (22 + 14) * 6);
  });

  test("ALCHEMIST pays once when NATURE and TECH are both present", () => {
    const both = compare("alch", [card("MOSS", ["NAT"]), card("ENGINE", ["TEC"])]);
    assert.strictEqual(both.chips, 250);
    const one = compare("alch", [card("MOSS", ["NAT"]), card("OAK", ["PLA"])]);
    assert.strictEqual(one.chips, 0, "paid without TECH");
    const grown = compare("alch", [card("MOSS", ["NAT"]), card("ENGINE", ["TEC"])], [], { level: 240 });
    assert.strictEqual(grown.chips, 490);
  });

  test("ECHO pays 70 for every overtone two played words share", () => {
    const share2 = compare("echo", [card("EMBER", ["HEA", "DAN"]), card("VENOM", ["HEA", "DAN"])]);
    assert.strictEqual(share2.chips, 140, "two shared overtones should pay twice");
    const share0 = compare("echo", [card("EMBER", ["HEA"]), card("MOSS", ["PLA"])]);
    assert.strictEqual(share0.chips, 0);
  });

  test("CARNIVORE gives an ANIMAL word four times the base of the word to its left", () => {
    /* NATURE on both, so the line actually reads as far as the ANIMAL word.
       Two words with nothing in common stop the line at the first of them. */
    const left = card("AVALANCHE", ["COL", "NAT"]);
    const r = compare("carn", [left, card("WOLF", ["ANI", "NAT"])]);
    assert.strictEqual(r.chips, left.base * 4);
    const first = compare("carn", [card("WOLF", ["ANI", "NAT"]), card("MOSS", ["PLA", "NAT"])]);
    assert.strictEqual(first.chips, 0, "an ANIMAL word played first has nothing to eat");
  });

  test("MISER pays 140 for each discard still held", () => {
    assert.strictEqual(compare("miser", [card("OAK", ["PLA"])], [], { discards: 3 }).chips, 420);
    assert.strictEqual(compare("miser", [card("OAK", ["PLA"])], [], { discards: 0 }).chips, 0);
  });
});

/* ================================================================== */
describe("Lenses that add to the multiplier", () => {
  const adders = [
    { id: "zoo",   tag: "ANI", w: "WOLF" },
    { id: "hydro", tag: "WET", w: "TIDE" },
    { id: "phren", tag: "MIN", w: "MEMORY" },
    { id: "night", tag: "DAR", w: "SHADOW" }
  ];
  adders.forEach(a => {
    test(sigil(a.id).n + " adds exactly 1 per matching word", () => {
      const one = compare(a.id, [card(a.w, [a.tag])]);
      assert.strictEqual(one.add, 1, "+1 on one matching word");
      const two = compare(a.id, [card(a.w, [a.tag]), card(a.w + "S", [a.tag])]);
      assert.strictEqual(two.add, 2, "should add per word");
      const none = compare(a.id, [card("ANVIL", ["TOO"])]);
      assert.strictEqual(none.add, 0);
    });
  });

  test("RESONATOR adds 2, once, on the first word that matches the round", () => {
    /* compare() reads the DELTA the Lens makes, so the Demand's own
       multiplier - which both of these words now earn - cancels out. */
    const r = compare("reso", [card("EMBER", ["HEA"]), card("FORGE", ["HEA"])], ["HEA"]);
    assert.strictEqual(r.add, 2, "+2, and only once");
    const none = compare("reso", [card("MOSS", ["PLA"])], ["HEA"]);
    assert.strictEqual(none.add, 0);
  });

  test("LITERALIST rewards the concrete and punishes the abstract twice over", () => {
    const solid = compare("literal", [card("ANVIL", ["TOO"])]);
    assert.strictEqual(solid.with_.mult, 2, "concrete word: +1");

    const abstract = card("DOUBT", ["ABS"]);
    const voided = compare("literal", [abstract]);
    assert.strictEqual(voided.with_.chips, 0, "an ABSTRACT word should score nothing");
    /* 1 - 2 is below the floor resolve() clamps to */
    assert.ok(voided.with_.mult < 1, "an ABSTRACT word should cost multiplier too");
  });
});

/* ================================================================== */
describe("Lenses that multiply the multiplier", () => {
  test("SYNESTHETE triples on a word that is both LOUD and BRIGHT", () => {
    assert.strictEqual(compare("syn", [card("FANFARE", ["LOU", "BRI"])]).with_.mult, 3);
    assert.strictEqual(compare("syn", [card("FANFARE", ["LOU"])]).with_.mult, 1, "fired on LOUD alone");
  });

  test("ANTONYM ENGINE pays 180 and doubles for HEAT straight after COLD", () => {
    const hot = compare("anton", [card("GLACIER", ["COL"]), card("EMBER", ["HEA"])]);
    assert.strictEqual(hot.chips, 180);
    /* The Lens's own doubling, not the hand's multiplier. HEAT next to COLD is
       an opposition, so the line is already worth more than x1 before the Lens
       is consulted, and `mult` is the ratio the Lens is responsible for. */
    assert.strictEqual(hot.mult, 2);

    const reversed = compare("anton", [card("EMBER", ["HEA"]), card("GLACIER", ["COL"])]);
    assert.strictEqual(reversed.chips, 180, "should work in both directions");

    /* NATURE throughout so the line reads to the end - otherwise this passes
       because the third word is never scored, which proves nothing. */
    const apart = compare("anton",
      [card("GLACIER", ["COL", "NAT"]), card("MOSS", ["PLA", "NAT"]),
       card("EMBER", ["HEA", "NAT"])]);
    assert.strictEqual(apart.chips, 0, "the two words must be adjacent");
  });

  test("BRUTALIST multiplies by 1.6 for each word carrying a single overtone", () => {
    /* Was "four letters or fewer" - which on the blind curve was the one thing
       a player could still read off a card with its overtones hidden. */
    assert.strictEqual(compare("brut", [card("OAK", ["PLA"])]).with_.mult, 1.6);
    /* The same single overtone on both: one apiece for BRUTALIST, and shared,
       so the line reads past the first word. */
    const two = compare("brut", [card("OAK", ["NAT"]), card("TIDE", ["NAT"])]);
    assert.ok(Math.abs(two.mult - 2.56) < 1e-9, "1.6 x 1.6");
    assert.strictEqual(compare("brut", [card("HAMMER", ["TOO", "HEA"])]).with_.mult, 1,
      "a word that means two things is not the blunt instrument");
  });

  test("ASCETIC multiplies by 5, and only for a single word", () => {
    assert.strictEqual(compare("asc", [card("OAK", ["PLA"])]).with_.mult, 5);
    assert.strictEqual(compare("asc", [card("OAK", ["PLA"]), card("TIDE", ["WET"])]).with_.mult, 1);
  });

  test("ENTROPY rewards three descending words and punishes everything else", () => {
    /* Was descending LETTERS. Descending OVERTONES now: three, two, one. */
    /* Overtones that RESONATE rather than oppose. A tension between two words
       is itself worth multiplier, which would be folded into the figure under
       test - the fixture has to leave the bare line at x1. */
    const wide = ["NAT", "WET", "PLA"], mid = ["NAT", "WET"], thin = ["NAT"];
    const down = compare("entropy",
      [card("AVALANCHE", wide), card("EMBER", mid), card("OAK", thin)]);
    assert.strictEqual(down.with_.mult, 2.5);

    const up = compare("entropy",
      [card("OAK", thin), card("EMBER", mid), card("AVALANCHE", wide)]);
    assert.strictEqual(up.with_.mult, 0.5, "an ascending hand should be punished");

    const two = compare("entropy", [card("AVALANCHE", wide), card("OAK", thin)]);
    assert.strictEqual(two.with_.mult, 0.5, "fewer than three words is not a qualifying hand");
  });

  test("and ENTROPY is marked as a Lens that can cost you", () => {
    /* The best line achievable while holding it measured 0.658x the best line
       without it, on a $7 card the shop presented as pure upside. */
    assert.ok(api.LENSES.find(l => l.id === "entropy").flaw,
      "ENTROPY lowers your score and must carry the flaw mark");
  });

  test("GLUTTON multiplies by 3.2 for exactly three words, and costs a discard", () => {
    const three = compare("glut",
      [card("OAK", ["NAT"]), card("TIDE", ["NAT"]), card("EMBER", ["NAT"])]);
    assert.strictEqual(three.mult, 3.2);
    assert.strictEqual(compare("glut", [card("OAK", ["PLA"])]).with_.mult, 1);

    api.newRun("glut-round");
    api.G.lenses = [sigil("glut")];
    api.startRound();
    assert.strictEqual(api.G.discards, 2, "GLUTTON should take a discard");
  });
});

/* ================================================================== */
describe("the flawed Lenses take something back", () => {
  test("THE WAGER multiplies by 3 and costs a play", () => {
    assert.strictEqual(compare("wager", [card("OAK", ["PLA"])]).with_.mult, 3);
    api.newRun("wager");
    api.G.lenses = [sigil("wager")];
    api.startRound();
    assert.strictEqual(api.G.plays, api.PLAYS_PER_ROUND - 1,
      "THE WAGER should cost exactly one of the round's plays");
  });

  test("THE TITHE pays 1,000 and halves the multiplier", () => {
    const r = compare("tithe", [card("OAK", ["PLA"])]);
    assert.strictEqual(r.chips, 1000);
    assert.strictEqual(r.with_.mult, 0.5);
  });

  test("THE USURER multiplies by 3 and halves what the Bookseller pays", () => {
    assert.strictEqual(compare("usurer", [card("OAK", ["PLA"])]).with_.mult, 3);
    assert.strictEqual(sigil("usurer").onReward(10), 5);
  });

  test("THE ORACLE multiplies the first word by 4 and silences the rest", () => {
    const rest = card("HAMMER", ["TOO", "NAT"]);
    const r = compare("oracle", [card("OAK", ["PLA", "NAT"]), rest]);
    assert.strictEqual(r.mult, 4);
    assert.strictEqual(r.chips, -rest.base, "words after the first should score nothing");
  });

  test("THE FAMINE pays 150 a word and shrinks the hand and the discards", () => {
    assert.strictEqual(compare("famine", [card("OAK", ["PLA"])]).chips, 150);
    assert.strictEqual(compare("famine", [card("OAK", ["NAT"]), card("TIDE", ["NAT"])]).chips, 300);
    assert.strictEqual(sigil("famine").hand, -3);

    api.newRun("famine");
    api.G.lenses = [sigil("famine")];
    assert.strictEqual(api.handSize(), api.HAND_SIZE - 3);
    api.startRound();
    assert.strictEqual(api.G.discards, 2);
    assert.strictEqual(api.G.hand.length, api.HAND_SIZE - 3, "dealt a full hand anyway");
  });

  test("THE CURSE multiplies by 3.5 and doubles every target", () => {
    assert.strictEqual(compare("curse", [card("OAK", ["PLA"])]).with_.mult, 3.5);
    /* Against the round's own target, not TARGETS[0] raw: every mode scales
       the table by its curve, so the raw number is nobody's round 1. */
    api.newRun("curse");
    api.startRound();
    const plain = api.G.target;
    api.newRun("curse");
    api.G.lenses = [sigil("curse")];
    api.startRound();
    assert.strictEqual(api.G.target, plain * 2);
  });

  test("a flawed Lens is marked as one, so the shop can warn about it", () => {
    const flawed = api.LENSES.filter(l => l.flaw);
    assert.ok(flawed.length >= 5, "the flawed tier should not be a token gesture");
    flawed.forEach(l => {
      /* A penalty multiplier is a drawback too - ENTROPY's whole cost is the
         x0.5 it applies to every hand that does not qualify, and the regex
         did not recognise that shape. */
      const takes = l.onRound || l.onReward || l.hand
        || /no points|halved|less play|less discard|smaller|pays you half|doubled/.test(l.d)
        || /multiplier ×0?\.[0-9]/.test(l.d);
      assert.ok(takes, l.n + " is flagged as flawed but takes nothing back");
    });
  });

  test("no unflawed Lens quietly takes something away", () => {
    /* GLUTTON is the exception and it says so in its own description. */
    api.LENSES.filter(l => !l.flaw).forEach(l => {
      if (l.onRound || l.onReward || l.hand) {
        assert.ok(/less discard|less play|smaller|pays/.test(l.d),
          l.n + " has a drawback hook but its description never mentions it");
      }
    });
  });
});

/* ================================================================== */
describe("the table as a whole", () => {
  test("every Lens is covered by a test in this file", () => {
    /* The guard. Adding a Lens to index.html without pinning its arithmetic
       here fails immediately, which is how the whole balance pass stayed
       honest. */
    const src = require("fs").readFileSync(__filename, "utf8");
    const missing = api.LENSES.filter(l => src.indexOf('"' + l.id + '"') < 0)
      .map(l => l.n).join(", ");
    /* Joined to a string, NOT compared as an array: api.LENSES lives in the
       VM realm, so .filter().map() hands back an array carrying the VM's
       Array.prototype, and deepStrictEqual checks prototype identity — a
       cross-realm [] never equals a host []. Second time this file has been
       bitten by it. */
    assert.strictEqual(missing, "", "these Lenses have no arithmetic test: " + missing);
  });

  test("costs sit in a band a run's economy can actually reach", () => {
    api.LENSES.forEach(l => {
      assert.ok(l.cost >= 3 && l.cost <= 8, l.n + " costs $" + l.cost);
    });
  });

  test("a growing Lens always says so in its description", () => {
    api.LENSES.forEach(l => {
      if (l.grows) {
        assert.ok(/more each round you keep it/.test(l.d),
          l.n + " grows but does not tell the player");
      }
    });
  });
});
