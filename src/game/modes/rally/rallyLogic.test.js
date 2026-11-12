import { describe, it, expect } from 'vitest'
import { createRally, playRound, rallyResult, canUse } from './rallyLogic.js'

describe('rally jobs', () => {
  it('faking every round gets half pay', () => {
    const r = createRally({ job: 'disturb', seed: 3 })
    while (!r.over) playRound(r, 'fake')
    expect(r.over).toBe('faked')
    expect(rallyResult(r).moneyChange).toBe(7500)
  })

  it('steady chanting with crew help gets paid', () => {
    let paid = 0
    for (let seed = 1; seed <= 20; seed++) {
      const r = createRally({ job: 'disturb', seed, help: 4 })
      while (!r.over) playRound(r, r.round % 2 ? 'heckle' : 'chant')
      if (r.over === 'paid') paid++
    }
    expect(paid).toBeGreaterThan(10)
  })

  it('rice runs out', () => {
    const r = createRally({ job: 'crowd', seed: 1 })
    for (let i = 0; i < 3 && !r.over; i++) playRound(r, 'rice')
    expect(canUse(r, 'rice')).toBe(false)
  })

  it('sabotage every round ends in arrest or a brawl', () => {
    const r = createRally({ job: 'disturb', seed: 9 })
    while (!r.over) playRound(r, 'sabotage')
    expect(['arrested', 'brawl']).toContain(r.over)
  })
})
