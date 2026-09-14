# NecroCards — design writeup

A word roguelite where meaning is the physics.

---

## 1. The pitch

**What it is.** NecroCards is a five-minute roguelite built on a scoring engine that runs on
*meaning* instead of spelling. Every word in the game carries **overtones** — semantic tags
like HEAT, MOTION, DANGER, TIME. Each round sets a **Demand** (`THE FURNACE — wants HEAT,
DANGER`) and a target score. You play up to three word-cards; they resolve left to right,
paying out for every overtone that matches. Between rounds you buy **Sigils**, which rewrite
how meaning scores: `CARNIVORE` lets an ANIMAL word devour the word to its left, `ANTONYM
ENGINE` detonates when a hot word lands straight after a cold one, `ENTROPY` doubles
everything if each word is shorter than the last.

**Who it's for.** The intersection of two large audiences that currently have no shared
product: people who play a word game every morning (Wordle, Connections, Contexto) and people
who play build-a-broken-engine roguelites (Balatro, Slay the Spire, Luck be a Landlord). Word
games are almost entirely pure puzzles with no build variety and no run structure. Deckbuilders
are almost entirely fantasy-combat-themed and demand a rules vocabulary before they're fun.
NecroCards is a deckbuilder whose rules vocabulary is *the language you already speak*.

**Why someone plays it.** Because sixty seconds in, you notice that AVALANCHE is COLD and
MOTION and DANGER and LOUD all at once, that you happen to own two Sigils that both care about
that, and that the number at the bottom of the screen just did something obscene. The pleasure
is not "I know a lot of words." It's "I found a hole in the rules." Vocabulary size is
deliberately *not* the skill — overtones are printed on the card, so the tactical layer is
legible to everyone including non-native speakers, and the strategic layer is knowing which
Lens to buy.

---

## 2. Core loop and first session

**The loop, in one line:** read the Demand → find resonance in your hand → order the words →
watch the engine resolve → spend the winnings on a rule that breaks the next round harder.

**The first three minutes, beat by beat:**

| Time | What happens |
|---|---|
| 0:00–0:15 | One screen, no account, no install. A help card with three numbered points and a worked example showing the arithmetic on a real card. Seven word-cards face up, each with a generated emblem and its overtones printed along the bottom. |
| 0:15–0:50 | Player clicks a card. The stage shows a live **"would score"** preview before committing — the game teaches its own maths without a tutorial. A one-line coach sits above the hand and advances with them: pick → play → read the result, then retires for good. They play. Cards resolve one at a time, each trigger popping a label and a rising tone. |
| 0:50–1:20 | Round 1 target (200) falls in about two plays. Unspent plays convert to money, which quietly teaches efficiency. |
| 1:20–1:50 | **The Reliquary.** Three offers. The first Sigil purchase is the moment the game stops being a word puzzle and becomes a roguelite. |
| 1:50–3:30 | Rounds 2–4. Somewhere here the first real combo fires and the screen shakes. Most first runs die around round 4–5. |
| 3:30 | Death screen: total, best play, the Sigil carried into the next run, and a copyable share block. |

**What brings them back tomorrow.** Three separate hooks, deliberately layered so they don't
depend on each other:

1. **Memory** — the run-end screen hands you one Sigil you actually used, permanently equipped
   at the start of your next run. Run 2 is *mechanically visibly different* from run 1 within
   five seconds of starting it. This is the cheapest and most reliable retention lever a
   roguelite has.
2. **The daily seed** — everyone gets the same deck and the same eight Demands each day, so a
   score is comparable and therefore arguable.
3. **The unfinished thought** — "I had ANTONYM ENGINE and never drew a cold word." Roguelite
   deaths generate a specific grievance, and a specific grievance is a reason to start again.

---

## 3. Progression and metagame

### The day-1 hook I built: The Interpreter

Once per run, a button says **"type any word at all."** Whatever you type — your dog's name,
your job title, MITOCHONDRIA, the worst thing that happened to you this week — gets appraised
for its overtones and shuffled into your deck as a real card that scores by exactly the same
rules as everything else.

This is the hook because it does three jobs at once:

- **It is the share moment.** The run-end block names your word and its overtones. "I put my
  ex's name in a card game and it came out DARK, TIME, DANGER" is a message someone sends
  unprompted.
- **It is player expression inside a systems game**, which word games almost never offer.
- **It is a live demonstration that the game understands meaning**, which retroactively makes
  the other 249 words feel authored rather than tagged.

It's capped at one per run on purpose: scarcity is what makes the choice interesting, and an
unlimited version would turn the deck into a sandbox and flatten the difficulty curve.

