# Overtone — design writeup

A word roguelite where meaning is the physics.

---

## 1. The pitch

**What it is.** Overtone is a five-minute roguelite built on a scoring engine that runs on
*meaning* instead of spelling. Every word in the game carries **overtones** — semantic tags
like HEAT, MOTION, DANGER, TIME. Each round sets a **Demand** (`THE FURNACE — wants HEAT,
DANGER`) and a target score. You play up to three word-cards; they resolve left to right,
paying out for every overtone that matches. Between rounds you buy **Lenses**, which rewrite
how meaning scores: `CARNIVORE` lets an ANIMAL word devour the word to its left, `ANTONYM
ENGINE` detonates when a hot word lands straight after a cold one, `ENTROPY` doubles
everything if each word is shorter than the last.

**Who it's for.** The intersection of two large audiences that currently have no shared
product: people who play a word game every morning (Wordle, Connections, Contexto) and people
who play build-a-broken-engine roguelites (Balatro, Slay the Spire, Luck be a Landlord). Word
games are almost entirely pure puzzles with no build variety and no run structure. Deckbuilders
are almost entirely fantasy-combat-themed and demand a rules vocabulary before they're fun.
Overtone is a deckbuilder whose rules vocabulary is *the language you already speak*.

**Why someone plays it.** Because sixty seconds in, you notice that AVALANCHE is COLD and
MOTION and DANGER and LOUD all at once, that you happen to own two Lenses that both care about
that, and that the number at the bottom of the screen just did something obscene. The pleasure
is not "I know a lot of words." It's "I found a hole in the rules." Vocabulary size is
deliberately *not* the skill — overtones are printed on the card, so the tactical layer is
legible to everyone including non-native speakers, and the strategic layer is knowing which
Lens to buy.

---

## 2. Core loop and first session

**The loop, in one line:** read the Demand → find resonance in your hand → find a **shape** in
the words themselves → order them → watch the engine resolve → spend the winnings on a rule that
breaks the next round harder.

The two halves of that pull against each other on purpose. The Demand cares what a word *means*;
the figure cares what it *is* — how long it is, what letter it opens on. The best three words for
the round are rarely the best three for the shape, and choosing between them is the decision the
hand exists to create. §6.10 is how that got there, and why it was missing at first.

**The first three minutes, beat by beat:**

| Time | What happens |
|---|---|
| 0:00–0:15 | One screen, no account, no install. A help card with three numbered points and a worked example showing the arithmetic on a real card. Seven word-cards face up, each with a generated emblem and its overtones printed along the bottom. |
| 0:15–0:50 | Player clicks a card. The stage shows a live **"would score"** preview before committing — the game teaches its own maths without a tutorial. A one-line coach sits above the hand and advances with them: pick → play → read the result, then retires for good. They play. Cards resolve one at a time, each trigger popping a label and a rising tone. |
| 0:50–1:20 | Round 1 target (450) falls in two or three plays. It is set from what a player who has understood *nothing* can make — first three cards as dealt, no reordering — so nobody loses round one to a rule they have not been shown. Unspent plays convert to money, which quietly teaches efficiency. |
| 1:20–1:50 | **The Bookseller.** Three offers. The first Lens purchase is the moment the game stops being a word puzzle and becomes a roguelite. |
| 1:50–3:30 | Rounds 2–4. Somewhere here the first real combo fires and the screen shakes. Most first runs die around round 4–5. |
| 3:30 | Death screen: total, best play, the Lens carried into the next run, and a copyable share block. |

### Two moments a stranger either gets or quietly closes the tab

Neither of these was a colour problem, and both were found by asking where a new player’s
attention actually goes rather than where the layout assumes it goes.

**The first sixty seconds.** The stage is the largest element on screen and sat empty at rest,
holding one small line of text — while the round’s rule lived in the far sidebar. A new player
had to connect “gold tags on cards” to “PAYS FOR” on the opposite side of the screen. The stage
now states the rule where the eye already is: the demanded overtones as large icons, and
**+25 points for every matching tag you play**. Three smaller fixes came with it:

- Cards that carry at least one matching overtone get a gold top edge, so the hand sorts itself
  into useful / not useful before anything is read. This removes noise, not depth — the actual
  decision was never *which cards match*, it is which three and in what order.
- Selected cards are **numbered 1-2-3**. The game had been stating “resolves left to right” in
  words while giving the player no way to see what order they had picked. A stated rule that is
  never shown is not a rule, it is trivia.
- The idle hint stopped repeating the +25 rule the stage now states, and carries the question a
  new player actually has instead: *how many should I take?*

**The copy got read out loud.** Once the vocabulary was fixed, the sentences still were not: they
were drafted, not spoken. Long clauses strung on em-dashes, three parallel items where two would
do, "which is why" doing the work a full stop should. A pass over every player-facing string
shortened the sentences, used contractions, and put one idea on each line. *"Every word carries
overtones — the little tags along the bottom of the card"* became *"See the little tags along the
bottom of each card? Those are its overtones."* Same fact; one of them sounds like a person.

**The board stopped using words nobody had been taught.** The scoring readout was two unlabelled
numbers, a blue one and a red one, and the game called them *chips* and *mult*. "Chips" is a poker
word; this is not poker, and it bought the game nothing that "points" would not. So: **points ×
multiplier**, both labelled above the number they name. "RESONANCE +25" became "MATCH +25", and the
hand shapes became MATCH / DOUBLE MATCH / TRIPLE MATCH, keeping OVERTONE CASCADE at the top end as
the one flourish worth earning. "PAYS FOR" became "WANTS". Lens descriptions went from "+45 chips"
to "+45 points", and the four most opaque were rewritten outright — CARNIVORE now says *eats the
word to its LEFT*, ENTROPY says *play words longest to shortest*.

