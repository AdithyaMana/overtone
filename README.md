# Overtone

**A word roguelite where meaning is the physics.**

Every word carries *overtones* — semantic tags like HEAT, MOTION, DANGER, TIME. Each round wants
two of them (`THE FURNACE — wants HEAT or DANGER`) and sets a target. You play up to three
word-cards, they resolve left to right, and every overtone that matches pays out. Between rounds
you buy **Lenses** that rewrite how meaning scores, until the numbers get silly.

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
- A hand scores **points × multiplier**. Words add points; only Lenses move the multiplier.
- **Take three whenever you can.** A non-matching word still adds its own value, so a third word
  is almost never a mistake — and clearing a round with plays and discards left pays more at the
  shop. Play fewer only when a Lens pays you to (ASCETIC gives ×5 for exactly one word).
- **Four plays, three discards** per round. Miss the target and the run ends.
- Clear a round and the **Bookseller** sells you a Lens. Lenses are the game; a deck that isn't
  multiplying will stall around round 4.

`1`–`7` pick · `Enter` play · `D` discard · `Space` hurry the scoring · `Esc` close

### Does the order matter?

Not until it does, and the board only claims it when it is true.

With no Lenses the points are summed and the multiplier never moves, so every order of the same
three words scores the same number. It becomes real two ways:

1. **A Lens reads position.** CARNIVORE eats the word to its left, LEXICOGRAPHER pays for your
   leftmost word, ANTONYM ENGINE wants a HEAT word directly after a COLD one, ENTROPY wants each
   word shorter than the one before it.
2. **You hold one Lens that *adds* to the multiplier and another that *multiplies* it.** The
   multiplier is a single running number, so `(1+2)×3 = 9` and `(1×3)+2 = 5` are different
   scores from the same three cards. Put the adders first.

`orderMatters()` in `index.html` computes exactly that, and the stage line appears only when it
returns true. Telling a lens-less player on their first screen that order matters was a lie the
board used to tell.

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

**268 tests, 0 failures.** 102 engine + 166 E2E. The engine tier uses Node’s built-in runner and needs no
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

| | at first | after pass one | now |
|---|---|---|---|
| optimal player | 70% | 43% | **23%** |
| realistic player (`--play human`) | — | 33% | **18%** |
| careless player (random buys) | — | 12% | **11%** |
| round 8 target | 5,200 (p9 of what a round can produce) | 29,000 (p45) |
| best single Lens | ENTROPY, **100%** win, carried to round 7.7 alone | 58% |
| worst single Lens | CHRONICLER, 3% | 21% |

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

### Setting a target curve

`--curve` reports what a round can *produce* at each point in a run, so targets are a percentile
of measured output rather than a number that felt right. The curve now sits at roughly
p3 / p5 / p10 / p14 / p18 / p22 / p26 / p45 — deliberately generous early, because **dying in
round 2 reads as the game cheating and dying in round 6 reads as your build being wrong**, and
only one of those makes someone start again.

A Lens-less player clears round 1 at ×2.2 and misses round 2 at ×0.97. Missing by three percent
is the shop teaching itself.

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
