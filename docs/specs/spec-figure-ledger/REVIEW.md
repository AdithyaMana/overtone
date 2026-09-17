# Review — the figure ledger

Content class: code (uncommitted working-tree diff).
Lenses: **adversarial**, **verification-gap**. Both run inline rather than in
subagents — the parallel runs died on a session rate limit, and sequential
in-thread is the skill's stated fallback.

Changeset (A) is the figure ledger. Changeset (B) — volume sliders, removal of
the quick-scoring pref, the figure-beat timing change — was reviewed for
breakage only, per instruction; nothing broken was found in it.

---

## Adversarial

### Fixed during the review

**1. A finished run kept advertising its levels** — `index.html`, `showFigures()`
- *Trigger:* `G` outlives the run that made it. `endRun()` sets `G.over = true` and nothing clears `G`, so opening **The figures** from the title after finishing a run quoted the dead run's ladder.
- *Consequence:* the panel said `THE COLUMN +270 · LV4` to a player whose next run starts COLUMN at `+150` and level 0. The one panel whose entire job is to say what a shape is worth was quoting a run that had ended.
- *Fix:* levels are shown only while `G && !G.over`; otherwise the shipped table. Pinned by `a finished run stops advertising its levels`.

**2. The pip row was mute** — `index.html`, `renderFigBar()`
- *Trigger:* the row was `<i>` elements plus a `title=` attribute. A screen reader read the shape name and then nothing.
- *Consequence:* CAP-4 ("the player can see what each shape is worth to them") held for sighted players only, in a file that is otherwise careful about this — it has a `say()` for the stage and `aria-hidden` on every decorative glyph.
- *Fix:* `role="img"` with a full `aria-label` on each shape, `aria-hidden` on the pips and the abbreviated name.

**3. `--noledger` flattened scoring but not banking** — `tools/balance.js`
- *Trigger:* the flag stubbed `figLevel` only, so `noteFigure` kept running and the ladder-reach report printed real levels beside flattened scores.
- *Consequence:* the control run did not describe the pre-ledger game, so any A/B drawn from it was invalid.
- *Fix:* the flag now stubs `noteFigure` too, and `playRound` calls it through `ctx` so the stub reaches it.

**4. The simulator could stop banking the ledger in total silence** — `tools/balance.js`, `playRound`
- *Trigger:* nothing anywhere would catch `noteFigure(best.cards)` being deleted. Every number would still print, and every one would describe the pre-ledger game.
- *Consequence:* this is the failure that quietly invalidates every balance conclusion in this spec, including the number the acceptance bound is read off.
- *Fix:* the report now ends with how far the ladder actually got. Verified as a live alarm: **25/25 runs level something with the ledger, 0/25 with `--noledger`.**

### Cleared in a second pass

_7 and 8 below. 5, 6 and 9 remain open and are listed under them._

**5. `resolve()` rounds the figure's multiplier, and the ladder feeds it bigger inputs** — `index.html`, `resolve()`
- `Math.round(fig.mult * answering / cards.length)` is pre-existing, but a levelled figure hands it a larger `fig.mult`. At mult 6 with 2 of 3 answering it is exactly 4; at mult 4 with 1 of 3 it is 1.33 → 1. The rounding loss is unchanged in kind and slightly larger in size. Not a regression; worth knowing it exists.

**6. THE FOG does not fog the figure** — `index.html`, `ORDEALS`
- THE FOG says *"words are worth nothing on their own. Only matching tags pay"* and acts per-card, so the figure's chips pay in full underneath it. True before the ledger; the ladder makes the hole bigger, since a maxed figure is now worth up to 180% of what it was. A design question rather than a defect.

**7. `figPay(id, 2)` was a landmine for COLUMN and STAIR** — FIXED
- Neither has a `[2]` entry, so `FIG_PAY[id][bind] || FIG_PAY[id][2]` yielded `undefined` and `base.chips` threw. Unreachable today, but an unreachable throw inside `resolve()` is one refactor from being reachable and would take the hand with it. The fallback chain now ends somewhere every figure has.

**8. `.figbar` has `overflow: hidden`** — PINNED RATHER THAN CHANGED
- A silent clip, not an observed break; it measures clean at every width. Changing layout CSS blind is exactly how five layout tests broke earlier in this change, so it got a test (`the ledger row never clips itself`, seven widths including 1100px where the names are still drawn) instead of a speculative fix.

