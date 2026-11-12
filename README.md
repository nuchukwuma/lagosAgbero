# Area Boy

A story-driven 3D browser game about a Lagos agbero. It's built with Vite,
React, three.js (@react-three/fiber and drei) and Zustand. It is satire:
every person, party, cult, brand and drink is made up.

The whole story is playable: 12 chapters over 4 acts, two Act 3 paths (cult
or independent) and 9 endings (2 secret).

## Play on a phone or a computer

The game is one web page that adapts to the device:

- **Phone / tablet:** joystick on the left, action buttons on the right,
  portrait or landscape. "Add to Home Screen" installs it full screen and
  lets it open offline after the first visit (PWA + service worker).
- **Computer:** WASD / arrows to move, Shift to run, E or Enter to talk or
  act, mouse for menus.
- **Pause menu → Settings:** graphics (Auto / Battery saver / Sharp) and full
  screen. **Pause menu → Wardrobe** (during free roam): outfits, colours,
  accessories and earned street names. Looks change how people react.

## Run it

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
npm run assets:clean     # list asset files the game no longer uses (-- --delete to remove)
npm test                 # engine unit tests
npm run assets:animations -- a1.zip a2.zip a3.zip a4.rar a5.zip "source-assets/mixamo/Breathing Idle.fbx" source-assets/mixamo/Walking.fbx   # re-import Mixamo clips
```

## Docs

- `docs/asset-table.md`: every model, its file, size and planned use
- `docs/story-outline.md`: cast, backstory, acts, endings and the Ada paths (approved)
- `docs/story-format.md`: how to write story JSON (beats, choices, effects, callbacks, free roam)
- `docs/world-format.md`: how the 3D street is laid out (and the `?cam=top` map view)

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
