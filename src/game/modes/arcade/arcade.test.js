import { describe, it, expect } from 'vitest'
import { ARCADE_GAMES, ARCADE_BY_STORY } from './index.js'
import { rng, viewFor } from './px.js'
import * as change from './games/change.js'
import * as draughts from './games/draughts.js'
import * as ayo from './games/ayo.js'
import * as whot from './games/whot.js'
import * as sneak from './games/sneak.js'
import * as akara from './games/akara.js'
import * as palm from './games/palmClimb.js'
import * as traffic from './games/traffic.js'
import * as ballots from './games/ballots.js'
import * as rice from './games/riceQueue.js'
import * as pepper from './games/pepperSoup.js'
import * as bar from './games/barRush.js'
import * as posters from './games/posters.js'
import * as parts from './games/fakeParts.js'
import * as penalty from './games/penalty.js'
import campaigns from '../../data/campaigns.json'
import escapeGame from '../platformer/escape.js'

const V = viewFor(800, 450)

// turn-based games: a bot that makes a random legal move on its turn
const BOTS = {
  escape: (s, r) => {
    s.held.right = true
    if (r() < 0.2) escapeGame.input(s, { type: 'button', id: r() < 0.7 ? 'jump' : r() < 0.5 ? 'hit' : 'roll', down: true })
  },
  draughts: (s, r) => {
    if (s.turn !== 'p' || s.over) return
    const m = s.turns[Math.floor(r() * s.turns.length)]
    if (!m) return
    for (const sq of m.path) draughts.tapSquare(s, sq)
  },
  ayo: (s, r) => {
    const ms = ayo.legal(s.board, 'p')
    if (s.turn === 'p' && ms.length) ayo.tapCup(s, ms[Math.floor(r() * ms.length)])
  },
  whot: (s) => {
    if (s.turn !== 'p') return
    if (s.choosing) return whot.callShape(s, 'circle')
    const k = s.hands.p.findIndex((c) => whot.playable(c, s.top, s.need))
    if (k >= 0) whot.playCard(s, 'p', k)
    else whot.goMarket(s, 'p')
  },
}

/** Mash random inputs at a game until it ends (or 10 simulated minutes pass). */
function mash(game, seed) {
  const s = game.create({}, seed)
  const r = rng(seed * 7 + 1)
  for (let i = 0; i < 6000 && !s.over; i++) {
    game.step(s, 0.1)
    if (BOTS[game.id]) BOTS[game.id](s, r)
    else if (r() < 0.6) {
      const bs = game.buttons?.(s) || []
      if (bs.length && r() < 0.6) game.input(s, { type: 'button', id: bs[Math.floor(r() * bs.length)].id }, V)
      else {
        const ev = { x: r() * V.W, y: r() * V.H }
        game.input(s, { type: 'down', ...ev }, V)
        game.input(s, { type: 'up', ...ev }, V)
      }
    }
  }
  return s
}

