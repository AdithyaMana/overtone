# The difficulty model

Companion to `SPEC.md`. Holds the per-mode property matrix (CAP-3), the call
sites that must stop testing ids, the starting numbers for the two curves, and
the measurement protocol that decides them.

## Properties a mode declares

Every difference between the two modes is one of these. A mode is a plain object
in `DIFFICULTIES`; nothing outside that table may know a mode's id.

| property | type | meaning |
|---|---|---|
| `id` | string | Storage value and test hook. Never branched on outside the table and the migration block. |
| `n` | string | Display name. |
| `rank` | integer | Ordering by difficulty, 0 = gentlest. This is what "offer the easier one" and "unlock the harder one" read, so adding a third mode later needs no new branches. |
| `curve` | number[ROUNDS] | Per-round multiplier on `TARGETS[r]`. Length must equal `ROUNDS`; a short array is a bug, not a fallback. Replaces both `scale` and `APPRENTICE_CURVE`. |
| `discards` | integer | Added to the base 3 discards a round starts with. |
| `ordealRounds` | integer[] | Round indices (0-based) that carry an Ordeal. |
| `ordealBan` | string[] | Ordeal ids this mode never deals. |
| `reckon` | boolean | Whether THE RECKONING may draft a second rule onto a round when the deck has outgrown it. |
| `bestKey` | string | Storage key for this mode's best score. Distinct per mode — a total from one curve is not a better run than a total from the other. |
| `lockedUntilRun` | integer | Runs that must be finished before the mode can be chosen. 0 = always open. |
| `d` | string | The line under the pills on the title screen. Must say outright whether this is the easier or the harder setting (SPEC Constraints). |

`scale`, `APPRENTICE_CURVE`, `APPRENTICE_ORDEAL_ROUNDS`, `APPRENTICE_ORDEAL_BAN`
and `scholarOpen()` are deleted. `ORDEAL_ROUNDS` survives only if something other
than difficulty still reads it.

## Call sites that must stop testing ids

Each of these currently branches on `id === "apprentice"` or `id === "scholar"`.
All line numbers are against `index.html` at the start of this work.

| site | now | must become |
|---|---|---|
| `ordealRoundsFor()` ~2707 | ternary on id | `mode.ordealRounds` |
| `ordealPoolFor()` ~2710 | ternary on id | filter by `mode.ordealBan` |
| `difficulty()` ~2803 | falls back to `DIFF_BY_ID.scholar` | falls back to the lowest-`rank` mode |
| `scholarOpen()` ~2809 | named for one mode | `modeOpen(mode)` reading `lockedUntilRun` |
| `curveScale()` ~2852 | id ternary, flat `scale` fallback | `mode.curve[round]` |
| first-boot default ~3145 | writes `"apprentice"` | writes the lowest-`rank` id |
| `prefs.difficulty` default ~3167 | `"scholar"` | lowest-`rank` id |
| `reckonFor()` ~3756 | exempts `"apprentice"` | `if(!runDifficulty().reckon) return null` |
| `endRun()` bestKey ~4870 | `"best"` or `"best:"+id` | `mode.bestKey` |
| `endRun()` softer offer ~4911, ~4947 | gate on scholar, offer apprentice | offer the mode one `rank` below, if any |
| `endRun()` first-run unlock ~4924, ~4939 | offers scholar | offers the mode one `rank` above, if any |
| `shareText()` ~4969 | suppresses name when scholar | suppress when `rank === 0`, or always name it |
| `renderControls()` seedLabel ~6175 | same | same |
| `showTitle()` lock ~6268 | `shut` written around scholar | `modeOpen(d)` per pill |
| `titleStats()` bests ~6315 | two hardcoded keys | map over `DIFFICULTIES` reading `bestKey` |
| `paintDiff()` ~6419 | `shut` around scholar | `modeOpen(d)` per pill |

## The two curves

