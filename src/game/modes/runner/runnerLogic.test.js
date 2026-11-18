import { describe, it, expect } from 'vitest'
import { createRun, stepRun, makeCourse, makeTraffic, LANES, CLOSE_TIME } from './runnerLogic.js'

describe('runner', () => {
  it('every row of obstacles leaves a lane free', () => {
    const items = makeCourse(600, 7, 1.3)
    const rows = new Map()
    for (const it of items) if (it.kind !== 'note') rows.set(it.d, [...(rows.get(it.d) || []), it.lane])
    for (const lanes of rows.values()) expect(lanes.length).toBeLessThan(LANES.length)
  })

  it('a perfect runner escapes', () => {
    const r = createRun({ goal: 200, seed: 3 })
    for (let i = 0; i < 4000 && !r.over; i++) {
      // look ahead: dodge into the free lane, jump/slide as needed
      const next = r.items.filter((it) => !it.done && it.d > r.distance && it.d < r.distance + 6 && it.kind !== 'note')
      const here = next.find((it) => it.lane === r.lane)
      const input = {}
      if (here) {
        const blocked = new Set(next.filter((it) => Math.abs(it.d - here.d) < 0.1).map((it) => it.lane))
        const free = LANES.find((l) => !blocked.has(l))
        if (free != null && free < r.lane) input.left = true
        else if (free != null && free > r.lane) input.right = true
        else if (here.kind === 'low') input.jump = here.d - r.distance < 3
        else if (here.kind === 'high') input.slide = here.d - r.distance < 3
      }
      stepRun(r, input, 1 / 30)
    }
    expect(r.over).toBe('escaped')
  })

  it('running into everything gets you caught', () => {
    const r = createRun({ goal: 400, seed: 3 })
    for (let i = 0; i < 6000 && !r.over; i++) {
      const next = r.items.find((it) => !it.done && it.kind !== 'note' && it.d > r.distance)
      if (next && Math.round(r.laneX) !== next.lane) stepRun(r, next.lane < r.lane ? { left: true } : { right: true }, 1 / 30)
      else stepRun(r, {}, 1 / 30)
    }
    expect(r.over).toBe('caught')
  })

  it('a jump is an arc: too late and the carton still gets you', () => {
    const r = createRun({ goal: 200, seed: 3 })
    r.items = [{ d: 20, lane: 0, kind: 'low' }]
    r.speed = 10
    while (r.distance < 19.6) stepRun(r, {}, 1 / 60) // jump with no time to rise
    stepRun(r, { jump: true }, 1 / 60)
    for (let i = 0; i < 30; i++) stepRun(r, {}, 1 / 60)
    expect(r.hits).toBe(1)
    const ok = createRun({ goal: 200, seed: 3 })
    ok.items = [{ d: 20, lane: 0, kind: 'low' }]
    ok.speed = 10
    while (ok.distance < 17.5) stepRun(ok, {}, 1 / 60)
    stepRun(ok, { jump: true }, 1 / 60)
    for (let i = 0; i < 60; i++) stepRun(ok, {}, 1 / 60)
    expect(ok.hits).toBe(0)
    expect(ok.y).toBe(0) // landed
  })

  it('sliding in the air drops you straight down', () => {
    const r = createRun({ goal: 200, seed: 3 })
    r.items = []
    stepRun(r, { jump: true }, 1 / 60)
    for (let i = 0; i < 8; i++) stepRun(r, {}, 1 / 60)
    const high = r.y
    stepRun(r, { slide: true }, 1 / 60)
    for (let i = 0; i < 6 && r.y > 0; i++) stepRun(r, {}, 1 / 60)
    expect(high).toBeGreaterThan(0.5)
    expect(r.y).toBe(0)
  })

  it('an endless run keeps building road and never finishes on its own', () => {
    const r = createRun({ endless: true, seed: 5 })
    r.maxHits = Infinity
    for (let i = 0; i < 60 * 120 && !r.over; i++) {
      stepRun(r, {}, 1 / 60)
      r.pursuer = 18 // keep the chasers off for the test
    }
    expect(r.over).toBe(null)
    expect(r.distance).toBeGreaterThan(1500)
    expect(r.items.some((it) => it.d > r.distance)).toBe(true) // road ahead
    expect(r.items.every((it) => it.d > r.distance - 400)).toBe(true) // old rows dropped
    expect(r.speed).toBeGreaterThan(18)
  })

  it('oncoming cars come in the gaps between obstacles and leave a lane free', () => {
    const course = makeCourse(2000, 11, 1.4)
    const cars = makeTraffic(course, 11, 1.4)
    expect(cars.length).toBeGreaterThan(5)
    const meets = new Map()
    for (const c of cars) meets.set(c.meet, (meets.get(c.meet) || 0) + 1)
    for (const [meet, n] of meets) {
      expect(n).toBeLessThan(LANES.length)
      expect(course.some((it) => it.kind !== 'note' && Math.abs(it.d - meet) < 5)).toBe(false)
    }
  })

  it('a car in your lane knocks you down and brings them to your back; a side-step saves you', () => {
    const run = (dodge) => {
      const r = createRun({ goal: 400, seed: 3 })
      r.items = [{ d: 60, meet: 60, lane: 0, kind: 'car', model: 'danfo', v: 9, active: false }]
      let honked = false
      for (let i = 0; i < 60 * 8 && r.distance < 80; i++) {
        stepRun(r, dodge && r.items[0].active && r.items[0].d - r.distance < 14 && r.lane === 0 ? { left: true } : {}, 1 / 60)
        honked ||= r.events.some((e) => e.type === 'horn')
        if (r.hits) break
      }
      return { r, honked }
    }
    const hitRun = run(false)
    expect(hitRun.honked).toBe(true)
    expect(hitRun.r.hits).toBe(1)
    expect(hitRun.r.closeT).toBeGreaterThan(CLOSE_TIME - 0.1)
    expect(run(true).r.hits).toBe(0)
  })
})
