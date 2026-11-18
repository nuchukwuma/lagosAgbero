import { describe, it, expect } from 'vitest'
import { tunedActivity, recordRun, heatOf, COOL_MINUTES, MAX_HOT_RUNS } from './heat.js'

const gauntlet = { id: 'gauntlet', mode: 'runner', params: { endless: true, difficulty: 1 } }
const game = (over = {}) => ({ stats: { day: 1, notoriety: 0 }, time: 8 * 60, ...over })

describe('the Gauntlet heats up', () => {
  it('each run soon after the last is harder; it cools with time', () => {
    let g = game()
    const d0 = tunedActivity(g, gauntlet).params.difficulty
    g = recordRun(g, 'gauntlet')
    const d1 = tunedActivity(g, gauntlet).params.difficulty
    g = recordRun(g, 'gauntlet')
    const d2 = tunedActivity(g, gauntlet).params.difficulty
    expect(d1).toBeGreaterThan(d0)
    expect(d2).toBeGreaterThan(d1)
    const later = { ...g, time: g.time + COOL_MINUTES + 1 }
    expect(heatOf(later, 'gauntlet')).toBe(0)
    expect(tunedActivity(later, gauntlet).params.difficulty).toBe(d0)
  })

  it('too many runs and they stake out the bridge', () => {
    let g = game()
    for (let i = 0; i < MAX_HOT_RUNS; i++) g = recordRun(g, 'gauntlet')
    expect(tunedActivity(g, gauntlet).blocked).toMatch(/Come back/)
  })

  it('notoriety makes it harder whatever the heat', () => {
    expect(tunedActivity(game({ stats: { day: 1, notoriety: 80 } }), gauntlet).params.difficulty).toBeGreaterThan(tunedActivity(game(), gauntlet).params.difficulty)
  })
})
