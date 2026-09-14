# Card list — 249 words

Every word in the lexicon, with the overtones the scoring engine reads off it.
`value` is the card's base chips, which is derived from its length (`5 + 3 × letters`).

## How card faces work

Cards don't carry per-word artwork. Each shows the **icons for its own overtones** on a
plate tinted by its most distinctive one — so the picture and the scoring rule are views of
the same data, and a player learns that the flame means HEAT within one round. Overtones
that match the current Demand get a gold ring, which makes a playable card readable at a
glance.

Nineteen icons cover all 249 words — and every word a player invents with the
Interpreter, which is the case a fixed art library could never serve.

Icons are [Google Material Symbols](https://fonts.google.com/icons) (Rounded, filled). That
set was chosen partly on merit and partly because the artifact host's CSP only serves
stylesheets from `fonts.googleapis.com`, which rules out Font Awesome and Bootstrap Icons.

| Overtone | Icon |
|---|---|
| ANIMAL | `pets` |
| PLANT | `psychiatry` |
| NATURE | `landscape` |
| BODY | `ecg_heart` |
| FOOD | `restaurant` |
| TOOL | `handyman` |
| TECH | `memory` |
| MONEY | `paid` |
| HEAT | `local_fire_department` |
| MOTION | `speed` |
| DANGER | `warning` |
| LOUD | `volume_up` |
| COLD | `ac_unit` |
| WET | `water_drop` |
| DARK | `dark_mode` |
| BRIGHT | `light_mode` |
| MIND | `psychology` |
| TIME | `schedule` |
| ABSTRACT | `blur_on` |

## ANIMAL (31)

| Word | Overtones | Value |
|---|---|---|
| **WOLF** | ANIMAL DANGER MOTION | 17 |
| **BEAR** | ANIMAL DANGER | 17 |
| **SHARK** | ANIMAL DANGER WET MOTION | 20 |
| **EAGLE** | ANIMAL MOTION BRIGHT | 20 |
| **MOTH** | ANIMAL MOTION DARK | 17 |
| **HORNET** | ANIMAL DANGER LOUD MOTION | 23 |
| **SALMON** | ANIMAL WET FOOD MOTION | 23 |
| **OYSTER** | ANIMAL WET FOOD | 23 |
| **CROW** | ANIMAL DARK LOUD | 17 |
| **OWL** | ANIMAL DARK MIND | 14 |
| **SNAKE** | ANIMAL DANGER MOTION | 20 |
| **SPIDER** | ANIMAL DANGER DARK | 23 |
| **WHALE** | ANIMAL WET MOTION | 20 |
| **HORSE** | ANIMAL MOTION | 20 |
| **RAT** | ANIMAL DARK DANGER | 14 |
| **BEE** | ANIMAL FOOD LOUD MOTION | 14 |
| **ANT** | ANIMAL MOTION | 14 |
| **FALCON** | ANIMAL MOTION DANGER | 23 |
| **TIGER** | ANIMAL DANGER BRIGHT | 20 |
| **LOCUST** | ANIMAL DANGER MOTION LOUD | 23 |
| **LEECH** | ANIMAL WET DANGER BODY | 20 |
| **HOUND** | ANIMAL MOTION LOUD | 20 |
| **VULTURE** | ANIMAL DARK DANGER TIME | 26 |
| **JELLYFISH** | ANIMAL WET DANGER BRIGHT | 32 |
| **BEETLE** | ANIMAL DARK | 23 |
| **STALLION** | ANIMAL MOTION LOUD | 29 |
| **MAGGOT** | ANIMAL DARK BODY | 23 |
| **SWARM** | ANIMAL MOTION LOUD DANGER | 20 |
| **OX** | ANIMAL TOOL | 11 |
| **LAMB** | ANIMAL FOOD | 17 |
| **CORMORANT** | ANIMAL WET DARK | 32 |

## BODY (18)

| Word | Overtones | Value |
|---|---|---|
| **HEART** | BODY MOTION HEAT | 20 |
| **BONE** | BODY COLD TIME | 17 |
| **SPINE** | BODY TOOL | 20 |
| **TOOTH** | BODY DANGER TOOL | 20 |
| **BLOOD** | BODY WET HEAT DANGER | 20 |
| **LUNG** | BODY MOTION | 17 |
| **FIST** | BODY DANGER MOTION | 17 |
| **THUMB** | BODY TOOL | 20 |
| **SKULL** | BODY DARK DANGER TIME | 20 |
| **NERVE** | BODY MIND TECH | 20 |
| **PULSE** | BODY MOTION TIME | 20 |
| **SINEW** | BODY MOTION | 20 |
| **TONGUE** | BODY FOOD LOUD | 23 |
| **EYE** | BODY BRIGHT MIND | 14 |
| **SCAR** | BODY TIME DANGER | 17 |
| **BREATH** | BODY MOTION COLD | 23 |
| **MARROW** | BODY WET TIME | 23 |
| **KNUCKLE** | BODY DANGER TOOL | 26 |

## BRIGHT (8)

| Word | Overtones | Value |
|---|---|---|
| **BEACON** | BRIGHT TOOL DANGER | 23 |
| **PRISM** | BRIGHT TOOL MIND | 20 |
| **NEON** | BRIGHT TECH DARK | 17 |
| **COMET** | BRIGHT MOTION NATURE COLD | 20 |
| **AURORA** | BRIGHT COLD NATURE DARK | 23 |
| **FLARE** | BRIGHT HEAT DANGER MOTION | 20 |
| **HALO** | BRIGHT MIND ABSTRACT | 17 |
| **GLINT** | BRIGHT COLD | 20 |

## DANGER (10)

| Word | Overtones | Value |
|---|---|---|
| **SIEGE** | DANGER TIME LOUD | 20 |
| **AMBUSH** | DANGER MOTION DARK | 23 |
| **CANNON** | DANGER LOUD TOOL HEAT | 23 |
| **TRENCH** | DANGER DARK WET | 23 |
| **ARMADA** | DANGER MOTION WET MONEY | 23 |
| **MUTINY** | DANGER LOUD MIND | 23 |
| **SHRAPNEL** | DANGER MOTION TOOL | 29 |
| **GALLOWS** | DANGER DARK TIME TOOL | 26 |
| **VENOM** | DANGER WET ANIMAL BODY | 20 |
| **LANDMINE** | DANGER DARK TECH | 29 |

## DARK (7)

| Word | Overtones | Value |
|---|---|---|
| **SHADOW** | DARK ABSTRACT COLD | 23 |
| **CRYPT** | DARK COLD TIME DANGER | 20 |
| **INK** | DARK WET TOOL MIND | 14 |
| **SOOT** | DARK HEAT TIME | 17 |
| **ABYSS** | DARK WET DANGER ABSTRACT | 20 |
| **CINDER** | DARK HEAT TIME | 23 |
| **GLOOM** | DARK ABSTRACT COLD | 20 |

## FOOD (16)

| Word | Overtones | Value |
|---|---|---|
| **BREAD** | FOOD | 20 |
| **HONEY** | FOOD WET BRIGHT | 20 |
| **PEPPER** | FOOD HEAT | 23 |
| **SALT** | FOOD COLD TIME | 17 |
| **STEW** | FOOD HEAT WET | 17 |
| **VINEGAR** | FOOD WET DANGER | 26 |
| **SUGAR** | FOOD BRIGHT | 20 |
| **GARLIC** | FOOD PLANT DANGER | 23 |
| **PLUM** | FOOD PLANT WET | 17 |
| **CHILI** | FOOD PLANT HEAT DANGER | 20 |
| **BROTH** | FOOD WET HEAT | 20 |
| **CRUMB** | FOOD | 20 |
| **FEAST** | FOOD LOUD MONEY TIME | 20 |
| **YEAST** | FOOD MOTION TIME | 20 |
| **BUTTER** | FOOD HEAT | 23 |
| **BRINE** | FOOD WET COLD NATURE | 20 |

## HEAT (5)

| Word | Overtones | Value |
|---|---|---|
| **SMOKE** | HEAT DARK MOTION NATURE | 20 |
| **ASH** | HEAT DARK TIME NATURE | 14 |
| **SCALD** | HEAT DANGER BODY WET | 20 |
| **SIMMER** | HEAT WET TIME | 23 |
| **BLAZE** | HEAT BRIGHT DANGER LOUD | 20 |

## LOUD (8)

| Word | Overtones | Value |
|---|---|---|
| **SIREN** | LOUD DANGER BRIGHT TECH | 20 |
| **DRUM** | LOUD TOOL MOTION | 17 |
| **ROAR** | LOUD ANIMAL DANGER | 17 |
| **APPLAUSE** | LOUD MIND MOTION | 29 |
| **STAMPEDE** | LOUD ANIMAL MOTION DANGER | 29 |
| **CHOIR** | LOUD MIND BRIGHT | 20 |
| **FANFARE** | LOUD BRIGHT MONEY | 26 |
| **CLAMOUR** | LOUD MIND MOTION | 26 |

## MIND (18)

| Word | Overtones | Value |
|---|---|---|
| **DREAM** | MIND ABSTRACT DARK | 20 |
| **MEMORY** | MIND ABSTRACT TIME | 23 |
| **PANIC** | MIND ABSTRACT MOTION DANGER LOUD | 20 |
| **DOUBT** | MIND ABSTRACT DARK | 20 |
| **GENIUS** | MIND ABSTRACT BRIGHT | 23 |
| **GRUDGE** | MIND ABSTRACT TIME DANGER | 23 |
| **WHIM** | MIND ABSTRACT MOTION | 17 |
| **LOGIC** | MIND ABSTRACT COLD | 20 |
| **OMEN** | MIND ABSTRACT DARK TIME DANGER | 17 |
| **RIDDLE** | MIND ABSTRACT TIME | 23 |
| **NOSTALGIA** | MIND ABSTRACT TIME WET | 32 |
| **VERTIGO** | MIND ABSTRACT MOTION DANGER | 26 |
| **INSTINCT** | MIND ABSTRACT MOTION ANIMAL | 29 |
| **PARANOIA** | MIND ABSTRACT DARK DANGER | 29 |
| **EPIPHANY** | MIND ABSTRACT BRIGHT | 29 |
| **SPITE** | MIND ABSTRACT HEAT DANGER | 20 |
| **RESOLVE** | MIND ABSTRACT COLD | 26 |
| **HUNCH** | MIND ABSTRACT | 20 |

## MONEY (12)

| Word | Overtones | Value |
|---|---|---|
| **DEBT** | MONEY ABSTRACT DANGER TIME | 17 |
| **GOLD** | MONEY BRIGHT COLD | 17 |
| **RANSOM** | MONEY DANGER ABSTRACT | 23 |
| **MARKET** | MONEY LOUD MIND | 23 |
| **WAGE** | MONEY TIME ABSTRACT | 17 |
| **VAULT** | MONEY DARK COLD | 20 |
| **COIN** | MONEY BRIGHT | 17 |
| **INHERITANCE** | MONEY TIME ABSTRACT | 38 |
| **AUCTION** | MONEY LOUD MIND | 26 |
| **TARIFF** | MONEY ABSTRACT MIND | 23 |
| **BULLION** | MONEY BRIGHT COLD | 26 |
| **PENSION** | MONEY TIME ABSTRACT | 26 |

## MOTION (8)

| Word | Overtones | Value |
|---|---|---|
| **SPRINT** | MOTION BODY TIME | 23 |
| **ORBIT** | MOTION TIME NATURE | 20 |
| **PENDULUM** | MOTION TIME TOOL | 29 |
| **CAROUSEL** | MOTION BRIGHT LOUD | 29 |
| **MIGRATION** | MOTION ANIMAL TIME NATURE | 32 |
| **LURCH** | MOTION BODY DANGER | 20 |
| **SPIRAL** | MOTION ABSTRACT MIND | 23 |
| **RICOCHET** | MOTION LOUD DANGER | 29 |

## NATURE (34)

| Word | Overtones | Value |
|---|---|---|
| **VOLCANO** | NATURE HEAT DANGER LOUD | 26 |
| **GLACIER** | NATURE COLD WET MOTION | 26 |
| **AVALANCHE** | NATURE COLD MOTION DANGER LOUD | 32 |
| **THUNDER** | NATURE LOUD DANGER BRIGHT | 26 |
| **MONSOON** | NATURE WET MOTION LOUD | 26 |
| **DESERT** | NATURE HEAT TIME | 23 |
| **CANYON** | NATURE DARK TIME | 23 |
| **TIDE** | NATURE WET MOTION TIME | 17 |
| **EMBER** | NATURE HEAT BRIGHT DARK | 20 |
| **FROST** | NATURE COLD BRIGHT | 20 |
| **FOG** | NATURE COLD WET DARK | 14 |
| **GEYSER** | NATURE HEAT WET MOTION | 23 |
| **MAGMA** | NATURE HEAT DANGER BRIGHT | 20 |
| **TUNDRA** | NATURE COLD TIME | 23 |
| **SWAMP** | NATURE WET DARK DANGER | 20 |
| **SUMMIT** | NATURE COLD BRIGHT | 23 |
| **QUARRY** | NATURE TOOL DANGER | 23 |
| **DUST** | NATURE DARK TIME | 17 |
| **ECLIPSE** | NATURE DARK TIME BRIGHT | 26 |
| **BLIZZARD** | NATURE COLD MOTION LOUD DANGER | 29 |
| **ICICLE** | NATURE COLD DANGER BRIGHT | 23 |
| **PERMAFROST** | NATURE COLD TIME | 35 |
| **WILDFIRE** | NATURE HEAT DANGER MOTION BRIGHT | 29 |
| **SANDSTORM** | NATURE HEAT MOTION DANGER DARK | 32 |
| **CAVERN** | NATURE DARK COLD TIME | 23 |
| **DELTA** | NATURE WET MOTION | 20 |
| **RIVER** | NATURE WET MOTION | 20 |
| **MARSH** | NATURE WET DARK | 20 |
| **DELUGE** | NATURE WET MOTION DANGER LOUD | 23 |
| **DRIZZLE** | NATURE WET COLD | 26 |
| **STEAM** | NATURE WET HEAT MOTION | 20 |
| **CASCADE** | NATURE WET MOTION LOUD | 26 |
| **UNDERTOW** | NATURE WET MOTION DANGER DARK | 29 |
| **MONOLITH** | NATURE TIME DARK | 29 |

## PLANT (17)

| Word | Overtones | Value |
|---|---|---|
| **OAK** | PLANT NATURE TIME | 14 |
| **THORN** | PLANT DANGER NATURE | 20 |
| **MOSS** | PLANT NATURE WET | 17 |
| **FERN** | PLANT NATURE | 17 |
| **LILY** | PLANT BRIGHT NATURE | 17 |
| **CACTUS** | PLANT DANGER NATURE HEAT | 23 |
| **IVY** | PLANT NATURE MOTION | 14 |
| **ROOT** | PLANT NATURE DARK | 17 |
| **SEED** | PLANT NATURE TIME | 17 |
| **BLOSSOM** | PLANT BRIGHT NATURE TIME | 26 |
| **VINE** | PLANT NATURE MOTION | 17 |
| **REED** | PLANT NATURE WET | 17 |
| **BRAMBLE** | PLANT DANGER NATURE | 26 |
| **TIMBER** | PLANT TOOL NATURE LOUD | 23 |
| **POLLEN** | PLANT NATURE BRIGHT MOTION | 23 |
| **ORCHID** | PLANT BRIGHT NATURE | 23 |
| **NETTLE** | PLANT DANGER NATURE | 23 |

## TECH (17)

| Word | Overtones | Value |
|---|---|---|
| **ENGINE** | TECH MOTION HEAT LOUD | 23 |
| **CIRCUIT** | TECH BRIGHT MIND | 26 |
| **LASER** | TECH BRIGHT DANGER HEAT | 20 |
| **REACTOR** | TECH HEAT DANGER BRIGHT | 26 |
| **SATELLITE** | TECH MOTION COLD BRIGHT | 32 |
| **ROBOT** | TECH MOTION MIND | 20 |
| **CABLE** | TECH TOOL | 20 |
| **SERVER** | TECH HEAT MIND | 23 |
| **ALGORITHM** | TECH MIND ABSTRACT | 32 |
| **PIXEL** | TECH BRIGHT | 20 |
| **DRONE** | TECH MOTION LOUD DANGER | 20 |
| **BATTERY** | TECH HEAT MONEY | 26 |
| **TURBINE** | TECH MOTION LOUD | 26 |
| **MAGNET** | TECH MOTION MIND | 23 |
| **ANTENNA** | TECH MOTION BRIGHT | 26 |
| **FIRMWARE** | TECH MIND ABSTRACT | 29 |
| **BANDWIDTH** | TECH MOTION ABSTRACT MONEY | 32 |

## TIME (12)

| Word | Overtones | Value |
|---|---|---|
| **DECADE** | TIME ABSTRACT | 23 |
| **RUIN** | TIME DARK DANGER | 17 |
| **FOSSIL** | TIME COLD NATURE | 23 |
| **DAWN** | TIME BRIGHT | 17 |
| **MIDNIGHT** | TIME DARK COLD | 29 |
| **DEADLINE** | TIME ABSTRACT DANGER | 29 |
| **RUST** | TIME WET DARK DANGER | 17 |
| **ANTIQUE** | TIME MONEY | 26 |
| **SOLSTICE** | TIME BRIGHT NATURE | 29 |
| **JUBILEE** | TIME LOUD MONEY BRIGHT | 26 |
| **RELIC** | TIME MONEY DARK | 20 |
| **ERA** | TIME ABSTRACT | 14 |

## TOOL (28)

| Word | Overtones | Value |
|---|---|---|
| **HAMMER** | TOOL LOUD DANGER MOTION | 23 |
| **ANVIL** | TOOL COLD LOUD | 20 |
| **NEEDLE** | TOOL DANGER BODY | 23 |
| **BLADE** | TOOL DANGER BRIGHT COLD | 20 |
| **ROPE** | TOOL MOTION | 17 |
| **LEVER** | TOOL MOTION | 20 |
| **WRENCH** | TOOL MONEY | 23 |
| **CHISEL** | TOOL DANGER | 23 |
| **SAW** | TOOL DANGER LOUD MOTION | 14 |
| **LANTERN** | TOOL BRIGHT HEAT | 26 |
| **COMPASS** | TOOL MIND MOTION | 26 |
| **CLOCK** | TOOL TIME MOTION TECH | 20 |
| **KEY** | TOOL MONEY | 14 |
| **LADDER** | TOOL MOTION | 23 |
| **NET** | TOOL WET ANIMAL | 14 |
| **PLOW** | TOOL NATURE MOTION | 17 |
| **HINGE** | TOOL MOTION | 20 |
| **FURNACE** | TOOL HEAT DANGER LOUD | 26 |
| **BELLOWS** | TOOL HEAT MOTION LOUD | 26 |
| **SCAFFOLD** | TOOL MOTION DANGER | 29 |
| **CRUCIBLE** | TOOL HEAT DANGER TIME | 29 |
| **SHOVEL** | TOOL MOTION NATURE | 23 |
| **LOOM** | TOOL MOTION TIME | 17 |
| **KETTLE** | TOOL HEAT WET LOUD | 23 |
| **FORGE** | TOOL HEAT LOUD DANGER | 20 |
| **KILN** | TOOL HEAT TIME | 17 |
| **TORCH** | TOOL HEAT BRIGHT DANGER | 20 |
| **COALFACE** | TOOL DARK HEAT DANGER | 29 |

