// Lagos Online rooms: a 4-letter code opens your own copy of the open world
// for you and your friends. The public world is the room with no code ('').

// No vowels (so codes don't spell words) and no letters that look alike (I, O)
const LETTERS = 'BCDFGHJKLMNPQRSTVWXZ'
export const CODE_LENGTH = 4
export const ROOM_LIMIT = 24 // people in one room
export const EMPTY_TTL = 30 * 60 * 1000 // a room with nobody in it closes after this

/** A code as typed ("abcd", " ab cd ") made comparable ("ABCD"); '' if it can't be one. */
export function normCode(s) {
  const c = String(s ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
  return c.length === CODE_LENGTH ? c : ''
}

/** A new code nobody is using. random: () => 0..1 */
export function makeCode(random, taken) {
  for (let tries = 0; tries < 1000; tries++) {
    let c = ''
    for (let i = 0; i < CODE_LENGTH; i++) c += LETTERS[Math.floor(random() * LETTERS.length) % LETTERS.length]
    if (!taken.has(c)) return c
  }
  throw new Error('no free room codes')
}

export class Lobbies {
  constructor({ now = () => Date.now(), random = Math.random } = {}) {
    this.now = now
    this.random = random
    this.rooms = new Map() // code -> { code, host, hostName, created, emptySince }
  }
  create(hostId, hostName) {
    const code = makeCode(this.random, this.rooms)
    const room = { code, host: hostId, hostName, created: this.now(), emptySince: null }
    this.rooms.set(code, room)
    return room
  }
  get(code) {
    return this.rooms.get(normCode(code)) || null
  }
  /** Note who's in each room (counts: code -> people); close rooms empty too long. */
  sweep(counts) {
    const t = this.now()
    for (const [code, r] of this.rooms) {
      if (counts.get(code)) r.emptySince = null
      else if (r.emptySince == null) r.emptySince = t
      else if (t - r.emptySince > EMPTY_TTL) this.rooms.delete(code)
    }
  }
}
