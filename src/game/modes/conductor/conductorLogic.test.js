import { describe, it, expect } from 'vitest'
import { createTrip, dropOff, callRoute, paymentFor, changeOptions, settleFare, nextStop, conductorPay, isLastStop } from './conductorLogic.js'

function perfectTrip(seed) {
  const t = createTrip({ seed, named: ['mamaPepper'] })
  while (!t.over) {
    dropOff(t, t.passengers.filter((p) => p.dest === t.stopIndex).map((p) => p.id))
    if (!isLastStop(t)) {
      for (const p of callRoute(t, true)) {
        const given = paymentFor(t, p)
        settleFare(t, p, given, given - t.route.fare)
      }
    }
    nextStop(t)
  }
  return t
}

describe('conductor', () => {
  it('a perfect conductor finishes calm and paid', () => {
    const t = perfectTrip(5)
    expect(t.over).toBe('done')
    expect(t.anger).toBe(0)
    expect(conductorPay(t)).toBeGreaterThan(0)
  })

  it('change options always include the right change', () => {
    const t = createTrip({ seed: 3 })
    for (const given of [500, 1000]) expect(changeOptions(t, given)).toContain(given - t.route.fare)
  })

  it('short-changing makes the bus angry; forgetting stops makes it angrier', () => {
    const t = createTrip({ seed: 9 })
    const [p] = callRoute(t, true)
    settleFare(t, p, 1000, 500)
    expect(t.anger).toBeGreaterThan(0)
    const before = t.anger
    nextStop(t)
    t.passengers.forEach((x) => (x.dest = t.stopIndex))
    dropOff(t, [])
    expect(t.anger).toBeGreaterThan(before)
  })

  it('a furious bus ends in a brawl', () => {
    const t = createTrip({ seed: 2 })
    t.anger = 100
    expect(nextStop(t)).toBe('brawl')
  })
})
