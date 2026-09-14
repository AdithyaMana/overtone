# Test Automation Summary — Overtone

**217 tests, 0 failures.** 83 engine tests + 134 E2E tests across two device profiles.

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

### Engine — `tests/*.test.js` (83)

| Suite | Covers |
|---|---|
| lexicon | 249 words parse; every overtone is real; no duplicates; every overtone has ≥15 words |
| deck construction | exactly 26 distinct words; **no Demand is ever starved**; same seed ⇒ same run; different seeds ⇒ different runs |
| scoring | base value formula; +25 per matching overtone; **order changes the score**; points never negative, mult never zero |
| Lenses | all 24 well formed and uniquely id'd; **600-play fuzz** across random hands and loadouts; the "fits your deck" map only names single-overtone Lenses |
| run shape | targets climb monotonically; the climb is ≥15× so an engine is mandatory; a run starts fully resourced; **the first shop is always affordable**; no Demand repeats |
| the Interpreter | the house appraiser always returns 1–4 valid overtones on junk input; appraisal is stable; known vocabulary is read from its shape; an interpreted word is scorable |
| the daily seed | the key is a sortable zero-padded date; one date gives every player the same deck and Demand order; a different date gives a different run; the year rolls over cleanly; a named seed is not flagged as the daily |
| presentation | every overtone has an icon and a valid colour; bright plates are detected so icons stay legible; hand names cover every resonance count |
| **Lens arithmetic** (`lenses.test.js`) | all 24 Lenses pinned to their exact numbers — each scored with and without the Lens, asserting the precise chip and mult delta. A guard test fails if a Lens is added without one |
| **the Bookseller** (`shop.test.js`) | always two Lenses and a word pack; never re-offers an owned Lens or duplicates one in a roll; buying charges correctly, equips, and cannot be repeated; a word pack adds exactly two *new* words; an empty purse buys nothing; slots cannot be overfilled; rerolling costs a dollar and never resurrects a sold offer; the round reward pays for efficiency |
| **run end** (`runend.test.js`) | runs counted; personal best only beaten scores replace it; **the Memory unlock carries a Lens the player owned and it actually fires in run 2**; the share block names the game, seed, score, the Demand that ended it, the best play and the interpreted word, and stays under 280 chars |

### E2E — `tests/e2e/` (70 × desktop + phone)

