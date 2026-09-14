# Test Automation Summary — NecroCards

**115 tests, 0 failures.** 65 engine tests + 50 E2E tests across two device profiles.

```bash
npm test          # engine — no browser, no network, ~0.3s
npm run test:e2e  # browser — desktop + phone, ~21s
npm run sim       # balance report (not a test; prints the difficulty curve)
```

## Framework

There was no existing framework, no `package.json` and no tests. The project is a
single-file vanilla-JS browser game with no build step, so:

| Tier | Framework | Why |
|---|---|---|
| Engine | **`node:test`** (built in) | Zero dependencies, so the fast tier stays runnable anywhere — including a machine that has never run `npm install`. |
| E2E | **Playwright** | The current standard for browser E2E, and the only tier that can prove a click actually scores. Runs `file://` directly — no server needed, matching how the game ships. |

Playwright is a `devDependency` only. **The game itself still has zero runtime
dependencies** and still opens by double-clicking `index.html`.

### The harness is the important part

`tests/harness.js` loads `index.html`, extracts the inline script, and runs it in a
Node VM against a stubbed DOM — then exports the real functions and state.

Engine tests therefore exercise **the code that actually ships**, not a copy. This
mattered immediately: `tools/sim.js` previously re-implemented deck construction from
a regex scrape, and had silently drifted out of sync with the game it was measuring.
It now runs on the harness too.

## Generated tests

### Engine — `tests/*.test.js` (65)

| Suite | Covers |
|---|---|
| lexicon | 249 words parse; every overtone is real; no duplicates; every overtone has ≥15 words |
| deck construction | exactly 26 distinct words; **no Demand is ever starved**; same seed ⇒ same run; different seeds ⇒ different runs |
| scoring | base value formula; +25 per matching overtone; **order changes the score**; chips never negative, mult never zero |
| Sigils | all 24 well formed and uniquely id'd; **600-play fuzz** across random hands and loadouts; the "fits your deck" map only names single-overtone Sigils |
| run shape | targets climb monotonically; the climb is ≥15× so an engine is mandatory; a run starts fully resourced; **the first shop is always affordable**; no Demand repeats |
| the Interpreter | the house appraiser always returns 1–4 valid overtones on junk input; appraisal is stable; known vocabulary is read from its shape; an interpreted word is scorable |
| presentation | every overtone has an icon and a valid colour; bright plates are detected so icons stay legible; hand names cover every resonance count |
| **Sigil arithmetic** (`sigils.test.js`) | all 24 Sigils pinned to their exact numbers — each scored with and without the Sigil, asserting the precise chip and mult delta. A guard test fails if a Sigil is added without one |
| **run end** (`runend.test.js`) | runs counted; personal best only beaten scores replace it; **the Memory unlock carries a Sigil the player owned and it actually fires in run 2**; the share block names the game, seed, score, the Demand that ended it, the best play and the interpreted word, and stays under 280 chars |

### E2E — `tests/e2e/` (25 × desktop + phone)

| Suite | Covers |
|---|---|
| first visit | title; help card with worked example and 19-icon legend; a 7-card hand; the rule stated mid-screen; scoring cards marked live |
| playing a hand | selection lifts, numbers and scores live; **order badges 1‑2‑3**; hand-name shape; the 4th card is refused with a reason; deselection clears; playing spends a play and refills; discarding replaces cards |
| the Reliquary | opens on clearing a round; states the exponential; offers three items; **"Leave with no Sigil"** when empty-handed; a bought Sigil equips and survives into the next round |
| the Interpreter | a typed word becomes a real card via the house appraiser, which names itself; a 1-letter word is rejected |
| layout | never scrolls sideways; **the controls stay in the viewport**; help reopens and closes on Escape |
| **the live Claude path** (`interpreter.spec.js`) | a fake sampler is injected before page load, proving the live branch works and names itself; **invented overtones are discarded rather than rendered**; a reply with no usable tags, a malformed reply, `not_granted` and `rate_limited` all degrade to the house appraiser with the run intact |

## Two real bugs the tests found

**1. An unwinnable round (engine).** Seed 151 dealt `THE GREENHOUSE` only 3 playable
cards. The cause: the deck's coverage floor was per *overtone*, but a Demand is
answered by *any* of its tags — and words carry 3.2 overtones on average, so three
PLANT words that all happened to be NATURE too satisfied the floor twice over while
answering the Demand once.

Fixed by guaranteeing coverage **per Demand**, scarcest Demand first. Worst case across
4,000 checks went from 3 playable cards to 5, with the difficulty curve unchanged.

An earlier hand-rolled simulation had missed this because it used a looser threshold
and the old algorithm.

**2. Controls below the fold (phone).** Playwright's Pixel 5 profile is 393×**727** —
117px shorter than the iPhone 14 I had checked by hand, where the layout fit *exactly*.
The Play button fell off-screen.

Fixed by pinning the control row to the bottom on phones rather than shaving more
pixels, since device heights vary far more than widths.

## Coverage

| Area | State |
|---|---|
| Scoring engine | covered, including a 600-play fuzz |
| Deck construction & seeding | covered |
| Sigil effects | covered — structural, 600-play fuzz, and exact arithmetic for all 24 |
| Shop economy | affordability and purchase flow covered; reroll and word-packs not |
| Interpreter | covered — fallback, live path, response validation and every refusal code |
| Run end | covered — bookkeeping, Memory unlock, share block |
| Coach / onboarding | not covered |
| API | not applicable — no backend |

## Next steps

- **Coach / onboarding is still untested.** The coach advances pick → play → score and then
  retires permanently; none of that is asserted.
- **The shop’s reroll and word-pack offers** are untested, as is running out of money.
- **A full losing run** — playing until the targets outrun the deck — is not simulated end to
  end; `runend.test.js` calls `endRun` directly rather than arriving there through play.
- **CI**: both tiers run headless with no server. `npm test` is fast enough for a pre-commit
  hook; `npm run test:e2e` suits a push hook or CI job.

## A note on the harness

Two bugs in the test code itself are worth recording, since both would recur:

- **Cross-realm comparison.** `api.LENSES` lives in the VM realm, so `.map()` returns an array
  carrying the VM’s `Array.prototype`. `assert.deepStrictEqual` checks prototype identity, so a
  cross-realm `[]` never equals a host `[]`. Compare lengths or contents, not array objects.
- **Reduced motion is forced** in the harness so the rAF counter tweens resolve synchronously
  and assertions do not race an animation.
