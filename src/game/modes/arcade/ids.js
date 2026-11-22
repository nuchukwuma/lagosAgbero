// The mini-games' ids, without loading the games (the store and other light
// modules use these; arcade/index.js has the games themselves).

/** Which story each game belongs to (and is first met in). */
export const ARCADE_BY_STORY = {
  areaBoy: ['escape', 'change', 'draughts', 'traffic'],
  grace: ['ayo', 'palmClimb', 'fakeParts'],
  campus: ['akara', 'penalty'], // (and Back Gate, a 3D mission: modes/stealth)
  politics: ['posters', 'ballots', 'riceQueue'],
  sugar: ['pepperSoup', 'barRush', 'whot'],
}

/** Every mini-game's id. */
export const ARCADE_IDS = new Set(Object.values(ARCADE_BY_STORY).flat())
