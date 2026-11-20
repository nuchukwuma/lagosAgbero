# NaijaVice

Three story-driven 3D browser games set in Nigeria. It's built with Vite,
React, three.js (@react-three/fiber and drei) and Zustand. It is satire:
every person, party, cult, brand and drink is made up.

It's a branching narrative game: choices are remembered, characters bring
them up later, and they decide which endings you can reach. Five stories
share the engine:

- **Area Boy:** a JJC with ₦2,300 becomes the agbero of Iyana-Wahala. 15
  chapters, two Act 3 paths (cult or independent), 12 endings (2 secret).
- **Grass to Grace:** Emeka will do anything to leave the village for Lagos
  money, including joining a fellowship that wants more than his soul.
  15 chapters, 9 endings. Inspired by the premise of Nigerian classics about
  money rituals; the characters and plot are original.
- **Fake It Till You Graduate:** Somto, a pap seller's son on a scholarship,
  pretends to be rich at Royal Crest University. Cults, sorting lecturers,
  loan apps, yahoo boys and a girlfriend whose mother is running for office.
  15 chapters, 12 endings. Inspired by the premise of campus coming-of-age
  dramas; the characters and plot are original.
- **The Honourable:** Kunle, a schoolteacher, runs for councillor of
  Iyana-Wahala with a godfather's money, a wife who knows him too well, and a
  journalist holding a folder. Rallies, a debate, a rigging offer and
  election day. 15 chapters, 10 endings.
- **Mama Sugar:** Ebiere runs Sugar Palace, a tired South Street hotel, and is
  three months behind on rent. Settlement money, a rival madam, a daughter who
  comes visiting, and a man who wants to send five girls to Italy. Kept
  non-explicit: the story is about the business and the line she will or
  won't cross. 15 chapters, 9 endings.

Every story also has side quests with its key people (a quest-giver stands in
the street during free roam); doing them raises your bond and changes later
scenes.

After every chapter you see the choices you made, and a story map shows the
paths you didn't take. The title screen has an **Endings** page: the endings
you've reached, and a hint for each one you haven't.

Between story beats there's the street: fee runs, chases, fist fights (a 2D
fighting game on a painted Lagos street, see below; land hits close together
for a combo), escape runs (dodge cartons, banners, danfos driving straight at
you and Task Force officers running at you; stumble and the rest of them are
right at your back),
danfo driving, side quests, and small finds lying around for anyone who
wanders. Pausing (the menu, map or status) stops everything: activity
timers, the runner, fights and timed choices wait for you.

## Play on a phone or a computer

The game is one web page that adapts to the device:

- **Phone / tablet:** joystick on the left, action buttons on the right,
  portrait or landscape. "Add to Home Screen" installs it full screen and
  lets it open offline after the first visit (PWA + service worker).
- **Computer:** WASD / arrows to move, Shift to run, E or Enter to talk or
  act, mouse for menus.
- **Camera (walking around):** the camera button (bottom right, or V) steps
  through the views: Auto (the game picks, and dodges buildings by itself),
  from the other side, the left, the right, the street, above. Drag the
  screen (finger or mouse) to swing it round freely, pinch or scroll to zoom,
  Q / R to turn. If something blocks the view, the camera moves in closer,
  then up. The stick always walks "up the screen", whichever way it faces.
- **Fights:** a 2D fighting game, side-on: guard stance, jab, high kick, the
  spinning "Lagos Roundabout", block, backstep dodge, stagger, knock-out.
- **Fee runs:** stand in front of a vehicle that's trying to leave and it
  can't: a driver who refused gives in and pays, one that got tired of
  waiting stops so you can collect.
- **Map:** a small map in the corner while you're on the street (walking,
  talking, fee runs, chases, fights) shows where you are,
  where the story wants you (and how far, which way), any place you
  marked, fee vehicles still waiting to pay and the vehicle you're chasing; tap it, the map button or **M** for the full map with every named
  place.
- **The street reacts:** stand in front of a moving car and the driver honks,
  then gets out (say sorry, argue, or fight; drivers who've heard of you
  lose patience faster). Barge into people and they shout; keep doing it and
  your standing drops. People you have history with greet you warmly or
  coldly. The crowd cheers or jeers your fights. Lines and effects live in
  `src/game/data/reactions.json`.
