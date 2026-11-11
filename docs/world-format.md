# Building the street (world JSON)

The street is described in `src/game/data/world/iyanaWahala.json`. Distances
are in metres:

- +X is east and +Z is south.
- The main road runs east-west along z = 0.
- The camera looks north.

To look at the whole map, run `npm run dev` and open the game with `?cam=top`
added to the URL, for example `http://localhost:5173/?cam=top`. Then use the
"Dev: jump to chapter" menu and pick **Sandbox**.

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

The layout test (`npm test`) checks that every spot is walkable and every
model exists.
