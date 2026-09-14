# Wordhoard

**A word roguelite where meaning is the physics.**

Every word carries *overtones* — semantic tags like HEAT, MOTION, DANGER, TIME. Each round sets
a Demand (`THE FURNACE — wants HEAT, DANGER`) and a target. You play up to three word-cards,
they resolve left to right, and every overtone that matches pays out. Between rounds you buy
**Lenses** that rewrite how meaning scores, until the numbers get silly.

Every card’s emblem is generated from its own overtones — flames for HEAT, shards for COLD,
an eye for ANIMAL — so the picture and the scoring rule are views of the same data. No image
assets: it is all SVG primitives, seeded by the word itself.

Once per run, the **Interpreter** will take any word you type — your dog's name, your job
title, anything — appraise its overtones, and shuffle it into your deck as a real card.

▶ **Play it in the browser** — one click, nothing to install.
Live at `https://adithyamana.github.io/overtone/` once this repo is pushed and GitHub Pages is
enabled; until then, clone and open `index.html` directly (see below) — it needs no server.

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
| `tools/export-cards.js` | Exports the full card list for artwork sourcing. |
| `art/CARDS.md` | All 249 cards, grouped, with filenames and prompts. |
| `art/cards.csv` | Same list as data. |
| `art/prompts.txt` | One image prompt per line, for batch generation. |
| `docs/brainstorming/` | The ideation log the design came out of — 86 logged ideas across seven techniques. |

## Balance

Targets aren't guessed. `tools/sim.js` runs 400 headless runs and reports deck coverage and how
a greedy *lens-less* player fares against each round's target:

```bash
node tools/sim.js
```

It caught two real bugs before launch: decks that could hand you an unwinnable Demand (FOOD sits
on only 21 of 249 words), and a difficulty wall at round 3. Both are written up in
[DESIGN.md §5.4](DESIGN.md).

## Card artwork

Each card shows a generated emblem built from its own overtones — flames for HEAT, shards for
COLD, an eye for ANIMAL — so the picture and the scoring rule are views of the same data.

To use real artwork instead, save an image as `art/<slug>.png` and the game picks it up
automatically. Slugs and prompts for all 249 cards are in [`art/CARDS.md`](art/CARDS.md),
regenerate with:

```bash
node tools/export-cards.js
```

Recommended size **440×280** (11:7), PNG or WebP. Cards without a file keep their emblem, so a
partial art pass ships fine — and words a player invents with the Interpreter have no file by
definition, which is why the generator stays as the fallback.

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
