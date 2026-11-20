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
best score. The pause menu opens on the game's rules (**How to play**, from
`modes/howToPlay.js`, which also has the rules of every story mode). At the
end: your score, any money earned, **Continue** (the story takes the result)
and, if you lost, **Try again**. When a game pays, one rewarded ad doubles the
money and a second triples it. Best scores are kept on the device
(`systems/records.js`).

Controls are taps on the scene and a pad of chunky buttons at the bottom; on a
keyboard every button has a key (shown in its corner). Swipes work where they
are natural (Original or Fake, Rice Day). The moving games (the escape, Back
Gate) use an analog stick by default; Settings → Controls switches to arrow
buttons.

## Harder as the story goes on, easier with power-ups

Every mini-game reads how far you are into its story (0 in the first chapter, 1
in the last; `systems/progress.js`) and tunes itself with it
(`modes/arcade/tuning.js`): in early chapters targets are about 15% smaller
and customers more patient than written; by the last chapter targets are about
20% bigger, patience shorter and opponents sharper. The limits are fixed so a
careful player can always win (tests play the sorting games perfectly at the
hardest level). The start screen shows the difficulty as stars.

Free-roam fights, runs and chases step up the same way (`systems/heat.js`).

**Practice** (`systems/records.js`): every game, mini-game or story mode, also
counts how often you've played and won it. Each play and each win makes it a
little harder (up to +0.35 on the 0–1 scale), and the pay grows with the story
and with your wins: ×1 at the start up to ×2.2 (shown on the start screen as
"rewards ×1.4" and so on).

Each game also has its own power-ups, bought by watching a short ad on the
start screen, for that run only: more time, more patient customers, a tired
opponent, gentler oil, slower guards, a bigger paste bucket, a Whot card in
your hand, extra lives and hearts in the escape, and so on.

## Board and card games: the official rules

- **Draughts** is International draughts (FMJD), as Nigeria plays it: 10×10,
  20 men each, men capture backwards as well, flying kings, the biggest capture
  is compulsory, captured pieces come off at the end of the move, a man is
  crowned only if his move ends on the far row, and 25 moves each of kings only
  is a draw. `variant: "english"` plays English draughts (8×8).
- **Ayò** is Ayò Ọlọ́pọ́n: anticlockwise sowing, laps skip the starting cup,
  captures of 2 or 3 from the last cup backwards on their side, no capture that
  would take everything, compulsory feeding, more than 24 seeds wins.
- **Whot** uses the standard 54-card deck and specials (1 Hold On, 2 Pick Two,
  5 Pick Three, 8 Suspension, 14 General Market, 20 Whot), stars count double.

Each opponent has five levels (Beginner, Casual, Club/Village player, Strong,
Master): how far ahead they look and how often they just play something. The
level rises with the story and with practice, and is shown in the score bar.

## Escape (the platformer)

Area Boy's Task Force chases in *Purple Rain* and *Operation Clean Sweep* are a
side-scrolling platformer (`modes/platformer/`, mode `escape`): move freely,
jump and double jump, roll, strike and stomp; cars, awnings and roofs are
platforms; gutters kill; officers only see what's in front of them. Params:
`metres` (700), `difficulty` (1–3), `lives` (3), `to` (the destination).
Once an officer sees you he whistles, the officers within earshot join in, and
they all rush you faster than you can run: get up where they can't climb, roll
past, or fight. Creeping (a small push on the stick, or CREEP/Shift) or standing
still halves how far they see; a strike from behind on one who hasn't seen you
takes him down at once. Every officer down pays a bounty (₦250 in a fight, ₦300
for a stomp, ₦400 from behind, times the reward multiplier).

The runner and the Task Force are Eris Esra's character template (see *People*
below): run, walk, idle, jump (the landing frame on touchdown), the attack swing
for strikes and baton blows; the roll and double jump spin the tuck frame, and a
knock-down tips the body flat. The cars, trucks and buses come from *Retro
vehicle sprites 64x64*; Craftpix's *Free Pixel Art Prototype Character Sprites*
stay as the fallback while the template loads. Both are cropped into small
atlases by `scripts/build-platformer-atlas.py`.

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
| `draughts` | `name` ("Professor"), `skill` 0–1 → level 1–5 (or `aiLevel`), `variant` ("international" or "english") |
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
and `people.js` (the people, so Mama Ngozi, Garba, Bassey and you look like
yourselves).

### People

People in the mini-games, the platformer and the dialogue portraits are the
*Character Templates Pack* by Eris Esra (erisesra.itch.io/character-templates-pack;
free for games, credit given, not to be resold as an asset pack).
`scripts/build-eris-atlas.py` keeps its front and side views of idle, walk, run,
jump, attack and interact (`public/assets/eris/eris.png`, `eris.json`), and
`src/game/characters/eris.js` paints each frame for a character by where the pixel
sits on the body: skin on the head and hands, hair or their cap / beret / gele,
shirt, trousers, shoes. The dialogue portrait is the template's face with an
expression drawn on (neutral, happy, laughing, sad, angry, surprised, scared,
serious, nervous), picked from the line's mood or what the text says
(`expressionFor`). The *Pixelart Study Expression Sheet* that came with it has
eighteen identical blank faces, so the expressions are drawn in code instead.

The fights and dance battles keep their own pixel fighters: the template has no
hit, block, duck, knock-out or dance moves. The 3D streets keep their 3D people.

| Game | What it draws |
|---|---|
| Exact Change | the inside of a yellow danfo, the open door and road, naira notes (₦500 to ₦10, each its own colour), the passenger, a patience bar |
| Draughts | the tea table, a plywood 10×10 board (8×8 for the English variant), red and green bottle tops with crimped rims, crowns |
| Go-Slow | an isometric junction (roads, zebra crossings, corner blocks) with the game's own 3D vehicles as sprites: danfos, molue, taxis, cars, SUVs, lorries, kekes and okadas with riders, the Task Force convoy; they queue bumper to bumper, pull away and turn; the warden in the middle |
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

## Go-Slow's vehicles

`scripts/bake-goslow-sprites.mjs` photographs the game's own 3D vehicles
(`src/dev/bakeVehicles.jsx`, through the dev server) from an isometric camera at
eight headings into `public/assets/goslow/vehicles.png` (+ `goslowSprites.json`).
Re-run it after changing a vehicle: `npx vite --port 5179` then
`node scripts/bake-goslow-sprites.mjs`.

## Code

- `src/game/modes/arcade/ArcadeHost.jsx`: the host (intro, loop, pause, HUD, pad, result, retry).
- `src/game/modes/arcade/games/*.js`: one file per game: `create`, `step`, `input`, `draw`, `hud`, `buttons`, `result`, and the how-to-play text. The rules are plain functions with no drawing, so they are tested directly.
- `src/game/modes/arcade/index.js`: the list, and which story each belongs to.
- `src/game/modes/arcade/arcade.test.js`: rule tests (forced captures in draughts, Ayò captures and feeding, Whot specials, solvable sneak maps, …) and a random-input bot that plays every game to the end.
