// Turf Flag Brawl (Port Harcourt): a creekside yard at dusk, three flags, your
// crew of three against theirs. Pure logic (TurfScene.jsx draws it):
//   createTurf(params)          the yard, the flags, six fighters
//   stepTurf(t, dt, input)      move, shove, fall in the creek, raise flags, score
//   turfResult(t)
//
// Stand in a flag's ring with nobody from the other side in it and your
// colour goes up (faster with two of you). A held flag scores a point a
// second. SHOVE knocks the other side back; shoved off the yard, they are in
// the creek and out for a few seconds. First to the target, or ahead when the
// time is up, takes the turf. (Fictional crews; nobody is hurt: it's a shoving
// match over a flag.)

import { rng } from '../arcade/px.js'

// the yard: solid ground in this box; past the west, north and east edges is
// the creek (you fall in); the south edge is the shack wall (you stop)
export const YARD = { minX: -16, maxX: 16, minZ: -12, maxZ: 11 }
export const FLAGS = [
  { id: 'A', x: -10, z: -5, label: 'JETTY' },
  { id: 'B', x: 0, z: 1, label: 'DRUMS' },
  { id: 'C', x: 10, z: -5, label: 'BOATHOUSE' },
]
export const FLAG_R = 2.6
// drums and crates: you go round them
export const BLOCKS = [
  { x: -4, z: -2, r: 0.9 },
  { x: 4.5, z: -1, r: 0.9 },
  { x: -13, z: 4, r: 1.1 },
  { x: 12.5, z: 5, r: 1.1 },
  { x: 0, z: -8, r: 1.0 },
]
export const SPEED = 4.4
export const SHOVE_RANGE = 1.9
export const SHOVE_PUSH = 10
export const SHOVE_CD = 1.1
export const STUN = 0.6
export const OUT_TIME = 3.5 // seconds in the creek before you're back at your end
export const TARGET = 90 // points to take the turf outright
export const TIME = 120
const R = 0.45 // a fighter's body

export const TEAMS = { you: { name: 'Creek Kings', color: '#c0392b' }, them: { name: 'Barracudas', color: '#2471a3' } }
const HOME = { you: [[-6, 9], [0, 9.5], [6, 9]], them: [[-6, -10], [0, -10.5], [6, -10]] }

export function createTurf(params = {}) {
  const level = Math.max(0, Math.min(1, params.level ?? 0.4))
  const r = rng(params.seed ?? 5)
  const fighters = []
  for (const team of ['you', 'them'])
    HOME[team].forEach(([x, z], i) =>
      fighters.push({
        id: fighters.length,
        team,
        me: team === 'you' && i === 1,
        x,
        z,
        vx: 0, // knockback
        vz: 0,
        face: team === 'you' ? Math.PI : 0,
        stun: 0,
        outT: 0,
        cd: 0,
        shoveT: 0, // the shove animation
        home: [x, z],
        moving: false,
        ai: { think: r() * 0.5, target: null, aggro: 0.35 + (team === 'them' ? level * 0.4 : 0.15) + r() * 0.15 },
      }),
    )
  return {
    level,
    rand: r,
    fighters,
    flags: FLAGS.map((f) => ({ ...f, owner: null, p: 0 })), // p: -1 (them) .. +1 (you)
    score: { you: 0, them: 0 },
    tick: 0,
    time: TIME + (params.extraTime || 0),
    // AI speed: their crew gets quicker as it gets harder
    aiSpeed: { you: SPEED * 0.82, them: SPEED * (0.78 + level * 0.16) },
    over: false,
    won: false,
    why: null,
    events: [],
    stats: { shoves: 0, dunked: 0, fell: 0, captures: 0 },
  }
}

export const me = (t) => t.fighters.find((f) => f.me)
const inYard = (x, z) => x >= YARD.minX && x <= YARD.maxX && z >= YARD.minZ

