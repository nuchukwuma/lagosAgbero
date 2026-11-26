# NaijaVice upgrade plan

The brief: new story arcs (Port Harcourt cultist, Abuja big boy, Lekki tech-bro,
Computer Village hustler, campus exam syndicate), a bigger city with enterable
buildings and furniture, recorded voices, private multiplayer rooms with
WhatsApp invites, a street economy (sending money, property, snitching, bail),
elections and turf wars, share cards, and 3D action/stealth mini-games instead
of abstract ones.

This file is the map: what exists, where new code goes, the phases and what
each one delivers, and the decisions that need you.

## What exists today (the starting point)

| Area | Where | Notes |
|---|---|---|
| App shell, screens | `src/App.jsx`, `src/components/*Screen.jsx` | Zustand store `src/game/store/gameStore.js` |
| 3D world | `src/game/world/` (`GameCanvas.jsx`, `worlds.js`, `layout.js`, world JSON in `src/game/data/world/`) | three.js via React Three Fiber; 3 worlds: Iyana-Wahala (Lagos), Nkwo Agu (village), Royal Crest (campus); Kenney low-poly kits; collision = rotated boxes |
| Player, camera | `src/game/player/PlayerController.jsx`, `src/game/world/CameraRig.jsx`, `worldState.js` | follow camera you can turn (drag / V) |
| Story engine | `src/game/narrative/`, chapters in `src/game/data/story/<campaign>/` | 5 campaigns, 84 chapters, `npm run story:check` |
| Modes | `src/game/modes/` (`modeRegistry.js`) | 3D street modes (fee run, chase, runner, drive, Back Gate stealth), 2D fights, 2D arcade games |
| Voices | `src/game/audio/` | browser speech synthesis with Nigerian pronunciation fixes; procedural music and sound |
| Multiplayer | `server/` (Node + `ws`), client `src/game/online/` | Lagos Online: 3 places joined by buses, live draughts/Ayò, score duels, bets, groups, quests, shop |

## Folder structure for the new work

```
server/
  world.js            rules (grows: lobbies, transfers, boards, then elections, turf, property)
  lobbies.js          4-letter room codes                                 (phase 1)
  economy.js          transfers, net worth, respect / influence           (phase 1)
  politics.js         candidacy, campaign tasks, the vote, office perks   (phase 4)
  turf.js             cult clashes, territory capture                     (phase 4)
  property.js         buying, owning, furnishing                          (phase 2)
src/game/online/
  net.js              connection + store (rooms, boards, transfers added)
  invite.js           room links, WhatsApp / share / copy                 (phase 1)
  catalog.js          games, groups, quests, shop (+ properties, offices)
src/components/landing/  the new landing page, room modal, archetype cards (phase 1)
src/components/online/   in-game online panels (HUD, board, send money)
src/game/world/interiors/  interior loader, door triggers, roof cutaway    (phase 2)
src/game/data/world/       new districts: lekki, maitama, phCreek, computerVillage (phase 2)
public/assets/furniture/   low-poly GLB furniture                          (phase 2)
src/game/audio/voice/      pre-rendered voice lines + manifest, preloader  (phase 3)
src/components/share/      share cards (canvas capture + stat cards)       (phase 3)
src/game/modes/<mission>/  3D mini-games, one folder each, pure logic + tests + director + overlay
                           (the pattern of modes/stealth: logic.js, Director.jsx, Mode.jsx, store.js)
```

Each 3D mini-game follows the Back Gate pattern: a pure, tested logic module
(`createX`, `stepX`, result), a director inside the 3D canvas that draws it,
and a React overlay for intro, HUD and result. That keeps them testable
without a browser and cheap at runtime.

## Phases

### Phase 1: rooms, invites, the street economy, live boards, new landing page (this commit)

- 4-letter room codes: create a private room (your own copy of the three
  places) or join one with a code; rooms close 30 minutes after the last
  person leaves.
- Invites: one tap to WhatsApp (`https://wa.me/?text=...` with the link and
  the code), the phone's share sheet, or copy the link. Opening the link goes
  straight to joining that room.
- Send naira to anyone in your room (limits, so nobody farms bonuses).
- Live board in free roam: net worth, street respect, political influence,
  heist / turf wins, for the people in your room; all-time city leaders in
  the Leaders panel.
- Landing page redesign: neo-noir street-luxury look, a slowly turning live
  view of the city behind it (a still picture on weak phones), archetype
  cards for the stories (the new arcs marked as coming), and a Create / Join
  room box.

