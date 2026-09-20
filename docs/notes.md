# Notes

These were the back half of the README until it got too long to be a README.
Nothing here is required reading. It is the reasoning behind the parts of
Overtone that are not obvious from playing it: why the scoring works the way it
does, what the simulators found, and a few things I got wrong first.

The rules themselves are in [`../README.md`](../README.md) and the full design
writeup is in [`../DESIGN.md`](../DESIGN.md).

## Why it works this way

The first version of this game was a checklist. You picked three of seven cards against two
overtones the round had named, the board had already scored them before you committed, and two
people playing the same daily played it identically and had nothing to say to each other
afterwards. People told me the idea was good and playing it was boring. They were right, and the
problem was not the difficulty curve. It was the verb.

The fix was sitting in the data. Half of all word pairs in the lexicon share an overtone, 17% are
in opposition, and 11.9% are both at once, and none of that was read at the moment of play. So
the verb became JOIN. Words go down in an order and score against each other, and what you are
deciding is what these two words do when you put them next to one another.

Two rules follow from that and are not negotiable. Nothing in scoring reads spelling: not word
length, not first letter, not last letter, not in a Lens either. And no new content was written
to make the physics work. The 249 words, the 19 overtones and the opposition table all come out
of material that already existed.

## The five hands

Some patterns have names, the way a flush has a name in poker. Every hand your line makes pays,
not just the best one.

| Hand | What it is | Pays |
|---|---|---|
| THE MIRROR | four words whose pairs read the same backwards as forwards | 250 points, +2 mult |
| THE TWIST | two words that are alike and opposite at the same time | 200 points, +1 mult |
| THE BUILD | each pair with more in common than the pair before it | 150 points |
| THE CHORUS | two words with three things or more in common | 120 points |
| THE CLASH | two words that mean opposite things | 80 points |

The prices come from how often each one can actually be made, measured with
`node tools/join-sim.js` rather than picked by feel. `tests/figures.test.js` checks the ladder
never inverts.

## Overtones rest

An overtone that just paid goes quiet for two plays. On the card it turns grey and struck
through, and while it is resting it pays nothing, not for a match and not for an alike. Hover it
and the card says how many plays until it wakes.

Opposites never rest. That is the point of the rule: a line built on clashes keeps paying, and a
line built on hammering the same overtone runs dry. Resting is what stops one good pairing from
being the answer to every hand.

Only an overtone that actually paid goes to sleep. Playing one that is already resting used to
put its clock back to the top, which made the card's own countdown a promise the board could
break on the next hand.

## Playing it blind

There is a switch under the sound button called "play it blind". Turn it on and a word does not
show you its overtones until you have played it once, and what you have learned is kept between
runs. The board stops telling you which words answer the round and starts asking whether you
know.

It is off until somebody chooses it. It used to be tied to a difficulty, which meant anyone who
had played before met it without being told, which is a different game arriving unannounced.

## Keeping a line

Clear a round and the Bookseller offers you back a line you just played, for free. Keep it and it
pays 120 points and +1 multiplier every time you make that hand again. The hand, not those exact
words, so a kept THE CLASH pays on every clash you make for the rest of the run.

It is the only rule in a run the player wrote rather than bought. You can hold two of them, on a
shelf of their own under the Lens rail, where you can read one back mid round. The chip flashes
when it fires.

## Lenses

Lenses are what you spend money on, and a deck that is not multiplying stalls somewhere around
round 4. There are 30 of them and you can hold five.

Seven of them are flawed. They carry the biggest numbers in the game and every one takes
something back: a play, a discard, two cards of hand, half your income, or the target itself. The
first flawed Lens you are ever offered gets a card of its own explaining the trade, once.

Nine Lenses grow every round you hold them, sized against how common their overtone is. DANGER
sits on 34% of the lexicon and grows slowly. MONEY sits on 9% and grows fast. Flat payouts die,
because targets climb almost sixfold across a run, so a Lens paying a fixed number per word is
decisive in round 2 and pointless by round 6.

## Ordeals

Six rounds of "make a bigger number than last time" is a grind, not a difficulty curve. So some
rounds change a rule instead of raising the number, and the rule is on the plaque before you play
a card.

| | |
|---|---|
| THE DROUGHT | no discards |
| THE CLOCK | one play fewer |
| THE LEAN YEAR | a four card hand |
| THE FORFEIT | give a word up before you play |
| THE VICE | three words at a time, at most |
| THE FOG | words are worth nothing on their own, only matching overtones pay |
| THE TOLL | every word costs 90 points to play |
| THE MIRROR | a word scores nothing unless two of its overtones match |
| THE HALF-LIGHT | every hand starts at half a multiplier |

