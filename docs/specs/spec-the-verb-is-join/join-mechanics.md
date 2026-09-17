# Join mechanics

The physics for SPEC-the-verb-is-join. Every constant here is provisional and
is settled by `tools/balance.js` against CAP-7; the shapes are not.

Evidence for the pair statistics quoted throughout:
`docs/brainstorming/brainstorm-overtone-make-it-fun-2026-09-17/.memlog.md`,
measured on the shipped lexicon.

## The opposition table

Eight pairs, all drawn from overtones the ontology already has. Nothing new is
authored.

| | |
|---|---|
| HEAT | COLD |
| DARK | BRIGHT |
| NATURE | TECH |
| MIND | BODY |
| WET | HEAT |
| ABSTRACT | BODY |
| ABSTRACT | FOOD |
| ABSTRACT | TOOL |

## A join

For adjacent words `a` and `b`:

- `s` = number of overtones they share
- `t` = number of table rows where one carries the left tag and the other the right

| s | t | kind |
|---|---|---|
| >0 | >0 | **PARADOX** |
| 0 | >0 | **TENSION** |
| >0 | 0 | **RESONANCE** |
| 0 | 0 | **SILENCE** |

Measured across all 30,876 lexicon pairs: resonance 49.7%, tension only 17.0%,
paradox 11.9%, silence 33.2%. Inside a dealt hand of seven, 99.5% of opening
hands hold at least one join in tension.

## Scoring a line

A line is 2 to 5 words in the order the player laid them. Scoring runs left to
right, join by join, and **stops at the first silence**. Words before the
silence score; words after it do not.

```
chips = 0, mult = 1, scored = 1
for each join (a, b) at index i:
    if kind is SILENCE: stop
    scored = i + 2
    chips += JOIN_RESONANCE * s
    mult  += JOIN_TENSION   * t
for each of the first `scored` words:
    chips += word.base                      # 5 + 3 per letter, unchanged
    chips += DEMAND_PTS * (its demanded overtones, if not dull)
total = chips * mult
```

| constant | start | note |
|---|---|---|
| `JOIN_RESONANCE` | 40 | points per shared overtone on a join |
| `JOIN_TENSION` | 1 | multiplier added per opposed pair on a join |
| `DEMAND_PTS` | 25 | unchanged from the current game |
| `LINE_MIN` / `LINE_MAX` | 2 / 5 | replaces `MAX_PLAY = 3` |
| `ROUNDS` / plays per round | 6 / 2 | 12 plays per run, against 32 now |
| `FATIGUE_SPAN` | 2 | plays an overtone stays dull after it scores |
| `LENS_SLOTS` | 5 | unchanged |

## The five figures

All read the join list. None reads spelling.

| figure | condition |
|---|---|
| **ANTITHESIS** | any join of kind TENSION |
| **PARADOX** | any join of kind PARADOX — resonant and opposed at once |
| **SYNONYMY** | any join with `s >= 3` |
| **ESCALATION** | two consecutive non-silent joins where `s` strictly rises |
| **CHIASMUS** | three consecutive joins whose kinds read A-B-A, where a kind is "has tension" or "has not" |

A figure pays chips and multiplier as the old ones did; the ladder is set by
the simulator. PARADOX is the rare one — 11.9% of pairs — and is what
JUXTAPOSITION was reaching for in the brainstorm. JUXTAPOSITION itself cannot
exist alongside "silence stops the line" and is dropped rather than
special-cased.

`OWL / EYE` is a PARADOX: it shares an overtone and opposes on both
DARK/BRIGHT and MIND/BODY. The current game scores that pair as nothing. There
are 1,469 such double oppositions in the lexicon already.

## Fatigue

An overtone that contributed to a score — as a shared overtone on a join, or
as a demanded tag — goes **dull** for the next `FATIGUE_SPAN` plays. While
dull it counts 0 for resonance and 0 for the Demand. It still counts for
tension, because an opposition is a fact about two words rather than a
resource being spent.

## Kept lines

At the end of a round the player may keep one line they played that round. It
becomes a Lens carrying its own words as its name, and grants a standing bonus
to the figure that line made — a line that made an ANTITHESIS grants a bonus
to every later ANTITHESIS. Five slots. This replaces buying from a list; the
Bookseller's role becomes offering the choice, which is also the first time
the Bookseller is a thing the player sees rather than a menu.

## Settled by simulation

`tools/join-sim.js` builds the whole loop on the real lexicon and deck and
reports against CAP-7. The constants above are no longer provisional:

| | |
|---|---|
| `KEPT_CHIPS` / `KEPT_MULT` | 120 / +1, per kept line whose figure fires |
| `TARGETS[r]` | round-1 ceiling × 1.30^r, where the ceiling is the p50 of one perfectly played line (7,720) |

**500 runs, full information: 20.6% win rate, 95% CI 17.1–24.1 — inside
[15%, 30%].** Deaths spread 10.2 / 20.6 / 14.0 / 13.4 / 10.2 / 11.0 across all
six rounds, which is a better spread than the shipped game manages.

## Acceptance checks

- **Order matters (CAP-1).** Best ordering of the same three words beats the
  worst by at least 40% at p50. Measured on 400 real hands under these
  constants: **x6.00 at p50**, x1.62 at p25, x18.18 at p90.
- **Figures fire (CAP-3).** At least 3 distinct figures per run at p50.
  Measured: **3 at p50, 4 at p90** in a single opening hand's best line.
- **Silence bites (CAP-4).** At the median, at least one line per run stops
  early, measured against a player model limited to the overtones it has
  already seen. Under full information it is **0.0%** — a connected five-word
  path essentially always exists when two thirds of pairs connect. This is why
  hiding the overtones is load-bearing rather than decorative.
- **Fatigue works (CAP-5).** The same overtone scores on two consecutive plays
  in under 5% of play pairs.
- **It can be lost (CAP-7).** SCHOLAR inside [15%, 30%] over 1,200+ runs,
  deaths across 4+ distinct rounds.

## Lines these rules actually produced

Unedited, from the best line found in six real opening hands:

```
MIDNIGHT · LANTERN · SHADOW · SANDSTORM · LANDMINE     2,072   antithesis, paradox, escalation
REED · EMBER · GLINT · SANDSTORM · FALCON              2,232   paradox, antithesis, escalation
INSTINCT · BREATH · BANDWIDTH · AMBUSH · DAWN          1,220   paradox, antithesis, chiasmus
DREAM · SPRINT · LOGIC · BLIZZARD · NETTLE             1,425   antithesis, escalation
WOLF · NET · HALO · GALLOWS · CAVERN                   1,168   antithesis, escalation
SHRAPNEL · RUST · EYE · RESOLVE · OYSTER               1,320   antithesis, paradox
```

A five-word line pays 1,200 to 2,200 at round 1 under the starting constants,
against a current round-1 target of 350. `TARGETS` is rescaled by the
simulator, not by hand.
