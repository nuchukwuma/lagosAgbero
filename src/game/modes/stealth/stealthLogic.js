// Back Gate: the 3D stealth mission on the Royal Crest campus at night.
// Pure logic (no React, no three.js), so it can be tested and replayed:
//   createMission(layout, params, seed)  the guards, their routes, the cover
//   stepMission(m, dt, player)           guards patrol, see, chase, search
//   takedown(m)                          put the guard next to you to sleep
//
// The player is driven by the normal free-roam controller (PlayerController):
// this only reads where they are and whether they run. Guards walk on a 1 m
// grid built from the campus buildings plus the mission's own cover (crates,
// containers, walls), with A* paths, and see along their torch beam unless a
// wall is in the way.

import { getAsset } from '../../../assets/assetManifest.js'
import { rng } from '../arcade/px.js'

const DEG = Math.PI / 180
export const START = { x: -34, z: 27, facing: 90 } // outside the hostel
export const GATE = { x: 52, z: -5 } // the back gate (royalCrest spots.backGate)
export const GATE_RADIUS = 3
export const SEE_RANGE = 9 // metres of torch
export const SEE_HALF = 32 * DEG // half the beam's width
export const HEAR_RUN = 6 // running this close is heard
export const PATROL_SPEED = 1.3
export const CHASE_SPEED = 4.1 // you run 4.8: you can outrun them, loudly
export const CATCH = 1.1
export const TAKEDOWN = 2.2
export const LOSE_SIGHT = 3.5 // seconds out of sight before a chase becomes a search
export const TIME = 300 // till dawn

// The cover put on the campus for the night: containers, bins, walls, cars.
// [model, x, z, rotationDeg]
export const COVER = [
  ['shippingContainerA', -26, 21, 0],
  ['dumpster', -19, 30, 90],
  ['compoundFence1x3', -13, 21, 0],
  ['shippingContainerB', -2, 23, 90],
  ['privateCar', 6, 31, 0],
  ['shippingContainerA', 3, 11, 0],
  ['dumpster', -16, 10, 0],
  ['compoundFence1x3', 14, 24, 90],
  ['shippingContainerB', 20, 13, 0],
  ['dumpster', 26, 2, 0],
  ['shippingContainerA', 31, -9, 90],
  ['compoundFence1x3', 40, 4, 0],
  ['dumpster', 44, -12, 90],
  ['privateCar', 22, -20, 90],
  ['shippingContainerB', -6, -10, 0],
  ['compoundFence1x2', 46, -2, 90],
]

// Patrol routes (loops through these points), in the order guards are added
// as it gets harder.
export const ROUTES = [
  [[-30, 15], [-17, 15], [-17, 26], [-30, 26]], // the hostel yard
  [[-8, 30], [10, 27], [10, 18], [-8, 17]], // behind the chapel row
  [[12, 7], [33, 7]], // the cafeteria road
  [[38, -4], [48, -14], [36, -14]], // by the back gate
  [[-12, -2], [18, -2]], // the main road
  [[16, -26], [30, -26], [30, -15]], // the car park side
]

export const coverBoxes = (cover = COVER) =>
  cover.map(([model, x, z, rot]) => {
    const s = getAsset(model)?.size || [2, 2, 2]
    return { x, z, hw: s[0] / 2, hd: s[2] / 2, angle: rot * DEG, model }
  })

function insideBox(c, x, z, pad) {
  const dx = x - c.x
  const dz = z - c.z
  const ca = Math.cos(-c.angle)
  const sa = Math.sin(-c.angle)
  const lx = dx * ca - dz * sa
  const lz = dx * sa + dz * ca
  return Math.abs(lx) < c.hw + pad && Math.abs(lz) < c.hd + pad
}

/** The walk grid (1 m): 1 = blocked for walking, 2 = also blocks sight. */
export function buildGrid(bounds, boxes) {
  const x0 = bounds.minX
  const z0 = bounds.minZ
  const w = bounds.maxX - bounds.minX + 1
  const h = bounds.maxZ - bounds.minZ + 1
  const cells = new Uint8Array(w * h)
  for (const c of boxes) {
    const r = Math.ceil(Math.hypot(c.hw, c.hd)) + 2
    for (let gz = Math.floor(c.z - r - z0); gz <= Math.ceil(c.z + r - z0); gz++)
      for (let gx = Math.floor(c.x - r - x0); gx <= Math.ceil(c.x + r - x0); gx++) {
        if (gx < 0 || gz < 0 || gx >= w || gz >= h) continue
        const x = gx + x0
        const z = gz + z0
        if (insideBox(c, x, z, 0.1)) cells[gz * w + gx] = 2
        else if (!cells[gz * w + gx] && insideBox(c, x, z, 0.6)) cells[gz * w + gx] = 1
      }
  }
  return { x0, z0, w, h, cells }
}

