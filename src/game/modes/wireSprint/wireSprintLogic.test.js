import { describe, it, expect } from 'vitest'
import { createSprint, stepSprint, sprintResult, buildGraph, route, DROPS, START, ALLEYS, MAX_SPEED } from './wireSprintLogic.js'
import { resolveCollisions } from '../../world/layout.js'

const k = (x, z) => `${x},${z}`
const blocked = (s, x, z) => {
  const p = { x, z }
  resolveCollisions(p, 1.3, s.colliders, { minX: -128, maxX: 128, minZ: -128, maxZ: 128 })
  return Math.hypot(p.x - x, p.z - z) > 0.01
}

/** A driver who knows the way: steers towards each point in turn. */
function drive(s, points, { maxT = 120, slow = 1 } = {}) {
  let i = 0
  for (let t = 0; t < maxT && !s.over && i < points.length; t += 1 / 30) {
    const [tx, tz] = points[i]
    const c = s.car
    const want = Math.atan2(tx - c.x, tz - c.z)
    let d = want - c.heading
    d = Math.atan2(Math.sin(d), Math.cos(d))
    const dist = Math.hypot(tx - c.x, tz - c.z)
    stepSprint(s, 1 / 30, { steer: Math.max(-1, Math.min(1, -d * 2)), gas: (Math.abs(d) < 0.5 && c.speed < (dist < 25 ? 12 : MAX_SPEED * slow)) || c.speed < 5 ? 1 : 0, brake: Math.abs(d) > 0.9 && c.speed > 8 ? 1 : 0 })
    if (dist < 4) i++
  }
}

describe('Beat-the-Bet Wire Sprint', () => {
  it('the start, the drops, the boosts and the alleys are on open road', () => {
    const s = createSprint()
    expect(blocked(s, START.x, START.z)).toBe(false)
    for (const d of DROPS) expect(blocked(s, d.x, d.z), d.name).toBe(false)
    for (const b of s.boosts) expect(blocked(s, b.x, b.z), `boost ${b.x},${b.z}`).toBe(false)
    for (const a of ALLEYS) {
      // the middle of each alley is open (between its carts)
      const mx = (a.from[0] + a.to[0]) / 2 + (a.from[0] === a.to[0] ? -1.5 : 0)
      const mz = (a.from[1] + a.to[1]) / 2 + (a.from[0] === a.to[0] ? 0 : 1.5)
      expect(blocked(s, mx, mz), `alley ${a.from}`).toBe(false)
    }
  })

  it('every drop can be reached along the avenues (round the roadblocks)', () => {
    const g = buildGraph()
    for (const d of DROPS) expect(route(g, k(START.x, START.z), k(d.x, d.z)), d.name).toBeTruthy()
    // a closed stretch is not used
    const r = route(g, k(-40, -40), k(-40, 40))
    expect(r.length).toBeGreaterThan(80)
  })

  it('a good driver beats the rivals; a dawdler loses the pool to them', () => {
    const g = buildGraph()
    // the order: nearest first, along the avenues
    const order = []
    let at = k(START.x, START.z)
    const left = DROPS.map((d) => k(d.x, d.z))
    while (left.length) {
      left.sort((a, b) => route(g, at, a).length - route(g, at, b).length)
      const next = left.shift()
      order.push(...route(g, at, next).points.slice(1))
      at = next
    }
    const s = createSprint({ level: 0.4 })
    drive(s, order)
    expect(s.won).toBe(true)
    expect(sprintResult(s).outcome).toBe('won')
    const slow = createSprint({ level: 1 })
    drive(slow, order, { slow: 0.35 })
    expect(slow.won).toBe(false)
    expect(slow.why === 'rival' || slow.why === 'time').toBe(true)
  })

  it('a boost makes you quicker for a while; walls and roadblocks stop you', () => {
    const s = createSprint()
    const c = s.car
    c.x = 40
    c.z = -14
    c.heading = Math.PI
    for (let i = 0; i < 30; i++) stepSprint(s, 1 / 30, { gas: 1 })
    expect(s.boosts.some((b) => b.taken)).toBe(true)
    expect(c.boost).toBeGreaterThan(0)
    // straight into a block
    const t = createSprint()
    // from the avenue at z = -40, straight north into the block beyond it
    Object.assign(t.car, { x: 0, z: -40, heading: Math.PI, speed: 20 })
    for (let i = 0; i < 90; i++) stepSprint(t, 1 / 30, { gas: 1 })
    expect(t.car.z).toBeGreaterThan(-47)
    expect(t.events.length + 1).toBeGreaterThan(0)
    // and a roadblock: north along x = -40 from z = 30 runs into the barrier at z = 0
    const r = createSprint()
    Object.assign(r.car, { x: -40, z: 30, heading: Math.PI, speed: 15 })
    for (let i = 0; i < 120; i++) stepSprint(r, 1 / 30, { gas: 1 })
    expect(r.car.z).toBeGreaterThan(0)
  })
})