**As measured and shipped.** `TARGETS` itself never moved:
`[7720, 10036, 13047, 16961, 22049, 28664]`.

### Gentle mode — `rank: 0`, named APPRENTICE

`curve: [0.73, 0.73, 0.78, 0.84, 0.89, 0.95]` → absolute targets
`[4169, 5419, 7567, 10516, 14553, 20065]`, climbing steadily. The curve it
replaced held eight entries for a six-round run, two of them dead, and *dipped*:
its round 2 multiplier of 0.31 made round 2 easier in points than round 1, which
is why almost nothing ever ended there.

`discards: 1`, `ordealRounds: [5]`, `ordealBan: ["drought", "lean", "fog"]`,
`reckon: false`, `bestKey: "best:gentle"`, `lockedUntilRun: 0`.

**Measured: 53.4% (95% CI 49.0–57.8) at n = 500.** Pre-final rounds end
0.4 / 1.6 / 4.4 / 6.0 / 6.4%.

### Steep mode — `rank: 1`, named SCHOLAR

`curve: [1.22, 1.08, 1.15, 1.05, 1.12, 1.04]` → absolute targets
`[6948, 8029, 11090, 13230, 18301, 22071]`. It steps ~38% on ordinary rounds and
19–21% on its two Ordeal rounds, so an Ordeal round's difficulty is its rule
rather than its number — restoring an intent the file already described in a
comment but had stopped honouring once `TARGETS` became a flat 1.30 ramp.

`discards: 0`, `ordealRounds: [3, 5]`, `ordealBan: []`, `reckon: true`,
`bestKey: "best:steep"`, `lockedUntilRun: 1`.

**Measured: 26.8% (95% CI 22.9–30.7) at n = 500.** Pre-final rounds end
3.2 / 6.0 / 16.0 / 18.6 / 8.6%.

## Why the wall kept moving

The original defect was round 2 ending 32.0% of all steep runs. Three
measurements at n = 500 established that the round index was never the variable:

| first Ordeal on | that round ended |
|---|---|
| round 2 | 32.0% |
| round 3 | 30.4% |
| round 4 | 26.0% |

Flattening the Ordeal round's target moved the **win rate** (26.0% → 31.2%) and
barely moved the **wall** (26.0% → 24.4%). What moved the wall was restricting
which Ordeal may land early: 24.4% → 18.6%.

So the rule is per **slot**, not per mode. An Ordeal that *disarms* — takes
discards, cards, plays, or the worth of a word on its own — cannot be answered
by a player two shops in, whatever the target says. `DISARMING` lists
`drought`, `lean`, `fog`, `vice` and `clock`; `ordealPoolAt(mode, slot, total)`
withholds them from every slot but the last. It is the same distinction the
gentler mode's `ordealBan` already drew, applied to the slot instead of the mode.

### THE CLOCK

Found broken during this work. It read `g.plays = 3` under the description
"Three plays this round instead of four" — written when a round *was* four
plays. A round has been two since the JOIN rebuild, so the Ordeal **handed the
player a play** while quoting a number the game no longer used. It now takes
one, floored at one, and says so. It counts as disarming: against four plays
"one fewer" was a squeeze, against two it means clearing the round in one hand.

The rest of the Ordeal set has drifted the same way and was **not** re-derived
here — THE VICE caps a line at 2 of a possible 5 rather than 2 of 3, THE TOLL's
90 points a word is noise against four-figure targets. Named as follow-on work.

## Measurement protocol

One command per mode, against the real engine:

```
node tools/balance.js 500 --difficulty <id> --play optimal --buy value
```

Read from its report:

- **Win rate** — must land inside the CAP band. Report it as `p% (95% CI lo–hi)`
  with `SE = sqrt(p(1-p)/n)` and the interval `p ± 1.96·SE`. At n = 500 that is
  ±4.4 points at p = 0.55 and ±4.0 at p = 0.30.
