import { describe, it, expect } from 'vitest'
import { createBluff, optionsFor, answerBluff, bluffResult, ledgerFromMemory, SCENARIOS } from './bluffLogic.js'

const pick = (b, test) => optionsFor(b).find(test)

describe('bluff', () => {
  it('confident lies convince, and the lies are remembered', () => {
    const b = createBluff('orientation')
    for (let i = 0; i < 5; i++) answerBluff(b, pick(b, (o) => !o.truth && !o.deflect))
    expect(b.over).toBe('convinced')
    const r = bluffResult(b)
    expect(r.remember.lie_home).toBe('lekki')
    expect(r.stats.cover).toBeGreaterThan(0)
  })

  it('telling the core truth ends the bluff as a confession', () => {
    const b = createBluff('orientation')
    answerBluff(b, pick(b, (o) => o.truth))
    expect(b.over).toBe('confessed')
  })

  it('a later scene remembers the earlier lie: sticking to it calms, changing it is a contradiction', () => {
    const ledger = ledgerFromMemory({ lie_home: 'lekki', lie_dad: 'oil', other: 1 })
    const a = createBluff('dinner', ledger)
    const stick = optionsFor(a)[0]
    expect(stick.stick).toBe(true)
    expect(answerBluff(a, stick).event).toBe('consistent')

    const c = createBluff('dinner', ledger)
    const r = answerBluff(c, pick(c, (o) => o.says?.home === 'ikoyi'))
    expect(r.event).toBe('contradiction')
    expect(c.suspicion).toBeGreaterThan(50)
  })

  it('hesitating and too many jokes raise suspicion', () => {
    const b = createBluff('orientation')
    answerBluff(b, pick(b, (o) => !o.truth))
    const before = b.suspicion
    answerBluff(b, null)
    expect(b.suspicion).toBe(before + 18)
  })

  it('enough contradictions get you caught', () => {
    const b = createBluff('dinner', { home: 'ikoyi', dad: 'consultant', dadCo: 'private', church: 'cathedral' })
    for (let i = 0; i < 4 && !b.over; i++) answerBluff(b, pick(b, (o) => !o.stick && !o.truth && !o.deflect))
    expect(['caught', 'doubted']).toContain(b.over)
    expect(b.suspicion).toBeGreaterThan(55)
  })

  it('every scenario is playable', () => {
    for (const id of Object.keys(SCENARIOS)) {
      const b = createBluff(id)
      while (!b.over) answerBluff(b, optionsFor(b).find((o) => !o.core) || optionsFor(b)[0])
      expect(['convinced', 'doubted', 'caught', 'confessed']).toContain(b.over)
    }
  })
})
