# Test Automation Summary — NecroCards

**64 tests, 0 failures.** 28 engine tests + 36 E2E tests across two device profiles.

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

### Engine — `tests/logic.test.js` (28)

| Suite | Covers |
|---|---|
| lexicon | 249 words parse; every overtone is real; no duplicates; every overtone has ≥15 words |
| deck construction | exactly 26 distinct words; **no Demand is ever starved**; same seed ⇒ same run; different seeds ⇒ different runs |
| scoring | base value formula; +25 per matching overtone; **order changes the score**; chips never negative, mult never zero |
| Sigils | all 24 well formed and uniquely id'd; **600-play fuzz** across random hands and loadouts; the "fits your deck" map only names single-overtone Sigils |
| run shape | targets climb monotonically; the climb is ≥15× so an engine is mandatory; a run starts fully resourced; **the first shop is always affordable**; no Demand repeats |
| the Interpreter | the house appraiser always returns 1–4 valid overtones on junk input; appraisal is stable; known vocabulary is read from its shape; an interpreted word is scorable |
| presentation | every overtone has an icon and a valid colour; bright plates are detected so icons stay legible; hand names cover every resonance count |

### E2E — `tests/e2e/game.spec.js` (18 × desktop + phone)

| Suite | Covers |
|---|---|
| first visit | title; help card with worked example and 19-icon legend; a 7-card hand; the rule stated mid-screen; scoring cards marked live |
| playing a hand | selection lifts, numbers and scores live; **order badges 1‑2‑3**; hand-name shape; the 4th card is refused with a reason; deselection clears; playing spends a play and refills; discarding replaces cards |
| the Reliquary | opens on clearing a round; states the exponential; offers three items; **"Leave with no Sigil"** when empty-handed; a bought Sigil equips and survives into the next round |
| the Interpreter | a typed word becomes a real card via the house appraiser, which names itself; a 1-letter word is rejected |
| layout | never scrolls sideways; **the controls stay in the viewport**; help reopens and closes on Escape |

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
| Sigil effects | covered structurally + by fuzz; **no per-Sigil arithmetic assertions** beyond CARNIVORE |
| Shop economy | affordability and purchase flow covered; reroll and word-packs not |
| Interpreter | fallback path covered; **the live Claude path is not** (no `window.claude` over `file://`) |
| Run end | **not covered** — death screen, Memory unlock, share text |
| Coach / onboarding | not covered |
| API | not applicable — no backend |

## Next steps

- **Per-Sigil arithmetic tests.** The fuzz proves no Sigil crashes or produces nonsense;
  it does not prove `ANTONYM ENGINE` pays exactly 120 + ×2. That is 24 small tests.
- **Cover the run end**, which is where the day-1 hooks live: the Memory unlock and the
  share text are the retention mechanics and are currently untested.
- **Mock the live Interpreter** by injecting a fake `window.claude.use` before load, so
  the Claude path gets tested as well as the fallback.
- **CI**: both tiers run headless with no server. `npm test` is fast enough for a
  pre-commit hook; `npm run test:e2e` suits a push hook or CI job.