The nouns the game keeps — Overtone, Lens, the Bookseller, the Interpreter — are the ones that
carry the theme and are each explained the first time they appear. The ones it dropped carried
nothing.

**"How many words should I take?" had no answer anywhere in the game.** It is the single most
frequent decision — four times a round, eight rounds — and the rules card did not address it. It
turns out to have a clean answer that falls straight out of the scoring:

*Take three whenever you can.* Points are summed, so three words score roughly three times one;
a word that matches nothing still contributes its own base value, so a third word is almost never
a mistake; and `reward = 4 + plays left + discards left`, so **clearing a round quickly is
literally money**, which is Lenses, which is the whole engine. Fewer is right only when a Lens pays
for it — ASCETIC gives ×5 for exactly one word, ANTONYM ENGINE wants a specific adjacent pair.

That is now a dedicated tutorial step which will not let you past it until you have actually
picked a second word, a numbered point on the rules card, and a contextual nudge on the board
("you can still add 1 more word") when a fourth useful card is sitting in hand.

**The board had also been lying about order since the first frame.** It told every player that
words "resolve left to right, so the order matters". For a player with no Lenses that is simply
false: points are summed and the multiplier never moves, so every permutation of the same three
words scores identically. It becomes true two ways — a Lens that reads position (CARNIVORE,
LEXICOGRAPHER, ANTONYM ENGINE, ENTROPY), or holding one Lens that *adds* to the multiplier
alongside one that *multiplies* it, since `(1+2)×3 = 9` and `(1×3)+2 = 5` are different scores
from the same cards. `orderMatters()` computes exactly that, and the line appears only when it
returns true. A tutorial that teaches a rule the player cannot yet observe teaches distrust.

> This passage describes the game before **figures** (§6.10). Order is load-bearing from the
> first hand now, because a figure reads the words left to right — and the board says so itself
> rather than leaving the player to find out. `orderMatters()` survives, narrowed to the second
> kind of order-dependence: the kind a Lens introduces.

**The Bookseller is the real cliff.** The simulation says a player who ignores the shop dies at
round 3, so the shop has about fifteen seconds to teach that Lenses are the engine and not a
bonus. Money was never the problem — a player arrives with ~$13 against a $4-7 Lens.
Comprehension was. So the shop now:

- **Names the exponential in numbers**, because it is invisible from inside a single round:
  *Round 8 asks for 58,000 — 53× this one. Lenses multiply. More words only add.*
- **Marks a Lens that has words to fire on** (“Fits your deck — 7 DANGER words”), which teaches
  synergy thinking by example. The badge only appears when it is true, so it stays meaningful —
  on a typical roll about half the offers earn it.
- **Makes leaving empty-handed a conscious act.** With no Lens owned, the exit button reads
  *Leave with no Lens* in the warning colour rather than *To the table →*. Friction, not a
  block: the player may still do it, but not by accident.

**What brings them back tomorrow.** Three separate hooks, deliberately layered so they don't
depend on each other:

1. **Memory** — the run-end screen hands you one Lens you actually used, permanently equipped
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

- **Lens breadth.** 24 Lenses today; the shape supports 120+. Roguelite lifetime tracks almost
  linearly with the number of build archetypes a player hasn't tried yet.
- **Archetypes worth chasing.** The current set already implies them — a short-words build
  (`BRUTALIST` + `ENTROPY`), an abstraction build (`METAPHYSICIAN` + `LITERALIST` as a trap
  pair), a single-card build (`ASCETIC` + `SESQUIPEDALIAN`). More Lenses means more of these.
- **Lexicon packs** — a Cosmology set, a Culinary set, a Medical set. Each adds words *and* the
  Demands and Lenses that make them sing. This is the content treadmill, and it's exactly the
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
2. **One-time unlock, ~$5.** Free players get the first four Demands and roughly half the Lens
   pool — a complete, satisfying, genuinely replayable short game. The unlock opens the full
   eight-Demand ladder and the whole Lens pool. This is the Balatro/Threes model: it converts
   on *delight already delivered* rather than on frustration manufactured.
3. **Lexicon packs, ~$3 each.** New words, new Demands, new Lenses. Sold as variety, balanced
   to the same power curve, so a buyer gets more game rather than a stronger game. A pack that
   made you win more would break the leaderboard and the point.
4. **Cosmetics.** Desk themes, card stocks, share-card styles. Pure vanity, and the share card
   is the natural surface for it because it's the thing other people see.

**What I would refuse to ship,** and why each one is a trap:

- **Energy or run limits** — meters the core loop, which is the only asset.
- **Paid continues** on a lost run — sells relief from a failure the game manufactured, and
  destroys the meaning of a score.
- **Power sold directly** (stronger Lenses, extra Interpreter charges that outscale) — kills
  the daily leaderboard and turns build discovery into a purchase decision.
- **Interstitial ads between rounds** — the loop's whole value is that it's a clean 90-second
  escape. An ad at the Bookseller is a tax on the exact moment the game is working.

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

**Test 1 — does the Bookseller land?** The entire game hinges on the player understanding, at
around 1:20, that Lenses are the engine and not a bonus. I'd instrument: share of players who
buy a Lens at their first shop, and share who die at round 3 having bought nothing. If a large
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

## 6.5 The phone, the feel, and the theme

**Portrait is a layout, not a scale factor.** The first phone build was the desktop layout with
smaller numbers, and it failed in a specific way: 839px of content in an 812px viewport, so the
hand's second row sat behind the pinned control bar. Three things fixed it, in order of how much
they returned:

1. **The card stopped carrying a desktop min-height.** An 80px-wide phone card was 121px tall for
   93px of content — 28px of empty card, on seven cards, in two rows. Letting the content set the
   height returned ~80px, which is more than the entire first-run coach bar costs.
