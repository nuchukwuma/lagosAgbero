// Beat-the-Bet Wire Sprint (the Abuja arc): a race across a Wuse street grid.
// The bet closes when the countdown runs out. Hit the three drop points (a
// bank and two bureaux de change), in any order, before the clock, and before
// either rival bettor's driver has hit all three (then the pool is cleared).
// Pure logic: createSprint, stepSprint, sprintResult. The 3D side is
// WireSprintScene.jsx.
//
// The grid: four avenues each way (x and z = -120, -40, 40, 120), 14 m wide,
// office blocks between. A few blocks have a narrow alley through them: a
// shortcut for you (the rivals keep to the avenues), with carts in the way.
// Police roadblocks close some avenue stretches. Blue arrows on the road give
// a few seconds of boost.
import { resolveCollisions } from '../../world/layout.js'

export const AVENUES = [-120, -40, 40, 120]
export const HALF_ROAD = 7
export const EDGE = 128 // the grid's outer limit
export const CAR_RADIUS = 1.3
export const MAX_SPEED = 28 // m/s, ~100 km/h
export const BOOST = 1.4
const ACCEL = 10
const BRAKE = 20
const DRAG = 0.35
const STEER = 1.8 // rad/s at speed
export const DROP_RADIUS = 7
export const TIME = 90

export const DROPS = [
  { id: 'zone4', name: 'Zone 4 Bureau de Change', x: -40, z: -80 },
  { id: 'maitama', name: 'Maitama bank', x: 120, z: 40 },
  { id: 'garki', name: 'Garki Bureau de Change', x: -80, z: 120 },
]
export const START = { x: 40, z: 40, heading: Math.PI } // facing north (-z)
// avenue stretches the police have closed: [x1, z1, x2, z2] between two crossings
export const ROADBLOCKS = [
  [-40, -40, -40, 40],
  [40, 120, 120, 120],
]
// alleys through blocks: a narrow lane, [x1, z1, x2, z2], with carts
export const ALLEYS = [
  { from: [0, -40], to: [0, 40], carts: [[1.2, -12], [-1.2, 14]] },
  { from: [-120, 80], to: [-40, 80], carts: [[-92, 81], [-66, 79]] },
  { from: [40, -80], to: [120, -80], carts: [[70, -79], [96, -81]] },
]
export const BOOSTS = [
  [40, -20],
  [-20, -40],
  [-120, 20],
  [80, 40],
  [120, -20],
  [-60, 40],
]

const key = (x, z) => `${x},${z}`

