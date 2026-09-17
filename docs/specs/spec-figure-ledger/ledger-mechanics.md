# Ledger mechanics

Companion to `SPEC.md`. Holds the tables the kernel cites by name.

## The ladder

`count` is the number of times this figure has **scored** earlier in the run, read
*before* the current hand resolves. The current hand is paid at the level its count
has already earned, then the count increments.

| Level | Reached at count | Points × | Multiplier + |
|------:|-----------------:|---------:|-------------:|
| 0 | 0 | 100% | +0 |
| 1 | 1 | 120% | +0 |
| 2 | 3 | 140% | +0 |
| 3 | 6 | 160% | +0 |
| 4 | 10 | 180% | +1 |

Thresholds are triangular, not linear. A linear ladder capped at four would top out
by the fourth play of a thirty-two-play run and re-stagnate everything after it;
triangular makes level 4 a ten-play commitment.

Percentages are integers divided at the end, never float factors — `110 * 2.05`
evaluates to 225.49999999999997 and rounds the wrong way. These particular steps
divide every `FIG_PAY` base exactly, so no cell in the table below rounds at
all; the integer form is what guarantees that rather than luck.

## Repriced once, after measurement

The first ladder ran to 240% and +2 at the top. Four hundred simulated runs put
it at **29.0%** against a 23.5% baseline — inside the band on the point estimate
and outside it on the evidence, because the standard error at that sample is
2.27 points and the 95% interval reached 33.4%.

The reasoning that overpriced it is worth naming. *"Points are the safe term,
the multiplier is the runaway one"* is true of a figure's own additive
multiplier and false of this engine, because a figure's points are then
multiplied by the whole deck. At the ×60 a run reaches by p90, the old +448
chips on a maxed MONOGRAM was worth twenty-seven thousand points. When the
multiplier is large, nothing is the safe term — so both were cut.

## Worked values

Applying the ladder to the shipped `FIG_PAY`:

| Figure | Words | L0 | L1 | L2 | L3 | L4 |
|---|---|---|---|---|---|---|
| MONOGRAM | 3 | 320 / +5 | 384 / +5 | 448 / +5 | 512 / +5 | 576 / +6 |
| MONOGRAM | 2 | 110 / +2 | 132 / +2 | 154 / +2 | 176 / +2 | 198 / +3 |
| CHAIN | 3 | 220 / +4 | 264 / +4 | 308 / +4 | 352 / +4 | 396 / +5 |
| CHAIN | 2 | 90 / +2 | 108 / +2 | 126 / +2 | 144 / +2 | 162 / +3 |
| COLUMN | 3 | 150 / +3 | 180 / +3 | 210 / +3 | 240 / +3 | 270 / +4 |
| STAIR | 3 | 80 / +2 | 96 / +2 | 112 / +2 | 128 / +2 | 144 / +3 |
| PAIR | 2 or 3 | 30 / +1 | 36 / +1 | 42 / +1 | 48 / +1 | 54 / +2 |

## Why PAIR needs no special case

PAIR is reachable in roughly 95% of hands. A rule that levelled every figure
*present* would max PAIR immediately and the ladder would be free.

The rule levels only the figure that **scored**, and `resolve()` already pays exactly
one figure per hand — the best one. PAIR is the best figure only when nothing better
was available, so it levels on the consolation track, which is where a shape that
costs nothing to find belongs.

The same logic prices the whole ladder without per-figure thresholds: rarer shapes
level more slowly because they score more rarely, and that falls out of the existing
scoring rule rather than a table of exceptions.

## Ranking consistency

`figValue(f) = f.chips + 150 * f.mult` is the single comparator behind `resolve()`,
the reorder nudge and the figures reference panel. Once payout depends on ledger
state, `figValue` must be evaluated against the *levelled* payout, or the board will
nudge toward a play it then declines to pay for.

This is the one place the change can produce a wrong-looking game rather than a
merely differently-balanced one, and is the first thing to test.

## Acceptance checks

**Simulator** — `node tools/balance.js --runs 400`
- SCHOLAR win rate within [15%, 30%], not exceeding 30%. Baseline 23.5%.
- **MET.** 1200 runs: **24.9%** (95% CI 22.5–27.3). The ladder alone measured 25.0%
  on the same seeds, so the discovery bonus costs −0.1 points — indistinguishable
  from zero against a 1.25-point standard error. A counterweight that pays for
  breadth and is paid for by the ladder levels breadth does not earn.
- **Read the confidence interval, not the point estimate.** At n=400 the standard
  error near 25% is about 2.2 points, so a reading of 29.0% does not clear a 30%
  bound — its interval reaches 33.4%. The first ladder was rejected on exactly
  this, and a previous session in this repo lost two candidate curves to the
  same mistake.
- **The simulator is a floor, not a ceiling.** `bestPlay()` scores each hand
  through `resolve()` and so values a levelled shape correctly, but it never
  takes a weaker hand now to level a shape for later — which is the whole
  strategy the ladder exists to enable. A committed player beats this number,
  so the bound has to be cleared with room, not met exactly.
- **The simulator is deterministic.** `runOnce("bal-" + s)` walks a fixed seed
  prefix, so `--runs 400` scores the same 400 runs every time and re-running a
  number confirms nothing. The only way to tighten the interval is a larger
  `--runs`, which extends the same prefix rather than resampling.
- `--noledger` flattens the ladder to level 0 and must reproduce the 23.5%
  baseline. If it does not, the measurement apparatus moved and no other
  number in this file can be trusted.
- The simulator's own play policy must be taught the ladder, or it will undervalue
  repeat shapes and report a number that does not describe the game.

**Playwright**
- A hand scoring COLUMN increments COLUMN only; a lesser figure present in the same
  hand increments nothing.
- Second COLUMN of a run pays 120% of the first. Points, exact, at every level.
- Multiplier contribution is unchanged at counts 0, 1, 3 and 6, and rises once at 10.
- A new run zeroes every count. Nothing about a reload: the game has no mid-run
  persistence for anything, so there is no behaviour here to pin.
- The level is readable on the board with cards selected, and the five-shape ledger
  is readable with none selected.
- The reorder nudge and `resolve()` pick the same figure for a ledger state where a
  levelled lesser figure out-pays an unlevelled greater one.