const cellOf = (g, x, z) => [Math.round(x - g.x0), Math.round(z - g.z0)]
export function walkable(g, x, z) {
  const [cx, cz] = cellOf(g, x, z)
  return cx >= 0 && cz >= 0 && cx < g.w && cz < g.h && g.cells[cz * g.w + cx] === 0
}

/** Can someone at a see b? (No wall or container in between.) */
export function lineOfSight(g, ax, az, bx, bz) {
  const d = Math.hypot(bx - ax, bz - az)
  const n = Math.ceil(d / 0.5)
  for (let i = 1; i < n; i++) {
    const [cx, cz] = cellOf(g, ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n)
    if (cx < 0 || cz < 0 || cx >= g.w || cz >= g.h) return false
    if (g.cells[cz * g.w + cx] === 2) return false
  }
  return true
}

function nearestFree(g, x, z) {
  if (walkable(g, x, z)) return [Math.round(x), Math.round(z)]
  for (let r = 1; r < 6; r++)
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) if (walkable(g, x + dx, z + dz)) return [Math.round(x + dx), Math.round(z + dz)]
  return null
}

/** A* on the grid, 8 directions, no cutting corners. Returns [[x, z], ...] (world metres) or null. */
export function findPath(g, from, to, maxNodes = 6000) {
  const a = nearestFree(g, from[0], from[1])
  const b = nearestFree(g, to[0], to[1])
  if (!a || !b) return null
  const [sx, sz] = cellOf(g, a[0], a[1])
  const [tx, tz] = cellOf(g, b[0], b[1])
  const key = (x, z) => z * g.w + x
  const open = [[sx, sz]]
  const cost = new Map([[key(sx, sz), 0]])
  const from_ = new Map()
  const est = (x, z) => Math.hypot(tx - x, tz - z)
  const f = new Map([[key(sx, sz), est(sx, sz)]])
  let seen = 0
  while (open.length && seen++ < maxNodes) {
    let bi = 0
    for (let i = 1; i < open.length; i++) if (f.get(key(...open[i])) < f.get(key(...open[bi]))) bi = i
    const [cx, cz] = open.splice(bi, 1)[0]
    if (cx === tx && cz === tz) {
      const out = []
      let k = key(cx, cz)
      while (k !== undefined) {
        out.push([(k % g.w) + g.x0, Math.floor(k / g.w) + g.z0])
        k = from_.get(k)
      }
      return out.reverse()
    }
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue
        const nx = cx + dx
        const nz = cz + dz
        if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h || g.cells[key(nx, nz)]) continue
        if (dx && dz && (g.cells[key(cx + dx, cz)] || g.cells[key(cx, cz + dz)])) continue
        const c = cost.get(key(cx, cz)) + (dx && dz ? 1.414 : 1)
        const k = key(nx, nz)
        if (c < (cost.get(k) ?? Infinity)) {
          cost.set(k, c)
          f.set(k, c + est(nx, nz))
          from_.set(k, key(cx, cz))
          if (!open.some(([ox, oz]) => ox === nx && oz === nz)) open.push([nx, nz])
        }
      }
  }
  return null
}

/** Shorten a grid path to the corners you can walk straight between. */
function smooth(g, path) {
  if (!path || path.length < 3) return path
  const out = [path[0]]
  let i = 0
  while (i < path.length - 1) {
    let j = path.length - 1
    while (j > i + 1 && !clearWalk(g, path[i], path[j])) j--
    out.push(path[j])
    i = j
  }
  return out
}
function clearWalk(g, a, b) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1])
  const n = Math.ceil(d / 0.5)
  for (let i = 1; i < n; i++) if (!walkable(g, a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n)) return false
  return true
}

/**
 * A new night. params.difficulty / params.level (0..1) sets how many guards (4 to 6).
 * layout: the campus layout (colliders, bounds) from worlds.js.
 */
export function createMission(layout, params = {}, seed = 1) {
  const r = rng(seed)
  const level = Math.max(0, Math.min(1, params.level ?? (params.difficulty != null ? (params.difficulty - 1) / 2 : 0.4)))
  const cover = coverBoxes()
  const grid = buildGrid(layout.bounds, [...layout.colliders, ...cover])
  const count = Math.min(ROUTES.length, 4 + Math.round(level * 2))
  const guards = ROUTES.slice(0, count).map((route, i) => {
    const pts = route.map(([x, z]) => nearestFree(grid, x, z))
    // the walk between each point and the next, round the loop
    const legs = pts.map((p, k) => smooth(grid, findPath(grid, p, pts[(k + 1) % pts.length])) || [p])
    return { id: i, home: pts, legs, leg: 0, step: 1, x: pts[0][0], z: pts[0][1], ry: 0, state: 'patrol', spot: 0, path: null, lastSeen: null, lostT: 0, lookT: 0, look: 0, repath: 0, cash: 300 + Math.round((r() * 500) / 50) * 50, said: null, saidT: 0 }
  })
  return {
    level,
    spotMul: params.spotMul ?? 1,
    grid,
    cover,
    guards,
    time: TIME + (params.extraTime || 0),
    tries: params.tries ?? 3,
    cash: 0,
    takedowns: 0,
    open: false, // the back gate
    over: false,
    won: false,
    caughtT: 0, // seconds since you were caught (the screen flashes)
    events: [], // for sounds and lines: { type: 'spotted'|'caught'|'down'|'open'|'heard', id }
    canTakedown: null,
  }
}

