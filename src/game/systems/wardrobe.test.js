import { describe, it, expect } from 'vitest'
import { styleOf, costOf, feeBonus, earnedNicknames, ownedAfter } from './wardrobe.js'

describe('wardrobe', () => {
  it('the flashiest piece decides the style', () => {
    expect(styleOf({ body: 'male_casual' })).toBe('plain')
    expect(styleOf({ body: 'male_casual', accessories: [{ type: 'chain' }] })).toBe('flashy')
    expect(feeBonus('flashy')).toBeGreaterThan(feeBonus('sharp'))
  })

  it('a missing look is plain, not a crash', () => {
    expect(styleOf(null)).toBe('plain')
    expect(styleOf(undefined)).toBe('plain')
  })

  it('you only pay for new things', () => {
    const before = { body: 'male_casual', accessories: [{ type: 'cap' }] }
    expect(costOf(before, { body: 'male_suit', accessories: [{ type: 'cap' }] })).toBe(15000)
    const owned = ownedAfter({ body: 'male_suit', accessories: [] })
    expect(costOf(before, { body: 'male_suit', accessories: [] }, owned)).toBe(0)
  })

  it('nicknames are earned by story flags', () => {
    const game = { flags: { beatScatter: true }, stats: {}, memory: {} }
    const names = earnedNicknames(game)
    expect(names).toContain('Odogwu')
    expect(names).not.toContain('Shell')
    expect(earnedNicknames(game, ['supporterPack'])).toContain('Supporter')
  })
})