/** The colliders: the blocks (cut by alleys), the roadblocks, the alley carts. */
export function buildCity() {
  const boxes = []
  const spans = [] // the stretches between avenues
  for (let i = 0; i < AVENUES.length - 1; i++) spans.push([AVENUES[i] + HALF_ROAD, AVENUES[i + 1] - HALF_ROAD])
  for (const [x1, x2] of spans)
    for (const [z1, z2] of spans) {
      const cx = (x1 + x2) / 2
      const cz = (z1 + z2) / 2
      // an alley runs right through this block?
      const alley = ALLEYS.find((a) =>
        a.from[0] === a.to[0]
          ? a.from[0] > x1 && a.from[0] < x2 && Math.min(a.from[1], a.to[1]) <= z1 && Math.max(a.from[1], a.to[1]) >= z2
          : a.from[1] > z1 && a.from[1] < z2 && Math.min(a.from[0], a.to[0]) <= x1 && Math.max(a.from[0], a.to[0]) >= x2,
      )
      if (!alley) {
        boxes.push({ x: cx, z: cz, hw: (x2 - x1) / 2, hd: (z2 - z1) / 2, angle: 0, block: true })
        continue
      }
      const W = 3 // half the alley's width
      if (alley.from[0] === alley.to[0]) {
        // a north-south alley at x = alley.from[0]
        const ax = alley.from[0]
        boxes.push({ x: (x1 + ax - W) / 2, z: cz, hw: (ax - W - x1) / 2, hd: (z2 - z1) / 2, angle: 0, block: true })
        boxes.push({ x: (ax + W + x2) / 2, z: cz, hw: (x2 - ax - W) / 2, hd: (z2 - z1) / 2, angle: 0, block: true })
      } else {
        const az = alley.from[1]
        boxes.push({ x: cx, z: (z1 + az - W) / 2, hw: (x2 - x1) / 2, hd: (az - W - z1) / 2, angle: 0, block: true })
        boxes.push({ x: cx, z: (az + W + z2) / 2, hw: (x2 - x1) / 2, hd: (z2 - az - W) / 2, angle: 0, block: true })
      }
    }
  for (const a of ALLEYS) for (const [x, z] of a.carts) boxes.push({ x, z, hw: 0.8, hd: 0.8, angle: 0, cart: true })
  // a roadblock: a line of barriers across the middle of the stretch, a van behind
  for (const [x1, z1, x2, z2] of ROADBLOCKS) {
    const mx = (x1 + x2) / 2
    const mz = (z1 + z2) / 2
    const across = x1 === x2 // a north-south stretch: the barrier lies east-west
    boxes.push({ x: mx, z: mz, hw: across ? HALF_ROAD : 0.5, hd: across ? 0.5 : HALF_ROAD, angle: 0, roadblock: true })
  }
  return boxes
}

/** The avenue network for the rivals: crossings and drops as nodes, open stretches as edges. */
export function buildGraph() {
  const nodes = new Map()
  const add = (x, z) => {
    const k = key(x, z)
    if (!nodes.has(k)) nodes.set(k, { k, x, z, edges: [] })
    return nodes.get(k)
  }
  const closed = (a, b) => ROADBLOCKS.some(([x1, z1, x2, z2]) => {
    const minX = Math.min(x1, x2)
    const maxX = Math.max(x1, x2)
    const minZ = Math.min(z1, z2)
    const maxZ = Math.max(z1, z2)
    return a.x >= minX && a.x <= maxX && b.x >= minX && b.x <= maxX && a.z >= minZ && a.z <= maxZ && b.z >= minZ && b.z <= maxZ
  })
  const link = (a, b) => {
    if (closed(a, b)) return
    const d = Math.hypot(a.x - b.x, a.z - b.z)
    a.edges.push({ to: b.k, d })
    b.edges.push({ to: a.k, d })
  }
  // each line: its crossings plus any drop lying on it, in order
  for (const fixed of AVENUES) {
    for (const vertical of [true, false]) {
      const pts = AVENUES.map((v) => (vertical ? [fixed, v] : [v, fixed]))
      for (const d of DROPS) if ((vertical && d.x === fixed) || (!vertical && d.z === fixed)) pts.push([d.x, d.z])
      pts.sort((p, q) => (vertical ? p[1] - q[1] : p[0] - q[0]))
      const ns = pts.map(([x, z]) => add(x, z))
      for (let i = 0; i < ns.length - 1; i++) if (ns[i].k !== ns[i + 1].k) link(ns[i], ns[i + 1])
    }
  }
  return nodes
}

/** Shortest way along the avenues: [[x, z], ...] and its length, or null. */
export function route(graph, from, to) {
  const dist = new Map([[from, 0]])
  const prev = new Map()
  const open = new Set([from])
  while (open.size) {
    let cur = null
    for (const k of open) if (cur === null || dist.get(k) < dist.get(cur)) cur = k
    open.delete(cur)
    if (cur === to) break
    for (const e of graph.get(cur).edges) {
      const nd = dist.get(cur) + e.d
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd)
        prev.set(e.to, cur)
        open.add(e.to)
      }
    }
  }
  if (!dist.has(to)) return null
  const path = []
  for (let k = to; k !== undefined; k = prev.get(k)) path.unshift(k)
  return { points: path.map((k) => [graph.get(k).x, graph.get(k).z]), length: dist.get(to) }
}

