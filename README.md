# Overtone

**A word roguelite where meaning is the physics.**

Every word carries *overtones* — semantic tags like HEAT, MOTION, DANGER, TIME. Each round wants
two of them (`THE FURNACE — wants HEAT or DANGER`) and sets a target. You play up to three
word-cards, they resolve left to right, and every overtone that matches pays out. Between rounds
you buy **Lenses** that rewrite how meaning scores, until the numbers get silly.

The tags are what a word *means*. The other half of the game is what a word *is*: three words of
the same length, or three that each open on the letter the last one closed on, make a **figure**,
and the figure is scored before anything reads a single tag. So the round pulls you one way and
the shape of your hand pulls you another, and the order you tap them in is part of it.

Each card shows the icons for its own overtones on a plate tinted by the most distinctive one,
so the picture and the scoring rule are views of the same data. Nineteen icons cover all 249
words — and every word a player invents, which is the case a fixed art library could not serve.

Once per run, the **Interpreter** will take any word you type — your dog's name, your job
title, anything — appraise its overtones, and shuffle it into your deck as a real card.

▶ **[Play it](https://playovertone.web.app)** — one click, nothing to install.

📄 **[Design writeup](DESIGN.md)** — pitch, loop, progression, money, AI, shipping, references.

---

## Play

- Pick up to **three** words carrying what the round wants. Each matching tag is **+25 points**.
- The **shape** of your hand is scored first. Three words of the same length is THE COLUMN; three
  climbing or falling by the same step is THE STAIR; each one opening on the letter the last one
  closed on is THE CHAIN. Figures add points *and* lift the multiplier off 1.
- A hand scores **points × multiplier**. Words and tags add points; the figure and then the
  Lenses move the multiplier.
- **Take three whenever you can.** A non-matching word still adds its own value, so a third word
  is almost never a mistake — and clearing a round with plays and discards left pays more at the
  shop. Play fewer only when a Lens pays you to (ASCETIC gives ×5 for exactly one word).
- **Four plays, three discards** per round. Miss the target and the run ends.
- The game opens on a **main menu**: pick how hard, press Play. A first-time player is started
  on APPRENTICE and told why; a returning one keeps what they chose and sees their run history.
- Two difficulties. **SCHOLAR** is the game as balanced. **APPRENTICE** lowers every
  target by 40% and adds a fourth discard — same words, same Lenses, same Ordeals, more room to be
  wrong in.
- Clear a round and the **Bookseller** sells you a Lens. Lenses are the game; a deck that isn't
  multiplying will stall around round 4.

`1`–`7` pick · `Enter` play · `D` discard · `Space` hurry the scoring · `Esc` close

## Figures

A tester put the problem better than the design notes had:

> Everything revolves around the tags for the words, so the actual word on the card gets ignored
> most of the time. A player can just see the tag needed and pick those cards.

They were right. A word was a tag bundle with a number attached; its letters were decoration, and
the order you played in changed nothing unless you happened to own one of four Lenses. The same
tester found one run far more engaging than the rest — the run where they drew a Lens that paid
for playing words biggest to smallest, because it made them read what they were actually holding.

So that became the base game. Every hand is scored for its **figure** — its shape as an object,
before anything reads its meaning — and the figure lands *first*, so every Lens that multiplies
multiplies it too. It is where a poker hand sits in the game Overtone owes its shape to.

| Figure | Two words | Three words | Reachable from a 7-card hand |
|---|---|---|---|
| **THE MONOGRAM** — every word opens on the same letter | +110 · +2 mult | +320 · +5 mult | 74% / **8%** |
| **THE CHAIN** — each word opens on the letter the last one closed on | +90 · +2 mult | +220 · +4 mult | 87% / **36%** |
| **THE COLUMN** — three words of exactly the same length | — | +150 · +3 mult | **55%** |
| **THE STAIR** — three climbing or falling by the same step | — | +80 · +2 mult | **87%** |
| **THE PAIR** — two of your words share a length | +30 · +1 mult | +30 · +1 mult | ~95% |

Only the best figure pays, and every figure but THE PAIR has to bind **every word you play** —
two words that chain stop chaining the moment you lay a third beside them. That is the decision
the mechanic exists to create: three words for the chips, or two for the figure.

**And the round has to want your words.** A figure's *multiplier* is paid only for the words that
answer the Demand. Three words the same length that the round wants nothing of is a shape with
nothing behind it: the points still land, the multiplier does not. Two of three answering pays two
thirds of it.

This is a correction, not a flourish. Measured over every possible play of 951 hands, the two
layers ran in parallel and the bigger one simply won — "take the best figure and ignore the
Demand" was the *exactly correct* play 70% of the time in round 1 and cost nothing at all through
round 4, while "take the best tags and ignore the shape" gave up 63–79% of the hand. That is the
same complaint that started this work, pointed the other way. Coupling them fixed it:

| | ignore the Demand | ignore the shape | weigh both |
|---|---|---|---|
| **before**, round 1 | best play **70%** | best play 3% | best play 100% |
| **after**, round 1 | best play 45% | best play 5% | best play 73% |
| **after**, round 7 | best play 23% | best play 11% | best play 31% |

No heuristic solves the hand now, at any point in a run.

**The ranking is measured, not guessed.** The first cut of this table had THE CHAIN as the rare
jackpot at +6 mult. A seven-card hand holds 210 ordered triples, so a three-word chain turns up in
36% of them; three words sharing an initial turns up in 8%. The pay table follows the measurement,
and `tests/figures.test.js` asserts the ladder never inverts.

**The tutorial deals a hand it can teach from.** The step that introduces figures tells you to tap
three cards and then names what they made. Dealt at random those three make nothing 43% of the
time and THE PAIR — which demonstrates neither length order nor letters — another 44%, so the one
step that teaches the mechanic mostly taught that the mechanic does not fire. `arrangeForTutorial()`
reorders the same seven words so the first three make the best figure available; 98% now land on
something worth naming. It is a teaching aid, not a handout, so the deal goes back the way it was
dealt the moment the tutorial ends — left in place it cleared round 1 in a single hand and made the
daily seed worth more to a player who watched the tutorial than to one who skipped it.

**The multiplier is added, not multiplied**, which was the other half of the feedback. An added
multiplier is worth most to a deck that has none of its own and least to a runaway engine: it is
a 3× swing on a bare round-1 hand and about 1.5× on a deck already holding three +mult Lenses.
It narrows the gap between a good deck and a broken one instead of widening it.

### Does the order matter?

Yes, from the first hand of your first run — a figure reads left to right, so the same three
words can be THE STAIR in one order and nothing at all in another. The board names the figure you
have made and tells you when the same words would make a better one in some other order. It never
reorders them for you: *which* words to take is the decision, and losing points because you did
not notice is not.

Order matters a second way, which no figure readout would think to mention:

1. **A Lens reads position.** CARNIVORE eats the word to its left, LEXICOGRAPHER pays for your
   leftmost word, ANTONYM ENGINE wants a HEAT word directly after a COLD one, ENTROPY wants each
   word shorter than the one before it.
2. **You hold one Lens that *adds* to the multiplier and another that *multiplies* it.** The
   multiplier is a single running number, so `(1+2)×3 = 9` and `(1×3)+2 = 5` are different
   scores from the same three cards. Put the adders first.

`orderMatters()` in `index.html` computes that second kind, and the Lens line appears only when
it returns true. Blaming the Lenses for something no Lens is reading is a lie the board used to
tell.

## Run it locally

No build step, no dependencies, no server:

```bash
git clone https://github.com/AdithyaMana/overtone.git && open overtone/index.html
```

`index.html` is the whole game — engine, 249-word lexicon, 24 Lenses, and styles in one file.

## Repository

| Path | What it is |
|---|---|
| `index.html` | The game. Standalone; source of truth. |
| `audio/theme.mp3` | The looping theme. The only asset not inlined — fetched on the first tap, never on load. |
| `DESIGN.md` | The full design writeup. |
| `build-artifact.js` | Strips the HTML wrapper to produce `artifact.html` for the Claude Artifacts host. |
| `artifact.html` | Generated — do not edit by hand. |
| `tools/sim.js` | Headless balance simulator (deck coverage + difficulty curve). |
| `tests/harness.js` | Loads the real game into a Node VM for engine tests. |
| `tests/logic.test.js` | Engine tests (node:test). |
| `tests/lenses.test.js` | Exact arithmetic for all 24 Lenses. |
| `tests/figures.test.js` | What makes a figure, which one pays, and where it lands in the score. |
| `tests/e2e/ux.spec.js` | The findings of a UX audit, turned into things that cannot come back. |
| `tests/e2e/difficulty.spec.js` | APPRENTICE and the menu: that it is gentler, cannot be switched into mid-run, keeps its scores out of the real best, and that every door out of the menu comes back to it. |
| `tests/runend.test.js` | Memory unlock and share block. |
| `tests/e2e/` | Browser tests (Playwright). |
| `docs/tests/test-summary.md` | What is covered, and what is not. |
| `tools/export-cards.js` | Exports the full card list from the lexicon. |
| `art/CARDS.md` | All 249 cards, grouped, with overtones and icons. |
| `art/cards.csv` | Same list as data. |
| `docs/brainstorming/` | The ideation log the design came out of — 86 logged ideas across seven techniques. |

## The arcade display face

Big text and every number are set in an arcade display face; the small print stays in a
legible dot-matrix face, because a heavy arcade face is unreadable at 10px.

The page ships with [Russo One](https://fonts.google.com/specimen/Russo+One) as the display
face. To use your own arcade TTF instead — the artifact host’s CSP only serves fonts from
`fonts.gstatic.com`, so it has to travel inside the page as a data URI:

```bash
npm run font -- ARCADE_R.TTF
```

That embeds it as `@font-face { font-family: "ArcadeLocal" }`, which `--f-display` already
asks for first — so the swap needs no other change. `npm run font -- --clear` removes it and
falls back to the web face. Then rebuild with `node build-artifact.js`.

Check the licence first: embedding a font in a published page redistributes it, which many
free-for-personal-use faces do not permit.

## Deploying

```bash
npm run deploy      # stage public/ and push to Firebase Hosting
```

Hosted at **https://playovertone.web.app** (Firebase project `playovertone`).
`overtone.web.app` was already taken globally — that subdomain belongs to whoever owns the
Firebase project ID `overtone`.

`tools/build-web.js` copies `index.html` into `public/`, copies `audio/theme.mp3` next to it, and
serves the same page as `404.html` so any URL lands in the game. Tests, tools and `node_modules`
stay out of the deploy.

## Tests

```bash
npm test          # engine — no browser, no network, ~0.3s
npm run test:e2e  # browser — desktop + phone, ~21s
```

**434 tests, 0 failures.** 144 engine + 290 E2E. The engine tier uses Node’s built-in runner and needs no
dependencies; the E2E tier uses Playwright against `file://`, so no server is involved.
Playwright is a devDependency only — the game still has zero runtime dependencies and still
opens by double-clicking `index.html`.

`tests/harness.js` runs the real `index.html` script in a Node VM against a stubbed DOM, so
engine tests exercise the code that actually ships rather than a copy. Full breakdown, plus
the two real bugs the suite caught, is in [`docs/tests/test-summary.md`](docs/tests/test-summary.md).

## Sound, vibration and motion

### The effects

The first version played one oscillator per event, which is exactly why every sound in the game
was a beep. A hit that reads as physical is three layers landing on the same frame:

1. a **noise transient**, 20–60ms, for the attack you feel;
2. a **pitched body that bends downward** — that fall is what the ear hears as something
   *landing* rather than something *sounding*;
3. a **sub sine** under it for weight.

Chip hardware faked all three with two square channels and a noise channel, so that is the shape
of `SFX` in `index.html`: squares and saws, one noise buffer, hard envelopes with no tail, and a
`tanh` soft clipper on the bus so four layers at once saturate like a console instead of
crackling. The scoring sound climbs a whole-tone ladder as a chain runs, so a long hand builds
instead of repeating, and a multiplier event gets a saw growl under it so it is audibly not a
point.

### The theme

A 96kbps MP3 at ~2MB, **never fetched before the player touches something**: no browser will play
audio before a gesture anyway, so putting it on the critical path would only slow the first frame
for nothing. It sits at `MUSIC_VOL = 0.15` and ducks to a quarter of that under a big hand — it
is scenery, not the show, and at its first setting it swallowed the effects it is supposed to sit
under.

Browsers do not agree on which events count as a gesture, and an iframed page can need the
gesture to land inside the frame, so the start is not a one-shot: it retries on every interaction,
in the capture phase, until the element is genuinely playing, and only then unhooks.

`audio/theme.mp3` is re-encoded from a 6.6MB 320kbps source that stays out of the repo
(`.gitignore`); regenerate it with:

```bash
ffmpeg -i "bg music.mp3" -codec:a libmp3lame -b:a 96k -ar 44100 -ac 2 -map_metadata -1 audio/theme.mp3
```

Music, sound effects and vibration are three separate switches under the ♪ button, because they
fail differently — music is what people mute in public, effects are what they mute at work, and
vibration is what eats a battery. **Vibration is Android-only**: iOS Safari does not implement
`navigator.vibrate` at all, so on an iPhone every `buzz()` is a silent no-op. Nothing in the game
depends on a buzz to be understood; it is confirmation, never information, and the settings panel
says so rather than quietly shipping a dead switch.

`prefers-reduced-motion` kills every animation, the flying points, the confetti and the screen
shake, and short-circuits the counter rolls so the numbers settle synchronously.

### One bug worth knowing about if you touch the particles

Every throwaway particle — sparks, confetti, the flying points, the shockwave — used to be
written as `el.animate(frames, opts)` with a separate, slightly longer `setTimeout` to remove
the element. **A Web Animation with no `fill` reverts its element to the element's own static
style the instant it finishes.** So in the gap between the two, every particle snapped back to
its start position at full opacity and sat there. The sparks were the visible case: 700–1220ms of
animation, removed at 1300ms, leaving a solid square parked dead centre of the board for up to
half a second after every hand.

They all go through `animateOut()` now, which sets `fill: "forwards"` and removes the element on
`onfinish`, with the timeout kept only as a net for browsers that never fire it. A test samples
every frame of the scoring window and fails if any particle's animation does not hold its last
frame — and it was checked against the broken version, because a regression test that passes
either way is worse than none.

## Ordeals

Raising the target curve makes a game grindier, not harder, and the reviews had already said the
loop felt aimless. The problem was not that the rounds were easy, it was that they were all the
**same** — eight rounds of "make a bigger number than last time" with a difficulty knob on it.

**Rounds 4, 6 and 8 now carry an Ordeal**: one rule, stated on the plaque before a card is played,
that stops the hand you have been playing all run from working.

| | |
|---|---|
| THE DROUGHT | no discards |
| THE CLOCK | three plays instead of four |
| THE LEAN YEAR | a four-card hand |
| THE VICE | two words at a time, at most |
| THE FOG | words are worth nothing on their own; only matching tags pay |
| THE TOLL | every word costs 90 points to play |
| THE MIRROR | a word scores nothing unless *two* of its tags match |
| THE HALF-LIGHT | every hand begins at half a multiplier |
| THE FORFEIT | give a word up before you play |

Three are drawn per run from the seed, so a daily deals everyone the same three and two runs are
never shaped alike. Each invalidates a different habit: THE VICE breaks "always take three",
THE FOG breaks a deck built on long words, THE MIRROR breaks a deck built on breadth,
THE HALF-LIGHT breaks an engine leaning on the multiplier.

**The Bookseller names the next Ordeal before you spend.** That is the whole reason they sit on
fixed rounds rather than arriving as a surprise: an Ordeal you are told about is a purchase
decision, and an Ordeal you discover is just a bad beat. Round 8 is always one, so a run ends on a
wall rather than on a slightly larger number.

Round 1 is never an Ordeal — the tutorial runs there, and meeting a rule-breaking round while
still learning the rules would be indefensible. There is a test for it.

## Can a round always be won?

No, and that is deliberate — but it is now always visible one round ahead.

`npm run balance -- --fair` answers the question properly. For every round a run
reaches it computes the **ceiling**: the best score the *whole deck* could produce with
perfect draws, perfect ordering and every play spent. Nothing a real hand does can beat it, so a
target above the ceiling is a target no sequence of plays reaches.

| | rounds the deck cannot reach, however played |
|---|---|
| holding a flawed Lens | **15.6%** |
| holding none | 7.7% |

A flawed Lens roughly doubles it. The 7.7% floor is a build that fell off the curve, which is the
genre working. A losing build is fine; an **invisible** losing build is not — so the Bookseller now
does the arithmetic out loud:

- **The true target.** It used to print `TARGETS[round]` straight, so with THE CURSE it said
  11,500 and the round then demanded 23,000 — the game lying at the exact moment you are deciding
  what to buy.
- **The true shape.** "You will have 3 plays, 2 discards, a hand of 4" whenever a Lens or the
  coming Ordeal has bent the round.
- **The reality check.** *"Played perfectly, your deck makes about 3,854 next round. It asks for
  47,000. No order of play gets there."* Red when it is short, and it names the two ways out: buy
  something that changes it, or sell a Lens costing more than it pays.

One honest finding from the simulator: **selling rarely rescues a run.** Modelling a player who
sells whenever the warning fires made things *worse* — stripping the engine costs more than the
drawback did. Selling only helps when removing that Lens actually raises the ceiling, which is
uncommon. So the flawed Lenses are a bet you commit to rather than a trap you escape, and the
weight sits where it should: on the purchase.

## The Reckoning

A run that gets its engine going stops playing the game. Every hand clears, nothing is a
decision, and the run finishes itself — which is a complaint players made in exactly those words.

Raising every target is the obvious answer and the wrong one: it punishes the decks that never got
going and barely inconveniences the ones that did. So the round answers the deck in front of it.
**Past three times what the round asks for, it drafts a second rule** — one of the Ordeals, never
the one it already has — and the Bookseller names it before you spend, so an engine loud enough to
trigger it is a purchase you made knowing.

Both numbers are measured, and both were retuned after measuring what they cost. Across simulated
runs the deck's ceiling over the round's target sits at a median of **4.1×** on rounds 1 and 2 —
those targets are meant to be walked over, and round 1 is where the tutorial runs — and then at
**0.7× to 1.2×** from round 3 on. So the rule starts at round 3.

The bar is three times rather than twice because twice turned out to be a tax rather than an
answer:

| threshold | fires on | realistic win rate |
|---|---|---|
| no reckoning | — | 20.8% |
| **3× (shipped)** | 0–5% of rounds 3–8 | **18.2%** |
| 2× | 5–18% of rounds 3–8 | 16.6% |

Being strong is the point of the game. Running away with it is what this is for.

**Memory never carries a flawed Lens.** It is a gift handed to a player who has not chosen anything
yet — it arrives before the first shop, on a board they cannot answer it on. A Lens that doubles
every target is a bargain you accept with a deck and a purse, and a sentence when it is dealt to
you on round 1. Taking one is a decision, and a decision has to be made, not inherited.

## Playing on a phone

Portrait is a first-class layout, not a squeezed desktop. The budget is written against
**375×667** — smaller than any phone the game is likely to meet — and every band except the
board and the hand gets a fixed allowance, so the two that carry the game get the slack:

- The control row is **pinned to the bottom**, not measured. Phone heights vary far more than
  widths (a Pixel 5 is 117px shorter than an iPhone 14), and pinning is the only version that
  cannot put PLAY below the fold on a device nobody tested.
- **All seven words are visible at once**, in two rows. A hand you have to scroll is a decision
  you cannot make. Two E2E tests assert exactly this at 393×727 and 375×667: no card's bottom
  edge may fall below the top of the control row.
- **The board does not repeat the hand back.** At portrait width the stage's preview cards are
  hidden — the order badges are already on the cards in hand — which returned 240px of a 667px
  screen. While a hand resolves the cards fold away and the board takes the room, which is what
  makes the scoring readout fit.
- **Every card is the same rectangle.** Left to size themselves, cards came out ragged: a word
  takes one line to three, and its tags one row to five. Each breakpoint now has a single height,
  measured against the worst case the lexicon can actually produce (SANDSTORM, four long
  overtones) rather than guessed. Portrait is the one tier that caps the tag row at two lines to
  afford it — so `cardEl` sorts matching tags to the front, and what a fourth long tag pushes out
  of sight is never one that scores.
- **A Lens opens.** The rail clamps a rule to two lines, and `title` — the only other way to read
  it — is a hover tooltip, which a touch screen does not have, so the rule a player just paid $6
  for was unreadable on a phone. Tapping one opens it out to the full text. It stays on the rail's
  one row, stopping just short of full width so the next Lens peeks in: letting the rail wrap grew
  it by 53px, which is enough to put the hand's bottom row behind the controls.

## Balance

Nothing here is guessed. Two simulators run the **real engine** through the harness — real deck
construction, real draws, real scoring, real shop, real purchases.

```bash
npm run sim                      # deck coverage + how a LENS-LESS player fares
npm run balance                  # full runs: win rate, where runs die, mult ceiling
npm run balance -- --curve       # what a round can actually PRODUCE, per round
npm run balance -- --lenses      # per-Lens power ranking against the baseline
npm run balance -- --stacks      # the strongest reachable loadouts
npm run balance -- 400 --play greedy --buy random
```

`sim.js` plays with **no** Lenses. That was the right question while the shop was the thing
being taught and the wrong one once the shop became the game: **it cannot see a broken Lens,
because it never buys one.** `balance.js` does, and the first time it ran it reported a **70%
win rate** — the reviews were right.

### The simulator was flattering itself

After the first pass the model said 25% and players said it was still easy. They were right, and
the model was wrong in three specific ways — **it never rerolled** the shop, **it never carried a
Memory Lens** into run 2, and its "realistic" player took the best three cards by face value
without trying orderings. That last one is the worst of the three: the board scores every
selection live, so clicking three cards and swapping them about *is* a search. A human is far
closer to optimal play than a greedy model, because the game does the arithmetic for them.

With rerolling, Memory, and a human-depth search (`--play human`, which tries every ordering of
the best five cards), the honest number was **33%**, and rounds 1-3 killed 0.3% of runs between
them. The first three rounds were a formality.

### What the numbers said

| | at first | after pass one | before figures | now |
|---|---|---|---|---|
| optimal player (searches every ordering) | 70% | 43% | 23.4% | **28.3%** |
| realistic player (`--play human`) | — | 33% | 18.2% | **17.0%** |
| careless player (`--play greedy`, never reorders) | — | 12% | 12.8% | **9.0%** |
| round 8 target | 5,200 (p9 of what a round can produce) | 29,000 (p45) | 28,000 | **46,000** |
| best single Lens | ENTROPY, **100%** win, carried to round 7.7 alone | 58% | | |
| worst single Lens | CHRONICLER, 3% | 21% | | |

The last column is the figure pass, and the row that matters is the middle one: **18.0% against
18.2%**. Adding a whole scoring layer and leaving the realistic difficulty exactly where it was
is the point — the layer exists to make the hand a decision, not to make the game easier, and a
difficulty number that had moved would mean I did one while claiming the other. Targets roughly
doubled to pay for it (`--nofigures` scores the same seeds with the layer switched off, which is
how the before and after columns were separated).

What moved is the **spread**. Careless to optimal was 10.6 points before figures existed; it is
19.3 now. Reading the board is worth about twice what it was, and ignoring it costs more.

Three findings did most of the work:

1. **Flat chips die.** Targets climb 116× across a run; a Lens paying +45 a word is decisive in
   round 2 and irrelevant by round 6. PROSPECTOR won 41% against a 64% baseline — it was a trap
   dressed as an option. Seven Lenses now **grow every round you hold them**, sized against
   measured tag frequency (DANGER sits on 34% of the lexicon and grows +40; MONEY on 9% and
   grows +190). They start weaker and end far stronger, which turns a round-2 purchase into a
   round-8 engine and gives the player a number to watch climb.
2. **Unconditional ×mult breaks everything.** ENTROPY won *every* run and reached round 7.7 with
   no other Lens, because "each word shorter than the last" is not a condition, it is a sorting
   instruction. GLUTTON paid ×2.5 for playing three words, which everybody does anyway. Both
   cost something now.
3. **The slot cap was not a cost.** With five slots and nothing but upside in the shop, the right
   play was always "buy the biggest number". Six **flawed** Lenses have the biggest numbers in
   the game and every one takes something back: a play, a discard, two cards of hand, half your
   income, or the target itself.

### Two curves

The game loses four runs in five on purpose, which is right for a roguelite and wrong for somebody
who has lost six in a row without seeing a Lens do anything. **APPRENTICE** scales every target to
60% and hands back a fourth discard. Nothing else moves: the deck, the Lenses, the Ordeals, the
figures and the Reckoning are identical, because an easier mode that removes the decision is not an
easier version of the same game. The extra discard is the deliberate part — what ends an early run
is usually a dead draw rather than a wrong choice.

| | SCHOLAR | APPRENTICE |
|---|---|---|
| realistic player (`--play human`) | **17.5%** | **44.0%** |
| round 1 / round 8 target | 350 / 46,000 | 210 / 27,600 |
| discards | 3 | 4 |

Measure it with `node tools/balance.js --difficulty apprentice`.

**A first run starts on APPRENTICE.** Somebody opening this for the first time has no idea that
four runs in five end early on purpose, and finding out by losing six of them is not a lesson. The
default is written down on the first boot rather than derived every time, or it would flip to
SCHOLAR the moment their run counter passed zero and the game would have changed difficulty behind
them. Anyone who has already played keeps SCHOLAR.

Three things keep it honest. The difficulty is **pinned at `newRun`**, so nobody switches at round
7 to duck the wall. A total scored on the gentler curve is stored under its own key and **never
becomes the SCHOLAR best**. And the share block names the mode, so two scores are never compared
blind — SCHOLAR, being the default, says nothing.

The result screen offers it, once, to a player who has lost three runs and is still falling inside
the first third. Never on a first run, never to someone reaching round 6, never to someone already
playing it.

### Setting a target curve

`--curve` reports what a round can *produce* at each point in a run, so targets are a percentile
of measured output rather than a number that felt right. Rounds 3–8 are a percentile of that
curve, deliberately generous early, because **dying in round 2 reads as the game cheating and
dying in round 6 reads as your build being wrong**, and only one of those makes someone start
again.

Rounds 1 and 2 are not set from that curve at all, and the figure pass is what made the
difference obvious. `--curve` measures what the *best* hand in the deck is worth; the opening
rounds are not aimed at that player. `--floor` measures the other end — first three cards as
dealt, no reordering, no discards, four plays, which is what the first minute of a first run
actually looks like. It puts round 1 at a median of 855 and a 5th percentile of 455.

That gap is the mechanic working. Scored on the same seeds, figures inflate what an optimal
player can produce in rounds 1–2 by five or six times and rounds 3–8 by about 1.8, because an
*added* multiplier is worth most to a deck that has none of its own. Scaling every target
uniformly would have left the endgame untouched and made the opening unwinnable for anyone who
had not yet been told the rule. So round 1 sits at **450**, just under the floor, and round 2 at
**1,100**, just above its median — which is where clicking stops working and the board starts
being worth reading.

The first attempt did scale uniformly, put round 1 at 1,400, and the full-run E2E test — which
plays the first three cards in dealt order and never discards — died in round one. That test
exists for exactly this.

### Two bugs the old simulator could not see

`sim.js` caught decks that could hand you an unwinnable Demand (FOOD sits on only 21 of 249
words) and a difficulty wall at round 3 — both in [DESIGN.md §5.4](DESIGN.md). It could not catch
either of these, because both live on the far side of a purchase.

## Card faces

Each card shows the **icons for its own overtones** — a flame for HEAT, a snowflake for COLD,
paws for ANIMAL — on a plate tinted by its most distinctive one. The picture and the scoring
rule are views of the same data, so a player learns the mapping within a round, and overtones
matching the current Demand get a gold ring so a playable card reads at a glance.

Nineteen icons cover all 249 words, and every word a player invents with the Interpreter — the
case a fixed art library could never serve. Icons are [Google Material Symbols](https://fonts.google.com/icons); that set is also the only one the artifact host’s CSP will
serve, since it allows stylesheets from `fonts.googleapis.com` alone.

The full card list is in [`art/CARDS.md`](art/CARDS.md), regenerate with `node tools/export-cards.js`.

## AI in this project

- **Build time** — the 249-word lexicon and its 19-overtone ontology (~800 semantic judgements)
  were authored with Claude and baked to a static table. That table *is* the rules engine. The
  game runs at 0ms, offline, deterministic, which is what makes a shared daily seed possible.
- **Runtime** — the Interpreter calls Claude live from the published page, validates the reply
  against the tag whitelist, and falls back to a local morphological appraiser when there's no
  runtime or the viewer declines. It degrades; it never breaks.
- **The rule held throughout** — no network call inside the one-second loop.

## Licence

MIT.