### Still open, deliberately

**5. `resolve()` rounds the figure's multiplier** (above). Pre-existing behaviour;
the ladder feeds it slightly larger inputs. Not a regression, and changing it
would alter scoring the spec did not ask to touch.

**6. THE FOG does not fog the figure** (above). **This one is a design decision,
not a defect, and it is not mine to make.** The current behaviour is now pinned
by `a levelled figure still obeys the Ordeals`, so whichever way it is decided,
the test says what the game does rather than what anyone assumed.

**9. `api.figLevel` and the context's `figLevel` diverge after a stub.**
The harness captures function objects at export time, so `ctx.figLevel = …`
reaches the unqualified call inside `figPay` but not `api.figLevel`. Documented
in `balance.js` rather than fixed — it is exactly what makes the ladder alarm
honest under `--noledger`.

### Checked and unfounded

**10. Preview vs payment divergence.** `figuresIn` is documented side-effect-free and now reads `G.figSeen`. Traced: the ledger advances only in `play()`, after `resolve()` has returned. `renderPreview` and the paying call therefore read identical state. No path found where the board shows one number and the game pays another.

**11. `noteFigure` double-call or missed call.** Traced every commit path. `play()` returns early on `G.animating` and sets it before `resolve()`; no other path commits a hand; the Interpreter adds a word rather than playing one; `winRound()` does not play. Called exactly once per committed hand, with the same `cards` array `resolve()` scored.

**12. `figCount`'s guard.** `(G && G.figSeen && G.figSeen[id]) || 0` is complete for every reachable caller, including `showFigures` from the title before any run is dealt.

---

## Verification gaps

### Closed

**1. Regression gap — nothing checked that levelling changes a played hand's score.**
Every arithmetic test drove `figPay()` directly, so a regression where `resolve()`
went back to reading the flat `FIG_PAY` would have passed all of them.
Closed by `levelling changes what a played hand actually scores`, which plays the
same three words at count 0 and count 10 and compares real totals (+120 chips).

**2. Regression gap — the reorder nudge was never exercised with a ledger state.**
The companion's acceptance checks name it explicitly. `figureByReorder` had no
ledger coverage at all. Closed by `the reorder nudge ranks by the ledger too`,
which asserts the nudge may only ever point at a figure worth strictly more.

**3. Broken-verification gap — CAP-4's board assertion passed on invisible text.**
`toContainText` reads `textContent` and passes on `display: none`. The figure
names *are* hidden below 1080px, so on the phone project that assertion was green
while the thing it claimed to check was invisible. Now asserts names visible
above 1080px, hidden below, and pips visible at both.

**4. Regression gap — the simulator's banking was unverified.** See adversarial #4.

**5. Gap — CAP-3's even-spread promise was never asserted.**
Closed by `spreading your plays thin keeps every shape low`: five shapes at six
plays each (30 of a 32-play run) tops nothing out, while ten of one shape does.

**6. Gap — nothing covered the ledger under a payout-changing Ordeal.** CLOSED.
THE FOG, THE TOLL, THE MIRROR and THE HALF-LIGHT all alter scoring and none was
exercised against a levelled figure. Closed by `a levelled figure still obeys
the Ordeals`, which asserts levelling is worth something under both FOG and
HALF-LIGHT and that neither Ordeal becomes free money. It pins THE FOG's
current treatment of the figure as behaviour, without endorsing it.

---

## Closed after the review

The balance acceptance bound is **met**: 1200 runs at **24.9%** (95% CI 22.5–27.3)
against a [15%, 30%] bound and a 23.5% baseline. The ladder-reach alarm added under
adversarial #4 reports 1200 of 1200 runs levelling something, which is what makes
that number trustworthy rather than merely printed.

One correction to the reasoning used while it was open: a 400-seed subset put the
discovery bonus at +1.2 points and I extrapolated ~26.2%. On the full 1200 seeds it
is −0.1. The paired-comparison argument was sound in form — pairing does remove seed
variance between two configurations — and wrong in fact, because it does not make
400 seeds representative of 1200.

<details><summary>What this section said while the run was still going</summary>

## Open at time of writing

The 1200-run balance confirmation had not finished. The 400-run reading for the
shipped ladder is **25.3%** against a 23.5% baseline, interval 21.0–29.6%, which
clears the spec's 30% bound but not by much. The acceptance bound is **not** met
until the larger sample lands.

</details>