### What sustains months

- **Sigil breadth.** 24 Sigils today; the shape supports 120+. Roguelite lifetime tracks almost
  linearly with the number of build archetypes a player hasn't tried yet.
- **Archetypes worth chasing.** The current set already implies them — a short-words build
  (`BRUTALIST` + `ENTROPY`), an abstraction build (`METAPHYSICIAN` + `LITERALIST` as a trap
  pair), a single-card build (`ASCETIC` + `SESQUIPEDALIAN`). More Sigils means more of these.
- **Lexicon packs** — a Cosmology set, a Culinary set, a Medical set. Each adds words *and* the
  Demands and Sigils that make them sing. This is the content treadmill, and it's exactly the
  thing an AI pipeline can produce at a rate no hand-authored word game can match.
- **Weekly mutators** — "every word must be longer than the last", "abstract words are worth
  triple", "the Demand is hidden until your second play."
- **A player-grown corpus.** Interpreted words are the most interesting data the game produces.
  Words that many players type, once vetted, become real lexicon entries. The game's physics
  grows out of its own playerbase.
- **Daily leaderboards** on the shared seed.

---

## 4. Money

The design constraint: **the fun must never be the thing that's metered.** Every model below
sells variety, expression, or a one-time unlock — never power, never patience.

**The model I'd ship:**

1. **Free forever, unlimited runs.** No energy, no lives, no timers, no "watch an ad to
   continue your run." Runs are the product; metering them poisons the only thing that
   retains.
2. **One-time unlock, ~$5.** Free players get the first four Demands and roughly half the Sigil
   pool — a complete, satisfying, genuinely replayable short game. The unlock opens the full
   eight-Demand ladder and the whole Sigil pool. This is the Balatro/Threes model: it converts
   on *delight already delivered* rather than on frustration manufactured.
3. **Lexicon packs, ~$3 each.** New words, new Demands, new Sigils. Sold as variety, balanced
   to the same power curve, so a buyer gets more game rather than a stronger game. A pack that
   made you win more would break the leaderboard and the point.
4. **Cosmetics.** Desk themes, card stocks, share-card styles. Pure vanity, and the share card
   is the natural surface for it because it's the thing other people see.

**What I would refuse to ship,** and why each one is a trap:

- **Energy or run limits** — meters the core loop, which is the only asset.
- **Paid continues** on a lost run — sells relief from a failure the game manufactured, and
  destroys the meaning of a score.
- **Power sold directly** (stronger Sigils, extra Interpreter charges that outscale) — kills
  the daily leaderboard and turns build discovery into a purchase decision.
- **Interstitial ads between rounds** — the loop's whole value is that it's a clean 90-second
  escape. An ad at the Reliquary is a tax on the exact moment the game is working.

The honest tension worth naming: **extra Interpreter charges** are the most obviously
monetisable thing in the game and the one I'd be most tempted by. I'd sell them only if the
interpreted card were provably curve-neutral — and if it weren't, I'd sell Interpreter
*cosmetics* (a fancier appraisal card to screenshot) instead of charges.

---

## 5. AI

AI is in this project in three distinct places, and the boundaries between them are the
important design decision.

### 5.1 AI as the game's physics engine (build time)

The lexicon is 249 words × a 19-overtone ontology, averaging 3.2 overtones per word — roughly
800 semantic judgements. That corpus *is* the rules engine: every Lens, every Demand, and every
score reads from it. Hand-authoring semantic attributes at that density is precisely the work
LLMs are good at and humans are slow at, and it's why the game knows without being told that a
GEYSER is heat and water and motion and noise simultaneously.

Crucially it's **baked to a static table at build time**. The game runs at 0ms, offline, with
no API key and no per-session cost, and it's fully deterministic — which is what makes a shared
daily seed possible at all.

**The card faces come out of the same table.** Each card shows the icons for its own
overtones on a plate tinted by its most distinctive one. I tried per-word generated artwork
first and it read as abstract shapes rather than art — nineteen consistent icons beat 249
inconsistent pictures, and they *teach*: the picture and the scoring rule are views of the same
data, so a player learns that the flame means HEAT within one round rather than parsing tag
text. Overtones matching the current Demand take a gold ring, which makes a playable card
readable without reading at all.

It also stays honest to the brief and to the content treadmill: a lexicon pack of 200 new words
ships with zero new art, and so does every word a player invents with the Interpreter — the one
case a fixed art library can never serve.

### 5.2 AI as a live participant in the game (runtime)

