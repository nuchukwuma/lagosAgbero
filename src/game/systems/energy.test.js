import { describe, it, expect } from 'vitest'
import { consumeItem, dueEffects, drainRate, ITEMS, VENDORS } from './energy.js'

const game = (money) => ({ stats: { money, energy: 30 } })

describe('energy', () => {
  it('running and rain drain faster', () => {
    expect(drainRate({ running: true })).toBeGreaterThan(drainRate())
    expect(drainRate({ raining: true })).toBeGreaterThan(drainRate())
  })

  it('buying a drink costs money, gives energy and schedules a crash', () => {
    const r = consumeItem('agbaraBitters', game(1000), 100)
    expect(r.stats).toEqual({ money: -300, energy: 25, habit: 3 })
    expect(r.effects).toEqual([{ item: 'agbaraBitters', until: 220, crash: 10 }])
  })

  it('healthy food never crashes', () => {
    expect(consumeItem('riceBeans', game(1000), 0).effects).toEqual([])
  })

  it('cannot buy without money', () => {
    expect(consumeItem('redEyeTonic', game(100), 0).error).toMatch(/600/)
  })

  it('crashes land when their time is up', () => {
    const r = dueEffects([{ until: 10, crash: 10 }, { until: 50, crash: 20 }], 30)
    expect(r.crash).toBe(10)
    expect(r.remaining.length).toBe(1)
  })

  it('every vendor sells real items', () => {
    for (const v of Object.values(VENDORS)) for (const id of v.items) expect(ITEMS[id], id).toBeTruthy()
  })
})
