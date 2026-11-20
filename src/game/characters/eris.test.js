import { describe, it, expect } from 'vitest'
import { ERIS, EXPRESSIONS, expressionFor, drawEris, erisFace } from './eris.js'

describe('Eris template atlas', () => {
  it('has every move the games use, front and side', () => {
    for (const a of ['idle', 'walk', 'run', 'jump', 'attack', 'interact'])
      for (const v of ['front', 'side']) {
        const m = ERIS.anims[`${a}_${v}`]
        expect(m, `${a}_${v}`).toBeTruthy()
        expect(m.frames).toBeGreaterThan(0)
        expect(m.y % ERIS.frame).toBe(0)
      }
    expect(ERIS.anims.run_side.frames).toBe(6)
    expect(ERIS.anims.attack_side.frames).toBe(7)
  })
  it('falls back quietly when the pictures have not loaded (or there is no DOM)', () => {
    expect(drawEris(null, {}, 'run', 0, 0, 0, 1)).toBe(false)
    expect(erisFace({}, 'happy')).toBeNull()
  })
})

describe('expressionFor', () => {
  it('reads the mood first', () => {
    expect(expressionFor('angry', 'Good morning.')).toBe('angry')
    expect(expressionFor('nervous')).toBe('nervous')
    expect(expressionFor('proud')).toBe('happy')
  })
  it('then reads the line', () => {
    expect(expressionFor(null, 'He laughs. "You again?"')).toBe('laughing')
    expect(expressionFor('', 'Ehen! Now we are talking.')).toBe('happy')
    expect(expressionFor('', 'She is crying, tears on the form.')).toBe('sad')
    expect(expressionFor('', 'GET OUT OF MY SHOP!')).toBe('angry')
    expect(expressionFor('', 'You did what?!')).toBe('surprised')
    expect(expressionFor('', 'The bus is at the junction.')).toBe('neutral')
  })
  it('only names expressions it can draw', () => {
    for (const s of ['laughs', 'smiles', 'cries', 'shouts', 'whispers', 'haba', 'quietly', 'x'])
      expect(EXPRESSIONS).toContain(expressionFor('', s))
  })
})