- **"How far a run gets"** — the per-round histogram. It reports the round each
  run ENDED on, wins included, so losses at the final round are
  `reached[last] - wins` and every earlier bar is already a loss count. No round
  **before the last** may exceed its cap (15% gentle, 20% steep) as a share of
  all runs started. The final round is exempt: every surviving run resolves
  there, so its bar tracks the win rate rather than the shape of the curve.
- **Spread** — deaths in ≥ 3 distinct rounds (gentle), ≥ 4 (steep).

A tuning change that has not been re-measured at n ≥ 500 is not done. Record each
measured figure in `.memlog.md` as a `note` with its n, so the history shows what
each curve actually scored rather than what it was hoped to score.

## Migration (CAP-6)

**No stored difficulty is touched.** The names kept the roles they always had,
so `overtone:difficulty` means today exactly what it meant in the build that
wrote it.

| stored before | was | resolves to |
|---|---|---|
| `"apprentice"` | the gentle curve | unchanged — still the `rank: 0` mode |
| `"scholar"` | the steep curve | unchanged — still the `rank: 1` mode |
| absent, `runs > 0` | the steep curve, by the old derived default | written down as the steep mode, before the first-boot default can move them |
| absent, `runs === 0` | — | untouched; a new player, first-boot default applies |

What does move is the **record keys**, because `bestKey` is per curve now. The
old unlabelled `best` held a steep-curve total and the old `best:apprentice`
held a gentle-curve one; they are copied to `best:steep` and `best:gentle`.
Those two old names are frozen history — they record which curve the writing
build put behind that key, not which mode is gentle today.

A `curvesMigrated` flag runs the copy exactly once: a second pass could put a
stale old total back over a better new one.


## Re-measured after the gameplay review

The figures above the retune were all produced by a simulator that **never kept
a line**: `tools/balance.js` read `G.kept` when scoring and never wrote it, so
it modelled a player who declines the only free permanent bonus in the game.
It has a keep policy now, and these are the first honest numbers for either
curve.

| mode | win rate (n=500) | band | worst round before the last | cap |
|---|---|---|---|---|
| APPRENTICE | 56.4% | 48–62 ✓ | 8.8% | 15% ✓ |
| SCHOLAR | 27.2% | 25–38 ✓ | 19.8% | 20% ✓ |

Both curves were raised 1.35× to absorb the review fixes, which between them
made the game markedly easier: kept lines actually being kept, THE VICE capped
at three words instead of two, the gentle mode banning THE VICE rather than
THE FOG, and a card's base value re-keyed off spelling.

### Per-Ordeal cost, measured

Each rule forced onto every scheduled slot, n=300, against the same mode with
no Ordeals at all. This is what drove the VICE change and the ban-list swap.

| Ordeal | APPRENTICE (ceiling 73.0%) | SCHOLAR (ceiling 44.0%) |
|---|---|---|
| THE FORFEIT | 72.7 | 40.3 |
| THE FOG | 72.3 | 43.7 |
| THE MIRROR | 72.3 | 43.3 |
| THE TOLL | 65.7 | 39.7 |
| THE DROUGHT | 59.0 | 34.3 |
| THE LEAN YEAR | 55.3 | 23.3 |
| THE CLOCK | 54.0 | 36.7 |
| THE HALF-LIGHT | 51.3 | 33.0 |
| **THE VICE** (before the change) | **22.0** | **15.3** |

Three of the nine cost under a point of win rate and still get the warning
plaque. That is unresolved and is not a defect with an obvious right answer —
see the spec's non-goals.

### Spelling

`makeCard` set `base = 5 + 3 × word.length`, so the spec's first constraint —
*nothing in scoring may read spelling* — was violated at the foundation, not
merely in the four Lenses that read `w.length`. Base is `6 + 5 × overtones`
now, scaled to leave the lexicon's mean base unchanged at 22, and the
card-face letter-count badge is gone with the figures that needed it.