/** Shove: everyone of the other side close in front of you is knocked back. */
function shove(t, f) {
  if (f.cd > 0 || f.stun > 0 || f.outT > 0) return false
  f.cd = SHOVE_CD
  f.shoveT = 0.35
  let hit = 0
  for (const o of t.fighters) {
    if (o.team === f.team || o.outT > 0) continue
    const dx = o.x - f.x
    const dz = o.z - f.z
    const d = Math.hypot(dx, dz)
    if (d > SHOVE_RANGE || d < 0.01) continue
    // in front (a wide arc), or right up close
    let a = Math.atan2(dx, dz) - f.face
    a = Math.atan2(Math.sin(a), Math.cos(a))
    if (Math.abs(a) > 1.3 && d > 1.0) continue
    o.vx += (dx / d) * SHOVE_PUSH
    o.vz += (dz / d) * SHOVE_PUSH
    o.stun = STUN
    hit++
    t.events.push({ type: 'shoved', id: o.id, by: f.id })
  }
  if (f.me) t.stats.shoves += hit
  t.events.push({ type: 'shove', id: f.id, hit })
  return true
}

function ai(t, f, dt) {
  const A = f.ai
  A.think -= dt
  const foes = t.fighters.filter((o) => o.team !== f.team && o.outT <= 0)
  const near = foes.reduce((b, o) => (Math.hypot(o.x - f.x, o.z - f.z) < (b ? Math.hypot(b.x - f.x, b.z - f.z) : Infinity) ? o : b), null)
  if (near && Math.hypot(near.x - f.x, near.z - f.z) < SHOVE_RANGE * 0.9 && f.cd <= 0 && t.rand() < A.aggro * dt * 6) {
    f.face = Math.atan2(near.x - f.x, near.z - f.z)
    shove(t, f)
  }
  if (A.think <= 0 || !A.target) {
    A.think = 0.8 + t.rand() * 0.6
    // the flag we don't hold that's nearest; sometimes go for the nearest enemy instead
    const mine = f.team === 'you' ? 1 : -1
    const wanted = t.flags.filter((fl) => fl.p * mine < 0.99)
    const pool = wanted.length ? wanted : t.flags
    const fl = pool.reduce((b, x) => (Math.hypot(x.x - f.x, x.z - f.z) < Math.hypot(b.x - f.x, b.z - f.z) ? x : b), pool[0])
    if (near && t.rand() < A.aggro * 0.5 && Math.hypot(near.x - f.x, near.z - f.z) < 6) A.target = { chase: near.id }
    else A.target = { x: fl.x + (t.rand() - 0.5) * 2.4, z: fl.z + (t.rand() - 0.5) * 2.4 }
  }
  let tx
  let tz
  if (A.target.chase != null) {
    const o = t.fighters[A.target.chase]
    if (o.outT > 0) {
      A.target = null
      return { mx: 0, mz: 0 }
    }
    // come at them from the yard side, to shove them towards the creek
    tx = o.x - Math.sign(o.x || 1) * 0.6
    tz = o.z + 0.4
  } else {
    tx = A.target.x
    tz = A.target.z
  }
  const dx = tx - f.x
  const dz = tz - f.z
  const d = Math.hypot(dx, dz)
  if (d < 0.4) return { mx: 0, mz: 0 }
  return { mx: dx / d, mz: dz / d }
}

