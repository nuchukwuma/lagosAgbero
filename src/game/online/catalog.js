// Lagos Online: what the shared world offers. Used by the server (rules,
// rewards, prices) and by the game (panels), so both always agree.
// Money here is in-game naira only: it can't be bought or cashed out.

export const START_MONEY = 5000
export const DAILY_BONUS = 1000
export const MAX_STAKE = 50000
export const MAPS = {
  lagos: { name: 'Iyana-Wahala, Lagos', world: 'iyanaWahala' },
  village: { name: 'Nkwo Agu village', world: 'nkwoAgu' },
  campus: { name: 'Royal Crest University', world: 'royalCrest' },
}

// The games you can play against someone.
//   live: turn by turn against each other (the server checks every move)
//   duel: both play the same level (same seed); the higher score takes the pot
export const DUEL_GAMES = {
  draughts: { name: 'Draughts', kind: 'live' },
  ayo: { name: 'Ayò', kind: 'live' },
  runner: { name: 'Endless Runner', kind: 'duel', mode: 'runner', params: { chaser: 'taskForce', endless: true, difficulty: 1 } },
  escape: { name: 'Rooftop Escape', kind: 'duel', mode: 'escape', params: { metres: 500, difficulty: 1, to: 'the Motor Park' } },
  palmClimb: { name: 'Palm Climb', kind: 'duel', mode: 'palmClimb' },
  sneak: { name: 'Back Gate', kind: 'duel', mode: 'sneak' },
  akara: { name: 'Akara Fry', kind: 'duel', mode: 'akara' },
  penalty: { name: 'Penalty Shoot-out', kind: 'duel', mode: 'penalty' },
  traffic: { name: 'Go-Slow', kind: 'duel', mode: 'traffic' },
  pepperSoup: { name: 'Pepper Soup Kitchen', kind: 'duel', mode: 'pepperSoup' },
  barRush: { name: 'Bar Rush', kind: 'duel', mode: 'barRush' },
  whot: { name: 'Whot! (vs Bassey, best score)', kind: 'duel', mode: 'whot' },
  change: { name: 'Exact Change', kind: 'duel', mode: 'change' },
  fakeParts: { name: 'Original or Fake?', kind: 'duel', mode: 'fakeParts' },
}

// Groups from the stories. Joining is free; a perk is what members get.
//   perk.win: extra on match winnings · perk.bets: extra on bet winnings
//   perk.shop: off shop prices · perk.quests: extra on quest rewards
//   perk.daily: extra daily bonus · perk.games: [game ids] the win bonus applies to (all if missing)
export const GROUPS = {
  coop: { name: "Drivers' Co-op", story: 'Area Boy', leader: 'babaTicket', blurb: 'Fair fees, full buses.', perk: { win: 0.15, games: ['runner', 'escape', 'traffic', 'change'] }, perkText: '+15% on Runner, Escape, Go-Slow and Exact Change wins' },
  tortoises: { name: 'The Tortoises', story: 'Area Boy', leader: 'chuks', blurb: 'Slow and steady. Very steady.', perk: { daily: 1000 }, perkText: '+₦1,000 on your daily bonus' },
  campaign: { name: "Honourable's Campaign Team", story: 'The Honourable', leader: 'owoNla', blurb: 'Vote early. Vote often.', perk: { shop: 0.15 }, perkText: '15% off everything in the shop' },
  sugar: { name: 'Sugar Palace Crew', story: 'Mama Sugar', leader: 'mamaTiti', blurb: 'The house always wins. Mostly.', perk: { bets: 0.15 }, perkText: '+15% on bet winnings' },
  umunna: { name: 'Umunna Age Grade', story: 'Grass to Grace', leader: 'papaNgwo', blurb: 'Elders, palm wine, and patience.', perk: { win: 0.2, games: ['draughts', 'ayo', 'whot', 'palmClimb'] }, perkText: '+20% on Draughts, Ayò, Whot and Palm Climb wins' },
  fellowship: { name: 'Campus Fellowship', story: 'Fake It Till You Graduate', leader: 'usher', blurb: 'Prayer, plus good admin.', perk: { quests: 0.25 }, perkText: '+25% on quest rewards' },
}

// Quests from the stories' people. Each is a goal counted from what you do online.
//   goal.event: win (a match), play (a match), bet, betWin, solo (a solo game finished), shop
//   goal.game: only that game · goal.score: a solo score at least this
export const QUESTS = [
  { id: 'profDraughts', from: 'professor', story: 'Area Boy', text: 'Beat somebody at draughts. "Rule number eleven: practise on the living."', goal: { event: 'win', game: 'draughts', count: 1 }, reward: 1500 },
  { id: 'ticketDuels', from: 'babaTicket', story: 'Area Boy', text: 'Play three matches against anybody. "Fees are paid by people who show up."', goal: { event: 'play', count: 3 }, reward: 1000 },
  { id: 'adaRunner', from: 'ada', story: 'Area Boy', text: 'Run 600 m in the Endless Runner (on your own or in a duel).', goal: { event: 'solo', game: 'runner', score: 600, count: 1 }, reward: 1200 },
  { id: 'ngwoAyo', from: 'papaNgwo', story: 'Grass to Grace', text: 'Win a game of Ayò against a real person.', goal: { event: 'win', game: 'ayo', count: 1 }, reward: 1500 },
  { id: 'ngoziParts', from: 'ngozi', story: 'Grass to Grace', text: 'Score 150 at Original or Fake?.', goal: { event: 'solo', game: 'fakeParts', score: 150, count: 1 }, reward: 1000 },
  { id: 'somtoAkara', from: 'mamaSomto', story: 'Fake It Till You Graduate', text: 'Score 40 at Akara Fry.', goal: { event: 'solo', game: 'akara', score: 40, count: 1 }, reward: 1000 },
  { id: 'babaGateSneak', from: 'babaGate', story: 'Fake It Till You Graduate', text: 'Get out of the Back Gate (win it once).', goal: { event: 'solo', game: 'sneak', score: 100, count: 1 }, reward: 1500 },
  { id: 'dapoBets', from: 'chiefDapo', story: 'The Honourable', text: 'Bet on two matches. "Politics is just betting with other people\'s money."', goal: { event: 'bet', count: 2 }, reward: 800 },
  { id: 'titiBetWin', from: 'mamaTiti', story: 'Mama Sugar', text: 'Win a bet.', goal: { event: 'betWin', count: 1 }, reward: 1200 },
  { id: 'basseyWins', from: 'bassey', story: 'Area Boy', text: 'Win three matches. "I like winners. They settle faster."', goal: { event: 'win', count: 3 }, reward: 3000 },
]

