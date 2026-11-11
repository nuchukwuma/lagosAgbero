# Area Boy (working title)

A story-driven 3D browser game about a Lagos agbero. It's built with Vite,
React, three.js (@react-three/fiber and drei) and Zustand.

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

## Story, tests and animations

```bash
npm run story:check      # validate story JSON + random play-throughs
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
    systems/       energy, economy, events, notoriety, cult
    modes/         street, conductor, fight, runner
    characters/    one body, many looks: skin/clothes tinting, accessories, animations
    world/         3D street: model loader + tweaks, layout, camera, NPCs
    player/        input (keyboard + joystick) and the player controller
    vehicles/      keke, okada (built from shapes) and the Vehicle component
    data/story/    story JSON (editable without touching code)
    data/world/    street layout JSON
scripts/           asset import and check tools
```