- **Pause menu → Settings:** graphics (Low / Medium / High / Sharpest; the
  first visit picks Low or Medium for the device) and full screen. The pause
  menu also shows the chapter and your current objective. **Pause menu → Wardrobe** (during free roam): outfits, colours,
  accessories and earned street names. Looks change how people react.
  Outfits are Kenney Mini Characters (T-shirt, overalls, beanie, hard hat,
  glasses, uniform cap, Owambe suit, top, headband, lab coat...), coloured in
  your own colours.

## Look

Cartoon style, in the spirit of cosy stylised mobile games: light falls in
soft bands (light, half light, shade) instead of a smooth fade, the colours
are bright, and people are Kenney's blocky Mini Characters with a dark
outline, dressed in each character's own colours and skin tone. All of it is set in
`src/game/world/style.js` (band edges, outline width and distance, head size),
so it can be tuned in one place. Outlines are off on Low.
Each story dresses its hero its own way (`campaigns.json` hero outfits and
colours): Area Boy's JJC is rugged (faded, dusty clothes; in fights a stained
singlet, patches and rubber slippers until you buy new clothes), Grass to
Grace's Emeka a village trader, Campus's Somto neat.

## Fights in 2D

Street fights switch to a 2D pixel-art fighting game
(`src/game/modes/fight/Fight2D.jsx`; the look is in
`docs/fight-art-direction.md`, the HUD in `docs/fight-hud.md`). The fighters
(`fight2d/pixel.js`) follow a chunky pixel-people design: a big head with two
tall dot eyes and blush, a stubby body, nub arms, short legs and a navy
outline, dressed in each character's own skin tone, hair or hat, clothes and
shoes. Every frame (idle, walk, punch, kick, spin kick, jump, flying kick,
block, dodge, hit, knock-out, win) is painted pixel by pixel once when the
fight starts, then drawn scaled up with square pixels.

The backdrop (`fight2d/pixelStage.js`) is wherever the fight happens: the
world you're in and the nearest place in it. In Iyana-Wahala that's the bus
stop (shelter, danfo, shops), under the bridge (the flyover and its pillars),
the market (stalls and umbrellas) or a shop street. In Nkwọ-Agụụ it's the
square (a big tree, mud houses), the farm (yam mounds, palms, a hut), a
compound, the church or the shrine. At Royal Crest it's the quad (the faculty
building), the hostels or the sports field. The sky follows the time of day,
and at dusk and night windows, lamps and signboards glow. A few passers-by
walk, stand and cheer in the background with the same pixel frames, kept
small and hazy.

Moves: punch (light, chains into combos), kick (heavy, more reach; if it's
blocked you're left open for a moment), jump (hop over a kick; attack in the
air for a flying kick), block, dodge and the Lagos Roundabout special. The
crowd throws money for good combos and specials: pixel coins spin into the
purse, and the winner keeps it (₦50 a coin). Health and special bars sit at
the top as square-ended pixel bars with square portraits; touch buttons have
pixel-art icons.

Pixel art renders to a screen-sized buffer and the browser scales it up
crisply, so a fight frame costs well under a millisecond: light on 2 GB phones
whatever the graphics setting.

## Checks that catch broken data

`npm test` includes integrity tests, so slips like a story character left
somewhere you can't walk to are caught before anyone plays:

- `src/game/world/reachability.test.js`: every "talk to" goal, scene
  position, activity spot, shop and quest giver is on ground you can walk to
  from the arrival spot.
- `src/game/data/consistency.test.js`: every mode, fighter, bluff, quiz bank,
  route, job, driver, spot and runner chaser named in the story and worlds
  exists.

`npm run story:check` plays every chapter hundreds of times with random
choices. The GitHub Pages copy only deploys when lint, tests and the story
check all pass.

## Voices

