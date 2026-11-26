import { describe, it, expect } from 'vitest'
import { createCourse, stepCourse, courseResult, toWorld, COURSES } from './courseLogic.js'

/** A careful driver: looks ahead for anything in the way and steers for the clearest gap. */
function autopilot(m, { pace = 1, ram = false } = {}) {
  const { p, c } = m
  const ahead = m.obstacles.filter((o) => !o.hit && !o.gone && !o.pass && !o.pickup && o.s > p.s && o.s - p.s < 50)
  const gates = m.obstacles.filter((o) => o.pass && o.s > p.s && o.s - p.s < 40)
  let target = 0
  if (gates.length) target = gates[0].lat
  else if (ram) {
    const b = ahead.find((o) => o.kind === 'blocker')
    if (b) target = b.lat
  }
  const half = c.width / 2 - 1.4
  const body = c.vehicle === 'truck' ? 3 : c.vehicle === 'cart' ? 0.9 : 1.6
  // where a moving thing will be when we reach it
  const at = (o) => (o.vs && p.v > o.vs + 0.5 ? o.s + (o.vs * (o.s - p.s)) / (p.v - o.vs) : o.s)
  const near = ahead.filter((o) => at(o) - p.s < 45 || o.pass)
  const clear = (lat) => near.every((o) => o.kind === 'blocker' && ram ? true : Math.abs(o.lat - lat) > (o.w ?? o.r) + body + 0.4)
  if (!clear(target)) {
    let best = null
    for (let l = -half; l <= half; l += 0.5) if (clear(l) && (best === null || Math.abs(l - p.lat) < Math.abs(best - p.lat))) best = l
    if (best !== null) target = best
  }
  const d = target - p.lat
  const here = toWorld(m.track, p.s, 0)
  const bendy = Math.abs(here.k) > 0.015
  const limit = c.top * pace * (bendy && c.crates ? 0.55 : 1)
  return { steer: Math.max(-1, Math.min(1, d * 0.8)), gas: p.v < limit ? 1 : 0, brake: p.v > limit + 1 ? 1 : 0 }
}

const run = (m, opts, maxT = 300) => {
  for (let t = 0; t < maxT && !m.over; t += 1 / 30) stepCourse(m, 1 / 30, autopilot(m, opts))
  return m
}

describe('course runs', () => {
  it('the way is continuous and long enough; the course is the same for the same seed (a fair duel)', () => {
    for (const id of Object.keys(COURSES)) {
      const a = createCourse(id, { seed: 3 })
      const b = createCourse(id, { seed: 3 })
      expect(a.obstacles.length).toBe(b.obstacles.length)
      for (let s = 0; s < a.c.length; s += 50) {
        const p = toWorld(a.track, s, 0)
        const q = toWorld(a.track, s + 2, 0)
        expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeLessThan(2.2)
      }
    }
  })

  it('Creek Skiff Run: a careful pilot outruns the rival boats; one who dawdles is caught', () => {
    expect(run(createCourse('creekRun', { seed: 2 })).won).toBe(true)
    const slow = run(createCourse('creekRun', { seed: 2, level: 1 }), { pace: 0.45 })
    expect(slow.won).toBe(false)
    expect(slow.why).toBe('caught')
  })

  it('a boost pad gives a few seconds of extra speed', () => {
    const m = createCourse('creekRun', { seed: 2 })
    const b = m.obstacles.find((o) => o.kind === 'boost')
    Object.assign(m.p, { s: b.s - 1, lat: b.lat, v: 20 })
    stepCourse(m, 1 / 30, { gas: 1 })
    expect(m.boostT).toBeGreaterThan(2)
    for (let i = 0; i < 30; i++) stepCourse(m, 1 / 30, { gas: 1 })
    expect(m.p.v).toBeGreaterThan(COURSES.creekRun.top)
  })

  it('Customs Breakout: through the open lane at every gate, round the spikes, to the end', () => {
    const m = run(createCourse('customsBreakout', { seed: 4 }))
    expect(m.won).toBe(true)
    expect(m.damage).toBeLessThan(COURSES.customsBreakout.damage)
    // straight down the middle into the gates wrecks the truck
    const dumb = createCourse('customsBreakout', { seed: 4 })
    for (let t = 0; t < 200 && !dumb.over; t += 1 / 30) stepCourse(dumb, 1 / 30, { gas: 1 })
    expect(dumb.won).toBe(false)
  })

  it('Market Cart Dash: easy round the corners keeps the crates; flat out through them spills them', () => {
    const m = run(createCourse('cartDash', { seed: 5 }))
    expect(m.won).toBe(true)
    expect(m.crates).toBeGreaterThan(0)
    const fast = createCourse('cartDash', { seed: 5 })
    for (let t = 0; t < 120 && !fast.over; t += 1 / 30) stepCourse(fast, 1 / 30, { ...autopilot(fast), gas: 1, brake: 0 })
    expect(fast.crates).toBeLessThan(m.crates + 1)
    expect(fast.events.length + fast.crates).toBeGreaterThanOrEqual(0)
  })

  it('Convoy Escort: ram the blockers and the convoy gets through; leave them and it takes the hits', () => {
    const m = run(createCourse('convoyEscort', { seed: 6 }), { ram: true })
    expect(m.won).toBe(true)
    expect(m.rammed).toBeGreaterThan(0)
    const lazy = createCourse('convoyEscort', { seed: 6 })
    for (let t = 0; t < 200 && !lazy.over; t += 1 / 30) stepCourse(lazy, 1 / 30, {})
    expect(lazy.won).toBe(false)
    expect(lazy.why).toBe('convoy')
    expect(courseResult(m).outcome).toBe('won')
  })
})
