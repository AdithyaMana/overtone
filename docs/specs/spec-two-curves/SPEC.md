---
id: SPEC-two-curves
companions: ["difficulty-model.md", "../spec-the-verb-is-join/SPEC.md"]
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate.

# Two curves, and the copy stops lying

## Why

Overtone ships two difficulty settings and neither is the thing its name promises. Measured against the real engine at optimal play (`tools/balance.js 300 --play optimal --buy value`): SCHOLAR wins 19.0% of runs and APPRENTICE wins 51.3%. The gap is not the problem — the shape is. A third of all SCHOLAR runs (32.0%) end in round 2, after exactly one shop visit, because targets climb a flat 1.30× a round while a player's deck does not; rounds 3, 4 and 5 then end 13%, 15% and 7%. That is a wall in the wrong place with a lull behind it, not a difficulty curve.

Underneath, difficulty is not data. It is 24 hardcoded `id === "apprentice"` / `id === "scholar"` tests spread across `index.html` — the ordeal schedule, the target curve, the reckoning exemption, the unlock gate, the storage keys, the run-end offers. Which mode is the gentle one is an assumption baked into two dozen branches rather than a property anybody can read or change.

At the same time the board states four things the game stopped doing when the verb became JOIN. It tells a first-time player to pick up to three words when a line is five, and to trust a score preview that was deliberately removed. And the tutorial spends one of the round's two plays teaching, so a beginner who does exactly as instructed probably loses the first round they ever see. *(The round is three plays since, and the lesson no longer spends any of them — see CAP-2.)*

## Capabilities

- **CAP-1 — The board stops contradicting itself**
  - **intent:** Every instruction the game gives describes what the game actually does, in the plain vocabulary the rename established, so that a player who reads the screen is not misled by it.
  - **success:** `grep` over `index.html` returns zero occurrences of "Pick up to 3 words", "already worked out what you'd get", "Take three words", "never scores a point", and — outside the `FIGURES` table's own `id` strings — the words "ring together", "pull against", "silence" and "figure" used as player-facing nouns. The board's idle hint states the real cap by reading `maxPlay()`, and reads correctly at cap 2, 3 and 5. The panel reached by tapping the hand name uses ALIKE / OPPOSITE / BOTH / NOTHING and calls the five shapes hands.

- **CAP-2 — The tutorial does not cost the round it teaches in**
  - **intent:** A player finishes the opening tutorial in the same position as a player who skipped it, so that being taught costs nothing and is never something you have to quit in order to leave.
  - **success:** The lesson cannot spend the round. `PLAY` and `DISCARD` are refused for as long as the overlay is up, from the buttons and from the keyboard, and a run that walks the whole lesson ends it with `G.plays`, `G.discards` and `G.roundScore` equal to a run that pressed Skip on step 1 — verified in e2e specs that walk both paths. Round 1 is winnable afterwards from the position the tutorial leaves.
  - *Revised twice on player feedback.* The lesson first required a PLAY and refunded it, which put a permanent liability in the game (the refund had to be gated against replaying the lesson from Help, and a taught hand that cleared round 1 had to be held back so the shop did not land on step 7). Then the requirement became an invitation. Now there is no play to ask for, nothing to refund, and none of that machinery.

- **CAP-3 — Difficulty is data, not branches**
  - **intent:** Everything that makes one mode different from the other is a declared property of that mode, so that changing which mode is gentle is a data edit rather than an audit of the whole file.
  - **success:** Zero occurrences of `"apprentice"` or `"scholar"` as a string literal outside the `DIFFICULTIES` table, the storage-migration block, and tests. Every property in `difficulty-model.md` is read from the mode object at each call site. `tests/harness.js` exports the table and the accessors.

- **CAP-4 — An easy mode that is actually easy**
  - **intent:** A player who has understood the game usually finishes a run on the gentler setting, and loses to the back half rather than to a step they could not have seen coming.
  - **success:** Win rate in **[48%, 62%]** over **n ≥ 500** runs at `--play optimal --buy value`, reported with its 95% CI. **No round before the last ends more than 15%** of all runs started. Deaths occur in at least three different rounds. The final round is excluded: every surviving run resolves there by construction, so at a 53% win rate it necessarily ends ~27% of runs, and a cap that bound it would be a cap on the win rate instead.