/** A rival's whole run: from its start, to every drop (nearest next), as one line of points. */
export function rivalPlan(graph, startKey) {
  let at = startKey
  const left = DROPS.map((d) => key(d.x, d.z))
  const points = [[graph.get(at).x, graph.get(at).z]]
  let length = 0
  const marks = [] // the distance along the plan at which each drop is hit
  while (left.length) {
    let best = null
    for (const k of left) {
      const r = route(graph, at, k)
      if (r && (!best || r.length < best.r.length)) best = { k, r }
    }
    if (!best) break
    points.push(...best.r.points.slice(1))
    length += best.r.length
    marks.push(length)
    left.splice(left.indexOf(best.k), 1)
    at = best.k
  }
  return { points, length, marks }
}

/**
 * A new race. params.level (0..1): faster rivals; params.seed (unused: the
 * grid is the same for everyone, so a duel is fair).
 */
export function createSprint(params = {}) {
  const level = Math.max(0, Math.min(1, params.level ?? 0.4))
  const graph = buildGraph()
  const rivals = [
    { name: 'Alhaji’s driver', start: '-120,-120', color: '#1d1d1f' },
    { name: 'The Lagos boys', start: '120,-120', color: '#f2f2f2' },
  ].map((r) => {
    const plan = rivalPlan(graph, r.start)
    return { ...r, plan, along: 0, x: plan.points[0][0], z: plan.points[0][1], heading: 0, hits: 0, speed: 0, delay: 3 }
  })
  return {
    level,
    colliders: buildCity(),
    car: { x: START.x, z: START.z, heading: START.heading, speed: 0, boost: 0, bumped: 0 },
    drops: DROPS.map((d) => ({ ...d, hit: false })),
    boosts: BOOSTS.map(([x, z]) => ({ x, z, taken: false })),
    rivals,
    rivalTop: 13 + level * 6, // m/s on a straight
    time: TIME + (params.extraTime || 0),
    elapsed: 0,
    over: false,
    won: false,
    why: null,
    events: [],
  }
}

/** Move a rival along its plan, slowing for the corners. */
function stepRival(s, r, dt) {
  if (r.delay > 0) {
    r.delay -= dt
    return
  }
  const pts = r.plan.points
  // which segment are we on, and how far to its corner?
  let acc = 0
  let i = 0
  for (; i < pts.length - 1; i++) {
    const seg = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])
    if (acc + seg >= r.along) break
    acc += seg
  }
  const toCorner = i < pts.length - 1 ? acc + Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) - r.along : 0
  const want = toCorner < 12 ? s.rivalTop * 0.55 : s.rivalTop
  r.speed += Math.sign(want - r.speed) * Math.min(Math.abs(want - r.speed), 6 * dt)
  r.along = Math.min(r.plan.length, r.along + r.speed * dt)
  // place it
  let a = r.along
  for (let j = 0; j < pts.length - 1; j++) {
    const [x1, z1] = pts[j]
    const [x2, z2] = pts[j + 1]
    const seg = Math.hypot(x2 - x1, z2 - z1)
    if (a <= seg || j === pts.length - 2) {
      const t = seg ? Math.min(1, a / seg) : 1
      r.x = x1 + (x2 - x1) * t
      r.z = z1 + (z2 - z1) * t
      if (seg) r.heading = Math.atan2(x2 - x1, z2 - z1)
      break
    }
    a -= seg
  }
  while (r.hits < r.plan.marks.length && r.along >= r.plan.marks[r.hits] - 0.5) {
    r.hits++
    s.events.push({ type: 'rivalDrop', name: r.name, hits: r.hits })
  }
}

/**
 * One frame. input: { steer -1..1 (right +), gas 0..1, brake 0..1 }.
 * Changes s in place; s.events lists this frame's happenings.
 */