Dialogue is read aloud for players who'd rather listen than read (Settings →
Voices: Off, Read aloud, Hands-free). It uses the voices built into the phone
or browser, so nothing is downloaded: Nigerian English when the device has
it, then the nearest accent. Every character has their own pitch and pace, set
by who they are (elders low and slow, hustlers quick) plus a personal touch, and
no two of the cast match (`src/game/audio/voices.js`; a character can set its
own with `"voice": { "pitch", "rate", "sex" }` in characters.json). Nigerian
words are respelt so any voice says them right (`src/game/audio/pronounce.js`:
Pidgin, Yoruba, Igbo, Hausa, Lagos places, the cast's names; add to it). At a
choice nothing is read until you pick; then your character says your choice and
the story waits for it. The speaker button says a line again; music dips while
someone talks. Hands-free moves the story on by itself once a line has been said.

## Sound around you

Each place and activity has its own soundscape (`src/game/audio/audio.js`
SCENES): danfo horns, idling engines and conductors calling routes at a fee run,
whistles and "Ole! Hold am!" in a chase, a roaring crowd at a fight, sirens on
the run, drums at a rally, hawkers in the market, birds and goats in the
village. The shouts are said quietly by the phone's voices (Voices on), and
never over dialogue.

## Power-ups, heat and tired drivers

- **Power-ups:** an activity's start screen offers power-ups for watching a
  short sponsor message (the game pauses): Heavy Hands, Iron Jaw and Full Meter
  for fights, Second Wind and Light Feet for chases, Lucky Charm and Head Start
  for runs, Sweet Mouth and Extra Time for fee runs. One run each
  (`src/game/systems/powerups.js`).
- **Fee runs over a day:** set your fee on the start screen. Every vehicle you
  ask today makes the next drivers less willing (more haggling, refusals,
  runners, the odd shove); it resets each morning. A steady player makes about
  ₦6,500, ₦5,500 and ₦4,500 in the day's first three runs, so Baba Ticket's
  ₦15,000 is in reach.
- **The Gauntlet heats up:** each run within six game hours of the last is
  harder (faster, more officers), notoriety adds to it, and after four the
  Task Force stakes out the bridge until it cools (`src/game/systems/heat.js`).

## Requirements

- **Phones:** Android phones with 2 GB of RAM and up (Chrome), recent
  iPhones (Safari). On phones that report 3 GB or less, the game picks the
  **Low** graphics by itself: fewer background people, cars and props, and
  lower resolution, and a steady 30 frames a second (smoother than a frame
  rate that jumps around, and kinder to the battery); the stories are the
  same. Players can switch it in Settings.
- **Download:** about 5.5 MB for the first street (code, models, clips),
  then models are shared between worlds and cached for later visits.
- **Landscape by default.** On Android the game goes full screen and turns
  sideways when you start playing; elsewhere it asks you to turn the phone,
  with a button to keep playing upright. Settings → Screen changes it.
- **Computers:** any recent Chrome, Edge, Firefox or Safari with 3D graphics
  (WebGL) switched on. If it's off, the game says how to turn it on.

## Run it

You need Node.js 20 or newer to play (`node -v` to check). Running the
tests (`npm test`) needs Node 22.12 or newer.

```bash
npm install
npm run dev
```

Open the URL Vite prints. It uses `--host`, so you can also open it on your
phone if it's on the same Wi-Fi.

## Assets

The Kenney models are already in `public/assets/`. To re-import them from the
original zip:

```bash
npm run assets:import -- path/to/agberolife.zip
npm run assets:check
```

- `assets:import` copies only the GLBs, their shared colour atlas, the
  character FBX files and the skins. It also writes
  `src/assets/assetIndex.json`, which holds the sizes used by placeholders.
- `assets:check` confirms every file in `src/assets/assetManifest.js` exists
  and regenerates `docs/asset-table.md`.

Game code only ever uses names from `assetManifest.js` (`danfo`,
`taskForceVan`, `richManHouse`...), never file paths.

## Play it online without launching (GitHub Pages)

A private test copy builds itself on every push to the default branch
(`.github/workflows/pages.yml`) and appears at
`https://nuchukwuma.github.io/lagosAgbero/`. It isn't linked from anywhere and
asks search engines not to list it, so only people you send the link to will
find it (anyone with the link can open it, though).

One-time setup: on GitHub, open the repository's **Settings → Pages**, and
under **Build and deployment → Source** choose **GitHub Actions**. Then push,
or open the **Actions** tab, pick **Play on GitHub Pages** and press
**Run workflow**. The link shows on the finished run (about two minutes).

To build the same thing locally: `BASE_PATH=/lagosAgbero/ NOINDEX=1 npm run build`.

## Deploy (Vercel)

`vercel.json` is ready: framework Vite, output `dist/`, long caching for
hashed code, a week for models, and no caching for `sw.js`.

```bash
npm run build            # production build in dist/
npm run preview          # try the production build locally
```

Import the repository in Vercel (or run `vercel` from the repo) and it builds
with those settings. No environment variables are needed.

Optional environment variables:

| Variable | Effect |
|---|---|
| `VITE_PAYMENTS=paystack` + `VITE_PAYSTACK_PUBLIC_KEY` | real Paystack checkout for the optional supporter items (needs a server endpoint at `/api/verify-payment` that verifies the reference with your secret key). Without them, a clearly labelled test checkout is used. |
| `VITE_ADS=network` | switch the rewarded "favours" from the mock to a real ad SDK (plug it into `networkShow` in `src/game/services/adService.js`). |

Ads appear only as optional "favours" during free roam, never in dialogue,
fights, chases or any mode. Real money can never buy anything in the story.

## Story, tests and animations

```bash
npm run story:check      # validate story JSON + random play-throughs
npm run lint             # ESLint: undefined names, unused imports, broken hooks
npm run assets:clean     # list asset files the game no longer uses (-- --delete to remove)
npm test                 # engine unit tests
npm run assets:animations -- a1.zip a2.zip a3.zip a4.rar a5.zip "source-assets/mixamo/Breathing Idle.fbx" source-assets/mixamo/Walking.fbx   # re-import Mixamo clips
npm run assets:animations -- path/to/rpg-pack/FBX/Cleric.fbx   # add the Quaternius RPG pack clips (roll, cheer, preach, pickUp); other clips are kept
npm run assets:nature -- path/to/nature-pack.zip   # bake trees, bushes, rocks and grass into the scenery
npm run assets:minis -- path/to/kenney_mini-characters.zip   # the people: Kenney Mini Characters (palette colours become paintable parts; the game's animations converted to their 7-bone skeleton, Kenney's own used where it has them; the converted ones get a cartoon pass: bigger swings, quicker gestures, more bounce, heads kept level and facing ahead — see CARTOON in the script)
npm run assets:rpg -- path/to/rpg-pack.zip   # the RPG-pack people (Cleric, Monk, Ranger, Rogue, Warrior, Wizard), re-fitted to our skeleton so every animation works on them
npm run assets:faces     # draw eyes, eyebrows and mouths onto the people's faces (after any people import)
npm run assets:crowd     # rebuild the simplified bodies (background crowd, far-away people)
npm run assets:slim      # shrink the .glb models (1-byte normals and skin weights, no unused tangents); run after any import
```

## Credits

- City, vehicles, props and the people (Mini Characters): Kenney (kenney.nl), CC0.
- People (Men / Women packs and the RPG character pack), the bus, trees, bushes
  and rocks: Quaternius (quaternius.com), CC0.
- Animations: Mixamo (Adobe) and Quaternius.
- Driving handling (gearbox, spring steering) adapted from
  [Sketchbook](https://github.com/swift502/Sketchbook) by swift502, MIT licence.

## Docs

- `docs/asset-table.md`: every model, its file, size and planned use
- `docs/story-outline.md`: cast, backstory, acts, endings and the Ada paths (approved)
- `docs/story-format.md`: how to write story JSON (beats, choices, effects, callbacks, free roam, campaigns, bluff and exam modes, the consequence audit)
- `docs/world-format.md`: how the 3D worlds are laid out (Iyana-Wahala, the village, the campus) and the `?cam=top` map view

## Folder layout

```
src/
  assets/          assetManifest.js + generated assetIndex.json
  components/      UI screens and widgets
  game/
    store/         Zustand state
    narrative/     story engine, flags, relationships, callbacks
    systems/       traffic, fees, energy, clock, events, wardrobe
    modes/         fee collection, chase, fight, runner, conductor, begging, rally, initiation
    services/      mock ads (favours) and payments (Paystack mock)
    characters/    one body, many looks: skin/clothes tinting, accessories, animations
    world/         3D street: model loader + tweaks, layout, camera, NPCs
    player/        input (keyboard + joystick) and the player controller
    vehicles/      keke, okada (built from shapes) and the Vehicle component
    data/story/    story JSON (editable without touching code)
    data/world/    street layout JSON
scripts/           asset import / check / clean tools, story checker
public/            models, icons, manifest.webmanifest, sw.js
```
