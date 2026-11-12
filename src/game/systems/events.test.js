import { describe, it, expect } from 'vitest'
import { pickEvent, eligibleEvents, eventChance } from './events.js'
import { phaseOf, parseTime, formatClock } from './clock.js'

const state = (over = {}) => ({ stats: { notoriety: 0, ...(over.stats || {}) }, flags: over.flags || {}, memory: {} })

describe('random events', () => {
  it('notoriety makes events more likely', () => {
    expect(eventChance(60)).toBeGreaterThan(eventChance(0))
  })

  it('big events need notoriety', () => {
    expect(eligibleEvents(state()).some((e) => e.id === 'wrongBigMan')).toBe(false)
    expect(eligibleEvents(state({ stats: { notoriety: 20 } })).some((e) => e.id === 'wrongBigMan')).toBe(true)
  })

  it('rain can only start when dry and stop when raining', () => {
    expect(eligibleEvents(state()).some((e) => e.id === 'rainStop')).toBe(false)
    expect(eligibleEvents(state({ flags: { raining: true } })).some((e) => e.id === 'rainStart')).toBe(false)
  })

  it('"once" events never repeat', () => {
    expect(eligibleEvents(state({ flags: { event_sickChild: true } })).some((e) => e.id === 'sickChild')).toBe(false)
  })

  it('a roll above the chance gives nothing', () => {
    expect(pickEvent(state(), () => 0.99)).toBe(null)
  })
})

describe('clock', () => {
  it('phases and parsing', () => {
    expect(phaseOf(parseTime('06:30'))).toBe('dawn')
    expect(phaseOf(parseTime('day'))).toBe('day')
    expect(phaseOf(parseTime('18:00'))).toBe('dusk')
    expect(phaseOf(parseTime('23:10'))).toBe('night')
    expect(formatClock(parseTime('21:05'))).toBe('9:05 p.m.')
  })
})
