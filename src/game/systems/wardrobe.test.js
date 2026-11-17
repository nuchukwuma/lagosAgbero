import { describe, it, expect } from 'vitest'
import { styleOf, costOf, feeBonus, earnedNicknames, ownedAfter } from './wardrobe.js'

describe('wardrobe', () => {
  it('the flashiest piece decides the style', () => {
    expect(styleOf({ body: 'mini_male_f' })).toBe('plain')
    expect(styleOf({ body: 'mini_male_f', accessories: [{ type: 'chain' }] })).toBe('flashy')
    expect(styleOf({ body: 'male_suit' })).toBe('flashy') // an old save's suit is the new suit
    expect(feeBonus('flashy')).toBeGreaterThan(feeBonus('sharp'))
  })

  it('a missing look is plain, not a crash', () => {
    expect(styleOf(null)).toBe('plain')
    expect(styleOf(undefined)).toBe('plain')
  })

  it('you only pay for new things', () => {
    const before = { body: 'mini_male_f', accessories: [{ type: 'cap' }] }
    expect(costOf(before, { body: 'mini_male_d', accessories: [{ type: 'cap' }] })).toBe(15000)
    const owned = ownedAfter({ body: 'mini_male_d', accessories: [] })
    expect(costOf(before, { body: 'mini_male_d', accessories: [] }, owned)).toBe(0)
    // a suit bought in an older save is still yours
    expect(costOf(before, { body: 'mini_male_d', accessories: [] }, ['outfit:male_suit'])).toBe(0)
  })

  it('nicknames are earned by story flags', () => {
    const game = { flags: { beatScatter: true }, stats: {}, memory: {} }
    const names = earnedNicknames(game)
    expect(names).toContain('Odogwu')
    expect(names).not.toContain('Shell')
    expect(earnedNicknames(game, ['supporterPack'])).toContain('Supporter')
  })
})