| Suite | Covers |
|---|---|
| first visit | title; help card with worked example and 19-icon legend; a 7-card hand; the rule stated mid-screen; scoring cards marked live |
| playing a hand | selection lifts, numbers and scores live; **order badges 1‑2‑3**; hand-name shape; the 4th card is refused with a reason; deselection clears; playing spends a play and refills; discarding replaces cards |
| the Bookseller | opens on clearing a round; states the exponential; offers three items; **"Leave with no Lens"** when empty-handed; a bought Lens equips and survives into the next round |
| the Interpreter | a typed word becomes a real card via the house appraiser, which names itself; a 1-letter word is rejected |
| layout | never scrolls sideways; **the controls stay in the viewport**; help reopens and closes on Escape |
| **the opening tutorial** | greets a first-timer instead of a rules modal; the spotlight lands on the real element; the overlay does not swallow clicks, so the player can tap the cards it points at; **three** steps wait for a real action; the "how many words" step states both reasons and is only cleared by taking a second word; the last step names the exception (ASCETIC); skipping leaves the lighter coach running while finishing retires it; it never ambushes a returning player; replayable from the help card; on a phone the card docks clear of the control it is pointing at |
| **first-run coaching** | the coach walks pick → play → read the result, marks the Play button at the right moment, walks *back* if the player deselects, and never returns on a later run |
| **the end of a run** | running out of plays ends the run through the real code path; the result screen carries the share block and the Memory unlock; the next run starts with the carried Lens equipped |
| **a full run** (`fullrun.spec.js`) | an entire run played start to finish — every round, every shop, real purchases, through to the result screen — asserting no console error or unhandled rejection anywhere along the way |
| **the portrait budget** | at 393×727 *and* 375×667: all seven words on screen with no card's bottom edge below the top of the pinned control row, all three buttons in the viewport, no sideways scroll, and the board not repeating the hand back at portrait width |
| **the scoring readout** | the board grows and the hand steps back while a hand resolves; the total is fully on screen and the stage is **not** `overflow:hidden`; the green clear-wash fires only on a hand that actually cleared |
| **order honesty** | the "order matters" line is absent with no Lenses, present with a position-reading Lens, and `orderMatters()` is false for one additive-mult Lens but true once a multiplicative one joins it |
| **sound, vibration and motion** | three independent switches that persist across a reload; the theme is **not fetched before the first gesture**; it is created looping and pointed at the right file on that gesture; muting actually stops it; the iPhone `navigator.vibrate` gap is stated in the panel |
| **throwaway motion** | every frame of a scoring window is sampled: no particle's animation may lack a holding `fill`, none may be visible after finishing, and none may outlive the hand. Verified against the broken build first — the first version of this test passed either way, which made it worthless |
| **reading a Lens** | tapping one in the rail opens it to the full rule, unclamped and uncut; only one opens at a time and tapping again closes it; every one of the five longest rules fits when open; and on a phone opening one does not grow the rail into a second row, which would push the hand behind the pinned controls |
| **the shape of a hand** | all seven cards lay out at one identical height (via `offsetHeight` — the fan means their *rects* differ by rotation angle); no tag that matches the round is ever clipped out of a card |
| **the counters** | a rolling counter lands on the exact value the engine computed, not on whatever it was showing when the animation stopped; the total counts from zero and locks on the real score |
| **the sound engine** | the bus is built, every named sound fires back to back without throwing (they are called from inside `play()`, so one that throws takes the hand with it), and turning effects off means no node is built rather than a silent one |
| **the live Claude path** (`interpreter.spec.js`) | a fake sampler is injected before page load, proving the live branch works and names itself; **invented overtones are discarded rather than rendered**; a reply with no usable tags, a malformed reply, `not_granted` and `rate_limited` all degrade to the house appraiser with the run intact |

## Seven real bugs the tests found

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

**3. The coach never advanced (UX).** `toggleSel` re-renders the hand, controls and
preview directly rather than calling `render()` — and `coachSet` only ran inside
`render()`. So selecting a card never moved the coach past step one: the "press PLAY"
prompt and the pulsing button were dead code that no first-time player would ever see.

Found the moment onboarding got its first test.

**4. The green "round cleared" wash fired on hands that had not cleared.** The check read
`G.roundScore + res.total >= G.target`, but `G.roundScore` had already had `res.total`
added to it four lines earlier. Every hand was counted twice, so the board washed green
whenever a player reached *half* the remaining target. A test that sets an unreachable
target and asserts the class is absent now pins it.

**5. The stage was clipping its own scoring popup.** `.stage` carried `overflow: hidden`
with a 76px floor on phones, while the floating score labels rise 54px above the card
that earned them and the total is 52px of type. The readout was being cut in half — which
is exactly what a player reported. The stage no longer clips (the clear-wash clips itself
instead), and a test asserts both that the computed `overflow` is not `hidden` and that
the total's rect is inside the viewport.

**6. Every particle was left parked on the board.** Sparks, confetti, the flying points and
the shockwave were each animated with `el.animate(frames, opts)` and removed by a separate,
longer `setTimeout`. A Web Animation with no `fill` reverts its element to the element's own
static style the moment it finishes, so in the gap between the two, every particle snapped
back to its start position at full opacity. The sparks ran 700–1220ms and were removed at
1300ms: up to half a second of a solid square sitting dead centre of the board after every
hand. Reported by a player before any test caught it, which is the part worth noting.

