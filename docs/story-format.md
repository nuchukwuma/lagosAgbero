# Writing story JSON

All story content lives in `src/game/data/`. You can change the story without
touching code. After editing, run:

```bash
npm run story:check
```

It finds typos (unknown speakers, missing scenes, bad stat names). It also
plays every chapter 200 times with random choices to catch dead ends.

## Files

| File | What it holds |
|---|---|
| `story/*.json` | One file per chapter (sub-folders are fine) |
| `characters.json` | Speaker ids, display names, badge colours |
| `callbacks.json` | Lines characters say about your past choices |
| `endings.json` | Ending titles and epilogues |

## A chapter

```json
{
  "id": "ch1_jjc",
  "act": 1,
  "number": 1,
  "title": "JJC",
  "startScene": "arrival",
  "scenes": {
    "arrival": { "background": "busStopDawn", "next": "market", "beats": [ ... ] },
    "market":  { "background": "market", "beats": [ ... ] }
  }
}
```

- Beats in a scene play in order.
- When a scene runs out of beats, it continues to `next`. Otherwise the last
  beat must be a `goto`, an `endChapter`, or a choice where every option jumps
  away.
- Scenes play in the 3D street. Three optional scene fields control it:
  - `"location": "frontStop"` puts the player at that spot when the scene
    starts. Spots are listed in `src/game/data/world/iyanaWahala.json`.
  - `"time"` sets the lighting: `"dawn"`, `"day"`, `"dusk"` or `"night"`.
  - `"positions": { "professor": [x, z, facing] }` moves story characters
    for this scene only.
- The older `"background"` names still work: `busStopDawn` means the Front
  Stop at dawn, and `market` and `night` are mapped to spots in the same way.

## Beat types

| type | Fields | What happens |
|---|---|---|
| `dialogue` | `speaker`, `text`, optional `mood`, `variants`, `callback`, `effects` | Shows a line and waits for a tap |
| `choice` | `speaker`, `text`, `options`, optional `timeout` + `timeoutOption` | The player picks an option |
| `startMode` | `mode`, `params`, `results` | Launches a gameplay mode and waits for its result |
| `setFlag` | `flag` or `flags`, optional `clear` | Sets flags instantly |
| `changeStat` | `stats` | Changes numbers instantly |
| `randomEvent` | `outcomes: [{ weight, if, effects }]` | Rolls once and applies one outcome |
| `newsBroadcast` | `source`, `headline`, `text`, optional `effects` | A radio or TV news moment |
| `cutscene` | `cards: [{ title, text }]` | Full-screen title cards |
| `endChapter` | `title`, `summary`, and `next` (chapter id) or `ending` | Chapter-complete card |
| `goto` | `scene` (`"scene"` or `"chapter:scene"`) | Jumps instantly |
| `freeRoam` | `objective`, optional `goal` | The player walks around until the goal is met |

Every beat can have `"if"`. If the condition is false, the beat is skipped.

### Free roam: handing control to the player

```json
{ "type": "freeRoam", "objective": "Walk to the motor park office.", "goal": { "reach": "babaTicketOffice" } }
{ "type": "freeRoam", "objective": "Find Professor under the flyover.", "goal": { "talkTo": "professor" } }
{ "type": "freeRoam", "objective": "Explore Iyana-Wahala." }
```

- `reach`: the story continues when the player walks into the spot's circle.
- `talkTo`: the story continues when the player walks up to that character
  and presses TALK (or E / Enter).
- With no goal, the player can wander freely.

A yellow ring and an arrow mark where the goal is.

### Speakers

Use an id from `characters.json` (`professor`, `babaTicket`, `ada`…), or:

- `player`, which shows the player's name, or
- `narrator`, which shows no name and italic text.

### Placeholders

Use these in any text:

- `{name}` and `{nickname}`: the player's names
- `{money}`, `{hustleMoney}`, `{cultMoney}`, `{debt}`: shown as naira
- `{stat:friendBond}`: any stat as a plain number

### Variants: one beat, different lines

```json
{ "type": "dialogue", "speaker": "professor", "text": "Hmm. We go see.",
  "variants": [ { "if": "boughtProfessorTea", "text": "Ahhh. This boy get home training." } ] }
```

The first variant whose condition is true is used.

### Choices

```json
{
  "type": "choice",
  "speaker": "professor",
  "text": "Oga, that driver don run again. You go chase am or you go let am go?",
  "timeout": 10,
  "timeoutOption": 1,
  "options": [
    { "text": "Chase him!",
      "effects": { "startMode": "chase", "params": { "target": "driver_biodun" },
                   "results": { "won":  { "remember": { "biodun_ch1": "caught" }, "goto": "caught" },
                                "lost": { "remember": { "biodun_ch1": "escaped" }, "goto": "escaped" } } } },
    { "text": "Let am go, na small money",
      "effects": { "setFlag": "letDriverGo", "changeStat": { "chairmanTrust": -5 } } },
    { "text": "Ask Ada for credit", "requires": { "stats": { "friendBond": ">= 30" } },
      "showLocked": true, "lockedText": "Ada no know you reach to give you credit" },
    { "text": "Buy Professor tea", "cost": 300, "effects": { "changeStat": { "mentorBond": 5 } } }
  ]
}
```

- `requires`: the option is hidden unless this condition is true. Add
  `"showLocked": true` to show it greyed out with `lockedText` instead.
