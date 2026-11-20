# Mini-games: three for every story

Besides the 3D modes (fee runs, chases, the runner, the danfo, the conductor)
and the 2D fights and dance battles, every story has three arcade mini-games
of its own. They play full screen over the frozen street, like the fights.

| Story | Game | Mode id | Where you meet it | Free roam |
|---|---|---|---|---|
| Area Boy | **Exact Change**: give passengers the right change | `change` | Ch. *Bíọ́dún's Danfo* (if you got the bus back) | CONDUCT, Front Stop |
| Area Boy | **Draughts with Professor**: bottle-top draughts | `draughts` | Ch. *The Chair at the Back Side* (Professor, or Garba) | DRAUGHTS, Garba's tea |
| Area Boy | **Go-Slow**: be the traffic light | `traffic` | Ch. *Mama Comes to Lagos* (the ambulance) | GO-SLOW, Motor Park |
| Grass to Grace | **Ayò**: the seed game at the palm-wine shade | `ayo` | Ch. *Papa Ngwo's Burial* | AYÒ, palm-wine shade (village) |
| Grass to Grace | **Palm Climb**: tap the palm, mind the ants | `palmClimb` | Ch. *Papa Ngwo's Burial* | TAP PALM, the farm (village) |
| Grass to Grace | **Original or Fake?**: Mama Ngozi's test | `fakeParts` | Ch. *First Pay* | ORIGINAL?, the market (Lagos) |
| Campus | **Akara Fry**: drop, flip, lift | `akara` | Ch. *Send-Forth* | FRY AKARA, cafeteria |
| Campus | **Back Gate After Curfew**: stealth past the torches | `sneak` | Ch. *Campaign Season* (warning Tamara) | SNEAK OUT, hostel |
| Campus | **Hostel Cup Penalties** | `penalty` | Ch. *SUG Elections* (the cup final) | PENALTIES, sports field |
| The Honourable | **Poster War**: hold the wall overnight | `posters` | Ch. *The Rumour* | POSTERS, Front Stop |
| The Honourable | **Count the Votes**: sort every ballot | `ballots` | Ch. *Collation Night* | COUNT, South Street |
| The Honourable | **Rice Day**: one bag per ward family | `riceQueue` | Ch. *Stomach Infrastructure* (if you share rice) | RICE DAY, market |
| Mama Sugar | **Pepper Soup Kitchen**: Mama's order of spices | `pepperSoup` | Ch. *Kemi's Mother* | KITCHEN, Sugar Palace |
| Mama Sugar | **Bar Rush**: four stools, one Mama | `barRush` | Ch. *Night Shift* | BAR RUSH, Sugar Palace |
| Mama Sugar | **Whot!** with Commander Bassey | `whot` | Ch. *The Morning After* (play him for the envelope) | WHOT, Sugar Palace |

Several activities can share a spot (Sugar Palace has three): the first is on
the action button, the others appear as small buttons above it.

## Playing

Every game shows how to play the first time; after that the intro shows your
best score. The game pauses with the pause menu. At the end: your score, any
money earned, **Continue** (the story takes the result) and, if you lost,
**Try again**. Best scores are kept on the device (`systems/records.js`).

Controls are taps on the scene and a pad of chunky buttons at the bottom; on a
keyboard every button has a key (shown in its corner). Swipes work where they
are natural (Original or Fake, Rice Day).

## Harder as the story goes on, easier with power-ups

Every mini-game reads how far you are into its story (0 in the first chapter, 1
in the last; `systems/progress.js`) and tunes itself with it
(`modes/arcade/tuning.js`): in early chapters targets are about 15% smaller
and customers more patient than written; by the last chapter targets are about
20% bigger, patience shorter and opponents sharper. The limits are fixed so a
careful player can always win (tests play the sorting games perfectly at the
hardest level). The start screen shows the difficulty as stars.

Free-roam fights, runs and chases step up the same way (`systems/heat.js`).

Each game also has its own power-ups, bought by watching a short ad on the
start screen, for that run only: more time, more patient customers, a tired
opponent, gentler oil, slower guards, a bigger paste bucket, a Whot card in
your hand, extra lives and hearts in the escape, and so on.

## Escape (the platformer)

Area Boy's Task Force chases in *Purple Rain* and *Operation Clean Sweep* are a
side-scrolling platformer (`modes/platformer/`, mode `escape`): move freely,
jump and double jump, roll, strike and stomp; cars, awnings and roofs are
platforms; gutters kill; officers only see what's in front of them. Params:
`metres` (700), `difficulty` (1–3), `lives` (3), `to` (the destination).
Its sprites come from two packs, cropped into small atlases by
`scripts/build-platformer-atlas.py`: Craftpix's *Free Pixel Art Prototype
Character Sprites* (licence: craftpix.net/file-licenses) and *Retro vehicle
sprites 64x64*.

## Dance battles (rhythm)

