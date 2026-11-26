import { describe, it, expect } from 'vitest'
import { createTurf, stepTurf, turfResult, me, FLAGS, FLAG_R, OUT_TIME, YARD } from './turfLogic.js'

const run = (t, seconds, input = () => ({})) => {
  for (let i = 0; i < seconds * 30 && !t.over; i++) stepTurf(t, 1 / 30, input(t))
  return t
}
/** keep everybody but me still (and out of the way) */
const freeze = (t) => t.fighters.forEach((f) => !f.me && Object.assign(f, { outT: 999 }))

/** a decent player: to the nearest flag we don't hold, shoving anyone close */
function player(t) {
  const m = me(t)
  const foe = t.fighters.find((o) => o.team === 'them' && o.outT <= 0 && Math.hypot(o.x - m.x, o.z - m.z) < 1.7)
  if (foe) {
    m.face = Math.atan2(foe.x - m.x, foe.z - m.z)
    return { shove: true, mx: 0, mz: 0 }
  }
  const fl = t.flags.filter((f) => f.p < 0.99).sort((a, b) => Math.hypot(a.x - m.x, a.z - m.z) - Math.hypot(b.x - m.x, b.z - m.z))[0] || t.flags[1]
  const dx = fl.x - m.x
  const dz = fl.z - m.z
  const d = Math.hypot(dx, dz) || 1
  return d < 0.8 ? {} : { mx: dx / d, mz: dz / d }
}

describe('Turf Flag Brawl', () => {
  it('stand alone in a ring and your colour goes up; a held flag scores every second', () => {
    const t = createTurf({ seed: 1 })
    freeze(t)
    const m = me(t)
    ;[m.x, m.z] = [FLAGS[1].x, FLAGS[1].z]
    run(t, 4)
    expect(t.flags[1].owner).toBe('you')
    const s = t.score.you
    run(t, 3)
    expect(t.score.you).toBeGreaterThanOrEqual(s + 2)
  })

  it('a flag with both sides in it does not move', () => {
    const t = createTurf({ seed: 1 })
    freeze(t)
    const m = me(t)
    const foe = t.fighters.find((f) => f.team === 'them')
    foe.outT = 0
    foe.ai.aggro = 0
    ;[m.x, m.z] = [FLAGS[0].x, FLAGS[0].z]
    ;[foe.x, foe.z] = [FLAGS[0].x + 1.2, FLAGS[0].z]
    foe.ai.target = { x: foe.x, z: foe.z }
    foe.ai.think = 99
    run(t, 2)
    expect(t.flags[0].contested).toBe(true)
    expect(t.flags[0].p).toBe(0)
    expect(Math.hypot(foe.x - FLAGS[0].x, foe.z - FLAGS[0].z)).toBeLessThan(FLAG_R)
  })

  it('a shove at the edge puts them in the creek; they are back at their end a few seconds later', () => {
    const t = createTurf({ seed: 1 })
    freeze(t)
    const m = me(t)
    const foe = t.fighters.find((f) => f.team === 'them')
    Object.assign(foe, { outT: 0, x: YARD.minX + 1, z: 0 })
    foe.ai.target = { x: foe.x, z: foe.z }
    foe.ai.think = 99
    foe.ai.aggro = 0
    Object.assign(m, { x: YARD.minX + 2.2, z: 0, face: -Math.PI / 2 }) // facing west, at him
    stepTurf(t, 1 / 30, { shove: true })
    expect(t.events.some((e) => e.type === 'shoved' && e.id === foe.id)).toBe(true)
    run(t, 1)
    expect(foe.outT).toBeGreaterThan(0)
    expect(t.stats.dunked).toBe(1)
    let back = false
    for (let i = 0; i < OUT_TIME * 30 + 5 && !back; i++) back = stepTurf(t, 1 / 30, {}).events.some((e) => e.type === 'back' && e.id === foe.id)
    expect(back).toBe(true)
    expect([foe.x, foe.z]).toEqual(foe.home)
  })

  it('stand about and their crew takes the yard; play it and you can win it', () => {
    let lost = 0
    let won = 0
    for (let s = 1; s <= 6; s++) {
      const idle = run(createTurf({ seed: s, level: 0.6 }), 200)
      expect(idle.over).toBe(true)
      if (!idle.won) lost++
      const good = run(createTurf({ seed: s, level: 0.2 }), 200, player)
      if (good.won) won++
      expect(turfResult(good).line).toMatch(/to/)
    }
    expect(lost).toBeGreaterThanOrEqual(5)
    expect(won).toBeGreaterThanOrEqual(4)
  })
})