2. **The board stopped repeating the hand back.** When words are selected, the stage used to
   redraw them at full size while the hand below was still showing the very same cards, selected,
   raised and numbered 1‑2‑3. That is 240px of a 667px screen spent saying something twice. At
   portrait width the preview is the number alone; the cards come back, big, during resolution —
   when the hand folds away and the board takes the room.
3. **The control row is pinned, not measured.** Phone heights vary far more than widths, and
   pinning is the only version that cannot put PLAY below the fold on a device nobody tested.

The invariant two tests now hold, at 393×727 and again at 375×667, is not "no scrollbar" — it is
that **the decision and the move are on screen together**: all seven words visible, no card's
bottom edge below the top of the control row, all three buttons in the viewport. A hand you have
to scroll is a decision you cannot make.

**Impact.** Numbers used to simply change in the tally, which asks a player to take on trust that
the card and the counter are related. Now the points **leave the word that earned them** and arc
onto the counter. The counters themselves stopped tweening: they *settle*, digits scrambling and
locking left to right like a mechanical counter landing, and the total counts up from zero rather
than appearing as a finished number. A tween shows you the result; a settle shows you the event.

Around that: a square shockwave off the total, screen shake in three tiers scaled to the hand's
size against the round's target, the theme ducking under the moment, a ROUND CLEAR stamp and
confetti, and a matching red beat for running out of plays. All of it is flat and hard-edged — the
sheet's no-gradient, zero-blur rule holds for motion too — and all of it is off under
`prefers-reduced-motion`.

**A bug a player found before a test did.** Every one of those particles was written as
`el.animate(frames, opts)` with a separate, slightly longer `setTimeout` to remove the element. A
Web Animation with no `fill` reverts its element to the element's own static style the instant it
finishes — so in the gap between the two, every particle snapped back to its start position at
full opacity and sat there. The sparks ran 700–1220ms and were removed at 1300ms: half a second of
a solid square parked dead centre of the board after every single hand. Nobody reported "your
animations lack a fill mode"; the report was *"there's a weird dot left over for a second in the
middle"*, which is exactly the right way to report it.

**The sound was the weakest thing in the build, and it was one line.** Every effect went through a
single function that made one oscillator, so everything in the game beeped — selection, scoring,
buying, dying. A hit that reads as physical is three layers landing on the same frame: a noise
transient for the attack you feel, a pitched body that bends *downward* (that fall is what the ear
reads as landing rather than sounding), and a sub sine underneath for weight. Chip hardware faked
all three with two square channels and a noise channel, which is exactly the budget to work in
here. The scoring sound now climbs a whole-tone ladder as a chain runs, so a nine-event hand
*builds*, and a multiplier event gets a saw growl under it so it is audibly not a point. A `tanh`
soft clipper on the bus means four layers at once thicken instead of crackling.

The theme came down with it, from 0.32 to 0.15. Music that competes with the feedback is not
atmosphere, it is masking.

**Vibration, honestly.** Selecting buzzes 11ms, a Lens firing 11ms, a big hand a three-beat
pattern, a cleared round a five-beat one. On Android. **iOS Safari does not implement
`navigator.vibrate` at all**, so on an iPhone every one of those is a silent no-op — which is why
nothing in the game depends on a buzz to be understood. It confirms; it never informs. The
settings panel says so rather than shipping a switch that quietly does nothing.

**The theme.** One looping MP3, re-encoded from a 6.6MB 320kbps source down to ~2MB, and it is
**never fetched before the player touches something**. No browser will play audio before a gesture
anyway, so putting 2MB on the critical path would slow the first frame in exchange for nothing —
a test asserts the request does not happen. Music, sound effects and vibration are three separate
switches, because they fail differently: music is what people mute in public, effects are what
they mute at work, vibration is what eats a battery. One mute button would have made at least two
of those a worse trade than they need to be.

---

## 6.8 The balance pass, and the simulator that could not see the problem

Playtesters said the game was too easy and that some Lenses were broken. Both were true, and the
tooling I had could not show me either.

`tools/sim.js` plays with **no Lenses at all**. That was the right question while the shop was the
thing being taught — *can someone who ignores the Bookseller survive?* — and exactly the wrong one
once the shop became the game. **A simulator that never buys a Lens cannot see a broken Lens.**
So I built `tools/balance.js`, which plays whole runs through the real engine, buys from the real
shop, and reports what actually happens. First run: a **70% win rate**, against 15-30% for a
healthy roguelite.

### What it found

| Lens | win rate | reached alone |
|---|---|---|
| ENTROPY | **100%** | round 7.7 |
| LITERALIST | 93% | 6.1 |
| ZOOLOGIST | 89% | 5.4 |
| BRUTALIST | 87% | 5.0 |
| *baseline* | *64%* | |
| PROSPECTOR | 41% | 4.1 |
| CHRONICLER | **3%** | 2.6 |

A $7 Lens that wins every run and carries to round 7.7 on its own is not a strong Lens, it is the
game. And a $4 Lens that wins 3% is not a weak option, it is a trap — the shop was offering
players a choice between "correct" and "lose".

### Three structural problems, not thirty number problems

**1. Flat chips die.** Targets climbed 26× across a run while a chip Lens paid the same +45 in
round 8 as in round 2. Seven Lenses now **grow every round you hold them**, sized against measured
tag frequency rather than feel: DANGER sits on 34% of the lexicon and grows +40 a round, MONEY on
9% and grows +190. They start weaker than the old flat versions and end far stronger. That also
fixes the *fantasy*: a Lens bought in round 2 and carried is now visibly worth more than the same
Lens bought in round 6, and the rail shows the number climbing.