They are drawn from the seed, so a daily deals everyone the same ones and no two runs are shaped
alike. Each one breaks a different habit. The Bookseller names the next Ordeal before you spend,
which is the whole reason they sit on fixed rounds: an Ordeal you are told about is a purchase
decision, and one you discover is a bad beat.

Round 1 is never an Ordeal. The tutorial runs there, and meeting a rule breaking round while
still learning the rules would be indefensible. There is a test for it.

## The Reckoning

A run that gets its engine going stops being a game. Every hand clears, nothing is a decision,
and the run finishes itself. Players said so in those words.

Raising every target is the obvious fix and the wrong one, because it punishes the decks that
never got going and barely touches the ones that did. So from round 3 the round answers the deck
in front of it: past three times what it asks for, it drafts a second Ordeal on top of the one it
already has, and the Bookseller names it before you spend.

It never drafts a rule the deck has no answer to. An earlier version handed the disarming
Ordeals, the ones that take a mechanic away, to decks that had only seen two shops. That happened
280 times in 495 drafts. It is 0 in 367 now.

## Two difficulties

APPRENTICE is the easier game: lower targets, a fourth discard, one Ordeal instead of two, and no
Reckoning. Same words, same Lenses, same hands. An easier mode that removes the decision is not
an easier version of the same game, so nothing else moves.

SCHOLAR is the game as balanced. Two Ordeals, on rounds 4 and 6, and a curve only a multiplying
deck keeps up with.

A first run starts on APPRENTICE and cannot start anywhere else, and SCHOLAR is locked until one
run has ended, won or lost. Somebody opening this for the first time has no idea that most runs
are meant to end early, and finding that out by losing six in a row is not a lesson.

Three things keep the two honest. Difficulty is pinned when the run starts, so nobody switches at
round 5 to duck the wall. A score set on the gentler curve is stored under its own key and never
becomes the SCHOLAR best. And the share block names the mode.

## On a phone

Portrait is a real layout, not a squeezed desktop. The budget is written against 375x667, smaller
than any phone the game is likely to meet, and every band except the board and the hand gets a
fixed allowance so the two that carry the game get the slack.

The control row is pinned to the bottom rather than measured, because phone heights vary far more
than widths and pinning is the only version that cannot put PLAY below the fold on a device
nobody tested. All seven words are visible at once, in two rows, and two tests assert that no
card's bottom edge falls below the top of the control row at 393x727 and 375x667. A hand you have
to scroll is a decision you cannot make.

At portrait width the board stops repeating the hand back at you. The order badges are already on
the cards in hand, and hiding the stage preview returned 240px of a 667px screen. While a hand
resolves, the hand folds away and the board takes the room, which is what makes the scoring
readout fit.

Every card is the same rectangle at a given breakpoint, measured against the worst case the
lexicon can produce rather than guessed. Portrait caps the overtone row at two lines to afford
it, so `cardEl` sorts the scoring overtones to the front and what a fourth long one pushes out of
sight is never one that pays.

A Lens opens when you tap it. The rail clamps a rule to two lines and `title` is a hover tooltip,
which a touch screen does not have, so the rule somebody just paid $6 for was unreadable on a
phone.

## Sound and motion

The first version played one oscillator per event, which is why every sound was a beep. A hit
that reads as physical is three layers landing on the same frame: a short noise transient for the
attack, a pitched body that bends downward, and a sub sine under it for weight. The downward bend
is the part the ear hears as something landing rather than something sounding.

Chip hardware faked all three with two square channels and a noise channel, so that is the shape
of `SFX`: squares and saws, one noise buffer, hard envelopes with no tail, and a `tanh` soft
clipper on the bus so four layers at once saturate like a console instead of crackling. The
scoring sound climbs a whole tone ladder as a line runs, so a long hand builds instead of
repeating, and a multiplier event gets a saw growl under it so it is audibly not a point.

The theme is a 96kbps MP3 of about 2MB and it is never fetched before the player touches
something. No browser will play audio before a gesture anyway, so putting it on the critical path
would slow the first frame for nothing. It sits low and ducks further under a big hand, because
it is scenery. Browsers disagree about which events count as a gesture, so the start retries on
every interaction, in the capture phase, until the element is genuinely playing.

`audio/theme.mp3` is re-encoded from a 320kbps source kept out of the repo:

```bash
ffmpeg -i "bg music.mp3" -codec:a libmp3lame -b:a 96k -ar 44100 -ac 2 -map_metadata -1 audio/theme.mp3
```

Music, effects and vibration are three separate switches, because they fail differently. Music is
what people mute in public, effects are what they mute at work, and vibration is what eats a
battery. Vibration is Android only, since iOS Safari does not implement `navigator.vibrate` at
all, so every buzz on an iPhone is a silent no-op. Nothing in the game needs a buzz to be
understood, and the settings panel says so rather than shipping a dead switch quietly.