/** One frame. input: { mx, mz } (a direction in the world, length ≤ 1), shove. */
export function stepTurf(t, dt, input = {}) {
  t.events = []
  if (t.over) return t
  dt = Math.min(dt, 0.1)
  t.time -= dt
  for (const f of t.fighters) {
    if (f.cd > 0) f.cd -= dt
    if (f.shoveT > 0) f.shoveT -= dt
    if (f.outT > 0) {
      // in the creek: back at your end after a while
      f.outT -= dt
      if (f.outT <= 0) {
        ;[f.x, f.z] = f.home
        f.vx = f.vz = 0
        f.stun = 0
        t.events.push({ type: 'back', id: f.id })
      }
      continue
    }
    let mv = { mx: 0, mz: 0 }
    if (f.me) {
      mv = { mx: input.mx || 0, mz: input.mz || 0 }
      if (input.shove) shove(t, f)
    } else mv = ai(t, f, dt)
    const len = Math.hypot(mv.mx, mv.mz)
    if (len > 1) {
      mv.mx /= len
      mv.mz /= len
    }
    const sp = f.stun > 0 ? 0 : f.me ? SPEED : t.aiSpeed[f.team]
    if (f.stun > 0) f.stun -= dt
    f.moving = len > 0.1 && f.stun <= 0
    if (f.moving) f.face = Math.atan2(mv.mx, mv.mz)
    f.x += (mv.mx * sp + f.vx) * dt
    f.z += (mv.mz * sp + f.vz) * dt
    const k = Math.exp(-dt * 5)
    f.vx *= k
    f.vz *= k
    // the shacks: a wall
    if (f.z > YARD.maxZ) f.z = YARD.maxZ
    // drums and crates
    for (const b of BLOCKS) {
      const dx = f.x - b.x
      const dz = f.z - b.z
      const d = Math.hypot(dx, dz)
      if (d < b.r + R && d > 0.001) {
        f.x = b.x + (dx / d) * (b.r + R)
        f.z = b.z + (dz / d) * (b.r + R)
      }
    }
    // off the edge: into the creek
    if (!inYard(f.x, f.z)) {
      f.outT = OUT_TIME
      f.vx = f.vz = 0
      t.events.push({ type: 'splash', id: f.id, team: f.team })
      if (f.me) t.stats.fell++
      else if (f.team === 'them') t.stats.dunked++
    }
  }
  // fighters don't overlap
  const fs = t.fighters.filter((f) => f.outT <= 0)
  for (let i = 0; i < fs.length; i++)
    for (let j = i + 1; j < fs.length; j++) {
      const a = fs[i]
      const b = fs[j]
      const dx = b.x - a.x
      const dz = b.z - a.z
      const d = Math.hypot(dx, dz)
      if (d < R * 2 && d > 0.001) {
        const push = (R * 2 - d) / 2
        a.x -= (dx / d) * push
        a.z -= (dz / d) * push
        b.x += (dx / d) * push
        b.z += (dz / d) * push
      }
    }
  // the flags
  for (const fl of t.flags) {
    let you = 0
    let them = 0
    for (const f of fs) if (f.stun <= 0 && Math.hypot(f.x - fl.x, f.z - fl.z) < FLAG_R) f.team === 'you' ? you++ : them++
    fl.contested = you > 0 && them > 0
    if (fl.contested || (!you && !them)) continue
    const dir = you ? 1 : -1
    const n = Math.min(2, you || them)
    const before = fl.owner
    fl.p = Math.max(-1, Math.min(1, fl.p + dir * dt * (0.32 + 0.18 * n)))
    if (fl.p >= 1) fl.owner = 'you'
    else if (fl.p <= -1) fl.owner = 'them'
    else if (fl.owner && Math.sign(fl.p) !== (fl.owner === 'you' ? 1 : -1)) fl.owner = null // pulled down past the middle
    if (fl.owner !== before && fl.owner) {
      t.events.push({ type: 'capture', flag: fl.id, team: fl.owner })
      if (fl.owner === 'you') t.stats.captures++
    } else if (fl.owner !== before) t.events.push({ type: 'dropped', flag: fl.id })
  }
  // a point a second for every flag held
  t.tick += dt
  while (t.tick >= 1) {
    t.tick -= 1
    for (const fl of t.flags) if (fl.owner) t.score[fl.owner]++
  }
  if (t.score.you >= TARGET || t.score.them >= TARGET) return end(t, t.score.you >= TARGET, 'target')
  if (t.time <= 0) {
    t.time = 0
    return end(t, t.score.you > t.score.them, 'time')
  }
  return t
}

function end(t, won, why) {
  t.over = true
  t.won = won
  t.why = why
  t.events.push({ type: won ? 'won' : 'lost' })
  return t
}

export function turfResult(t) {
  const { you, them } = t.score
  const won = t.won
  return {
    outcome: won ? 'won' : 'lost',
    score: you * 5 + t.stats.dunked * 25 + t.stats.captures * 30 + (won ? 300 : 0),
    moneyChange: won ? 25000 : 0,
    headline: won ? 'The waterfront is yours.' : you === them ? 'A draw is a loss on the waterfront.' : 'The Barracudas hold the yard.',
    line: `${you} to ${them}. ${t.stats.dunked} of theirs in the creek, ${t.stats.fell} times you went in yourself.`,
  }
}
