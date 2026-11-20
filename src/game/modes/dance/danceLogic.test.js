import { describe, it, expect } from 'vitest'
import { createBattle, phaseAt, tap, advanceTo, battleResult } from './danceLogic.js'

describe('dance battle', () => {
  it('the rival dances first, then it is your turn, each round longer', () => {
    const b = createBattle({ rounds: 3, length: 4, seed: 2 })
    expect(b.plan.map((p) => p.moves.length)).toEqual([4, 5, 6])
    expect(phaseAt(b, b.plan[0].rivalAt).phase).toBe('rival')
    expect(phaseAt(b, b.plan[0].youAt + 1).phase).toBe('you')
    expect(phaseAt(b, b.end + 1).phase).toBe('done')
  })
  it('the right move on the beat is perfect; a wrong move or a late tap misses', () => {
    const b = createBattle({ seed: 3 })
    const p = b.plan[0]
    expect(tap(b, p.youAt, p.moves[0]).mark).toBe('perfect')
    const wrong = ['shaku', 'zanku', 'gwara', 'shoki', 'azonto'].find((m) => m !== p.moves[1])
    expect(tap(b, p.youAt + 1, wrong).mark).toBe('miss')
    expect(tap(b, p.youAt + 2 + 0.3, p.moves[2]).mark).toBe('good')
    expect(tap(b, p.youAt + 1, p.moves[1])).toBe(null) // that beat is gone
  })
  it('a perfect dancer beats a clumsy rival', () => {
    const b = createBattle({ seed: 4, skill: 0.1 })
    for (const p of b.plan) p.moves.forEach((m, i) => tap(b, p.youAt + i, m))
    advanceTo(b, b.end + 1)
    expect(b.over).toBe(true)
    expect(battleResult(b).outcome).toBe('won')
  })
  it('standing still loses', () => {
    const b = createBattle({ seed: 5, skill: 0.6 })
    advanceTo(b, b.end + 1)
    expect(b.you).toBe(0)
    expect(battleResult(b).outcome).toBe('lost')
  })
})
