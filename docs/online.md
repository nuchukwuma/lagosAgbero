# Lagos Online

The open world shared with other players. The home screen's **Lagos Online**
button asks for a street name and a look (no account: the device remembers
you with a private token), connects to the server and puts you at
Iyana-Wahala's motor park.

## What's in it

- **One world, three places.** Iyana-Wahala (Lagos), Nkwo Agu (the village)
  and Royal Crest University, joined by buses (the BUS TO... buttons at the
  motor park, the village junction and the campus gate). The story's own
  activities in each place still work and count for quests.
- **People here.** Everyone in the same place sees everyone else walk about,
  with their name and group over their head. Chat goes to the place you're in.
- **Challenges.** Challenge anybody here, with or without a stake.
  - *Draughts* and *Ayò* are played live, turn by turn; the server checks every
    move, so nobody can cheat. Leaving or giving up loses the game (a dropped
    connection has 45 seconds to come back).
  - The other games are *score duels*: both players get the same level (the
    same seed) and the higher score takes the pot.
- **Bets.** Anybody can bet on a match in their place (not their own).
  Everyone who backed the winner shares the whole pool in proportion to what
  they put in. Baba Radio announces every result.
- **Groups** from the stories, each with a perk: Drivers' Co-op, The
  Tortoises, Honourable's Campaign Team, Sugar Palace Crew, Umunna Age Grade,
  Campus Fellowship. One at a time; joining is free.
- **Quests** from the stories' people (Professor, Baba Ticket, Papa Ngwo,
  Mama Titi...), new every day, paid when claimed.
- **Shop:** Lucky Cap (+5% on match wins), Bet Insurance (half back on a lost
  bet), Power-up Tokens (a power-up for your next game, instead of an ad), and
  clothes.
- **Leaders:** the richest, the most wins, and the groups.
- A daily bonus each day you come.

Money in Lagos Online is game money only. It can't be bought or cashed out, and
it's separate from the stories' money. (Betting with real money would need a
gaming licence.)

## Running it

The server is `server/` (Node, the `ws` package; the rules are in
`server/world.js`, the catalogue of games, groups, quests and shop items in
`src/game/online/catalog.js`, shared with the game).

```bash
npm run server            # ws://localhost:8787
npm run dev               # the game; Lagos Online finds the server on the same host, port 8787
```

The game looks for the server in this order: `?server=wss://...` in the
address bar (remembered on that device), then `VITE_ONLINE_URL` at build time,
then `ws://<the page's host>:8787`.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | where it listens (hosts usually set this) |
| `DATA_FILE` | `server/data/players.json` | where players are saved (a small JSON file) |
| `ALLOWED_ORIGINS` | any | comma list of sites allowed to connect, e.g. `https://nuchukwuma.github.io` |

## Putting it on the internet

Any host that runs Node and allows WebSockets works (Render, Railway, Fly.io,
a small VPS). On Render, for example:

1. New **Web Service** from this repository.
2. Build command `npm ci`, start command `npm run server`.
3. Add a small **persistent disk** mounted at `/data` and set
   `DATA_FILE=/data/players.json` (without a disk, players are wiped on every
   redeploy).
4. Set `ALLOWED_ORIGINS` to the site the game is served from.
5. The service gets an address like `https://lagos-online.onrender.com`; the
   game connects to `wss://lagos-online.onrender.com`.

Then tell the game where it is:

- **GitHub Pages:** in the repository's **Settings → Secrets and variables →
  Actions → Variables**, add `ONLINE_URL` = `wss://lagos-online.onrender.com`.
  The Pages build passes it on as `VITE_ONLINE_URL`.
- **Vercel:** set `VITE_ONLINE_URL` in the project's environment variables.
- **Just to try:** open the game with `?server=wss://lagos-online.onrender.com`.

A page served over https can only reach a `wss://` server (not `ws://`).
Free plans that sleep when idle take a few seconds to wake on the first
connection; the game retries by itself.
