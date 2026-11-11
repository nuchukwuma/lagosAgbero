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

## Docs

- `docs/asset-table.md`: every model, its file, size and planned use
- `docs/story-outline.md`: cast, backstory, acts and endings (draft)

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
    data/story/    story JSON (editable without touching code)
scripts/           asset import and check tools
```
