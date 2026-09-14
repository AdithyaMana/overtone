# Overtone

**A word roguelite where meaning is the physics.**

Every word carries *overtones* — semantic tags like HEAT, MOTION, DANGER, TIME. Each round sets
a Demand (`THE FURNACE — wants HEAT, DANGER`) and a target. You play up to three word-cards,
they resolve left to right, and every overtone that matches pays out. Between rounds you buy
**Lenses** that rewrite how meaning scores, until the numbers get silly.

Each card shows the icons for its own overtones on a plate tinted by the most distinctive one,
so the picture and the scoring rule are views of the same data. Nineteen icons cover all 249
words — and every word a player invents, which is the case a fixed art library could not serve.

Once per run, the **Interpreter** will take any word you type — your dog's name, your job
title, anything — appraise its overtones, and shuffle it into your deck as a real card.

▶ **[Play it](https://playovertone.web.app)** — one click, nothing to install.

📄 **[Design writeup](DESIGN.md)** — pitch, loop, progression, money, AI, shipping, references.

---

## Play

- Pick up to **three** words that resonate with the Demand.
- They score **chips × mult**, resolving **left to right** — so the order you pick them in matters.
- **Four plays, three discards** per round. Miss the target and the run ends.
- Clear a round and the **Bookseller** sells you a Lens. Lenses are the game; a deck that isn't
  multiplying will stall around round 4.

`1`–`7` pick · `Enter` play · `D` discard · `Space` hurry the scoring · `Esc` close

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

`tools/build-web.js` copies `index.html` into `public/` and serves the same page as `404.html`,
so any URL lands in the game. Tests, tools and `node_modules` stay out of the deploy.

## Tests

```bash
npm test          # engine — no browser, no network, ~0.3s
npm run test:e2e  # browser — desktop + phone, ~21s
```

**137 tests, 0 failures.** The engine tier uses Node’s built-in runner and needs no
dependencies; the E2E tier uses Playwright against `file://`, so no server is involved.
Playwright is a devDependency only — the game still has zero runtime dependencies and still
opens by double-clicking `index.html`.

`tests/harness.js` runs the real `index.html` script in a Node VM against a stubbed DOM, so
engine tests exercise the code that actually ships rather than a copy. Full breakdown, plus
the two real bugs the suite caught, is in [`docs/tests/test-summary.md`](docs/tests/test-summary.md).

## Balance

Targets aren't guessed. `tools/sim.js` runs 400 headless runs and reports deck coverage and how
a greedy *lens-less* player fares against each round's target:

```bash
node tools/sim.js
```

It caught two real bugs before launch: decks that could hand you an unwinnable Demand (FOOD sits
on only 21 of 249 words), and a difficulty wall at round 3. Both are written up in
[DESIGN.md §5.4](DESIGN.md).

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
