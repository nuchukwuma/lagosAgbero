// Course runs: one engine for the 3D games that are "get down this winding
// way in one piece" (pure logic; CourseScene.jsx draws them):
//   creekRun          Port Harcourt: a speedboat through mangrove creeks, debris, rival boats behind you
//   customsBreakout   Computer Village: a haul truck down the expressway, inspection gates (one lane open), tyre spikes, police cars
//   cartDash          Computer Village: a loaded pushcart through market lanes; corner too fast and crates fall; Task Force and shoppers in the way
//   convoyEscort      Abuja: drive ahead of the VIP convoy and ram the rivals' blockers off the road before the convoy reaches them
//
// The way is a centre line (straights and bends, from a seed) with a width.
// Everything lives in course coordinates: s (metres along) and lat (metres
// across, + to the right). The vehicle steers freely across; the course turns
// under it. Obstacles: { s, lat, r, kind, vs (moving along), hit }.
import { rng } from '../arcade/px.js'

export const COURSES = {
  creekRun: { vehicle: 'boat', length: 900, width: 16, bends: 1.0, top: 22, accel: 7, steer: 7, time: 100, damage: 4, debris: 0.045, pursuers: 2, boosts: 110, surface: 'water', look: 'creek' },
  customsBreakout: { vehicle: 'truck', length: 1100, width: 18, bends: 0.35, top: 24, accel: 4.5, steer: 6, time: 95, damage: 5, spikes: 0.008, gates: 220, police: 0.012, surface: 'road', look: 'highway' },
  cartDash: { vehicle: 'cart', length: 520, width: 7, bends: 1.2, top: 8.5, accel: 3.5, steer: 4, time: 120, crates: 6, tip: 1.6, shoppers: 0.03, taskForce: 140, surface: 'lane', look: 'market' },
  convoyEscort: { vehicle: 'suv', length: 1000, width: 15, bends: 0.6, top: 25, accel: 7, steer: 6, time: 140, convoySpeed: 13, convoyHealth: 3, blockers: 130, boosts: 160, surface: 'road', look: 'avenue' },
}
const STEP = 2 // metres between centre-line samples

/** The centre line: [{ x, z, h (heading), k (curvature) }] every STEP metres. */
export function buildTrack(cfg, seed) {
  const r = rng(seed)
  const pts = []
  let x = 0
  let z = 0
  let h = Math.PI // heading north (-z) to start
  let left = 0
  let k = 0
  for (let s = 0; s <= cfg.length + 60; s += STEP) {
    if (left <= 0) {
      // a new piece: a straight, or a bend this way or that
      const bend = s > 40 && r() < 0.6
      k = bend ? (r() < 0.5 ? -1 : 1) * (0.012 + r() * 0.02) * cfg.bends : 0
      left = 30 + r() * 60
    }
    pts.push({ x, z, h, k })
    h += k * STEP
    x += Math.sin(h) * STEP
    z += Math.cos(h) * STEP
    left -= STEP
  }
  return pts
}

/** Course coordinates to the world: { x, z, h } (h: the way's heading there). */
export function toWorld(track, s, lat) {
  const i = Math.max(0, Math.min(track.length - 2, Math.floor(s / STEP)))
  const a = track[i]
  const b = track[i + 1]
  const t = Math.max(0, Math.min(1, s / STEP - i))
  const x = a.x + (b.x - a.x) * t
  const z = a.z + (b.z - a.z) * t
  const h = a.h + (b.h - a.h) * t
  return { x: x - Math.cos(h) * lat, z: z + Math.sin(h) * lat, h, k: a.k }
}

function place(c, r) {
  const obs = []
  const half = c.width / 2 - 1.2
  const lat = () => (r() * 2 - 1) * half
  for (let s = 60; s < c.length - 30; s += 1) {
    if (c.debris && r() < c.debris) obs.push({ s, lat: lat(), r: 0.9, kind: 'debris' })
    if (c.spikes && r() < c.spikes) obs.push({ s, lat: lat(), r: 1.2, w: 2, kind: 'spikes' })
    if (c.police && r() < c.police) obs.push({ s, lat: lat(), r: 2.2, kind: 'police', vs: 9 + r() * 4 })
    if (c.shoppers && r() < c.shoppers) obs.push({ s, lat: lat(), r: 0.5, kind: 'shopper', vlat: (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.6) })
  }
  // inspection gates: a line of barriers right across, one lane left open
  if (c.gates)
    for (let s = c.gates; s < c.length - 40; s += c.gates) {
      const lanes = 4
      const open = Math.floor(r() * lanes)
      const w = c.width / lanes
      for (let i = 0; i < lanes; i++) if (i !== open) obs.push({ s, lat: -c.width / 2 + w * (i + 0.5), r: 0.6, w: w / 2 - 0.15, kind: 'barrier' })
      obs.push({ s, lat: -c.width / 2 + w * (open + 0.5), r: 0, kind: 'gateOpen', pass: true })
    }
  // the Task Force across the market lane: a gap to squeeze through
  if (c.taskForce)
    for (let s = c.taskForce; s < c.length - 30; s += c.taskForce) {
      const side = r() < 0.5 ? -1 : 1
      obs.push({ s, lat: side * (c.width / 4), r: 0.8, w: c.width / 4, kind: 'taskForce' })
    }
  // boost pads (a ramp of wake, a clear stretch of tarmac): a few seconds faster
  if (c.boosts) for (let s = c.boosts; s < c.length - 40; s += c.boosts) obs.push({ s: s + r() * 30, lat: lat() * 0.7, r: 1.2, kind: 'boost', pickup: true })
  // blockers: they pull out in front of the convoy and stop
  if (c.blockers) for (let s = c.blockers; s < c.length - 40; s += c.blockers) obs.push({ s, lat: lat() * 0.6, r: 2.3, kind: 'blocker', w: 1.2 })
  return obs
}