**2. Unconditional ×mult breaks everything.** ENTROPY asked that each word be shorter than the
last, which is not a condition — it is a sorting instruction. GLUTTON paid ×2.5 for playing three
words, which is what everybody does anyway. A multiplier that compounds has to be paid for, so
GLUTTON costs a discard, ENTROPY punishes any hand that does not qualify, and the rest came down.

**3. The slot cap was not a cost.** Five slots, thirty Lenses, and nothing in the shop but upside
meant the correct play was always "buy the biggest number". Two changes fixed that:

- **Six flawed Lenses.** The biggest numbers in the game, each taking something back: THE WAGER
  is ×3 for one fewer play a round. THE FAMINE pays +150 a word and deals you a four-card hand.
  THE USURER is ×3 and halves your income. THE CURSE is ×3.5 and *doubles every target you face*.
  THE TITHE is +1,000 points and halves your multiplier, which is a bargain while your chips are
  big and a disaster once the multiplier is what carries you — the same card flips from good to
  bad inside one run.
- **Selling.** Every Lens has a price at the Bookseller, half what you paid. The slot comes back,
  but a growing Lens loses everything it grew, so the question is never "is this one better" but
  "is it better than what mine has already become". That is the decision the cap was supposed to
  create and never did.

### Setting targets from measurement

`--curve` reports what a round can actually *produce* at each point in a run. Against it, the old
final target of 5,200 sat at the **9th percentile**: the last round of the game was clearable by
nine runs in ten. The curve now sits at roughly p3 / p5 / p10 / p14 / p18 / p22 / p26 / p45.

Deliberately generous early. **Dying in round 2 reads as the game cheating; dying in round 6 reads
as your build being wrong**, and only one of those makes someone start again. A Lens-less player
clears round 1 at ×2.2 and misses round 2 at ×0.97 — missing by three percent is the shop teaching
itself better than any panel copy could.

### Where it landed

| player | win rate |
|---|---|
| optimal (evaluates every ordering, buys by simulation) | 43% |
| realistic (takes the best three, buys what fits) | **25%** |
| careless (random purchases) | 12% |

The number I care about is the spread. Before the pass, a careless player and a careful one both
won most of their runs, so there was nothing to be careful *about*. Now choosing well roughly
doubles your odds, and choosing badly roughly halves them. Deaths are spread across rounds 3-7
rather than piled at the end, so a loss has a specific cause you can name — which is the thing
that makes someone press New Run.

---

## 6.9 Ordeals, and why raising the numbers was the wrong answer

The second round of reviews said it was still too easy, and my own simulator agreed with me
instead of with them — which usually means the simulator is measuring the wrong player. It was.
It never rerolled the shop, never carried a Memory Lens into run 2, and its "realistic" player
took the best three cards by face value without trying orderings.

That last one is the real error. **The board scores every selection live**, so a human clicking
three cards and swapping them about is running a search — a shallow one, but a search. The game
does the arithmetic for them, which means a human plays much closer to optimal than any greedy
model. Once the simulator rerolled, carried a Lens and searched the best five cards, the honest
number was 33%, and rounds 1-3 killed 0.3% of runs between them.

So the game was easy, and the first three rounds were a formality. The obvious fix is to raise the
curve again. I think that would have been wrong: it makes the same eight rounds grindier, and the
complaint underneath "too easy" was **"aimlessly boring"**. Eight rounds of *make a bigger number
than last time* is one decision repeated eight times, however steep the numbers get.

**Rounds 4, 6 and 8 now carry an Ordeal** — one rule, on the plaque, that stops the hand you have
been playing all run from working. No discards. Two words at a time. A four-card hand. Words worth
nothing on their own. A word scores nothing unless *two* of its tags match.

Three design decisions inside that:

1. **They sit on fixed rounds and the Bookseller names the next one before you spend.** An Ordeal
   you are told about is a purchase decision — you can buy MISER for a round with no discards, or
   dump a three-word Lens before THE VICE. An Ordeal you discover is just a bad beat. Same
   mechanic, opposite feeling.
2. **Each one invalidates a different habit.** THE VICE breaks "always take three" — the thing the
   tutorial spends a whole step teaching. THE FOG breaks a deck built on long words. THE MIRROR
   breaks a deck built on breadth. THE HALF-LIGHT breaks an engine leaning on the multiplier. A
   run that has gone well in one direction meets the round that punishes exactly that direction.
3. **Round 8 is always one**, so a run ends on a wall rather than on a slightly larger number. And
   round 1 never is, because the tutorial runs there.

Where it landed: 23% for perfect play, **18% for a realistic player**, 11% for a careless one.
Even flawless play loses three runs in four. Deaths sit at 14% / 15% / 22% on rounds 4, 5 and 6 —
the Ordeal rounds are visible spikes in that distribution, which is the point. A loss you can name
("THE MIRROR, and my whole deck was one-tag words") is a reason to start again. A loss to a
slightly bigger number is a reason to stop.

---

## 6.10 Figures, and the half of every card that was decoration

The sharpest piece of feedback the prototype got did not come from the simulator:

> It's been a while since I last played Balatro, but if I'm not wrong, the points and the
> multiplier there was dependent on the poker card combination. What I found missing in your game
> is that everything revolves around the tags for the words. So the actual word on the card gets
> ignored most of the time. Also the order in which you pick the cards doesn't matter as much. A
> player can just see the tag needed and simply pick those cards.
>
> Then I got this lens which had something like if the cards are played from biggest to smallest
> word then the multiplier increases. So I found that run much more engaging than the previous
> ones cause I had to check what I was actually even using.

