# Building the street (world JSON)

The street is described in `src/game/data/world/iyanaWahala.json`. Distances
are in metres:

- +X is east and +Z is south.
- The main road runs east-west along z = 0.
- The camera looks north.

To look at the whole map, run `npm run dev` and open the game with `?cam=top`
added to the URL, for example `http://localhost:5173/?cam=top`. Then use the
"Dev: jump to chapter" menu and pick **Sandbox**.

## More than one world

There are three worlds, each a JSON file in `src/game/data/world/`:

| World | File | Used by |
|---|---|---|
| Iyana-Wahala (Lagos bus stop) | `iyanaWahala.json` | Area Boy, the Lagos chapters of the other stories |
| Nkwọ-Agụụ (village) | `nkwoAgu.json` | Grass to Grace |
| Royal Crest University | `royalCrest.json` | Fake It Till You Graduate |

They're registered in `src/game/world/worlds.js`. A new world needs its JSON,
an entry there, and `"world": "<id>"` on the chapters (or scenes) that use
it. A pavement can take `"texture": "earth"` for red-earth ground.

## Placing things

Every list item takes either `at` (one or more spots) or `line` (a row of
copies):

```json
{ "model": "danfo", "rotation": 90, "at": [[-18, -2.2], [-27, -2.2, 0, 1.0]], "solid": true }
{ "model": "roadStraight", "rotation": 0, "line": { "from": [-52, 0], "to": [52, 0], "step": 8 }, "skip": [[28, 0]] }
```

- Each `at` entry is `[x, z, rotationDegrees, scale]`. The last two are
  optional and default to the group's `rotation` and `scale`.
- `model` is a name from `src/assets/assetManifest.js`. It is never a file
  name.
- `"solid": true` makes the player bump into it. The collision box comes from
  the model's real size.

## Sections

| Key | What it holds |
|---|---|
| `roads` | Road tiles (8 m). `roadStraight` runs along X at rotation 0. |
| `pavements` | Flat coloured rectangles: `rect: [x, z, width, depth]` |
| `flyover` | The bridge over the bus stop: x, width, deck height, pillar positions |
| `props` | Poles (add `"wires": "north"` or `"south"` for sagging cables), lamps, signs, bins, trees |
| `buildings` | Houses, the market hall, the motor park office… |
| `vehicles` | Parked danfos, taxis, lorries |
| `stalls` | Market stalls built from containers, and small table stalls (`"small": true`) |
| `signs` | Painted signboards with your own text: billboards, shop names |
| `shelters` | Bus stop shelters |
| `spots` | Named places the story uses: `location`, `goal.reach` |
| `npcs` | Story characters. `"if": "flag"` controls when they appear. |
| `extras` | Background people with a random look (`seed`) |
| `placed` | Hand-placed props from the city palette: `{ "kind": "tree", "at": [x, z, rotation], "seed": 4 }`. Kinds include `tree`, `bush`, `rock`, `grassTuft`, `palmTree`, `yamBarn`, `shrine`, `goalPost`, `noticeBoard`, `gatehouse`. |
| `clutter` | Zones filled at random (but the same every time): `{ "rect": [x, z, width, depth], "count": 12, "seed": 40, "kinds": ["bush", "grassTuft", "rock", "tree"] }`. A kind listed twice is twice as likely. Nothing lands inside a building or on a story spot. |
| `treeline` | Rings of trees round the edge, so the bush or the campus fades out instead of ending |
| `traffic` | `{ "density": 3 }` for moving cars, or `false` for none (the village) |

The layout test (`npm test`) checks that every spot is walkable and every
model exists.

## Trees, bushes, rocks and grass

`tree`, `bush`, `rock` and `grassTuft` come from a low-poly nature pack. They
are baked into the same merged, vertex-coloured scenery as the kiosks and
umbrellas (`npm run assets:nature`), so a forest costs triangles but no
extra draw calls. Leaf colours vary per tree. `treeline` rings mix palms,
these trees and big shrubs. On budget phones, watch the triangle count: a
tree is 400–750 triangles, a bush about 100, a grass clump 172.

## Street finds

During free roam, six small finds (a naira note, a sachet of water, a lost
ID card) lie near the named `spots` of the world, never inside a building.
They change with the day and the chapter. What they are and what they give
is in `src/game/data/finds.json`; a kind can be limited to some campaigns
with `"campaigns": ["grace"]`.