- `cost`: naira taken from the pocket. If the player can't afford it, the
  option is locked. Use `"cost": "stat:quota"` to charge the current value of
  a stat.
- `timeout` and `timeoutOption`: a countdown bar. When time runs out, the
  game picks `timeoutOption`, which is the index of an option starting at 0.
- With no `goto`, the story continues with the next beat after the choice.

### Effects (on options, mode results, random outcomes, and some beats)

```json
"effects": {
  "setFlag": "letDriverGo",
  "clearFlag": ["raining"],
  "changeStat": { "chairmanTrust": -5, "money": 200 },
  "remember": { "biodun_ch1": "let_go" },
  "toast": "Bíọ́dún owes you one.",
  "noticedBy": ["Professor"],
  "goto": "market",
  "startMode": "chase", "params": {}, "results": { "won": {}, "lost": {}, "default": {} },
  "ending": "rock_bottom"
}
```

- Changing a relationship stat shows a toast like "Professor will remember
  that." The player feels the consequence without seeing the numbers. Set
  `noticedBy` to choose who is named, or to `[]` to show nothing.

### Conditions

```json
"if": "metAda"
"if": "!letDriverGo"
"if": { "flags": ["a"], "notFlags": ["b"],
        "stats": { "friendBond": ">= 20", "money": "< 500" },
        "memory": { "biodun_ch1": ["caught", "escaped"] },
        "anyOf": [ "raining", { "stats": { "energy": "< 20" } } ] }
```

All parts must be true. Use `anyOf` when any one of several is enough. The
comparisons are `>=`, `<=`, `>`, `<`, `==` and `!=`. A bare number means `>=`.

### Stats

| Group | Stats |
|---|---|
| Money (naira) | `money` (pocket), `hustleMoney`, `cultMoney`, `debt`, `quota` (Baba Ticket's daily share), `stopFee` (your fee per danfo) |
| Street | `energy` (0–100), `notoriety` (0–100) |
| People (0–100) | `chairmanTrust`, `mentorBond`, `friendBond` (Ada), `communityGoodwill`, `policeHeat`, `cultLoyalty`, `rivalCultHatred` |

### Callbacks: characters remembering your choices

1. Store a choice with `"remember": { "biodun_ch1": "let_go" }`.
2. Write what people say about it in `callbacks.json`:

   ```json
   "biodun_ch1": {
     "caught":  { "speaker": "ada", "text": "I hear say you catch Bíọ́dún..." },
     "let_go":  [ { "if": "raining", "speaker": "biodun", "text": "..." },
                  { "speaker": "biodun", "text": "..." } ]
   }
   ```

3. In any later chapter, add `{ "type": "dialogue", "callback": "biodun_ch1" }`.

The line matching what the player did is shown. If nothing matches, the beat
is skipped.

### Fee collection (`"mode": "feeCollection"`)

The fee run is played in the 3D street. Vehicles pull in at the stop, and the
player walks up to each one and presses COLLECT. Each driver then pays,
haggles or refuses, depending on the player's `stopFee` compared to the fair
fee.

```json
{ "type": "startMode", "mode": "feeCollection",
  "params": { "spot": "backSide", "duration": 120, "vehicles": 14,
              "drivers": ["pastorDriver", "iyaKeke"], "defaulter": "biodun", "defaulterAt": 0.72,
              "rememberAs": "ch1_firstRun" },
  "results": { "defaulter": { "goto": "defaulter" }, "done": { "goto": "evening" } } }
```

| Param | Meaning |
|---|---|
| `spot` | Where vehicles stop: `backSide` or `frontStop` |
| `duration` | Length of the run in seconds |
| `vehicles` | How many vehicles come |
| `wait` | How many seconds a vehicle waits before driving off |
| `drivers` | Named drivers from `drivers.json` who take part |
| `defaulter` | A named driver who runs off. Meeting him (or ignoring him) ends the run with outcome `defaulter`. |
| `defaulterAt` | When he arrives, as a fraction of the run from 0 to 1 |
| `fairFee` | What drivers think is normal (default ₦500). The economy changes this later. |
| `rememberAs` | A memory key that gets `metQuota`, `half` or `poor` |

**Outcomes:** `done` (time ran out) or `defaulter`.

**What the result applies:**

- the money collected goes into the pocket
- `communityGoodwill` and `notoriety` change
- flags are set: `feeRun_threatened`, `feeRun_letGo`, `feeRun_overcharged`,
  `feeRun_metQuota`, `feeRun_ignoredDefaulter`

**Related stats:**

- `stopFee`: the player's fee per danfo. Other vehicles pay a share of it:
  keke 40%, okada 20%, taxi 60%, lorry 200%.
- `quota`: Baba Ticket's daily share. A choice can charge exactly that with
  `"cost": "stat:quota"`.

### Gameplay modes

`startMode` (as a beat, or inside effects) launches a mode with `params`.
When the mode finishes, it returns a result like this:

```json
{ "outcome": "won", "moneyChange": 500, "flags": ["caughtDefaulter"], "stats": { "energy": -10 } }
```

The result is applied first. Then `results[outcome]` runs, falling back to
`results.default`. With no `goto`, the story continues after the beat that
started the mode.

Losing never dead-ends the story: send `lost` to a hospital scene, a debt or
a new branch. Modes that aren't built yet show a stand-in screen where you
pick the outcome by hand.