**The Interpreter** is a real Claude call from inside the published page, via the artifact
`sample` capability. It sends a strict prompt, requests JSON, and then — importantly —
**validates the answer against the tag whitelist** rather than trusting it, clamping to 2–4
known overtones. If the model returns something unusable, or the viewer declines, or there's no
runtime at all (opening the file locally, or on GitHub Pages), it falls through to a **local
house appraiser**: morphology plus a small sense-map, which reads abstraction off suffixes like
`-ness`/`-ity`/`-tion` and matches roots against a keyword table. The UI says which appraiser
ran. The feature degrades; it never breaks.

### 5.3 The architectural rule I held

> **No network call inside the one-second loop.**

Every design in the brainstorm that put a live model inside the core loop — the free-text
referee, the AI-judged persuasion game, the rule-induction game with an arbitrary-input oracle
— got cut for the same reason. A 2–20 second model call in a loop that must feel like a slot
machine is fatal, and a grader on bad wifi gets a broken game. So the model does the two jobs
it's genuinely better at than a human: it **authors the content** beforehand, and it
**adjudicates the unbounded edge case** (a word nobody anticipated) where latency is not only
acceptable but reads as deliberation.

### 5.4 AI in building it

The whole thing was built in one session with Claude Code: the ideation ran as a structured
divergent session (86 logged ideas across seven techniques — see
`docs/brainstorming/`), then the engine, the lexicon, and the CSS were written directly.

The most useful AI-assisted step wasn't code generation, it was **balance simulation**. After
the first build I ran 400 simulated runs headlessly to check two things a screenshot can't
show:

- **Deck starvation.** The lexicon is uneven — FOOD sits on only 21 of 249 words — so a random
  26-card deck could hand a player `THE BANQUET` with two playable cards and an unwinnable
  round. Fixed by building the deck *after* rolling the run's eight Demands and seeding a floor
  of three cards per demanded overtone. Starved rounds fell to 0.3%, and the floor is now four
  matching cards rather than zero.
- **The difficulty curve.** A greedy lens-less player was dying at round 3 (scoring 0.97× the
  target). Retuned the targets so that player now clears rounds 1–3 and needs ~1.5× by round 4
  and ~9× by round 8 — so engine-building is mandatory but never ambushes a first-timer.

Both are the kind of bug that makes a prototype feel unfair rather than hard, and neither is
visible by playing it a few times.

---

## 6. Shipping

### What I'd test first

**Test 1 — does the Reliquary land?** The entire game hinges on the player understanding, at
around 1:20, that Sigils are the engine and not a bonus. I'd instrument: share of players who
buy a Sigil at their first shop, and share who die at round 3 having bought nothing. If a large
group is dying poor, the shop is failing to communicate, and the fix is a free forced Lens
after round 1 rather than more tutorial text.

**Test 2 — does the day-1 hook get used?** The Interpreter is my retention thesis. It is a free,
once-per-run, prominently placed button that says *type any word*. If fewer than ~40% of
first-run players press it, the thesis is wrong and I need to know that in week one, not
month three.

### What would make me kill it or change direction

- **Run-2 start rate below ~35%** after two honest iterations on onboarding → kill. If people
  who finished a run don't want another one, the core loop isn't fun, and no metagame, art
  pass, or content drop rescues that. This is the single number I'd bet the project on.
- **Median session under ~90 seconds** → the loop isn't landing. Change direction toward the
  daily-puzzle framing: one fixed hand, one perfect solve, share it, done. That's a different
  and smaller game, but it's the one the data would be asking for.
- **Interpreter usage high, run-2 rate low** → the game is a toy, not a game. Pivot hard toward
  expression and sharing and away from the ladder.
- **Players can't articulate why a score was big** → the resolution animation is failing, which
  is the one thing that must not fail. Slow it down, not speed it up.

### The two numbers I'd watch at soft launch

1. **Run-2 start rate** — the share of players who begin a second run in their first session.
   Target > 55%. It's the cleanest possible read on "is the loop fun", it's measurable on day
   zero, and it's unpolluted by notifications, store placement, or install friction.
2. **D1 retention** — target > 25%, judged against daily-word-game norms rather than
   mid-core ones. D1 is where the Memory unlock and the daily seed either work or don't.

Secondary, watched but not steering: Interpreter usage rate, share-copy rate, and the
distribution of round-reached (I want a broad hump around 4–6, not a spike at 3 or a wall at 8).

---

## 7. Reference games

These were pulled apart as systems — what each one does mechanically, and what I took or
refused.