export function createCourse(id, params = {}) {
  const c = COURSES[id]
  const seed = params.seed ?? 7
  const r = rng(seed * 13 + 5)
  const level = Math.max(0, Math.min(1, params.level ?? 0.4))
  return {
    id,
    c,
    level,
    track: buildTrack(c, seed),
    obstacles: place(c, r),
    p: { s: 4, lat: 0, v: 0, latV: 0 },
    damage: 0,
    crates: c.crates || 0,
    tipT: 0,
    boostT: 0,
    // the chasing boats; the convoy you're escorting
    pursuers: c.pursuers ? Array.from({ length: c.pursuers }, (_, i) => ({ s: -30 - i * 18, lat: (i ? 1 : -1) * 3, v: 0 })) : [],
    convoy: c.convoySpeed ? { s: -25, lat: 0, v: c.convoySpeed * (0.9 + level * 0.25), health: c.convoyHealth, stopT: 0 } : null,
    time: c.time + (params.extraTime || 0),
    over: false,
    won: false,
    why: null,
    rammed: 0,
    events: [],
  }
}

const hits = (a, o, len = 1.6, wid = 1.0) => Math.abs(a.s - o.s) < (o.r || 0.5) + len && Math.abs(a.lat - o.lat) < (o.w ?? o.r ?? 0.5) + wid

/** One frame. input: { steer -1..1 (+ right), gas 0..1, brake 0..1 }. */
export function stepCourse(m, dt, input) {
  m.events = []
  if (m.over) return m
  dt = Math.min(dt, 0.1)
  const c = m.c
  const p = m.p
  m.time -= dt
  // pace: gas, brake, drag
  const top = c.top * (m.boostT > 0 ? 1.25 : 1)
  if (m.boostT > 0) m.boostT -= dt
  if (input.gas) p.v += c.accel * dt
  if (input.brake) p.v -= c.accel * 2.2 * dt
  p.v -= p.v * 0.25 * dt * (input.gas ? 0.3 : 1)
  p.v = Math.max(0, Math.min(top, p.v))
  // across: steering moves you sideways (more at speed); a bend pushes you to its outside if you don't
  const here = toWorld(m.track, p.s, 0)
  const want = (input.steer || 0) * c.steer * Math.min(1, 0.35 + p.v / c.top)
  p.latV += (want - p.latV) * Math.min(1, dt * 6)
  const fling = p.v * p.v * here.k * 0.12 // + curvature (turning left): pushed right
  p.lat += (p.latV + fling) * dt
  // cart: the load leans in a fast corner, and crates fall
  if (c.crates) {
    const lean = Math.abs(p.v * p.v * here.k) + Math.abs(p.latV) * p.v * 0.03
    if (lean > c.tip && m.crates > 0) {
      m.tipT += dt
      if (m.tipT > 0.35) {
        m.tipT = 0
        m.crates--
        m.events.push({ type: 'spill', left: m.crates })
      }
    } else m.tipT = Math.max(0, m.tipT - dt)
  }
  // the banks / kerbs
  const half = c.width / 2 - 1
  if (Math.abs(p.lat) > half) {
    p.lat = Math.sign(p.lat) * half
    p.latV *= -0.3
    if (p.v > c.top * 0.55) {
      hurt(m, 'bank')
      p.v *= 0.6
    }
  }
  p.s += p.v * dt
  // obstacles: some move
  for (const o of m.obstacles) {
    if (o.vs) o.s += o.vs * dt
    if (o.vlat) {
      o.lat += o.vlat * dt
      if (Math.abs(o.lat) > c.width / 2 - 0.6) o.vlat *= -1
    }
    if (o.cool > 0) o.cool -= dt
    if (o.hit || o.pass || o.gone || o.cool > 0 || Math.abs(o.s - p.s) > 6) continue
    if (!hits(p, o, c.vehicle === 'truck' ? 3 : c.vehicle === 'cart' ? 0.9 : 1.6, c.vehicle === 'truck' ? 1.3 : c.vehicle === 'cart' ? 0.7 : 1.0)) continue
    o.hit = true
    if (o.kind === 'boost') {
      m.boostT = 3
      m.events.push({ type: 'boost' })
      continue
    }
    if (o.kind === 'blocker') {
      // ram it: fast enough and it's off the road; slow and you just stop dead
      if (p.v > 9) {
        o.gone = true
        m.rammed++
        p.v *= 0.7
        m.events.push({ type: 'ram' })
      } else {
        o.hit = false
        p.v = 0
        p.s = o.s - o.r - 2
      }
      continue
    }
    if (o.kind === 'shopper' || o.kind === 'taskForce') {
      // you have to stop: they won't move for you
      p.v = 0
      p.s = o.s - (o.r || 0.5) - 1.8
      o.hit = false
      o.cool = 2
      if (o.kind === 'taskForce' && m.crates > 0) {
        m.crates--
        m.events.push({ type: 'seized', left: m.crates })
      } else m.events.push({ type: 'bump' })
      continue
    }
    hurt(m, o.kind)
    p.v *= o.kind === 'spikes' ? 0.45 : o.kind === 'barrier' ? 0.15 : 0.55
  }
  // rival boats: fast, closing in; caught = over
  for (const q of m.pursuers) {
    const gap = p.s - q.s
    const pace = c.top * (0.78 + m.level * 0.14) + (gap > 40 ? 3 : 0)
    q.v += (pace - q.v) * Math.min(1, dt)
    q.s += q.v * dt
    q.lat += Math.sign(p.lat - q.lat) * Math.min(Math.abs(p.lat - q.lat), 2.5 * dt)
    if (gap < 3 && gap > -2 && Math.abs(p.lat - q.lat) < 2.6) return end(m, false, 'caught')
  }
  // the convoy: steady; it stops at a blocker still on the road (and takes a hit)
  const cv = m.convoy
  if (cv) {
    if (cv.stopT > 0) cv.stopT -= dt
    else cv.s += cv.v * dt
    const ahead = m.obstacles.find((o) => o.kind === 'blocker' && !o.gone && !o.bumped && o.s - cv.s < 6 && o.s - cv.s > 0)
    if (ahead) {
      ahead.bumped = true
      ahead.gone = true
      cv.health--
      cv.stopT = 2.5
      m.events.push({ type: 'convoyHit', health: cv.health })
      if (cv.health <= 0) return end(m, false, 'convoy')
    }
    if (cv.s >= c.length) return end(m, true, 'done')
    if (p.s < cv.s - 8) m.events.push({ type: 'behind' })
  }
  if (m.damage >= (c.damage || Infinity)) return end(m, false, 'wrecked')
  if (c.crates && m.crates <= 0) return end(m, false, 'empty')
  if (!cv && p.s >= c.length) return end(m, true, 'done')
  if (m.time <= 0) {
    m.time = 0
    return end(m, false, 'time')
  }
  return m
}