**7. The tutorial's welcome step never dimmed the board.** With no element to spotlight,
the cutout was parked off-screen at `top: -9999px` on the theory that its `9999px`
box-shadow spread would still cover the page. It does not: a spread of 9999 from a
zero-height box at y = −9999 reaches exactly y = 0, so the shadow stopped at the top edge
of the viewport and the welcome card floated over a fully lit board. A zero-size hole at
50%/50% paints nothing and dims everything.

## Coverage

| Area | State |
|---|---|
| Scoring engine | covered, including a 600-play fuzz |
| Deck construction & seeding | covered |
| Lens effects | covered — structural, 600-play fuzz, and exact arithmetic for all 24 |
| Shop economy | covered — offers, buying, word packs, rerolling, slot limits, rewards |
| Interpreter | covered — fallback, live path, response validation and every refusal code |
| Run end | covered — bookkeeping, Memory unlock, share block |
| Coach / onboarding | covered |
| API | not applicable — no backend |

## Next steps

- **No pixel-level visual regression testing.** Every layout bug in this project was caught by a
  *geometry* assertion — viewport containment, hand-row spread, badge/icon overlap, mid-word
  wrapping — and those are stable across machines. Screenshot baselines are not: they vary with
  OS, GPU and font rendering, so committing them from one machine hands the next person failing
  tests on a correct build. If this ever needs pixel diffing it belongs in one fixed CI
  container, not on a laptop.
- **No load or performance budget.** The page is ~127KB with no runtime *code* dependencies. The
  one asset that is not inlined is `audio/theme.mp3` (~2MB), and it is deliberately off the
  critical path — a test asserts it is never requested before the first gesture. That is the
  budget worth guarding; a real byte budget becomes worth writing the day a font gets embedded.
- **Haptics are asserted only as far as they can be.** `navigator.vibrate` has no observable
  effect to assert against in a headless browser, and does not exist at all on iOS. The tests
  cover the switch and its persistence, not the buzz.
- **CI**: both tiers run headless with no server. `npm test` is fast enough for a pre-commit
  hook; `npm run test:e2e` suits a push hook or CI job.

## A note on the harness

Three bugs in the test code itself are worth recording, since all three would recur:

- **Cross-realm comparison.** `api.LENSES` lives in the VM realm, so `.map()` returns an array
  carrying the VM’s `Array.prototype`. `assert.deepStrictEqual` checks prototype identity, so a
  cross-realm `[]` never equals a host `[]`. Compare lengths or contents, not array objects.
- **A page timer can hang `node --test`.** The tutorial runs a `setInterval`, which held Node’s event loop open forever once the harness started loading a first-time visit — the engine suite went from 0.3s to never finishing. The harness now arrives as a player who has already seen the tutorial; the tutorial itself is covered in a browser, which has an event loop anyway.
- **Reduced motion is forced** in the harness so the rAF counter tweens resolve synchronously
  and assertions do not race an animation.
- **A `display:none` element measures 0×0, so a geometry test on one passes without testing
  anything.** Portrait hides the stage's preview cards (the hand already shows the same words,
  selected and numbered), which silently turned three overlap and wrapping assertions vacuous on
  the phone profile. Those tests now re-show the cards with `addStyleTag` before measuring.
- **Do not race the deal animation.** Cards deal in from 44px below over ~700ms, so a raw
  `getBoundingClientRect` immediately after load reports a hand that is transiently lower than it
  will settle. The portrait-budget assertions use `expect.poll`.
- **Never measure a rotated element, for anything.** This is the second time it has cost a
  test. Hand cards are fanned, and a rotated element's *axis-aligned* rect is inflated by an
  amount that depends on its angle — so a uniformity check on `getBoundingClientRect().height`
  reported four different heights for seven cards laid out at exactly 196px each. Use
  `offsetHeight`, which is layout rather than paint.
- **Never measure a rotated element for overlap.** Hand cards are fanned and deal in with a
  rotation, and a rotated element has an inflated *axis-aligned* bounding rect — the first
  overlap test reported four collisions that were not visually there. Geometry assertions run
  against the stage preview cards, which carry `transform: none` and render identical markup.