describe('arcade mini-games', () => {
  it('three games for every story', () => {
    const stories = (campaigns.campaigns || campaigns).map((c) => c.id)
    for (const id of stories) expect(ARCADE_BY_STORY[id].length, id).toBeGreaterThanOrEqual(3)
    const ids = ARCADE_GAMES.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const list of Object.values(ARCADE_BY_STORY)) for (const id of list) expect(ids).toContain(id)
  })

  it('every game plays to an end under random tapping, with a proper result', () => {
    for (const g of ARCADE_GAMES)
      for (const seed of [1, 2, 3]) {
        const s = mash(g, seed)
        expect(s.over, `${g.id} #${seed} never ended`).toBe(true)
        const res = g.result(s, {})
        expect(['won', 'lost', 'escaped', 'caught'], g.id).toContain(res.outcome)
        expect(Number.isFinite(res.score), g.id).toBe(true)
        expect(g.hud(s).length, g.id).toBeGreaterThan(0)
        expect(g.rules.length ?? g.rules({}).length, g.id).toBeGreaterThan(0)
      }
  })

  it('exact change: exact is a tip, short is a strike', () => {
    const s = change.create({}, 4)
    const owed = change.changeOwed(s.p)
    for (const n of change.NOTES) while (change.givenTotal(s) + n.v <= owed) change.input(s, { type: 'button', id: `n${n.v}` })
    change.input(s, { type: 'button', id: 'give' })
    expect(s.served).toBe(1)
    change.input(s, { type: 'button', id: 'give' }) // nothing given
    expect(s.strikes).toBe(1)
  })

  it('draughts (international): men capture backwards, the biggest capture is compulsory, kings fly', () => {
    const R = draughts.VARIANTS.international
    const at = (r, c) => draughts.idx(r, c, 10)
    const empty = () => new Array(100).fill(null)
    expect(draughts.turnsFor(draughts.initialBoard(R), 'p', R)).toHaveLength(9)
    // a man takes backwards
    let b = empty()
    b[at(5, 4)] = { side: 'p', king: false }
    b[at(6, 5)] = { side: 'o', king: false }
    b[at(0, 9)] = { side: 'o', king: false }
    let turns = draughts.turnsFor(b, 'p', R)
    expect(turns).toHaveLength(1)
    expect(turns[0].caps).toEqual([at(6, 5)])
    // majority rule: of a single and a double capture, only the double is allowed
    b = empty()
    b[at(6, 1)] = { side: 'p', king: false }
    b[at(5, 2)] = { side: 'o', king: false }
    b[at(3, 4)] = { side: 'o', king: false }
    b[at(6, 7)] = { side: 'p', king: false }
    b[at(5, 8)] = { side: 'o', king: false }
    turns = draughts.turnsFor(b, 'p', R)
    expect(turns.every((t) => t.caps.length === 2)).toBe(true)
    expect(draughts.countOf(turns[0].board, 'o')).toBe(1)
    // a flying king takes from a distance and may land on any free square beyond
    b = empty()
    b[at(9, 0)] = { side: 'p', king: true }
    b[at(5, 4)] = { side: 'o', king: false }
    turns = draughts.turnsFor(b, 'p', R)
    expect(turns.map((t) => t.path[1]).sort((x, y) => x - y)).toEqual([at(0, 9), at(1, 8), at(2, 7), at(3, 6), at(4, 5)].sort((x, y) => x - y))
    // a man passing the far row mid-capture is not crowned; one ending there is
    b = empty()
    b[at(2, 1)] = { side: 'p', king: false }
    b[at(1, 2)] = { side: 'o', king: false }
    b[at(1, 4)] = { side: 'o', king: false }
    turns = draughts.turnsFor(b, 'p', R)
    expect(turns[0].caps).toHaveLength(2) // up to the far row and back down
    expect(turns[0].board[turns[0].path.at(-1)].king).toBe(false)
  })

  it('draughts (english): 8x8, men capture forwards only, crowning ends the move', () => {
    const R = draughts.VARIANTS.english
    const at = (r, c) => draughts.idx(r, c, 8)
    expect(draughts.turnsFor(draughts.initialBoard(R), 'p', R)).toHaveLength(7)
    const b = new Array(64).fill(null)
    b[at(4, 3)] = { side: 'p', king: false }
    b[at(5, 4)] = { side: 'o', king: false } // behind: can't be taken by a man
    b[at(3, 2)] = { side: 'o', king: false }
    const turns = draughts.turnsFor(b, 'p', R)
    expect(turns).toHaveLength(1)
    expect(turns[0].caps).toEqual([at(3, 2)])
  })

  it('draughts: tapping each landing square plays a multiple capture; Professor plays a legal move at every level', () => {
    const s = draughts.default.create({ aiLevel: 1 }, 3)
    const t = s.turns[0]
    for (const sq of t.path) draughts.tapSquare(s, sq)
    expect(s.turn).toBe('o')
    for (let level = 1; level <= 5; level++) {
      const m = draughts.aiTurn(s.board, level, rng(level), draughts.VARIANTS.international)
      expect(draughts.turnsFor(s.board, 'o').some((x) => x.path.join() === m.path.join())).toBe(true)
    }
  })

  it('ayo: last seed making two or three on their side is captured; feeding is compulsory', () => {
    const b = [0, 0, 0, 0, 0, 2, 1, 2, 0, 0, 4, 0]
    const res = ayo.play(b, 5, 'p') // sow into 6 and 7: they become 2 and 3
    expect(res.taken).toBe(5)
    const empty = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    expect(ayo.legal(empty, 'p')).toEqual([]) // one seed can't reach their side: no feeding move
    const feedable = [0, 0, 0, 0, 1, 6, 0, 0, 0, 0, 0, 0]
    expect(ayo.legal(feedable, 'p')).toEqual([5])
  })

  it('whot: shape or number, Whot on anything, and specials hit the other player', () => {
    expect(whot.makeDeck()).toHaveLength(54)
    const top = { shape: 'circle', n: 7 }
    expect(whot.playable({ shape: 'circle', n: 3 }, top)).toBe(true)
    expect(whot.playable({ shape: 'star', n: 7 }, top)).toBe(true)
    expect(whot.playable({ shape: 'star', n: 3 }, top)).toBe(false)
    expect(whot.playable({ shape: 'whot', n: 20 }, top)).toBe(true)
    const s = whot.create({}, 9)
    s.top = { shape: 'square', n: 9 }
    s.hands.p = [{ shape: 'square', n: 2 }, { shape: 'circle', n: 4 }]
    const before = s.hands.o.length
    whot.playCard(s, 'p', 0)
    expect(s.hands.o.length).toBe(before + 2)
    expect(s.turn).toBe('p') // pick two: you go again
  })

  it('sneak: every level has a way from the hostel to the gate', () => {
    for (const lv of sneak.LEVELS) {
      let start
      lv.map.forEach((row, y) => [...row].forEach((c, x) => c === 'S' && (start = [x, y])))
      const seen = new Set([start.join()])
      const q = [start]
      let found = false
      while (q.length) {
        const [x, y] = q.shift()
        if (lv.map[y][x] === 'E') found = true
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx
          const ny = y + dy
          const c = lv.map[ny]?.[nx]
          if (!c || c === '#' || seen.has(`${nx},${ny}`)) continue
          seen.add(`${nx},${ny}`)
          q.push([nx, ny])
        }
      }
      expect(found, lv.name).toBe(true)
      for (const g of lv.guards) for (const [x, y] of g.path) expect(lv.map[y][x], `${lv.name} guard at ${x},${y}`).not.toBe('#')
    }
  })

  it('sneak: torch beams stop at walls, hedges hide you, the ? fills before you are caught, the gate moves you on', () => {
    const s = sneak.create({}, 1)
    const lv = s.lv
    // a guard in the open sees ahead, not through a wall
    const g = { x: 1.5, y: 3.5, fx: 1, fy: 0 }
    expect(sneak.inBeam(lv, g, 3.5, 3.5)).toBe(true)
    expect(sneak.inBeam(lv, g, 1.5, 1.5)).toBe(false) // behind the wall above, and off to the side
    expect(sneak.inBeam(lv, g, 1.5 + sneak.RANGE + 0.5, 3.5)).toBe(false) // too far
    // standing in a beam: caught only after the ? has filled
    s.guards = [{ path: [[1, 3], [2, 3], [3, 3], [4, 3]], kind: 'security', u: 0, dir: 1, wait: 0, x: 1.5, y: 3.5, fx: 1, fy: 0 }]
    s.pos = [3.5, 3.5]
    sneak.step(s, 0.1)
    expect(s.lives).toBe(3)
    expect(s.spot).toBeGreaterThan(0)
    for (let i = 0; i < 10; i++) sneak.step(s, 0.1)
    expect(s.lives).toBe(2)
    // in a hedge, nobody sees you
    const h = sneak.create({}, 1)
    h.guards = [{ path: [[1, 3], [2, 3]], kind: 'security', u: 0, dir: 1, wait: 99, x: 3.5, y: 3.5, fx: 1, fy: 0 }]
    h.pos = [5.5, 3.5] // the B at (5, 3)
    h.guards[0].wait = 0
    h.guards[0].path = [[3, 3], [4, 3]]
    for (let i = 0; i < 4; i++) sneak.step(h, 0.1)
    expect(h.lives).toBe(3)
    // the stick walks you; reaching the gate is the next level
    const w = sneak.create({}, 1)
    w.guards = []
    w.pos = [9.5, 5.5]
    w.stick = { x: 1, y: 0 }
    for (let i = 0; i < 30 && w.level === 0; i++) sneak.step(w, 0.1)
    expect(w.level).toBe(1)
  })

  it('akara: flip at golden, lift at golden, and orders fill', () => {
    const s = akara.create({}, 2)
    const need = s.orders[0].n
    for (let k = 0; k < need; k++) {
      akara.tapSlot(s, 0)
      s.slots[0].cook = 0.6
      akara.tapSlot(s, 0) // flip
      s.slots[0].cook = 0.6
      akara.tapSlot(s, 0) // lift
    }
    expect(s.filled).toBe(1)
    expect(s.perfect).toBe(need)
  })

  it('palm climb: a platformer up the fronds; every level can be reached; hazards sting; falling slips back', () => {
    const pm = palm.buildPalm({ height: 32, seed: 4 })
    // each level's frond is within a jump (and a double jump) of the one below
    expect(palm.JUMP_V ** 2 / (2 * palm.G) + palm.DOUBLE_V ** 2 / (2 * palm.G)).toBeGreaterThan(palm.GAP * 1.6)
    const levels = new Set(pm.fronds.map((f) => Math.round(-f.y / palm.GAP)))
    for (let i = 0; i <= 32; i++) expect(levels.has(i)).toBe(true)
    expect(pm.fronds.some((f) => f.top)).toBe(true)
    // a jump goes up; landing on the frond above counts as climbing
    const s = palm.create({ height: 8 }, 3)
    s.fruitNext = 99
    s.gustNext = 99
    const above = s.palm.fronds.find((f) => Math.round(-f.y / palm.GAP) === 1)
    s.p.x = above.x + above.w / 2
    palm.press(s, 'jump')
    for (let i = 0; i < 90; i++) palm.step(s, 1 / 60)
    expect(s.best).toBeGreaterThanOrEqual(1)
    // an ant on your frond stings
    s.palm.ants = [{ frond: s.palm.fronds.indexOf(above), t: 0, speed: 0 }]
    s.p.invul = 0
    for (let i = 0; i < 30; i++) palm.step(s, 1 / 60)
    expect(s.stings).toBeGreaterThanOrEqual(1)
    // falling out of the view sends you back to the last wide frond
    const before = s.stings
    s.p.invul = 0
    s.camY = -2000
    palm.step(s, 1 / 60)
    expect(s.stings).toBe(before + 1)
    expect(s.p.y).toBe(s.checkpoint.y)
  })

  it('a perfect player wins the sorting games', () => {
    // fake parts
    let s = parts.create({}, 5)
    while (!s.over) parts.judge(s, s.boxes[s.i].fake)
    expect(parts.result(s).outcome).toBe('won')
    // ballots
    s = ballots.create({}, 5)
    while (!s.over) ballots.sortInto(s, s.ballots[s.i].answer)
    expect(ballots.result(s).outcome).toBe('won')
    // rice queue
    s = rice.create({ seconds: 600 }, 5)
    while (!s.over) rice.decide(s, s.queue[0].ok)
    expect(rice.result(s).outcome).toBe('won')
    // pepper soup
    s = pepper.create({}, 5)
    while (!s.over) {
      for (const st of s.orders[0].steps) pepper.add(s, st)
      pepper.serve(s)
      pepper.step(s, 3)
    }
    expect(pepper.result(s).outcome).toBe('won')
  })

  it('bar rush: serving what they ask pays; pouring what nobody wants costs', () => {
    const s = bar.create({}, 6)
    bar.step(s, 0.5)
    const c = s.seats.find(Boolean)
    bar.pour(s, c.drink)
    expect(s.takings).toBeGreaterThan(0)
    const before = s.takings
    const nobody = Object.keys(bar.DRINKS).find((d) => !s.seats.some((x) => x && !x.leaving && x.drink === d))
    bar.pour(s, nobody)
    expect(s.takings).toBeLessThan(before)
  })

  it('go-slow: cars turn into the right lane, queue without overlapping, and pull away', () => {
    // a right turn from the north road ends heading west, on the westbound lane; a left turn heads east
    const r = traffic.pathPoint('N', 'R', 100)
    expect(r.dx).toBeCloseTo(-1)
    expect(r.dz).toBeCloseTo(0)
    expect(r.z).toBeCloseTo(-1.75)
    const l = traffic.pathPoint('N', 'L', 100)
    expect(l.dx).toBeCloseTo(1)
    expect(l.z).toBeCloseTo(1.75)
    // the path is continuous where the turn starts
    const a0 = traffic.pathPoint('E', 'R', 0)
    const a1 = traffic.pathPoint('E', 'R', 0.01)
    expect(Math.hypot(a1.x - a0.x, a1.z - a0.z)).toBeLessThan(0.05)
    const s = traffic.create({ spawnMul: 3 }, 4)
    s.green = 'EW'
    for (let i = 0; i < 80; i++) traffic.step(s, 0.1)
    for (const d of traffic.DIRS) {
      const q = s.q[d]
      for (let i = 1; i < q.length; i++) expect(q[i - 1].u - q[i - 1].m / 2).toBeGreaterThan(q[i].u + q[i].m / 2)
      if (q.length) expect(q[0].u + q[0].m / 2).toBeLessThanOrEqual(0)
    }
    expect(s.moving.length + s.passed).toBeGreaterThan(0)
  })

  it('poster war, traffic and penalties hold together', () => {
    const p = posters.create({}, 1)
    p.wall = p.wall.map(() => null)
    posters.tapSpot(p, 0)
    expect(posters.mine(p)).toBe(1)
    const t = traffic.create({}, 1)
    traffic.toggle(t)
    expect(t.green).toBe('EW')
    for (let i = 0; i < 100; i++) traffic.step(t, 0.1)
    expect(t.passed).toBeGreaterThan(0)
    const k = penalty.create({}, 1)
    penalty.input(k, { type: 'button', id: 'TL' }, V)
    expect(k.phase).toBe('power')
  })
})
