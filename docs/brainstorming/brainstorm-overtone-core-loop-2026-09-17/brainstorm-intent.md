# Intent — the figure ledger

Downstream input for `bmad-spec`. Derived from `.memlog.md` (97 entries, 8 techniques).

## The problem, stated exactly

Every escalating quantity in Overtone is a number the player does not touch — the
target, the multiplier. Every quantity the player *does* touch — which three cards,
in which order, for which figure — is identical in round 8 and round 1.

The run has one feedback loop: clear a round, buy a Lens, multiply harder, clear a
round. Nothing the player *learns* feeds back into it. A player who has spotted four
CHAINs is in the identical mechanical position to one who has spotted none.

## The measurement that rules out the obvious fix

400 runs, SCHOLAR, optimal play: **win rate 23.5%**, healthy band 15–30%. Deaths
spread across rounds 4–8 (13.8 / 12.3 / 17.0 / 11.3 / 15.8%).

The curve is fine. "Not fun" is not a balance complaint. Retuning `TARGETS` would be
motion, not progress.

## The chosen change

**A figure ledger.** Each figure the player completes is remembered for the run, and
the next one of that shape pays more.

Design constraints, each one a flipped bad idea:

| Constraint | Why |
|---|---|
| Short, capped ladder (3–4 levels) | A long grind is the bad version |
| Level only what you actually play | Makes the ledger a record of choices; breadth costs depth |
| Chips scale generously, multiplier scales stingily | Multiplier is the runaway term and was priced carefully already |
| Visible on the board while choosing | It has to inform the decision it is meant to change |
| Persists for the run, resets between runs | That is what makes a roguelite run a story |

## Why this one and not the others

- It is the only change all three personas need, for three different reasons: the
  first-time player's first structural change becomes an *addition* rather than a
  subtraction (today it is THE DROUGHT taking a tool away); the tenth-run player
  finally has the game acknowledge what they have learned; the fiftieth-run player
  gets a diverging optimal line instead of one solved strategy.
- It is the only "crown jewel" that survives being killed. Lenses, the target and
  the multiplier are all load-bearing. Nothing in the file depends on a COLUMN
  paying 150 forever.
- `FIG_PAY` is already a flat lookup table, so the change is a multiplier on a
  lookup plus a per-run counter. Low effort, high impact.

## Existing surface it lands on

- `FIGURES` — 5 shapes, `index.html:2763`
- `FIG_PAY` — flat `{figure: {wordsBound: {chips, mult}}}` lookup
- `figValue(f)` = `f.chips + 150 * f.mult` — the single ranking function, used by
  `resolve()`, the reorder nudge and the reference panel
- `.stage-hint .hand-name` — the figure is already named on the board during
  selection, so the ledger has a home that already exists

## Deferred, in order

1. **Ordeal density.** 9 Ordeals exist; 3 fire on SCHOLAR and 1 on APPRENTICE.
   Content already written and tested, going unspent.
2. **Overshoot banking.** Clearing by 1 and clearing by 40,000 are currently the
   same event — the largest dead signal in the game.

## Rejected for this pass

Finite resources (hand does not refill mid-round, words tire, deck depletes) and
route/choice (branching rounds, buy your own Ordeal, sell a Lens back). Both are
round-structure rewrites with real risk to a 336-test suite and a curve that
currently measures healthy.