That is the diagnosis and the fix in one paragraph, and it was right. A word-card was a bag of
tags with a number derived from its length. The letters were art. Four Lenses out of thirty read
position, and unless you owned one of them the order you tapped in was arithmetically irrelevant
— the board even had a function, `orderMatters()`, whose entire job was to *stop claiming
otherwise*.

The tell is the second paragraph. The run they enjoyed most was the one where a Lens forced them
to read their own hand. That is not an argument for more Lenses like it. It is an argument that
the thing the Lens was doing belongs in the base game, where Balatro puts it.

### What a figure is

Every hand is now scored for its **figure** — its shape as an object, before anything reads its
meaning — and the figure is applied **first**, at `mult = 1`, before any card is counted. That
position is the whole design:

- it is where a poker hand sits in Balatro: the base worth of the hand, which Jokers then modify;
- every Lens that multiplies multiplies the figure too, so figures and the Lens engine compound
  instead of competing;
- and it makes the *order* of the words load-bearing from the first hand of a first run, with
  nothing bought.

Five figures, best one pays, and every one but the floor has to bind **every word you play** —
two words that chain stop chaining the moment you lay a third beside them. That is the tension:
three words for the chips, or two for the figure.

### The ranking is measured, and my instinct was backwards

My first pay table made THE CHAIN — each word opening on the letter the last one closed on — the
rare jackpot at +6 multiplier, because it *felt* like the hardest thing to find.

A seven-card hand contains 210 ordered triples. Measured against the real deck, a three-word
chain is reachable from **36%** of hands. Three words sharing an initial is reachable from **8%**.
I had the ladder upside down, and shipping it would have made the rarest genuine achievement in
the system pay less than a common one.

| Figure | reachable | three words |
|---|---|---|
| THE MONOGRAM — every word opens on the same letter | **8%** | +320 · +5 mult |
| THE CHAIN — each opens where the last closed | **36%** | +220 · +4 mult |
| THE COLUMN — three of the same length | **55%** | +150 · +3 mult |
| THE STAIR — climbing or falling by the same step | **87%** | +80 · +2 mult |
| THE PAIR — any two of your words share a length | ~95% | +30 · +1 mult |

The lesson generalises past this feature: *combinatorial rarity is not available to intuition*. A
test now asserts the ladder never inverts, because the next person to retune these numbers will
have the same instinct I did.

### Added multiplier, not multiplied — which answers the other half of the note

The same round of feedback asked whether an overpowered Lens deck could be handed something extra
to think about. Figures answer that almost by accident, because the multiplier they give is
**added** rather than multiplied.

A figure worth +2 takes a bare round-1 hand from ×1 to ×3 — a 3× swing. The same +2 on a deck
already holding three +mult Lenses takes ×4 to ×6 — 1.5×. It is worth most to the deck that has
nothing and least to the runaway engine, so it *narrows* the gap between a good build and a
broken one. A multiplied figure would have done exactly the opposite.

### Paying for it

Adding a scoring layer and leaving the targets alone would have handed everyone a free doubling,
so the curve was re-derived rather than scaled. Scored on matched seeds with `--nofigures`,
figures inflate rounds 1–2 by five or six times and rounds 3–8 by about 1.8 — the same "worth
most to a weak deck" property seen from the other end. A uniform multiplier would have left the
endgame untouched and made the opening unwinnable.

So rounds 3–8 moved to a percentile of the measured curve, and rounds 1–2 were set from a new
measurement entirely: `--floor`, which plays the first three cards as dealt, never reorders and
never discards. Round 1 sits just under that distribution; round 2 just above its median, which
is where clicking stops working and the board starts being worth reading.

**Where it landed: 18.0% for a realistic player, against 18.2% before figures existed.** The win
rate is deliberately unchanged. The layer was added to make the hand a decision, not to make the
game easier, and a difficulty number that had moved would have meant I did one while claiming the
other.

What did move is the spread. A careless player who never reorders went 12.8% → **10.5%**; a
player who searches every ordering went 23.4% → **30.0%**. Reading the words is worth about twice
what it was, which is the entire ask.

The first attempt scaled the targets uniformly, put round 1 at 1,400, and the full-run E2E test —
which plays the first three cards in dealt order and never discards — died in round one. That
test exists for precisely that mistake.

### The correction: a shape needs something behind it

The first version of this ran the two layers in parallel, and a gameplay pass caught what that
costs. Over every possible play of 951 hands:

| | ignore the Demand | ignore the shape |
|---|---|---|
| round 1, no Lenses | the exactly correct play **70%** of the time | 3% |
| round 4, two Lenses | 55% | 7% |
| round 7, five Lenses | 34% | 7% |

"Read the figure, ignore the round" was free through the first half of every run. That is the
complaint that started this section, arriving again from the other direction — and it is what
parallel systems do. Two scoring layers that never touch are not a decision; the bigger one makes
it for you.

So they touch. **A figure's multiplier is paid only for the words that answer the Demand.** The
chips land either way — the words are worth what they are worth — but the thing that multiplies
them has to be earned twice. Three words the same length that the round wants nothing of is a
shape with nothing behind it.

| | ignore the Demand | ignore the shape | weigh both |
|---|---|---|---|
| round 1 | 45% | 5% | 73% |
| round 4 | 36% | 9% | 43% |
| round 7 | 23% | 11% | 31% |

Nothing solves the hand now. The cost was about 20% off every score, which came back out of the
targets; the realistic win rate is where it was.

### Saying it on the board

A mechanic nobody can see is a tax on guessing. Balatro shows its hand rankings from the first
second and is better for it: the list is not a spoiler, it is the puzzle. So:

- the board **names your figure** as you pick, with what it pays, and says **NO FIGURE** out loud
  when there is none — the absence is information, because it is the one thing still fixable by
  picking differently;