const faceTo = (g, x, z) => Math.atan2(x - g.x, z - g.z)
function turn(g, want, dt, rate = 5) {
  let d = want - g.ry
  d = Math.atan2(Math.sin(d), Math.cos(d))
  g.ry += d * Math.min(1, dt * rate)
}

/** Walk a guard along `path` (world points); true when it gets to the end. */
function walk(g, path, speed, dt) {
  if (!path?.length) return true
  let left = speed * dt
  while (left > 0 && path.length) {
    const [tx, tz] = path[0]
    const d = Math.hypot(tx - g.x, tz - g.z)
    if (d < 0.05) {
      path.shift()
      continue
    }
    turn(g, faceTo(g, tx, tz), dt, 8)
    const k = Math.min(1, left / d)
    g.x += (tx - g.x) * k
    g.z += (tz - g.z) * k
    if (k < 1) break // used up this frame's walk (no tiny leftovers going round forever)
    left -= d
    path.shift()
  }
  return !path.length
}

/** Is the point inside this guard's torch beam, with nothing in the way? */
export function sees(m, g, x, z, range = SEE_RANGE) {
  const d = Math.hypot(x - g.x, z - g.z)
  if (d > range) return false
  if (d > 0.8) {
    let a = Math.atan2(x - g.x, z - g.z) - g.ry
    a = Math.atan2(Math.sin(a), Math.cos(a))
    if (Math.abs(a) > SEE_HALF) return false
  }
  return lineOfSight(m.grid, g.x, g.z, x, z)
}

function say(g, text) {
  g.said = text
  g.saidT = 2.2
}

function backToRoute(m, g) {
  g.state = 'return'
  const p = g.home[g.leg]
  g.path = smooth(m.grid, findPath(m.grid, [g.x, g.z], p)) || [p]
}

/**
 * One frame. player: { x, z, running, moving }.
 * Returns the mission (changed in place); m.events lists what happened this frame.
 */