Every dance battle (`modes/dance/`, mode `dance`) is a 4-lane rhythm game:
arrows fall down four lanes and you tap each lane as its arrow reaches the
line (PERFECT / GOOD / MISS, with combos). The rival dances a phrase first,
then you; phrases get busier each round and later in the story. Each arrow
is a dance move your dancer does on the stage: ← Shaku, ↓ Gwara, ↑ Zanku,
→ Azonto. Params: `rival`, `name`, `rounds` (3), `length` (8 beats), `bpm`
(100), `skill` (0.6), `prize`. Power-ups: a slower beat, wider timing.

## In the story

Each game is a mode like any other:

```json
{ "type": "startMode", "mode": "whot",
  "params": { "name": "Commander Bassey", "skill": 0.6 },
  "results": { "won": { "changeStat": { "policeHeat": -10 } }, "lost": { "changeStat": { "money": -40000 } } } }
```

All of them end `won` or `lost`, and may pay `moneyChange`. Parameters:

| Mode | Params |
|---|---|
| `change` | `target` (8), `seconds` (60), `tip` (₦50) |
| `draughts` | `name` ("Professor"), `skill` 0–1 (0.7) |
| `traffic` | `target` vehicles (30), `seconds` (60) |
| `ayo` | `name` ("Papa Ngwo"), `skill` (0.6) |
| `palmClimb` | `height` rings (32), `seconds` (45) |
| `fakeParts` | `count` (20), `need` (15) |
| `akara` | `target` orders (5), `seconds` (70) |
| `sneak` | `lives` (3) |
| `penalty` | `name` (the other hostel), `skill` (0.5) |
| `posters` | `seconds` (45), `need` spots of 9 (5) |
| `ballots` | `count` (30), `need` accuracy (0.85) |
| `riceQueue` | `bags` (40), `need` families (18), `seconds` (75) |
| `pepperSoup` | `target` bowls (6), `seconds` (75) |
| `barRush` | `target` ₦ (20000), `seconds` (60) |
| `whot` | `name` ("Commander Bassey"), `skill` (0.6), `cards` (5) |

## The art (game assets)

No image files: every game draws its own pixel art in code, at a whole-number
pixel size picked from the screen, so it stays sharp on any phone and costs
nothing to download. Shared pieces live in `src/game/modes/arcade/px.js`
(panels, outlined labels, pixel discs, character-map sprites, a town backdrop)
and `people.js` (the same pixel people as the fights and dance battles, so
Mama Ngozi, Garba, Bassey and you look like yourselves).

| Game | What it draws |
|---|---|
| Exact Change | the inside of a yellow danfo, the open door and road, naira notes (₦500 to ₦10, each its own colour), the passenger, a patience bar |
| Draughts | the tea table, a plywood 8×8 board, red and green bottle tops with crimped rims, crowns |
| Go-Slow | a junction from above: roads, kerbs, lane marks, cars, danfos, okadas and trailers in queues, the warden, the convoy siren |
| Ayò | the palm-wine shade (thatch, red earth), a carved board with twelve cups and two stores, seeds |
| Palm Climb | sky, distant palms, a ringed trunk that scrolls, soldier ants, wasp nests, fronds and the calabash, the rope loop, a height gauge |
| Original or Fake? | the stall's shelves, parts boxes (brand, part, origin, hologram seal, price tag), Mama Ngozi's brand chart |
| Akara Fry | dawn, firewood, a black pan of oil, akara in six shades from raw to burnt, bubbles, smoke, the order board |
| Back Gate | a night campus map: buildings with lit windows, paths, hedges, the gate, guards and their torch beams |
| Penalties | the pitch, the hostel crowd, goal and net, keeper and kicker, the ball, the power bar, the score sheet |
| Poster War | a night wall, Teacher and Nephew posters, the boys with paste buckets, your paste bucket |
| Count the Votes | the counting table, ballot papers with three candidate boxes and symbols, thumbprints, smudges, rubber-banded bundles, the four piles |
| Rice Day | the canopy, stacks of rice bags, the queue, ward cards, inked thumbs, the crowd's mood bar |
| Pepper Soup | kitchen tiles, the ticket rail, the pot on a gas ring, ingredients, steam |
| Bar Rush | fairy lights, the bottle shelf, stools, customers with their orders and patience, the counter |
| Whot! | the green cloth, the full 54-card Whot deck (circles, triangles, crosses, squares, stars, Whot 20), the market pile |

Sound effects come from the game's existing synthesised set (`audio.js`).

## Code

- `src/game/modes/arcade/ArcadeHost.jsx`: the host (intro, loop, pause, HUD, pad, result, retry).
- `src/game/modes/arcade/games/*.js`: one file per game: `create`, `step`, `input`, `draw`, `hud`, `buttons`, `result`, and the how-to-play text. The rules are plain functions with no drawing, so they are tested directly.
- `src/game/modes/arcade/index.js`: the list, and which story each belongs to.
- `src/game/modes/arcade/arcade.test.js`: rule tests (forced captures in draughts, Ayò captures and feeding, Whot specials, solvable sneak maps, …) and a random-input bot that plays every game to the end.