### Phase 2: the bigger city, enterable buildings, furniture, property

Done so far: 27 furniture models made by script (`scripts/build-furniture.mjs`),
the interior system (walk in through a door, wall cutaway, colliders), three
interiors (Rich Street duplex, hostel room, shrine compound), and property in
Lagos Online (buy, furnish, visit). Still to come in this phase: the new
districts below.

- New districts as their own worlds, joined to the others by road and bus:
  Lekki (gated estates, tech hub, bank, bureau de change, EFCC field office),
  Maitama/Wuse in Abuja (duplexes, penthouse tower, secretariat, campaign
  ground), Port Harcourt creek (jetties, mangrove lanes, a hidden shrine
  compound), Computer Village/Onitsha market (stalls, warehouse, customs
  road), plus police stations and roadblocks.
- Enterable buildings: door triggers fade to the interior (a small separate
  scene loaded on demand); bigger open-plan places use a roof cutaway.
  Interiors carry their own colliders.
- Furniture: sofas, beds, desks, safes, server racks, shrine pieces, market
  crates as low-poly GLB with collision boxes.
- Property: buy an apartment, penthouse or hideout, place furniture, visit
  friends' places (in multiplayer).

### Phase 3: recorded voices and share cards

Done: 25 recorded lines (briefings, raid warnings, chants, call-outs, Baba
Radio, street announcements) rendered with skill-tts and the free local voice
(`scripts/voice/lines.json`, `scripts/render-voices.mjs`: re-run it after
editing the lines; a paid provider is one field in the script). They load only
when a scene needs them (a cache of eight), and play with radio, megaphone or
crowd effects while the music dips: the Back Gate briefing and guard shouts,
the chase briefing, Baba Radio on the street now and then. Share cards
(`src/components/share/`): Back Gate wins, online match wins and story
endings, with a snapshot of the 3D view, Share (with the picture) and Save.

- Voices with skill-tts: mission briefings, raid warnings, cult chants and
  call-outs, radio and street announcements rendered to small audio files,
  listed in a manifest and preloaded per scene, so nothing is generated while
  you play. Everything else keeps the browser voice.
- Share cards: a capture of the 3D view or a styled stat card for big moments
  ("Escaped the EFCC raid with ₦50M", "Elected Senator of Maitama"), with
  share / save buttons.

### Phase 4: the 3D mini-games and the big multiplayer loops

Done so far, all on the shared stealth engine (`src/game/modes/stealth/`,
missions in `stealthLogic.js`, each with tests on its real map):
- **Steal Untouched** (Port Harcourt): a rival shrine compound in the bush
  round Nkwo Agu at night; take the regalia unseen for respect x3.
- **EFCC Raid Escape** (Lekki): inside the Rich Street duplex; operatives
  come through the front door one by one; take the hard drive, the laptop
  and the cash (each slows you down), out through the back door.
- (Back Gate on campus, from before, is the third.)
- **Penthouse Raid** (Abuja), **Warehouse Stock Heist** (Computer Village),
  **Exam-Hall Sneak** (campus), **Server-Room Breakers** (Lekki): four more
  stealth missions, each in a building of its own (`data/world/interiors/`:
  penthouse, warehouse, examHall, serverRoom). New in the engine: CCTV
  cameras that sweep and ring the alarm (sending the guards), jobs you must
  stand still to finish (a safe, a ledger, breakers), heavy loot, and the exam
  hall's rule (move in a sightline: fail).
- **Beat-the-Bet Wire Sprint** (Abuja): a race across a Wuse street grid at
  dusk (its own 3D scene, `src/game/modes/wireSprint/`): three drop points in
  any order before the 90-second clock and before two rival bettors' drivers
  (who route along the avenues round the roadblocks); boosts, police
  roadblocks, alley shortcuts with carts, a radar, a chase camera.
- **Course runs** (`src/game/modes/course/`): one engine for the games that
  are "get down this winding way in one piece", each in its own 3D scene (the
  way drawn as a ribbon, its banks and what stands on them, a chase camera):
  - **Creek Skiff Run** (Port Harcourt): a speedboat down mangrove creeks,
    floating logs and drums, boost arrows, two rival boats closing in.
  - **Customs Checkpoint Breakout** (Computer Village): a container truck down
    the expressway, customs lines with one lane open, tyre spikes, police cars.
  - **Market Cart Dash** (Computer Village): a loaded pushcart through the
    market; corner too fast and crates fall; shoppers and Task Force lines.
  - **Convoy Escort** (Abuja): drive ahead of the convoy and ram the blockers
    off the road before it reaches them.