function hurt(m, kind) {
  m.damage++
  m.events.push({ type: 'hit', kind, damage: m.damage })
}

function end(m, won, why) {
  m.over = true
  m.won = won
  m.why = why
  m.events.push({ type: won ? 'won' : 'lost', why })
  return m
}

const TEXT = {
  creekRun: { won: 'Lost them in the mangroves.', line: (m) => `Through the creeks with ${m.c.damage - m.damage} lives left on the boat.`, lost: { caught: 'They boxed you in.', wrecked: 'The skiff is sinking.', time: 'The tide turned.' }, pay: 30000 },
  customsBreakout: { won: 'Through the customs line.', line: (m) => `The container is still yours, and ${m.damage} new dents say how.`, lost: { wrecked: 'The truck is finished.', time: 'They radioed ahead.' }, pay: 40000 },
  cartDash: { won: 'Delivered.', line: (m) => `${m.crates} of ${m.c.crates} crates still on the cart when you reached the shop.`, lost: { empty: 'The cart is empty.', time: 'The shop closed.' }, pay: 12000 },
  convoyEscort: { won: 'The convoy got through.', line: (m) => `${m.rammed} blockers knocked off the road; the convoy arrived with ${m.convoy.health} of ${m.c.convoyHealth} cars in one piece.`, lost: { convoy: 'The convoy is stuck.', time: 'Oga is late. Oga is never late.' }, pay: 35000 },
}

export function courseResult(m) {
  const t = TEXT[m.id]
  const extra = m.id === 'cartDash' ? m.crates * 40 : m.id === 'convoyEscort' ? m.rammed * 60 + (m.convoy?.health || 0) * 80 : (m.c.damage - m.damage) * 50
  return {
    outcome: m.won ? 'won' : 'lost',
    score: Math.round((m.won ? 300 : 0) + Math.min(m.p.s, m.c.length) / 5 + extra + (m.won ? m.time * 2 : 0)),
    moneyChange: m.won ? t.pay : 0,
    headline: m.won ? t.won : t.lost[m.why] || 'Not this time.',
    line: m.won ? t.line(m) : `${Math.round(Math.min(100, (m.p.s / m.c.length) * 100))}% of the way.`,
  }
}