export function stepSprint(s, dt, input) {
  s.events = []
  if (s.over) return s
  dt = Math.min(dt, 0.1)
  s.time -= dt
  s.elapsed += dt
  const c = s.car
  // the car: gas, brake (then reverse), drag, steering that needs speed
  const top = MAX_SPEED * (c.boost > 0 ? BOOST : 1)
  if (c.boost > 0) c.boost -= dt
  if (input.gas) c.speed += ACCEL * input.gas * dt * (c.boost > 0 ? 1.5 : 1)
  if (input.brake) c.speed -= (c.speed > 0.5 ? BRAKE : ACCEL * 0.6) * input.brake * dt
  c.speed -= c.speed * DRAG * dt * (input.gas ? 0.4 : 1)
  c.speed = Math.max(-7, Math.min(top, c.speed))
  if (Math.abs(c.speed) < 0.05 && !input.gas) c.speed = 0
  const grip = Math.min(1, Math.abs(c.speed) / 6) * (1 - Math.min(0.35, Math.abs(c.speed) / 120))
  c.heading -= (input.steer || 0) * STEER * grip * Math.sign(c.speed || 1) * dt
  const p = { x: c.x + Math.sin(c.heading) * c.speed * dt, z: c.z + Math.cos(c.heading) * c.speed * dt }
  resolveCollisions(p, CAR_RADIUS, s.colliders, { minX: -EDGE, maxX: EDGE, minZ: -EDGE, maxZ: EDGE })
  const pushed = Math.hypot(p.x - (c.x + Math.sin(c.heading) * c.speed * dt), p.z - (c.z + Math.cos(c.heading) * c.speed * dt))
  if (pushed > 0.02 && Math.abs(c.speed) > 6 && c.bumped <= 0) {
    s.events.push({ type: 'bump', hard: Math.abs(c.speed) > 15 })
    c.speed *= 0.45
    c.bumped = 0.4
  }
  if (c.bumped > 0) c.bumped -= dt
  c.x = p.x
  c.z = p.z
  // boosts, drops
  for (const b of s.boosts)
    if (!b.taken && Math.hypot(b.x - c.x, b.z - c.z) < 3.5) {
      b.taken = true
      c.boost = 3.5
      s.events.push({ type: 'boost' })
    }
  for (const d of s.drops)
    if (!d.hit && Math.hypot(d.x - c.x, d.z - c.z) < DROP_RADIUS) {
      d.hit = true
      s.events.push({ type: 'drop', name: d.name, left: s.drops.filter((x) => !x.hit).length })
    }
  for (const r of s.rivals) stepRival(s, r, dt)
  if (s.drops.every((d) => d.hit)) {
    s.over = true
    s.won = true
    s.why = 'done'
    s.events.push({ type: 'won' })
  } else if (s.rivals.some((r) => r.hits >= DROPS.length)) {
    s.over = true
    s.why = 'rival'
    s.events.push({ type: 'lost', why: 'rival' })
  } else if (s.time <= 0) {
    s.time = 0
    s.over = true
    s.why = 'time'
    s.events.push({ type: 'lost', why: 'time' })
  }
  return s
}

export function sprintResult(s) {
  const hit = s.drops.filter((d) => d.hit).length
  const winner = s.rivals.find((r) => r.hits >= DROPS.length)
  return {
    outcome: s.won ? 'won' : 'lost',
    score: hit * 150 + (s.won ? 300 + Math.round(s.time) * 5 : 0),
    moneyChange: s.won ? 25000 + Math.round(s.time) * 200 : 0,
    headline: s.won ? 'Beat the bet.' : s.why === 'rival' ? `${winner?.name || 'A rival'} cleared the pool.` : 'The bet closed.',
    line: s.won
      ? `All three drops with ${Math.round(s.time)} seconds on the clock. The pool is yours, and Wuse is talking.`
      : `${hit} of ${DROPS.length} drops made. Somebody else is buying the suya tonight.`,
  }
}