All are in the Games tab and are Lagos Online duels (same seed, same course).
- **Lekki** (the first new district, `data/world/lekki.json`): the Lekki-Epe
  expressway; Pearl Estate behind its wall and gate (big houses round a
  cross street, a guard post); the Admiralty strip (a tech hub, a bank, a
  bureau de change, suya); the beach. In Lagos Online it is a fourth map,
  with buses to and from the other three.
- **Estate Gate & Drone Dodge** (Lekki, night): the stealth engine gained
  drones (they fly a loop over the walls; stand in the circle of light and
  they mark you, ring the alarm and follow you). In past the gate camera,
  tear the page out of the gate log, plant a tracker on the Chairman's SUV,
  out to the keke.
- **Turf Flag Brawl** (Port Harcourt, `modes/turf/`): a creekside yard at dusk
  in its own 3D scene, three flags, your crew of three against the
  Barracudas (fictional). Stand in a ring to raise your colour; held flags
  score; SHOVE knocks them back, and off the yard they go in the creek for a
  few seconds. First to 90 or ahead after two minutes.
That completes the fifteen 3D games on the list.
- **Three more districts**, each a world of its own and a Lagos Online map
  (buses within Lagos, flights to Abuja and Port Harcourt), with the new
  games as things to do there:
  - **Computer Village, Ikeja**: Otigba Street's phone market, the loading
    bay (Market Cart Dash), the warehouses (Warehouse Stock Heist), the
    customs container yard (Customs Breakout), the fixer (Original or Fake?).
  - **Maitama & Wuse, Abuja**: the federal secretariat, a bank, the EFCC
    office, a bureau de change (Wire Sprint), the police division, a
    checkpoint, big houses (Convoy Escort) and the Pinnacle penthouses
    (Penthouse Raid).
  - **Port Harcourt waterfront**: the jetty (Creek Skiff Run), the boathouse
    yard (Turf Flag Brawl), the bars and fish market.
Next: elections, turf wars and the other multiplayer modes, then the new
story arcs set in these districts.

- Abuja Big Boy: Beat-the-Bet Wire Sprint (driving checkpoints), Penthouse
  Raid (stealth with heavy loot), Convoy Escort (pursuit).
- Port Harcourt: Steal Untouched (stealth shrine heist), Creek Skiff Run
  (boat chase), Turf Flag Brawl (arena capture with knockback).
- Lekki: EFCC Raid Escape, Estate Gate & Drone Dodge, Server-Room Breakers.
- Computer Village: Market Cart Dash, Warehouse Stock Heist, Customs Breakout.
- Campus: Exam-Hall Sneak, Midnight Hostel Dash, Paper-Drop Relay.
- Multiplayer: run for office (rallies, fund runs, smears, debates, then a
  vote; the winner gets perks and sets a tax for a while), cult turf wars
  (real-time clashes, faction colours, knockback, capture), co-op heists,
  a bluffing/betrayal party mode, snitching (a raid on a rival), extortion,
  bail.
- The new story arcs (Port Harcourt, Abuja, Lekki, Computer Village) are
  written chapter by chapter as their districts and games arrive, the way the
  five existing stories were.

Phases 2 and 4 are each several sessions of work; they're built and pushed in
playable slices (one district, one mini-game at a time), each with tests and a
browser check.

## Decisions that need you

Decided:

1. **Voices:** the free local voice (skill-tts with espeak), rendered ahead of time.
2. **Furniture:** low-poly GLB made by script here, in the city's Kenney style.
3. **The existing 2D games stay;** the 3D games are added beside them (new arcs, the Games tab).

Still open:

- **Hosting.** Rooms, transfers and elections all live on the Lagos Online
   server, which still needs to be hosted (docs/online.md) for the public site.

## Ground rules kept throughout

- Money in multiplayer is game money only: it can't be bought or cashed out.
- Satire, not a manual: crimes are game mechanics (a stealth map, a chase),
  never real-world how-to.
- Every new system gets tests; `npm run lint`, `npm test`, `npm run story:check`
  and the build pass before each push; budget-phone performance stays a
  requirement (models loaded on demand, interiors as separate small scenes).
