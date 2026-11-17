import { describe, it, expect } from 'vitest'
import { lineFor, effectsFor, argueChance, patience, greetingTier, statsFor, REACTIONS } from './reactions.js'
import characters from '../data/characters.json'
import { STAT_DEFS } from '../narrative/stats.js'

describe('street reactions', () => {
  it('speaks in each story\'s own voice, with names filled in', () => {
    const line = lineFor('greetWarm', 'grace', { name: 'Emeka' }, () => 0)
    expect(line).toContain('Emeka')
    expect(lineFor('honk', 'campus', {}, () => 0)).toBe(REACTIONS.lines.honk.campus[0])
    expect(lineFor('nope', 'areaBoy')).toBe('')
  })

  it("maps 'standing' and 'heat' to each story's stats", () => {
    expect(effectsFor('roadFightWon', 'areaBoy')).toEqual({ communityGoodwill: -3, policeHeat: 4 })
    expect(effectsFor('roadFightWon', 'campus')).toEqual({ campusRep: -3, donsHeat: 4 })
    expect(effectsFor('argueWon', 'grace')).toMatchObject({ villageStanding: -2, money: 200 })
  })

  it('only uses stats and characters that exist', () => {
    for (const names of Object.values(REACTIONS.stats)) for (const s of Object.values(names)) expect(STAT_DEFS[s]).toBeTruthy()
    for (const [who, spec] of Object.entries(REACTIONS.greet)) {
      expect(characters[who]).toBeTruthy()
      expect(STAT_DEFS[spec.split(':')[0]]).toBeTruthy()
    }
  })

  it('drivers back down more for a feared player, less for a repeat offender', () => {
    const calm = argueChance({ notoriety: 0 }, 'areaBoy')
    const feared = argueChance({ notoriety: 80 }, 'areaBoy')
    expect(feared).toBeGreaterThan(calm)
    expect(argueChance({ notoriety: 80 }, 'areaBoy', 5)).toBeLessThan(feared)
    expect(patience(3)).toBeLessThan(patience(0))
  })

  it('greets warmly or coldly from your history', () => {
    expect(greetingTier('ada', { friendBond: 80 })).toBe('warm')
    expect(greetingTier('ada', { friendBond: 0 })).toBe(null) // a stranger at the start
    expect(greetingTier('ada', { friendBond: 40 })).toBe(null)
    expect(greetingTier('nneEmeka', { motherBond: 40 })).toBe('cold') // started at 60
    expect(greetingTier('nneEmeka', { motherBond: 90 })).toBe('warm')
    expect(greetingTier('bassey', { policeHeat: 95 })).toBe('cold')
    expect(greetingTier('bassey', { policeHeat: 0 })).toBe(null)
    expect(greetingTier('nobody', {})).toBe(null)
    expect(statsFor('unknown').standing).toBe('communityGoodwill')
  })
})