// Where to find each quest giver in the open world. You claim a quest's reward
// from them in person. `pos` [x, z]: Lagos Online puts them there; without it,
// they already stand in that world (world JSON npcs).
export const QUEST_GIVERS = {
  professor: { map: 'lagos', place: 'under the bridge' },
  babaTicket: { map: 'lagos', place: 'his office at the motor park' },
  ada: { map: 'lagos', place: 'her shop in the market' },
  ngozi: { map: 'lagos', place: 'the market, by the parts stalls', pos: [18.5, -12], facing: 90 },
  mamaTiti: { map: 'lagos', place: 'the paraga joint', pos: [-1.5, -17], facing: 0 },
  chiefDapo: { map: 'lagos', place: 'South Street', pos: [-18.8, 9.3], facing: 180 },
  bassey: { map: 'lagos', place: 'Rich Street', pos: [28, 22], facing: 180 },
  papaNgwo: { map: 'village', place: 'the palm-wine shade' },
  mamaSomto: { map: 'campus', place: 'the cafeteria', pos: [10, 14.5], facing: 180 },
  babaGate: { map: 'campus', place: 'the main gate' },
}

// Property: places you can buy (each is a building you walk into, data/world/interiors)
// and furnish. Friends in your room can visit.
// Prices start at ₦100,000 and go up with the floor area (m²) and the address.
export const PROPERTIES = {
  hostelRoom: { name: 'Hostel room, Royal Crest', map: 'campus', size: 80, price: 100000, blurb: 'Six bunks, one window, endless noise.' },
  shrine: { name: 'Shrine compound, Nkwo Agu', map: 'village', size: 140, price: 350000, blurb: 'A walled yard and an altar. The elders will talk. Let them talk.' },
  duplex: { name: 'Rich Street duplex, Iyana-Wahala', map: 'lagos', size: 192, price: 1200000, blurb: 'Four rooms, a walled compound, a safe, and a gateman who salutes.' },
}
// What you can put in a place you own, and its price.
export const FURNITURE_SHOP = {
  plant: 300, chair: 400, crates: 300, rug: 700, filingCabinet: 700, officeChair: 800, coffeeTable: 900, desk: 1200,
  armchair: 1500, bunkBed: 1500, diningTable: 1500, laptop: 1500, wardrobe: 1800, bed: 2500, fridge: 2500,
  sofa: 3000, tvStand: 4000, safe: 5000, shrinePole: 600, serverRack: 8000,
}
export const MAX_FURNITURE = 30 // pieces in one place

// The shop. Advantages are small and fair; looks are just for style.
//   kind: perm (keep it) · uses (spent as used) · look (changes how you look)
export const SHOP = {
  luckyCap: { name: 'Lucky Cap', price: 6000, kind: 'perm', text: '+5% on every match you win', effect: { win: 0.05 } },
  insurance: { name: 'Bet Insurance', price: 1500, kind: 'uses', uses: 1, text: 'Half your stake back on your next lost bet' },
  powerToken: { name: 'Power-up Token', price: 800, kind: 'uses', uses: 1, text: 'Start your next duel with a free power-up' },
  goldChain: { name: 'Gold Chain', price: 9000, kind: 'look', text: 'Shine for the camera', look: { accent: '#f2c230' } },
  agbada: { name: 'Fine Agbada', price: 12000, kind: 'look', text: 'Big man energy', look: { shirt: '#e8d8b0', trousers: '#e8d8b0' } },
  jersey: { name: 'Super Eagles Jersey', price: 4000, kind: 'look', text: 'Green-white-green', look: { shirt: '#1e8449', trousers: '#ffffff' } },
}

/** A group's extra on a win in this game (0 if none). */
export function groupWinBonus(group, game) {
  const p = GROUPS[group]?.perk
  if (!p?.win) return 0
  return !p.games || p.games.includes(game) ? p.win : 0
}

/** Does this event count towards this quest? */
export function questCounts(q, ev) {
  const g = q.goal
  if (g.event !== ev.event) return false
  if (g.game && g.game !== ev.game) return false
  if (g.score != null && !(ev.score >= g.score)) return false
  return true
}

/** How a giver's quests stand for you: 'ready' (a reward to collect), 'open', or null (all claimed). */
export function giverState(id, me) {
  let open = false
  for (const q of QUESTS) {
    if (q.from !== id || me?.quests?.claimed?.[q.id]) continue
    if ((me?.quests?.progress?.[q.id] || 0) >= q.goal.count) return 'ready'
    open = true
  }
  return open ? 'open' : null
}
