# Writing story JSON

All story content lives in `src/game/data/`. You can change the story without
touching code. After editing, run:

```bash
npm run story:check
```

It finds typos (unknown speakers, missing scenes, bad stat names). It also:

- plays every chapter 200 times with random choices to catch dead ends;
- audits consequences: every choice must change something, and every flag
  or memory key you set must be read somewhere later (see
  [Every choice counts](#every-choice-counts-the-consequence-audit));
- plays each whole campaign 400 times, from its first chapter to an ending,
  and lists the endings nobody reached.

## Files

| File | What it holds |
|---|---|
| `story/*.json` | One file per chapter (sub-folders are fine) |
| `characters.json` | Speaker ids, display names, badge colours |
| `callbacks.json` | Lines characters say about your past choices |
| `endings.json` | Ending titles and epilogues |
| `campaigns.json` | The stories you can pick on New Game (hero, first chapter, world, HUD) |
| `bluffs.json` | Bluff scenarios: interrogations where your lies are remembered |
| `quizzes.json` | Question banks for the initiation and exams |

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

### Chase (`"mode": "chase"`)

This is a chase on foot after a fleeing vehicle. The vehicle crawls through
go-slow traffic, the player runs along the pavement, and GRAB wins.

| Param | Meaning |
|---|---|
| `target` | A named driver from `drivers.json` (`biodun` or `driver_biodun`) |
| `difficulty` | 1 (gentle) to 3 (hard): how fast the vehicle weaves through traffic |
| `kind` | The vehicle kind (defaults to the driver's own) |
| `escapeX` | The vehicle gets away once it passes this x (default −52, past the motor park) |
| `timeLimit` | Seconds (default 45) |

**Stamina** starts from the player's energy and drains while running.
Bumping into pedestrians makes the player stumble.

**Outcomes:**

- `won`: +₦500, flag `caughtDefaulter`, energy cost
- `lost`: flag `defaulterEscaped`, energy cost

### Interruptions: the common chapter

`story/common/common.json` (`"common": true`) holds scenes the game cuts to
from anywhere. The first is `collapse`, which plays when energy hits 0.

- Code calls `interrupt("common:collapse")`.
- The scene ends with `{ "type": "goto", "scene": "@resume" }`, which returns
  to the start of the interrupted scene (its checkpoint).
- A scene can also end the game instead, e.g. `rockBottom` after three
  collapses while broke.

### Energy items

`items.json` lists drinks, food and "hard jokes", plus which vendor sells
what. Each item has a price, an energy boost, an optional delayed `crash`,
and a hidden `habit` value.

Buying sets the flag `used_<itemId>`, and strong drinks also set
`hadStrongDrink`. The hidden stats `habit` and `collapses` can be used in
conditions, for example
`{ "if": { "stats": { "habit": ">= 25" } } }` so a character comments on
the drinking.

### Time, the day loop and random events

- The clock (`game.time`, in minutes) runs only while the flag `dayLoop` is
  set. One real second is 4 game minutes.
- A scene's `"time"` moves the clock (dawn 6:00, day 11:00, dusk 18:00,
  night 21:00). An effect can also set it: `"setTime": "06:00"`.
- **Evening:** at 9 p.m. during free roam the game cuts to
  `daily:evening`. Baba Ticket collects his share, you sleep, the day goes
  up by 1, energy is restored, the time becomes 6:00, and the game resumes.
- **Writing day-loop scenes:** put the free-roam beat in a scene of its own
  (for example `street`), because resuming restarts that scene.
- **Free-roam goals that wait:**
  - `"goal": { "until": { "stats": { "day": ">= 3" } } }` waits for a
    condition.
  - `"goal": { "atTime": "18:00" }` waits for a time.
- **Random events** (`events.json`) roll every 40 game minutes of free roam.
  Higher notoriety means more events, and it unlocks bigger ones
  (`minNotoriety`).
  - An event can apply effects (rain, toasts), start a go-slow (`jam`), or
    cut to a scene in `events.json` under `story/common`, which ends with
    `@resume`.
  - `"once": true` events happen a single time.
- **Activities** (world JSON `activities`) are things the player starts in
  free roam, for example FEE RUN at the Back Side when the flag
  `canCollectFees` is set. Their results go straight to the stats, and the
  clock moves on.

### Fight (`"mode": "fight"`)

A side-on fight in the street where the player stands.

- **Moves:** punch, kick, block (hold), dodge, and a special (the "Lagos
  Roundabout"), which needs a full meter.
- **Params:** `opponent` (an id from `fighters.json`: `kpakpa`,
  `conductor`, `scatter`, `taskForce`, `hyenaBoy`, `tortoiseBoy`,
  `lordLaffy`, `thug`, `passenger`) and `difficulty` (1–3).
- **Health and toughness:** the player's health comes from energy, and
  opponents get tougher with the player's notoriety.
- **Outcomes:**
  - `won`: energy cost, notoriety +2, flag `wonFight`
  - `lost`: a bigger energy cost, flag `lostFight`

### Escape runner (`"mode": "runner"`)

An endless-runner escape along a Lagos road.

- **Params:** `goal` (metres, default 320), `difficulty` (1–3), `chaser`
  (`taskForce` or `hyenas`), and `seed` for the course layout.
- **Outcomes:**
  - `escaped`: ₦100 per note picked up, flag `escapedRun`
  - `caught`: flag `caughtRun`
- Three stumbles, or letting the pursuers catch up, gets you caught. With
  low energy you get only two stumbles.

### Bus conductor (`"mode": "conductor"`)

```json
{ "type": "startMode", "mode": "conductor",
  "params": { "route": "oshodi", "named": ["mamaPepper", "kelvin", "prophet"], "extortionAt": 1, "extortion": 2000, "slogan": "GOD'S TIME IS THE BEST" },
  "results": { "done": { "goto": "lastStop" }, "brawl": { "goto": "busBrawl" }, "extorted": { "goto": "underBridge" } } }
```

The player hangs from a danfo's door. At each stop they drop off the passengers who said this was their stop, shout the right route (a wrong call brings wrong passengers), and give correct change. Mistakes raise **bus anger**: angry passengers refuse to pay, and at 100 a brawl breaks out (`brawl`). Named passengers come from `routes.json` (`named`): Kelvin Crypto offers a "transfer", Prophet Fire-Fire offers a prophecy, Mama Pepper pays exact. At `extortionAt` Scatter's boys block the bus: pay from the fares, let the driver pay (anger +10), or refuse, which ends the mode with `extorted` so the story can start a fight. The player keeps 30% of fares plus tips (`moneyChange`). Routes, stops, fares and passenger lines live in `src/game/data/routes.json`.

### Begging at the gate (`"mode": "begging"`)

```json
{ "type": "startMode", "mode": "begging",
  "params": { "count": 6, "wrongPerson": "nephew", "wrongAt": 3 },
  "results": { "done": { "goto": "afterBeg" }, "chased": { "goto": "afterBeg" }, "wrongPerson": { "goto": "wrongNephew" } } }
```

Rich people pass the Zone 5 gate one at a time, each described by a hint
("A Prado with a sticker: Blessed and Highly Favoured"). The player picks an
approach: praise, sob story, joke, block the car, or let them pass. Each kind
of target (`jobs.json` → `begging.targets`) pays best for one approach.
Blocking cars and failing raise **estate anger**; at 100 security chases you
out (`chased`, half the money is lost). One target can be **the wrong
person** (`nephew` = Owó Ńlá's nephew, `bassey` = Bassey off duty): anything
except letting him pass ends the run with `wrongPerson`.

### Rally jobs (`"mode": "rally"`)

```json
{ "type": "startMode", "mode": "rally", "params": { "job": "disturb", "help": 5 },
  "results": { "paid": {}, "faked": {}, "failed": {}, "arrested": {}, "brawl": {} } }
```

Six rounds at the Roundabout. Each round: chant, heckle, share rice (limited),
knock over the speakers (may start a brawl) or fake it. A random crowd event
follows. **Noise** must reach the job's goal and **heat** must stay under 100.
`help` adds noise every round (for example Scatter's boys as allies). Faking
almost every round gives `faked` (half pay). Jobs and events live in
`src/game/data/jobs.json`.

### Scene positions bring story-only characters on stage

A scene's `positions` shows an NPC even when its world `"if"` flag is off, so
characters like Settlement or Chuks appear only in the scenes that place them.

### Tortoise initiation (`"mode": "initiation"`)

```json
{ "type": "startMode", "mode": "initiation",
  "params": { "questions": ["knocks", "money", "hyena", "form", "boss"], "seconds": 12 },
  "results": { "perfect": {}, "passed": {}, "attacked": { "goto": "corrected" } } }
```

Coded questions in a candle-lit room (`src/game/data/cult.json`). Each has a
timer; a timeout counts as wrong. Two wrong answers end with `attacked`, and
the story starts a fight. Chuks teaches some answers in dialogue beforehand,
so players who read carefully pass.

### The cult system

- **Paths:** the flag `cultPath` + `tortoise` (joined) or `independentPath`.
  Chapters branch at their start scene with `goto` beats that have an `if`.
- **Ranks:** the hidden stat `cultRank` (0–5). `{rank}` in any text shows the
  rank name (`RANK_NAMES` in `stats.js`: Outsider, Egg, Hatchling, Shell,
  Hard Shell, Number Two Shell). Ranks rise through fights or fees.
- **Three pockets:** `money`, `hustleMoney` (co-op work, kept safe) and
  `cultMoney` (Shell allowances and SHELL WORK).
- **Cult help:** the raid choice "Call the Shell" (needs `tortoise` and
  ₦2,000 cult funds) and "Duck into a co-op driver's bus" (needs `coopFounded`).
- **Colours:** a Tortoise automatically wears a yellow scarf and brown
  trousers (`withAllegiance` in `look.js`; turned off by `leftTortoises` or
  `hidesColours`).

### Activity rewards

A world activity can add effects per outcome on top of the mode's result:

```json
{ "id": "shellWork", "label": "SHELL WORK", "spot": "shellHouse", "mode": "fight",
  "params": { "opponent": "hyenaBoy" },
  "results": { "won": { "changeStat": { "cultMoney": 3000 } }, "default": { } } }
```

### Mama's debt

The stat `debt` starts at ₦850,000. Players pay it at **Ada's Corner** (POS
items `sendHome5k`, `sendHome20k`, `sendHome100k` in `items.json`; transfer
items can change any stat with `"stats": { "debt": -5000 }`). Story effects
can pay from a pocket:

```json
{ "payDebt": "hustleMoney" }            // as much as that pocket allows
{ "payDebt": { "from": "money", "max": 50000 } }
```

Chapter 10 checks Iya Bọ́sẹ̀'s deadline (`deadlineMet` / `deadlineMissed`).
The secret **Go Home** ending needs the debt at ₦0.

### Endings and epilogues

`endings.json` holds every ending. Epilogue lines can be plain strings or
`{ "if": <condition>, "text": "..." }`, so the same ending reads differently
for an Ada romance, a dead Professor or an unpaid debt. `"secret": true`
shows **SECRET ENDING**. The special key `_fates` lists "What became of
them" lines shown under every ending (Professor, Ada, Sunday, Scatter, the
debt). Endings the player has seen are counted on the title screen.

The final choice (Chapter 12, scene `final`) is an ordinary choice: each
option `requires` the ending's conditions and ends with `"ending": "<id>"`.
Secret endings have no `showLocked`, so they appear only when earned. The
last option ("Walk back to the Back Side with nothing", Rock Bottom) is always
open. Jailed can also happen earlier (raids, Operation Clean Sweep).

| Ending | Needs |
|---|---|
| Go Home (secret) | debt ₦0, notoriety < 60, Professor and Ada bonds ≥ 40, never a Tortoise |
| The Honourable (secret) | exposed Owó Ńlá, Ronke owes you, goodwill ≥ 70 |
| Cult Boss | Tortoise, Hyenas defeated, rank ≥ 4, not thrown out |
| Street King | Baba Ticket's chair (given or taken), notoriety ≥ 40, heat < 60 |
| Legit Businessman | hustle savings ≥ ₦60,000, cult loyalty < 20, goodwill or Ada ≥ 50 |
| The Informant | gave Bassey evidence (flag `informant`) |
| Wanted | heat ≥ 60, and on the run or hunted by the Hyenas |
| Jailed | caught with heat ≥ 60 (raids, Clean Sweep) |
| Rock Bottom | collapse while broke, or nothing else earned |

### Economy news

Random events in `events.json` include news that changes the economy: fuel
hikes (`fairFee` and `quota` rise), a new sanitation levy (pay or argue),
cash scarcity (`fairFee` falls) and price jokes from Baba Radio.

### Looks and reactions (wardrobe)

The wardrobe (`src/game/data/wardrobe.json`) sells outfits and accessories
for pocket money. The flashiest piece sets a style flag the story and modes
can read:

| Flag | Effect |
|---|---|
| `style_plain` | nothing special |
| `style_sharp` | drivers accept ₦25 more as a fair fee |
| `style_flashy` | drivers accept ₦75 more; the Zone 5 gate gives half; Bassey comments in raids |

Write dialogue variants with `"if": "style_flashy"` to make people react.
Street names are earned by flags (`nicknames` in `wardrobe.json`) and show
up wherever `{nickname}` is used.

### Driving a danfo (`"mode": "drive"`)

```json
{ "type": "startMode", "mode": "drive",
  "params": { "length": 2400, "stops": 5, "fuel": 50, "checkpoints": 1, "slogan": "NO TELLING" },
  "results": { "done": {}, "caught": {}, "outOfFuel": {}, "wrecked": {}, "abandoned": {}, "roadRage": {} } }
```

An arcade driving mode on an endless Lagos expressway. Gas, brake, steering
and a horn that makes cars move over. Pull onto the shoulder and stop at a bus
stop to drop off and load passengers (driving past someone's stop costs half
their fare). Fuel burns with distance and throttle; filling stations sell it.
Crashes add damage (repairs come off the pay) and a hard crash can bring the
other driver out (`roadRage`). At a Task Force checkpoint you settle, talk, or
floor it, and driving through starts a **police chase**: escape by distance or
get caught. Wrecking the bus mid-chase is `abandoned` (jump out and run).
Rules: `src/game/modes/drive/driveLogic.js` (tested).

### Chaining one event into another (activities)

A world activity's per-outcome result can start another mode right away:

```json
"results": { "roadRage": { "then": { "mode": "fight", "label": "ROAD RAGE", "params": { "opponent": "angryDriver" },
                                     "results": { "lost": { "changeStat": { "money": -2000 } } } } } }
```

DRIVE DANFO (motor park, after the conductor chapter) uses this: road rage
leads into a fight, an abandoned bus into the escape runner.

### Side quests

`src/game/data/quests.json` lists every side quest:

```json
{ "id": "gasCylinder", "giver": "mamaPut", "title": "Mama Put's gas", "icon": "quest",
  "if": { "flags": ["dayLoop"], "notFlags": ["quest_gasCylinder"] },
  "blurb": "Mama Put's gas finished in the middle of the lunch rush.", "start": "quests:gasCylinder" }
```

During free roam a yellow **!** floats over every giver with a quest for you;
walk up to them and the TALK button becomes the quest. Quest scenes live in
the common chapter `story/common/quests.json`. Each sets `quest_<id>` at the
start and `quest_<id>_done` at the end, then `goto "@resume"`. Quests can use
free-roam errands (`"goal": { "reach": "motorPark" }`), choices, and any mode
(chase, fight, drive, runner). The status panel lists quests and who to ask.

When an interruption (quest, street event, raid) happens during free roam,
`@resume` returns to that same free-roam beat, and the player stays where
they are: the scene's opening dialogue does not replay.

### Task Force raids

`story/common/raids.json` holds the raid scenes:

- **`raid`** offers hide, run, fight or bribe. The bribe tiers depend on
  `policeHeat`, and Bassey refuses bribes once the flag `basseyRefuses` is
  set.
- **`caught`** means a fine, a night in the cell, or the Jailed ending after
  three arrests with high heat.

A raid is a random event once `policeHeat` is at least 20 or `notoriety` is
at least 30. Bassey's arc is tracked with the flags `basseyMet`,
`basseyDaughter`, `basseyRespect` and `basseyRefuses`, and the hidden stats
`bribesPaid` and `arrests`.

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

## Campaigns: three stories, one engine

`campaigns.json` lists the stories on the New Game screen. Each one is a
separate run with its own hero, chapters, world, HUD and endings.

| Campaign | Hero | Chapters | First world |
|---|---|---|---|
| `areaBoy` — Area Boy | you name him | `story/act1`–`act4` (12) | Iyana-Wahala |
| `grace` — Grass to Grace | Emeka | `story/grace` (6) | Nkwọ-Agụụ village |
| `campus` — Fake It Till You Graduate | Somto | `story/campus` (6) | Royal Crest University |

Grass to Grace and the campus story borrow only premises and themes from
films (a village man chasing city money; a poor student among rich ones).
Their characters, names and plots are original.

```json
{
  "id": "campus",
  "title": "Fake It Till You Graduate",
  "tagline": "...",
  "hero": { "name": "Somto", "nickname": "Scholar", "look": { ... } },
  "firstChapter": "u1_admission",
  "world": "royalCrest",
  "strict": true,
  "features": { "energy": false },
  "startStats": { "money": 3000, "debt": 0, "cgpa": 3.8 },
  "hud": { "meter": { "stat": "cover", "label": "Cover story", "icon": "shield" }, "bar": { "stat": "cgpa", "label": "CGPA" } },
  "stats": ["money", "schoolFees", "cgpa", "cover", "momBond", "tamaraBond"]
}
```

- A chapter says which campaign it belongs to with `"campaign": "grace"`.
  Chapters without one belong to `areaBoy`. Common chapters (quests, events,
  raids) only show up in Area Boy.
- `features.energy: false` turns off red eyes, energy drain and collapsing.
- `hud.meter` is the top meter: `"redEyes"` or any stat. `hud.bar` is the
  smaller bar under it. `stats` is what the status panel shows.
- Endings carry `"campaign": "grace"`. The "What became of them" list for a
  campaign is `_fates_<campaign>` (Area Boy keeps `_fates`).

### Worlds per chapter and scene

A chapter's `"world"` picks the 3D place it plays in: `iyanaWahala`,
`nkwoAgu` or `royalCrest` (registered in `src/game/world/worlds.js`). A
scene can override it, for example a campus dinner in Lagos:

```json
"dinner": { "world": "iyanaWahala", "location": "richStreet", "beats": [ ... ] }
```

`location` then means a spot in that world. Moving between worlds puts the
player at the scene's spot (or the world's spawn).

## Every choice counts: the consequence audit

The story checker treats a choice as wasted if nothing remembers it:

1. **Every option must do something lasting**: set a flag, remember a
   value, change a stat, start a mode, end the story, or go to a different
   scene. An option with `"effects": {}` fails.
2. **Every flag and memory key you set must be read later**: in a condition
   (`if`, `requires`, `variants`), in an ending or a fate, in world JSON (an
   NPC's `if`), or in code. A flag nobody reads is a choice the game forgets.

In campaigns marked `"strict": true` (all three are) these are errors and
`npm run story:check` fails. Run `node scripts/check-story.mjs --audit` to
list them in non-strict content.

The usual fixes, cheapest first:

- a `"text"` line in `_fates` (or `_fates_<campaign>`) with `"if": "<flag>"`;
- a dialogue line in a later scene with `"if": "<flag>"`, so a character
  brings it up;
- a `variants` entry on a line that is already there;
- an option that `requires` the flag (a door the choice opened).

Flags read through a template in code (`quest_<id>_done`) count as read.

The campaign play-throughs can't walk around, so in free roam they play one
of four styles (does nothing, hustler, good neighbour, outlaw). That earns
money, pays debt and builds reputation the way a player would, so endings
gated on free-roam progress get tested too.

## Your story so far: history, recap and the story map

The engine records where you've been:

- `story.visited`: every `"chapter/scene"` you've seen;
- `story.picks`: every choice, as `[chapter, scene, beat, option]`.

At the end of each chapter, the card lists the choices you made and how much
of the chapter you saw. **See your story map** (also in the pause menu and on
the ending screen) draws each chapter as a graph. Your path is gold, the
current scene is outlined, and scenes you missed are `???`. On a phone the
map scrolls to your path. `src/game/narrative/storyGraph.js` builds the graph
from the chapter JSON, so new scenes and choices show up on their own.

## Bluff (`"mode": "bluff"`)

An interrogation where your lies have to stay straight. Scenarios live in
`bluffs.json`:

```json
"harvestCon": {
  "title": "The harvest council",
  "asker": "onyisi",
  "coverStat": "villageStanding",
  "doubtAt": 45,
  "questions": [
    { "id": "company", "fact": "company", "q": "\"Which company?\"",
      "answers": [
        { "text": "\"Mega Fortune Holdings.\"", "says": { "company": "mega" }, "risk": 12 },
        { "text": "\"There is no company.\"", "says": { "company": "none" }, "truth": true, "core": true },
        { "text": "\"These questions are deep o.\"", "deflect": true }
      ] }
  ]
}
```

- Every claim (`says`) is remembered for the rest of the story as memory
  `lie_<fact>`, so a later bluff, or any line with
  `{ "memory": { "lie_company": "mega" } }`, can catch you out.
- Saying something that contradicts an earlier claim adds a lot of
  suspicion. "Stick to your story" repeats what you said before.
- Risk adds suspicion, and so does running out of time.
- `"truth": true, "core": true` answers end the bluff as `confessed`.
- Outcomes: `convinced` (suspicion stays under `doubtAt`, default 55),
  `doubted`, `caught` (suspicion hits 100) and `confessed`.

```json
{ "type": "startMode", "mode": "bluff", "params": { "scenario": "panel" },
  "results": { "convinced": { ... }, "doubted": { ... }, "caught": { ... }, "confessed": { ... } } }
```

## Exam (`"mode": "exam"`)

The initiation quiz screen with an exam bank from `quizzes.json`:

```json
{ "type": "startMode", "mode": "exam",
  "params": { "bank": "econ201", "count": 5, "maxWrong": 2, "seconds": 12 },
  "results": { "perfect": { "changeStat": { "cgpa": 0.5 } }, "passed": { ... }, "failed": { ... } } }
```

Questions are drawn at random from the bank. `maxWrong` wrong answers mean
`failed`. The CGPA stat takes two decimals and is shown with `{stat:cgpa}`.