**Balatro** — the primary reference and the structural skeleton.
*Borrowed:* two visible numbers (chips × mult) rather than one opaque score; sequential
left-to-right resolution so every trigger gets its own moment and its own sound; jokers that
break stated rules rather than tuning them; a shop between escalating antes; and the central
lesson that **exponential targets versus an exponential engine** is a better tension than
linear difficulty.
*Also borrowed — the presentation.* The look is Balatro's chassis dressed as a
necromancer's table: chunky slabs with a hard bottom edge that depress when pressed, the
**blue chips / red mult** pairing carrying the loudest colour in the UI, and the left-hand
blind panel — Demand plaque, “score at least”, round score, chips × mult, plays, discards,
money — with the board to its right. Plays are announced with named shapes (`DOUBLE
RESONANCE`, `OVERTONE CASCADE`) the way Balatro names poker hands, which teaches players to aim
for a shape instead of squinting at tags.

*The discipline* is four rules, held everywhere, because breaking them is exactly what makes a
UI read as machine-made: **flat fills** (no gradient on any surface), **hard shadows only**
(zero blur — every panel sits on a solid lip), **one typeface** at one family of sizes, and
**colour as information** — blue is chips, red is mult, gold is money, and nothing else gets to
be loud. The play area is green felt, because a card game should look like it happens on a
table.

*The juice* is where a card game lives, so it got its own pass: cards deal in with a stagger
(only newly drawn ones — the hand re-renders on every click), breathe on an inner layer so the
idle motion never fights hover or select, and kick with a springy overshoot as they score.
Counters tween rather than snap, Sigils lurch when they fire, the stage shakes and throws
sparks on a big hit, and a green wash breaks over it when the Demand falls.

*Did differently:* Balatro's hand is poker, so the skill floor is a memorised ranking table.
NecroCards's "hand" is meaning, which every player already has. And card *order* matters here in
a way it mostly doesn't there, which turns each play into a small ordering puzzle on top of a
selection puzzle. The card faces carry words and overtones rather than rank and suit, so they
run slightly larger and lean on type instead of pips — no art required either way.

**Wordle / NYT Games** — the retention and distribution reference.
*Borrowed:* the shared daily seed; a plain-text share block small enough to paste into a
message; zero account, zero install, one screen.
*Did differently:* Wordle is deliberately finite — one puzzle, then stop. That's excellent for
habit and terrible for session length. NecroCards keeps the daily seed as a *comparison* surface
but lets you play unlimited free runs, so it can be both a habit and a sitting.

**Slay the Spire** — the run-structure reference.
*Borrowed:* a deck as an evolving resource you shape through a run; a shop as the pacing beat
between encounters; permanent run failure as the thing that gives decisions weight.
*Did differently:* no combat, no HP, no enemy intents. The pressure is a pure score threshold,
which needs no art to read and no mental model to learn — a deliberate choice given "plain
blocks and shapes are fine."

**Semantle / Contexto** — the proof that semantic distance is a legitimate mechanic.
*Borrowed:* the core insight that meaning can be a scoring surface, not just a theme.
*Did differently:* those games hide the semantic state and make you grind toward it one guess
at a time, which is tense but slow and can feel like homework. NecroCards **prints the overtones
on the card**. Meaning becomes tactical information you act on immediately rather than hidden
state you search for — which is what lets the loop run at roguelite speed.

**Scrabble / Wordscapes** — the deliberate anti-reference.
Both make vocabulary size and spelling the skill. That gates non-native speakers, rewards
memorising two-letter word lists over actual thought, and makes losing feel like a verdict on
your education. NecroCards removes spelling from the skill entirely: you never construct a word,
you only choose and order ones you're shown.

**Vampire Survivors** — borrowed exactly one lesson: if the numbers escalate hard enough and
the feedback is loud enough, nobody asks where the art is.

---

## Appendix — how the prototype maps to the design

| Design claim | Where it lives in the code |
|---|---|
| Meaning is the physics | `LEXICON` — 249 words, 19-overtone ontology |
| Rules that warp meaning | `LENSES` — 24 entries, `onCard` / `onPlay` hooks |
| Order matters | `resolve()` iterates played cards left to right, emitting an event per trigger |
| Teach the maths without a tutorial | `renderPreview()` — live "would score" before committing |
| Card faces from the same data | `artNode()` / `ICONS` — overtone icons, no per-word assets |
| Teach in context, not up front | `COACH` / `coachSet()` — a one-line coach through round 1 |
| Day-1 hook | `openInterpreter()` / `runAppraisal()` |
| AI degrades, never breaks | `houseAppraise()` — the local fallback appraiser |
| No unwinnable rounds | deck construction in `newRun()` — demand-aware floor |
| Tuned, not guessed | `TARGETS`, set from a 400-run simulation |