- when the same words would make a better figure in another order, it **says which one** — and
  does not reorder them for you. Choosing the words is the decision; losing points because you
  did not notice is not;
- the figure name is a button onto the full table of five, as is a line on the idle board;
- and the tutorial gained a step that points at the readout and asks you to swap a word and watch
  the name change.

---

## 6.11 The title screen

What a player lands on, and what they come back to. The first version of it was a settings page
with a PLAY button on top: every entry carried a sentence explaining itself, the difficulty
carried two, and the whole thing read as documentation rather than a way in. **If an entry needs a
paragraph, it is the wrong entry.** What it is now is a stack of terse entries with a caret on the
one you are on, walked with ↑/↓, chosen with Enter, and with ←/→ changing the setting you are
standing on — the arrow keys are most of what makes a menu read as a game's rather than a page's.

Three rules hold it:

- **Two menus, and they are not the same menu.** Everything you decide *between* runs — how hard,
  the rules, the figures, your record, the tutorial — is on the title. The one thing you reach for
  *during* a run is sound, and that is the button on the board. The version that put both in one
  panel had the difficulty picker in two places disagreeing about which was the menu, and opening
  the sound settings from the title showed you two buttons both saying "Back to the menu".
- **The way back to the title is a door on the board**, in the masthead, not a line inside a
  panel — and it does not cost you the run. Reaching the menu mid-run offers **Resume run** above
  **New run**, so pressing the top entry never quietly throws a run away.
- **Nothing is on the board that the menu did not name.** A Lens sitting in the rail at round 1
  with nothing said about it reads as the game dealing at random; it is Memory, and the title says
  `Carrying in — <LENS>` with its rule before you press Play.

A UX pass over the finished screen found three more. All three worked for a mouse and for nothing
else:

- **Blocking the pointer is not hiding a screen.** With the menu up, Tab walked eight controls on
  the board before it reached PLAY, and a screen reader read out a hand nobody had been dealt yet.
  `#app` carries `inert` while the title is open now, with `aria-hidden` behind it for browsers
  that have not got inert.
- **The most destructive row sat directly under the most constructive one.** Mid-run the menu
  offered *Resume run* and, one row down, *New run*: same shape, no question asked, and a round and
  103 points gone in one press. Leaving a run you have actually played now costs one sentence
  naming what you are leaving. An untouched board does not ask. The masthead's own *New run* goes
  through the same door.
- **Told a mode exists, then given no way to play it.** The SCHOLAR unlock said it was on the main
  menu whenever you wanted it, and offered three buttons, none of them SCHOLAR. There is a *Play
  SCHOLAR* button in the block now, the mirror of the *Try APPRENTICE* button the gentler offer has
  had all along.

One more came out of the test suite rather than the audit: **changing difficulty rebuilt the whole
menu**, which threw away the button the player's finger was on and dropped keyboard focus. Two
things change when you switch, the lit pill and the line under it, so those are the two things that
change now.

### The copy

A pass over everything a player reads, against the AI-writing tells, found one habit doing most of
the damage: the em dash was the game's default connector. It turned up in nearly every teaching
sentence, and each one asks the reader to hold a clause open while the real point arrives. Most are
now full stops or colons.

The bigger fix was structural. Teach row 2 landed six ideas in one paragraph — figures exist, they
score first, they are about shape and not meaning, here are three of them, the multiplier is
coupled to the Demand, and order matters — at the exact moment a new player is carrying the most.
The coupling, which is the hardest rule in the game, arrived in a subordinate clause. It is two
paragraphs now, and the coupling is stated as something that happens to you: *play three words in a
perfect stair that answer nothing and you get the shape's points, but none of its multiplier.*

---

## 6.12 Hiding a mechanic, and putting it back

Flawed Lenses are the only thing in the shop that can make a run worse while looking like the best
thing on the shelf. THE CURSE reads *multiplier ×3.5* and doubles every target you have left. A
player who has not yet worked out what a multiplier is worth cannot price that, so the obvious move
was to keep them off APPRENTICE's shelf until the player had met one in SCHOLAR.

**It made the gentler mode harder.** 400 runs through the real engine, same seeds:

| APPRENTICE | win rate | p90 multiplier |
|---|---|---|
| with the flawed Lenses | 50.8% | ×65.6 |
| without them | **35.0%** | **×20.0** |

Six of the biggest multipliers in the game are not decoration. The curve is built on the assumption
that a ceiling exists, and removing the ceiling while leaving the curve is a difficulty increase
wearing the word "easier". This is the second time the same trap has caught this project — the
first was APPRENTICE measuring harder than SCHOLAR because `startRound` read the targets raw while
`shapeFor` scaled them.

Lowering APPRENTICE's targets to 0.47 did put the win rate back (47.8%). It was shipped and then
taken out again, because the number being right was hiding that the change was wrong: it bought a
gentler mode by making it *slacker*, and the flawed Lenses are the most interesting decision in the
shop. A new player should get to make it. What they needed was never the absence of the mechanic.
It was the explanation.

**What survived** is the part that was actually about understanding: the first flawed Lens anybody
is offered gets a card of its own, once, on the shelf it is standing on — what it pays, what it
takes, and that early with rounds to pay it off in they are the best thing in the shop while late
they are how a good run ends. It costs the balance nothing, because it explains a Lens the player
is already looking at.

The negative result is worth more than the feature would have been: **a change meant to make
something easier has to be measured, not reasoned about**, and the measurement has to be of the
thing you actually shipped rather than of the idea.

## 6.12a A round nobody can win is not a hard round

THE FORFEIT makes you spend a discard before you may play. THE DROUGHT takes every discard away.
THE RECKONING stacks a second Ordeal on top of the round's own, and a player hit the pair at round
6: a debt of one discard and no currency to pay it in. The run ended on a rule rather than on a
score.