export function stepMission(m, dt, player) {
  m.events = []
  if (m.over) return m
  m.time -= dt
  if (m.caughtT > 0) m.caughtT -= dt
  if (m.time <= 0) {
    m.time = 0
    m.over = true
    m.events.push({ type: 'dawn' })
    return m
  }
  let best = null
  let bestD = TAKEDOWN
  for (const g of m.guards) {
    if (g.state === 'down') continue
    if (g.saidT > 0) g.saidT -= dt
    const d = Math.hypot(player.x - g.x, player.z - g.z)
    const inBeam = sees(m, g, player.x, player.z)
    // being seen: the ? fills, faster up close and when you run; crouched and still is hardest to see
    if (inBeam && g.state !== 'chase') {
      const near = 1 - d / SEE_RANGE
      g.spot += dt * (0.7 + near * 2.2) * (player.running ? 1.6 : player.moving ? 1 : 0.55) * m.spotMul
      if (g.state === 'patrol' || g.state === 'return') {
        g.state = 'alert'
        g.lookT = 0
      }
      g.lastSeen = [player.x, player.z]
    } else if (g.state !== 'chase') g.spot = Math.max(0, g.spot - dt * 0.35)
    if (g.spot >= 1 && g.state !== 'chase') {
      g.state = 'chase'
      g.spot = 1
      g.lostT = 0
      g.repath = 0
      say(g, 'Hey! Stop there!')
      m.events.push({ type: 'spotted', id: g.id })
    }
    // running close by is heard: he turns to look
    if (!inBeam && player.running && d < HEAR_RUN && (g.state === 'patrol' || g.state === 'return')) {
      g.state = 'alert'
      g.lookT = 0
      g.lastSeen = [player.x, player.z]
      say(g, 'Who is there?')
      m.events.push({ type: 'heard', id: g.id })
    }
    // a sleeping colleague in the beam: he goes to look
    if (g.state === 'patrol')
      for (const o of m.guards)
        if (o.state === 'down' && !o.found && sees(m, g, o.x, o.z, 7)) {
          o.found = true
          g.state = 'search'
          g.spot = Math.max(g.spot, 0.4)
          g.lastSeen = [o.x, o.z]
          g.path = smooth(m.grid, findPath(m.grid, [g.x, g.z], [o.x, o.z])) || []
          g.lookT = 0
          say(g, 'Ah! Who did this?')
          m.events.push({ type: 'body', id: g.id })
        }

    switch (g.state) {
      case 'patrol': {
        if (!g.path?.length) {
          g.path = g.legs[g.leg].slice(1)
          if (!g.path.length) g.path = [g.home[(g.leg + 1) % g.home.length]]
        }
        if (walk(g, g.path, PATROL_SPEED, dt)) {
          g.leg = (g.leg + 1) % g.legs.length
          g.path = null
          g.lookT = 1.2 // a look round at each corner
          g.state = 'pause'
        }
        break
      }
      case 'pause':
        g.lookT -= dt
        turn(g, g.ry + Math.sin(g.lookT * 3) * 0.6, dt, 2)
        if (g.lookT <= 0) g.state = 'patrol'
        break
      case 'alert':
        // stops, faces what he saw or heard; if nothing more, carries on
        turn(g, faceTo(g, g.lastSeen[0], g.lastSeen[1]), dt, 4)
        g.lookT += dt
        if (!inBeam && g.lookT > 2.2) backToRoute(m, g)
        break
      case 'chase': {
        if (inBeam || (d < 2.5 && lineOfSight(m.grid, g.x, g.z, player.x, player.z))) {
          g.lostT = 0
          g.lastSeen = [player.x, player.z]
        } else g.lostT += dt
        g.repath -= dt
        if (g.repath <= 0 || !g.path?.length) {
          g.repath = 0.5
          g.path = smooth(m.grid, findPath(m.grid, [g.x, g.z], g.lastSeen, 3000)) || []
        }
        walk(g, g.path, CHASE_SPEED, dt)
        if (d < CATCH) {
          caught(m)
          return m
        }
        if (g.lostT > LOSE_SIGHT) {
          g.state = 'search'
          g.spot = 0.5
          g.path = smooth(m.grid, findPath(m.grid, [g.x, g.z], g.lastSeen)) || []
          g.lookT = 0
          say(g, 'Where did he go?')
          m.events.push({ type: 'lost', id: g.id })
        }
        break
      }
      case 'search':
        if (walk(g, g.path, PATROL_SPEED * 1.6, dt)) {
          g.lookT += dt
          turn(g, g.ry + 2.2 * dt * 3, dt, 3)
          if (g.lookT > 3) backToRoute(m, g)
        }
        break
      case 'return':
        if (walk(g, g.path, PATROL_SPEED, dt)) {
          g.state = 'patrol'
          g.path = null
        }
        break
      default:
    }
    // close enough, and he isn't after you: a takedown
    if (g.state !== 'chase' && d < bestD && !(inBeam && g.spot > 0.6)) {
      best = g.id
      bestD = d
    }
  }
  m.canTakedown = best
  if (m.open && Math.hypot(player.x - GATE.x, player.z - GATE.z) < GATE_RADIUS) {
    m.over = true
    m.won = true
    m.events.push({ type: 'escaped' })
  }
  return m
}

function caught(m) {
  m.tries--
  m.caughtT = 1.5
  m.events.push({ type: 'caught' })
  if (m.tries <= 0) {
    m.over = true
    return
  }
  // back to the hostel door; the ones still awake go back to their rounds
  for (const g of m.guards) {
    if (g.state === 'down') continue
    g.x = g.home[0][0]
    g.z = g.home[0][1]
    g.leg = 0
    g.path = null
    g.state = 'patrol'
    g.spot = 0
  }
  m.events.push({ type: 'reset' })
}

/** Put the guard next to you to sleep (m.canTakedown). */
export function takedown(m) {
  const g = m.guards.find((x) => x.id === m.canTakedown)
  if (!g || m.over) return null
  g.state = 'down'
  g.spot = 0
  g.said = null
  m.takedowns++
  m.cash += g.cash
  m.canTakedown = null
  m.events.push({ type: 'down', id: g.id })
  if (m.guards.every((x) => x.state === 'down') && !m.open) {
    m.open = true
    m.events.push({ type: 'open' })
  }
  return g
}

export function missionResult(m) {
  return {
    outcome: m.won ? 'won' : 'lost',
    score: m.takedowns * 30 + Math.round(m.cash / 20) + (m.won ? 100 + m.tries * 30 : 0),
    moneyChange: m.cash,
    headline: m.won ? 'Out of the back gate. The night is yours.' : m.tries <= 0 ? 'The porter locks the hostel door.' : 'Dawn. The cleaners are coming out.',
    line: m.won ? `${m.takedowns} guards sleeping till morning, ₦${m.cash.toLocaleString('en-NG')} back from them. (Tomorrow you will say you slept early.)` : `${m.takedowns} guards down before the night ran out. Back to bed.`,
  }
}
