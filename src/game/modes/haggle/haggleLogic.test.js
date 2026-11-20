import { describe, it, expect } from 'vitest'
import { createHaggle, ask, acceptCounter, current, haggleResult } from './haggleLogic.js'

describe('haggling', () => {
  it('a price at or under the top sells', () => {
    const h = createHaggle({ customers: 1, seed: 3 })
    const top = current(h).top
    expect(ask(h, top).result).toBe('sold')
    expect(h.takings).toBe(top)
    expect(h.over).toBe(true)
  })
  it('too high gets a counter you can take', () => {
    const h = createHaggle({ customers: 1, seed: 4 })
    const top = current(h).top
    const r = ask(h, top * 3)
    if (r.result === 'counter') {
      expect(r.price).toBeLessThanOrEqual(top)
      expect(acceptCounter(h).result).toBe('sold')
    } else expect(r.result).toBe('walked')
  })
  it('push too often and they walk', () => {
    const h = createHaggle({ customers: 1, seed: 5 })
    let r
    for (let i = 0; i < 6 && !h.over; i++) r = ask(h, 999999)
    expect(r.result).toBe('walked')
    expect(haggleResult(h)).toMatchObject({ outcome: 'bad', moneyChange: 0 })
  })
  it('selling to most customers is a good day', () => {
    const h = createHaggle({ customers: 5, seed: 6 })
    while (!h.over) ask(h, current(h).top)
    expect(haggleResult(h).outcome).toBe('good')
    expect(haggleResult(h).moneyChange).toBeGreaterThan(0)
  })
})