- **CAP-5 — A hard mode that is losable rather than walled**
  - **intent:** The steeper setting is lost more often than won and stays worth replaying, with the danger in the back half where a built deck is the thing being tested.
  - **success:** Win rate in **[25%, 38%]** over **n ≥ 500** runs at `--play optimal --buy value`, reported with its 95% CI. **No round before the last ends more than 20%** of all runs started — the measured round-2 figure of 32.0% is the specific defect this retires. Deaths spread across at least four different rounds. The final round is excluded, for the reason given in CAP-4.

- **CAP-6 — Existing players are migrated deliberately**
  - **intent:** A player who already chose a curve keeps that curve and its record when the names move, so that nobody's game changes difficulty behind them.
  - **success:** A profile holding the old id for the gentle curve resolves to the new gentle mode, and likewise for the steep one; the stored best score follows the curve it was set on, not the name. Migration runs once, is idempotent, and a profile with no stored difficulty is unaffected. Covered by an e2e spec that seeds each legacy storage state and asserts the resolved mode and best score.

## Constraints

- Both win rates are **measured, never asserted**. Every figure in this spec's acceptance is produced by `tools/balance.js` against the real engine and reported with n and the 95% CI (SE = `sqrt(p(1-p)/n)`). A tuning change that is not re-measured is not done.
- Neither mode may differ from the other by removing a decision. Every Lens, every hand, the whole deck and the JOIN rules are identical in both; a mode differs only by the properties declared in `difficulty-model.md`.
- The gentler mode must remain honest about what it is. Because the names run against their ordinary sense (see `assumptions`), each mode's own on-screen description states outright whether it is the easier or the harder one — nothing may depend on the player reading the name correctly.
- The game stays one self-contained file with no build step and no runtime dependencies.
- A new top-level `const` or `function` must be added to the `tests/harness.js` export list explicitly, or the Node tests cannot see it.
- Nothing is delivered until `node build-artifact.js` has run and the artifact has been republished — that is the only build the player tests against.

## Non-goals

- Not touching the JOIN engine. `joinOf`, `joinsOf`, `figuresFromJoins`, `resolve`, the five hands and their payouts, the fatigue rule and kept lines are all out of scope.
- Not adding a third difficulty, a per-round difficulty, or an adaptive one.
- Not re-authoring content. The lexicon, the 19 overtones, the 18 Demands, the card art and the audio do not change.
- Not rewriting the whole Playwright suite. Only the specs this change actually invalidates — `difficulty.spec.js` and the copy assertions — are in scope; the suite's pre-existing backlog against the JOIN rebuild is separate work.
- Not changing what the hidden-overtones setting does. It is an opt-in preference and stays one.

## Success signal

Both modes land inside their measured bands at n ≥ 500 with no round exceeding its cap; the four copy sites state what the game does; a tutorial-completing run has the same plays left as a skipping one; and a returning profile opens on the curve it was already playing, with its record intact.

## Assumptions

- ~~The player's assignment of names to roles is literal: SCHOLAR is the easy mode and APPRENTICE is the hard one.~~ **Withdrawn.** It was taken literally, flagged on delivery, and corrected: APPRENTICE is the gentle curve and SCHOLAR the steep one, which is the polarity the game shipped with. The tuning work was identical under either assignment, and the correction was the data edit CAP-3 exists to make possible — both curves re-measured byte-identical under the new names.
- A ~55% target for the gentle mode and ~30% for the steep one are read from "easy mode properly" and "hard but not TOO hard". The bands in CAP-4 and CAP-5 are set wide enough to absorb the sampling error at n = 500 (±4.4% at p = 0.55, ±4.1% at p = 0.30).
- This spec's CAP-5 supersedes the SCHOLAR figure in `spec-the-verb-is-join` CAP-7 ([15%, 30%] win rate). That bound describes the hard mode, which is SCHOLAR under both specs.

## Open questions

- *(resolved during the build)* The unlock gate. The gentler mode is always open and the steeper one opens after one finished run — the same rule as before the swap, since the steep curve is the one a first screen should not offer, but expressed as a `lockedUntilRun` property instead of a function named after one mode.