The guard was already there — THE FORFEIT does `g.discards = Math.max(1, g.discards)` with a
comment saying it exists so it can never meet THE DROUGHT — and it only worked in one order. The
rules apply in the order they are listed, so FORFEIT then DROUGHT is `max(1, 4) = 4`, then `0`.

Fixed twice over, because one of them is a rule and the other is a guarantee:

- **The Reckoning does not pair rules that contradict each other.** One table, both directions, so
  the check does not depend on which of the two the round was dealt.
- **A round that demands a forfeit leaves a discard to make it with**, clamped after every rule has
  taken its cut, in both `shapeFor` and `startRound`. Order-independent, and it holds for any
  combination anyone adds later.

The tests walk *every* pair of Ordeals rather than the one that was reported, because the next
contradiction will be somebody adding a tenth Ordeal, not this one coming back. All five fail
against the commit that shipped the bug and pass against the fix — which is the only way to know a
regression test tests anything.

## 6.12b What APPRENTICE takes out, and what it does not

APPRENTICE lowered the targets and handed back a discard, and it was still ending runs in the
middle. Where they ended says why:

| round | deaths, three Ordeals | deaths, one |
|---|---|---|
| 4 | 4.0% | 0.0% |
| 5 | 2.6% | 2.3% |
| **6** | **14.4%** | **3.3%** |
| 7 | 5.8% | 10.8% |
| reached round 8 | 73.0% | **83.8%** |

(Those are the 400-run readings at a flat 0.6. With the compensating curve below and measured at
200 runs against the same 200 runs of the version it replaces: round 6 falls from 13.5% to 8.0%,
round 4 from 2.5% to 0.0%, and 74.5% reach the last round against 71.0%. The simulator is
deterministic per configuration, so only readings at the same run count are comparable.)

Round 6 killed five times as many runs as round 5, and round 7 was *easier* than round 6 despite
asking for more points. Targets climb smoothly, so a spike like that is not a number. Rounds 4, 6
and 8 are the Ordeals.

**An Ordeal does not ask a new player to think harder.** It takes away the tool the tutorial just
spent a step teaching and asks the same question with one hand tied: no discards, four cards
instead of seven, words worth nothing on their own. To somebody still learning the first game,
that is a different game every third round.

So APPRENTICE meets **one**, on round 8, and it is never one of the three that delete a mechanic —
THE DROUGHT, THE LEAN YEAR, THE FOG are out of its pool. THE RECKONING, which stacks a second rule
on the first when a build runs away, does not fire there at all: doubling the one rule is the thing
this mode exists not to do.

**And the targets go up to pay for it.** Dropping two Ordeals took the win rate from 50.8% to
54.8%, so APPRENTICE stopped being a flat fraction of SCHOLAR and got a curve of its own:
`[0.60, 0.60, 0.62, 0.68, 0.76, 0.82, 0.84, 0.76]`. The opening is exactly where it was, the middle
climbs to within a sixth of SCHOLAR, and round 8 eases off because that one is still an Ordeal.
Measured against the version it replaces at the same run count, it lands at **52.5%** against
**53.0%**. That is
the whole point of the change: it is not a smaller game or a slacker one. Every decision survives —
which words, in which order, for which figure, against which Lens — and the numbers ask more for
them. What is gone is being disarmed in the middle of a run.

The shape matters more than the number. Three quarters of runs now reach round 8 and the last round
decides them, instead of the biggest single group ending at a rule change on round 6.

### One thing this nearly broke

The Ordeal pool has to be shuffled **whole and filtered after**, never filtered and then shuffled.
`shuffle` draws once per element, so shuffling a shorter list consumes fewer numbers from the
seeded stream and every draw after it — the deck included — comes out different. The first version
did it the wrong way round and quietly dealt APPRENTICE different words for the same seed, which
would have broken the daily for anyone not playing on SCHOLAR. The test that caught it was already
there: *"APPRENTICE changed the words, not just the curve."*

## 6.13 One rule for the carried Lens

Three buttons said *New run* and did three different things with Memory: the masthead's dropped it,
the result screen's kept it, the menu's kept it. The rule behind that was sound on its own
terms — abandoning a run should not pay you — but a player cannot see which button they are
pressing from the inside, and the word on all three is the same. What it produced was a Lens
appearing on a round-1 board with no explanation, which reads as the game dealing at random.

One rule now: **your Memory Lens comes with you into every new run, until you say otherwise on the
menu.** The original objection was that a board holding a Lens you never bought reads as a failure
to reset; the menu names the Lens and its rule before you press Play, so it cannot read that way
any more.

The control is the strip that already named it, turned into a decision: *Carrying in — CHRONICLER*
with a button that says *Start clean instead*. It never destroys the Lens — finishing a run is the
only thing that replaces it — so the choice is reversible right up to the moment you press Play. It
is not offered mid-run, because changing what you are carrying while you are carrying it is a
question with no honest answer. And the one place the game already stops to ask you something,
leaving a run you have played, now says what the new one will be holding.

## 6.14 Two things a playtester saw that we could not

> "I dont understand what the game has to do with overtones T_T, also that mechanic where u get to
> add a word of yr own is nice but idt its working as intended since the word types seem to be
> assigned randomly"

Both were right, and the second one was a real bug wearing a straight face.

### The word types really were assigned randomly

The Interpreter asks Claude to read a word's overtones, and falls back to a house appraiser when
there is no Claude to ask. On the public link there never is, because `window.claude` only exists
inside an artifact — so **every** player on playovertone.web.app was getting the house. And the house's
last branch, when none of its eighteen regexes matched, drew overtones from a hash of the letters.

Scored against the game's own 249 hand-tagged words, which is ground truth:

| | before |
|---|---|
| matched no rule at all | **64%** |
| got nothing right | **43%** |

EAGLE came back PLANT/TECH. TIGER, TECH/FOOD. BEE, DANGER/DARK. There was also a quieter failure
on top: three-letter fragments matching the insides of unrelated words, so FUNERAL was a TIME word
via "era" and MONDAY via "day".

The house does not guess now. It offers what it can point at, says so plainly when it cannot, and
the short fragments are anchored to a word start. On the same ground truth it now offers a reading
for 90 of 249 words and **94%** of those touch a real overtone.

And the other 159 words are the actual fix: **the player does the reading.** The panel has been
called The Interpreter all along; the interpreter is you. An appraisal — Claude's, or the house's
shape-reading, or nothing at all — arrives as a suggestion with the overtones it proposes already
selected, and you accept it, edit it, or write your own over the top. Two to four, the same range
the hand-authored lexicon uses.

That is better than a correct appraiser would have been. A guess you cannot see is a bug; a
suggestion you can change is a decision, and decisions are what this game is made of.

### And nobody had said what an overtone is

The game is named for a metaphor it never explained. Pluck a string and you do not hear one note:
you hear the note and the quieter frequencies above it, which is why a violin and a flute playing
the same note do not sound alike. Words do it too. FURNACE means a furnace and rings of HEAT, of
TOOL, of DANGER, none of which is the definition.

Naming a thing is not explaining it, and the rules had only ever named it. The help card now opens
on the metaphor before the seven rules, and the tutorial's first beat does the same. The line that
matters is the last one: **what the word means never scores a point.**

---

## 6.15 Nobody reads a wall

Everything in 6.14 was true and almost none of it was short. The help card had grown to seven
paragraphs of five or six sentences each, the figures table sat under two dense blocks, and the
tutorial explained a mechanic in the same breath as justifying it. On a phone, rule 7 alone ran
ten lines. Text that long does not get skimmed, it gets closed.

So the whole of the how-to-play, the figures table and the eight tutorial beats were rewritten to
the same rules, in this order:

- **One idea per sentence.** A rule and the reason for the rule are two sentences, not one with a
  clause hanging off it.
- **No em dashes.** A dash is a pause that makes a sentence longer than it needs to be; a full stop
  is shorter and never ambiguous. There are now none anywhere in the game's copy, including the
  shop, the result screen and the share text.
- **Cut the justification.** The old copy kept arguing for its own mechanics ("which is how you
  afford better Lenses", "so a third card is rarely a mistake"). A player mid-round does not need
  to be sold the design, only told the rule.
- **Say it plainly.** "Each word opens on the letter the word before it closed on" became "Each
  word starts with the letter the last one ended on." Same rule, no ceremony.

Two things stayed deliberately: every number, and the worked FURNACE example. Shortening copy is
only safe while the arithmetic on the page stays exact, and the example is the one place the
arithmetic is shown rather than described.

One detail worth writing down. The figures table printed an em dash in the cell for a figure two
words cannot make, which is a typographic shrug where the cell is being asked a question. It says
**no** now.

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
be loud.

The palette is Balatro’s own register: a dark blue-slate room and table, ivory cards, and the
blue/red chips-and-mult pairing carrying the loudest colour, with gold for money and lavender
for Lenses. A detour through a black-and-wine arcade palette was tried and reverted — it read
as a different game rather than a better-dressed one.

Type is split by job, not taste. An arcade display face carries the wordmark, the blind badge,
every number, card words and buttons; a compact text face (Oxanium) takes the small print —
tag chips, Lens rules, help copy. A heavy arcade face is unreadable at 10px, and the small
print is where the rules live.

Four faces were tried in the text slot before that split existed. Two pixel faces rendered 5
and 8 near-identically, which is fatal in a game made of numbers; a third was so wide that
English wrapped mid-phrase. Moving the numbers to the display face is what finally let the
text face be chosen for reading rather than for counting. Half the
overtone plates are bright enough that white icons vanish on them, so the plate measures its own
luminance and flips to dark ink — and inverts the gold match-ring along with it.

*The juice* is where a card game lives, so it got its own pass: cards deal in with a stagger
(only newly drawn ones — the hand re-renders on every click), breathe on an inner layer so the
idle motion never fights hover or select, and kick with a springy overshoot as they score.
Counters tween rather than snap, Lenses lurch when they fire, the stage shakes and throws
sparks on a big hit, and a green wash breaks over it when the Demand falls.

*Did differently:* Balatro's hand is poker, so the skill floor is a memorised ranking table.
Overtone's "hand" is meaning, which every player already has. And card *order* matters here in
a way it mostly doesn't there, which turns each play into a small ordering puzzle on top of a
selection puzzle. The card faces carry words and overtones rather than rank and suit, so they
run slightly larger and lean on type instead of pips — no art required either way.

**Wordle / NYT Games** — the retention and distribution reference.
*Borrowed:* the shared daily seed; a plain-text share block small enough to paste into a
message; zero account, zero install, one screen.
*Did differently:* Wordle is deliberately finite — one puzzle, then stop. That's excellent for
habit and terrible for session length. Overtone keeps the daily seed as a *comparison* surface
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
at a time, which is tense but slow and can feel like homework. Overtone **prints the overtones
on the card**. Meaning becomes tactical information you act on immediately rather than hidden
state you search for — which is what lets the loop run at roguelite speed.

**Scrabble / Wordscapes** — the deliberate anti-reference.
Both make vocabulary size and spelling the skill. That gates non-native speakers, rewards
memorising two-letter word lists over actual thought, and makes losing feel like a verdict on
your education. Overtone removes spelling from the skill entirely: you never construct a word,
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