`prefers-reduced-motion` kills every animation, the flying points, the confetti and the screen
shake, and settles the counters synchronously.

### A bug worth knowing about if you touch the particles

Every throwaway particle used to be written as `el.animate(frames, opts)` with a slightly longer
`setTimeout` to remove the element. A Web Animation with no `fill` reverts its element to the
element's own static style the instant it finishes, so in the gap between the two, every particle
snapped back to its start position at full opacity and sat there. The sparks were the visible
case: up to half a second of a solid square parked dead centre of the board after every hand.

They all go through `animateOut()` now, which sets `fill: "forwards"` and removes the element on
`onfinish`, with the timeout kept only as a net. A test samples every frame of the scoring window
and fails if any particle's animation does not hold its last frame. It was checked against the
broken version, because a regression test that passes either way is worse than none.

## Card faces

Each card shows the icons for its own overtones, a flame for HEAT, a snowflake for COLD, paws for
ANIMAL, on a plate tinted by its most distinctive one. The picture and the scoring rule are two
views of the same data, so the mapping is learnable inside a round. Overtones the round wants get
a gold ring, and resting ones go grey and struck.

Nineteen icons cover all 249 words and every word a player invents with the Interpreter, which is
the case a fixed art library could not serve. They are
[Google Material Symbols](https://fonts.google.com/icons), which is also the only set the
artifact host's CSP will serve.

The full list is in [`art/CARDS.md`](../art/CARDS.md). Regenerate it with
`node tools/export-cards.js`.

The display face is [Russo One](https://fonts.google.com/specimen/Russo+One). To swap in your own
arcade TTF, `npm run font -- ARCADE_R.TTF` embeds it as a data URI, which is necessary because
the artifact host only serves fonts from `fonts.gstatic.com`. Check the licence first: embedding
a font in a published page redistributes it, and plenty of free for personal use faces do not
allow that.

## Balance

Nothing here is guessed. Two simulators run the real engine through the same harness the tests
use, with real deck construction, real draws, real scoring and a real shop.

```bash
npm run sim                      # deck coverage, and a player who buys nothing
npm run balance                  # win rate, where runs die, multiplier ceiling
npm run balance -- --curve       # what a round can actually produce
npm run balance -- --lenses      # per Lens power against the baseline
npm run balance -- --fair        # rounds no sequence of plays can reach
```

Over 500 runs with a player that searches for the best line and buys by value, APPRENTICE wins
51.2% and SCHOLAR 29.2%. Losing most of your runs is right for the genre and wrong for somebody
who has lost six in a row without ever seeing a Lens do anything, which is what the two curves
are for.

Three findings did most of the work over the life of the project.

The simulator flattered itself for a long time. It never rerolled the shop, never carried a Lens
into the next run, and its "realistic" player took the best cards by face value without trying
orderings. That last one is the worst, because the board scores every selection live, so clicking
cards and swapping them about is a search. A human is much closer to optimal than a greedy model,
since the game does the arithmetic for them.

Unconditional multipliers break everything. ENTROPY used to win every run on its own, back when
its rule read "each word shorter than the last", because that is not a condition, it is a sorting
instruction. GLUTTON paid a flat multiplier for playing three words, which everybody did anyway.
Both cost something now, and ENTROPY reads overtones rather than letters like everything else.

A slot cap is not a cost. With five slots and nothing but upside on the shelf, the right play was
always to buy the biggest number, which is not a decision. The flawed Lenses exist so that the
biggest numbers have a price attached.

`--fair` answers the question nobody wants to ask: can a round always be won? No, and that is
deliberate, but it is visible a round ahead. For every round it works out the best score the
whole deck could produce with perfect draws and perfect ordering, and the Bookseller says out
loud when the target is above it, along with the two ways out. One honest finding from that work:
selling rarely rescues a run. Modelling a player who sells whenever the warning fires made things
worse, because stripping the engine costs more than the drawback did. So a flawed Lens is a bet
you commit to rather than a trap you escape.

## Where AI is used

The 249 word lexicon and its 19 overtone ontology, about 800 semantic judgements, were written
with Claude and baked into a static table. That table is the rules engine. The game runs at 0ms,
offline and deterministic, which is what makes a shared daily seed possible at all.

At runtime, the Interpreter calls Claude from the published page, checks the reply against the
overtone whitelist, and falls back to a local appraiser when there is no runtime or the player
declines. Once a run it will take any word you type, your dog's name or your job title, appraise
it, and shuffle it into your deck as a real card.

The rule held throughout: no network call inside the one second loop.
