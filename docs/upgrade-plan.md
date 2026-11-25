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

- Voices with skill-tts: mission briefings, raid warnings, cult chants and
  call-outs, radio and street announcements rendered to small audio files,
  listed in a manifest and preloaded per scene, so nothing is generated while
  you play. Everything else keeps the browser voice.
- Share cards: a capture of the 3D view or a styled stat card for big moments
  ("Escaped the EFCC raid with ₦50M", "Elected Senator of Maitama"), with
  share / save buttons.

### Phase 4: the 3D mini-games and the big multiplayer loops

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

1. **Voice provider (phase 3).** skill-tts can render with free local voices
   (robotic) or a paid provider (ElevenLabs, OpenAI or Gemini sound natural)
   using your API key, entered in the environment's settings, never in chat.
2. **Blender (phase 2).** The blender-skills pack drives a running Blender
   through Blender MCP. This cloud session has no Blender. Either connect
   Blender on your computer (then the skills build and export the furniture),
   or the furniture is made here as low-poly GLB by script in the same Kenney
   style as the rest of the city.
3. **The existing 2D games.** The brief says to replace abstract UI games
   (no memory cards or rhythm games). That would remove the dance battle and
   some 2D arcade games the stories use today. Replace them, or keep them and
   add the 3D ones beside them?
4. **Hosting.** Rooms, transfers and elections all live on the Lagos Online
   server, which still needs to be hosted (docs/online.md) for the public site.

## Ground rules kept throughout

- Money in multiplayer is game money only: it can't be bought or cashed out.
- Satire, not a manual: crimes are game mechanics (a stealth map, a chase),
  never real-world how-to.
- Every new system gets tests; `npm run lint`, `npm test`, `npm run story:check`
  and the build pass before each push; budget-phone performance stays a
  requirement (models loaded on demand, interiors as separate small scenes).
