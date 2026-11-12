import { describe, it, expect } from 'vitest'
import { createRun, stepRun, makeCourse, LANES } from './runnerLogic.js'

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
})
