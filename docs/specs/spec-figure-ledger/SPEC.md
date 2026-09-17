---
id: SPEC-figure-ledger
companions: ["ledger-mechanics.md"]
sources: ["../../brainstorming/brainstorm-overtone-core-loop-2026-09-17/brainstorm-intent.md"]
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# The figure ledger

## Why

A pain to solve. Playtesters report Overtone's loop is stagnant and not fun, and they mean the loop rather than the presentation. Every escalating quantity in the game is a number the player does not touch — the round target, the Lens multipliers. Every quantity the player *does* touch — which three words, in which order, for which figure — is identical in round 8 and round 1. The run has exactly one feedback loop (clear a round → buy a Lens → multiply harder) and nothing the player *learns* feeds back into it: a player who has spotted four CHAINs is in the identical mechanical position to one who has spotted none.

This is not a balance problem. Measured over 400 simulated runs at optimal play, SCHOLAR wins 23.5% with deaths spread across rounds 4–8 — inside the healthy 15–30% band. Retuning the target curve would be motion without progress. What is missing is an accumulator the player drives with play rather than money, so that getting better at seeing shapes is worth something inside the run.

## Capabilities

- **CAP-1** — the ledger accumulates
  - **intent:** Each time a hand scores a figure, the run remembers that it happened, so repeated recognition of the same shape accumulates over a run.
  - **success:** After a hand scores THE COLUMN, the run state records one more COLUMN than before. Playing a hand whose best figure is THE CHAIN increments CHAIN and leaves COLUMN unchanged. Figures present in the hand but not scored (a lesser figure beaten by a better one) increment nothing.

- **CAP-2** — a levelled figure pays more
  - **intent:** A figure the player has played before pays more than the first one did, generously in points and sparingly in multiplier, so committing to a shape is a strategy rather than a preference.
  - **success:** With a COLUMN count of 0, a scoring COLUMN pays exactly what it pays in the shipped game. At counts 1, 3, 6 and 10 its points rise per the table in `ledger-mechanics.md`, and its multiplier contribution rises only at the highest level. No level ever pays less than the level below it.

- **CAP-3** — the ladder is capped and reachable
  - **intent:** The ladder tops out well inside a run, and reaching the top costs enough plays that it reads as a commitment rather than a formality.
  - **success:** The top level is reached at 10 prior plays of one shape, out of a 32-play run maximum, and no further level exists above it. A player who spreads plays evenly across five shapes reaches no level above 2.

- **CAP-4** — the ledger is visible where the decision is made
  - **intent:** The player can see, while choosing which words to play, what each shape is currently worth to them.
  - **success:** With cards selected, the board shows the named figure together with its current level, without opening a menu or panel. With no cards selected, the player can still see the run's ledger across all five shapes.

- **CAP-5** — the ledger is run-scoped
  - **intent:** The ledger is part of the story of one run and does not carry between runs.
  - **success:** Starting a new run resets every figure count to zero, and no ledger state survives from the previous run.

- **CAP-6** — the board never advises a play it will not pay for
  - **intent:** Every surface that ranks or recommends figures ranks them by what they are actually worth to this player right now.
  - **success:** `resolve()`, the reorder nudge and the figures reference panel agree on which of two candidate figures is better, for any ledger state. A hand where a levelled lesser figure now out-pays an unlevelled greater one is scored, nudged and documented consistently.

## Constraints

- Vanilla JavaScript in a single file, no dependencies, no build step. The shipped `index.html` is the source of truth.
- Level 0 must pay exactly what the shipped game pays today. The ladder is additive on top of the existing balance and never a nerf to it — a first-time player's first figure is unchanged.
- The multiplier term moves exactly once, at the top of the ladder. **Corrected after measurement:** this constraint originally read "points are the safe term to be generous with", which is true of a figure's own additive multiplier and false of the engine — a figure's points are then multiplied by the whole deck, so at the ×60 a run reaches by p90 a +448 chip bonus is worth 27,000 points. Neither term is safe when the multiplier is large, and both were cut.
- Only the figure that actually scored may level. A hand contains several figures and `resolve()` pays exactly one; the ledger reads the same fact.
- `figValue(f) = f.chips + 150 * f.mult` is the single ranking function shared by `resolve()`, the reorder nudge and the reference panel. Any payout change must keep all three agreeing.
- SCHOLAR win rate over 400 runs of `tools/balance.js` must land within [15%, 30%] and must not exceed 30%. Baseline is 23.5%.
- The existing Playwright suite must pass. Tests that pin figure payouts may be updated to the new contract; tests that pin unrelated behaviour may not be weakened to accommodate this change.

## Non-goals

- Not rebalancing `TARGETS`. The curve measures healthy and is out of scope.
- Not changing `HAND_SIZE`, `MAX_PLAY`, `ROUNDS`, or the refill rule. Round structure is untouched.
- Not changing Ordeal frequency or the Lens catalogue. Both were considered and deferred.
- No cross-run progression, meta-unlocks or persistent player profile. The ledger dies with the run.
- No new figures. The five existing shapes are the whole vocabulary.

## Success signal

A player can say what they are *building* in a run before it ends — "this is a CHAIN run" — and the board can show them why that was worth doing. Concretely: two runs played from the same seed with different shape commitments produce materially different scores, and the simulator still reports a SCHOLAR win rate inside the healthy band.

## Assumptions

- ~~The ledger is covered by whatever save/restore `G` already has.~~ **Corrected during implementation:** the game has no mid-run persistence at all — a reload starts a fresh run, and the round, score, deck and Lenses are all lost with it. CAP-5 originally asked that a reload preserve the counts, which no other part of a run does either. The clause was dropped rather than a persistence layer invented for one counter.
- Reaching level 4 in a shape the round's Demand does not favour is a real trade the player may make, and does not need a guard rail on this pass.

## Open Questions

- Should a *new* figure pay a one-off discovery bonus, so breadth has its own reward line against the ladder's pull toward depth? Raised in the brainstorm, not resolved. Shipping without it is coherent; adding it later is additive.
- Should the level shown on the board display as a number, a pip row, or both? A presentation call the intent did not fix.
