import { describe, it, expect } from 'vitest'
import { createBattle, phaseAt, tap, advanceTo, battleResult, LANES } from './danceLogic.js'

describe('dance battle (4 lanes)', () => {
  it('the rival dances a phrase first, then it is your turn; each phrase longer', () => {
    const b = createBattle({ rounds: 3, length: 8, seed: 2 })
    expect(b.plan.map((p) => p.beats)).toEqual([8, 12, 16])
    expect(phaseAt(b, b.plan[0].rivalAt + 1).phase).toBe('rival')
    expect(phaseAt(b, b.plan[0].youAt + 1).phase).toBe('you')
    expect(phaseAt(b, b.end + 1).phase).toBe('done')
    for (const n of b.notes) expect(n.lane).toBeGreaterThanOrEqual(0)
    expect(LANES).toHaveLength(4)
  })

  it('later rounds and higher levels have more arrows', () => {
    const easy = createBattle({ seed: 7, level: 0 })
    const hard = createBattle({ seed: 7, level: 1 })
    const yours = (b, round) => b.notes.filter((n) => n.who === 'you' && n.round === round).length
    expect(yours(hard, 2)).toBeGreaterThan(yours(easy, 0))
    expect(hard.notes.filter((n) => n.who === 'you').length).toBeGreaterThan(easy.notes.filter((n) => n.who === 'you').length)
  })

  it('on the beat in the right lane is perfect, a little off is good, the wrong lane is a stray', () => {
    const b = createBattle({ seed: 3 })
    const mine = b.notes.filter((n) => n.who === 'you')
    expect(tap(b, mine[0].beat, mine[0].lane).mark).toBe('perfect')
    const n = mine.find((x) => x.beat > mine[0].beat + 0.9)
    expect(tap(b, n.beat, (n.lane + 1) % 4).mark).toBe('stray')
    expect(tap(b, n.beat + 0.2, n.lane).mark).toBe('good')
    expect(b.combo).toBe(2)
  })

  it('a perfect dancer beats a clumsy rival; standing still loses', () => {
    const b = createBattle({ seed: 4, skill: 0.1 })
    for (const n of b.notes) if (n.who === 'you') tap(b, n.beat, n.lane)
    advanceTo(b, b.end + 1)
    expect(b.over).toBe(true)
    expect(battleResult(b).outcome).toBe('won')
    const c = createBattle({ seed: 5, skill: 0.6 })
    advanceTo(c, c.end + 1)
    expect(c.you).toBe(0)
    expect(c.counts.miss).toBeGreaterThan(0)
    expect(battleResult(c).outcome).toBe('lost')
  })

  it('wider windows (the power-up) turn near misses into hits', () => {
    const b = createBattle({ seed: 9 })
    const lonely = (x) => !b.notes.some((y) => y !== x && y.who === 'you' && y.lane === x.lane && Math.abs(y.beat - x.beat) < 1.2)
    const n = b.notes.find((x) => x.who === 'you' && lonely(x))
    expect(tap(b, n.beat + 0.35, n.lane).mark).toBe('stray')
    expect(tap(b, n.beat + 0.35, n.lane, 1.5).mark).toBe('good')
  })
})
