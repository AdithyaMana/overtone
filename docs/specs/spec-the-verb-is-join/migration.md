# Migration

What this rebuild keeps, what it replaces, and what it costs. For
SPEC-the-verb-is-join.

## Kept, untouched

- `LEXICON` — 249 words and their overtones. The material the whole design
  rests on.
- `TAGS` / `TAG_KEYS` — the 19 overtones, their names, icons and colours.
- `DEMANDS` — all 18. A round still wants two overtones; only what a word does
  next to another word changes.
- The card art system, `artNode`, `cardEl`'s structure, the audio, the daily
  seed and `mulberry32`, the difficulty split, the Bookseller's economy.
- The title screen, the menu, the tutorial shell, the panel system.

## Replaced

| goes | comes |
|---|---|
| `FIGURES`, `FIG_PAY`, `figureFor`, `figuresIn`, `figValue`, `figureByReorder` | the five rhetorical figures, read off the join list |
| `FIG_STEPS`, `FIG_CHIPS_PCT`, `FIG_MULT_UP`, `figLevel`, `figPay`, `figToNext`, `noteFigure`, `G.figSeen`, `renderFigBar`, `showFigures` | nothing — the ledger is a mastery curve bolted to the orthographic figures and goes with them |
| `resolve(cards)` reading a set | `resolve(line)` reading adjacent pairs, stopping at the first silence |
| `MAX_PLAY = 3` | `LINE_MIN = 2`, `LINE_MAX = 5` |
| `ROUNDS = 8`, 4 plays | `ROUNDS = 6`, 2 plays |
| `renderPreview` showing the total | the same panel showing the relations found so far, never the total |
| the Bookseller's Lens list | choosing which line you played to keep |
| `.card .len` and the length-matching highlight | nothing — spelling stops being a mechanical input |

`LENSES` survives as a concept and most of the 30 entries survive as written —
26 of 30 already read meaning rather than spelling. The four that read
spelling (`SESQUIPEDALIAN`, `LEXICOGRAPHER`, `BRUTALIST`, `ENTROPY`) are
rewritten or dropped under the no-spelling constraint.

## Cost

- `index.html` — the scoring core, the figure system, the preview, the shop's
  Lens step, and `cardEl`'s tag row. Roughly 700 lines touched.
- `tests/harness.js` — the exported api loses `FIGURES`, `FIG_PAY`,
  `figureFor`, `figuresIn` and the ledger symbols, and gains the join
  classifier, the figure detector and the line scorer.
- `tools/balance.js` — rewritten. `bestPlay` currently searches subsets of the
  hand; it must search **ordered** lines of 2 to 5, and it needs a second
  player model that can only see overtones it has already played, because
  CAP-4's acceptance check is measured against that model rather than against
  the optimiser.
- **Tests: 187 of 372 are expected to fail and be rewritten.** `ledger.spec.js`
  (16) is deleted outright. `game.spec.js` (99) holds most of the scoring
  assertions. `difficulty.spec.js` (22) pins round counts and targets.
  `fullrun.spec.js` (2) and `interpreter*.spec.js` (12) play real hands.
  `ux.spec.js` (29) and `flaws.spec.js` (7) are mostly chrome and mostly
  survive.

## Order of work

The dependency order is not a preference. CAP-2's silence rule carries no risk
until CAP-4 hides the overtones — measured, an optimiser with full information
never hits a silence. Build in this order and each step is testable when it
lands:

1. The join classifier and the opposition table. Pure functions, no UI.
2. `resolve()` on ordered lines, stopping at silence. The simulator can score
   the new game before the board can draw it.
3. Rebuild `tools/balance.js` and set `TARGETS` from it. Nothing else is worth
   tuning until the curve is known.
4. The five rhetorical figures.
5. Hide the overtones, and the learned-word store.
6. Fatigue.
7. Kept lines, and the Bookseller's new step.
8. The board: laying a line, the relations panel, no total.

Steps 1 to 3 are where the design either works or does not, and they need no
interface at all. If the win rate cannot be brought inside CAP-7 with these
shapes, that is the moment to stop and say so rather than to keep building.
