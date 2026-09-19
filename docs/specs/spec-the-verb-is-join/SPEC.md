---
id: SPEC-the-verb-is-join
companions: ["join-mechanics.md", "migration.md"]
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate.

# The verb is JOIN

## Why

A vision to realize, forced by a pain. Players say Overtone's idea is good and playing it is boring, and the diagnosis is not the scoring curve — it is the verb. The player picks up to three of seven cards against a checklist the board has already scored for them before they commit. Nothing is composed, no judgement is made, two people playing the same daily play identically and have nothing to tell each other afterwards. Meanwhile the game's own data holds a better game: half of all word pairs in the lexicon share an overtone, 17% are in opposition, and 11.9% are both at once — and none of that is read at the moment of play. The verb becomes JOIN: words are laid in an order and score against **each other**, so that the thing the player is deciding is what these two words do when you put them next to one another.

## Capabilities

- **CAP-1 — A line, not a selection**
  - **intent:** The player lays 2 to 5 words in an order, and scoring reads each adjacent pair rather than the set, so that the order they are laid in is the decision.
  - **success:** For a fixed set of three words drawn from a real hand, the best ordering scores at least 40% more than the worst at the median across 400 seeded hands. Order that changes nothing is order that is decoration.

- **CAP-2 — Resonance, tension and silence**
  - **intent:** Each adjacent pair is one of three things — RESONANCE (shares overtones), TENSION (carries an opposed pair), SILENCE (neither) — and each pays differently, so that every placement is a judgement about meaning.
  - **success:** `resolve()` classifies every adjacent pair using only the existing tag data and the opposition table in `join-mechanics.md`; resonance pays points, tension pays multiplier, and a silent join stops the line's scoring at that point. Verified against the worked examples in the companion.

- **CAP-3 — Figures are figures of speech**
  - **intent:** The five figures are rhetorical rather than orthographic — read off the tag matrix, not off spelling — so that the multiplier and the theme are the same system.
  - **success:** No figure reads word length, first letter or last letter. At the median, a run makes at least 3 of the 5 distinct figures, measured over 400 simulated runs.

- **CAP-4 — The overtones are hidden**
  - **intent:** A word's overtones are not printed until the player has played that word, and what they have learned persists between runs, so that the player's own sense of English is the skill the game tests.
  - **success:** On SCHOLAR, a card for an unplayed word renders no tag row and no gold stripe; a word played once is annotated for every later run in the same profile. On APPRENTICE the overtones are shown, so the difficulty setting carries the information asymmetry and no first-time player is asked to guess blind.
  - **not settleable here:** This is the one capability simulation cannot judge, and the reason is the capability itself. A player model with no semantic knowledge wins 0.7% and dies in round 1 three quarters of the time — but that model is not a beginner, it is somebody who does not speak English, and the entire premise is that a human already knows FURNACE is hot. The true figure lies between 0.7% and the 20.6% a fully-informed player scores. **A human playtest decides it, and it is the one risk this spec cannot retire.**

- **CAP-5 — Overtones tire**
  - **intent:** An overtone that scored goes dull for the next two plays and pays nothing while dull, so that the strongest play this turn is not the strongest play next turn.
  - **success:** Across 400 simulated runs, the same overtone scores on two consecutive plays in under 5% of play pairs, against a measured baseline for the current game in the same report.

- **CAP-6 — You keep the lines you wrote**
  - **intent:** At the end of a round the player may keep one line they played; it becomes a Lens granting a standing bonus to the figure that line made, named after the line, so that the run's engine is something the player wrote rather than something they bought.
  - **success:** A kept line appears in the rail carrying its own words as its name, and its bonus applies to later hands. Five slots, as now.

- **CAP-7 — It is still a game that can be lost**
  - **intent:** The run is 6 rounds of 3 plays with targets the new scoring can reach but not comfortably, so that the rebuild is balanced rather than merely different. *(2 plays as first shipped; raised on player feedback — see the assumption below.)*
  - **success:** SCHOLAR win rate inside [15%, 30%] over at least 1,200 simulated runs at optimal play, with deaths spread across at least four different rounds.

## Constraints

- No new content may be authored to make the physics work. The 249-word lexicon, the 19 overtones, the 18 Demands, the card art and the audio are the material; the opposition table is derived from overtones that already exist.
- Nothing in scoring may read spelling. Word length, first letter and last letter stop being mechanical inputs entirely, including in Lenses.
- ~~The board never shows the score of an uncommitted line. It may show which relations it has found; the total is only known after PLAY.~~ **Withdrawn on player feedback.** It shipped, and the first thing the player said about it was "why do the points not get counted?" — the reasoning held (a board that prices the hand makes choosing words arithmetic somebody else has already done) and the reading was still correct: POINTS 0 and MULTIPLIER 1 under a hand you have just built is indistinguishable from a game that has stopped adding up. Dashes and a caption were tried first and did not survive contact either. The counters follow the selection again. The half the constraint was right about is kept: the relation beads name what each pair is DOING, which is the part a player has to learn, and that is what the board teaches with.
- Every constant in `join-mechanics.md` is provisional until `tools/balance.js` is rebuilt for the new scoring and reports against CAP-7. The spec asserts the shape, not the numbers.
- The game stays one self-contained file with no build step and no runtime dependencies.
- A silent join must not void the whole line. It stops scoring at that point and the words before it still pay.

## Non-goals

- Not turning Overtone into a chain-to-a-destination puzzle, a duet with the machine, or a librarian simulator. Those were generated in the brainstorm and are not being built.
- Not enlarging the lexicon. If 249 words is too few, hiding the overtones is the answer being tested first.
- Not keeping the existing figure ledger. It is a mastery curve bolted to the orthographic figures and is replaced along with them.
- Not preserving the current test suite as written. The scoring model changes, so the tests that pin it change with it.
- Not shipping to `playovertone.web.app` from this spec. It lands on a branch and is judged there.

## Success signal

Two players are given the same daily hand and produce different lines, and each can tell the other why theirs was better. The run ends with something the player wrote, in their own words, that is worth showing to somebody.

## Assumptions

- Silence stops the line rather than voiding it. Voiding can waste a whole turn on a guess while the overtones are hidden, which punishes the exploration the design depends on.
- What the player has learned about a word persists across runs rather than within one. Across runs, the small lexicon becomes the progression; within one, it teaches nothing lasting.
- A kept line's bonus attaches to the figure it made. The alternative — the player choosing an arbitrary effect — makes the line a token rather than a thing they wrote.
- ~~6 rounds of 2 plays. The brainstorm said fewer and heavier without naming a number; 12 plays against the current 32 is the reading taken.~~ **Revised to 3 plays** on the player's report that two felt thin. Two took "fewer and heavier" too far: it leaves a round no middle — the best line, the second best line, done — and no turn that hinges on what the first play spent, which is the turn CAP-5's dull rule exists for. 18 plays a run. `TARGETS` was re-derived by sweep to match (10,422 opening, x1.42 a round) and both curves re-measured; see `spec-two-curves/difficulty-model.md`.

## Open Questions

- Does the daily stay honest when veterans know the overtones and newcomers do not? The difficulty setting is assumed to absorb it; a shared-knowledge daily mode is the fallback if it does not.
- Should a word's overtones be learned on being played, or on being scored? Played is assumed, as it rewards experiment rather than success.
