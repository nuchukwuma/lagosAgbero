import { describe, it, expect } from 'vitest'
import { createBegRun, approach, currentTarget, begResult, BEG } from './beggingLogic.js'

const best = (kind) => Object.entries(BEG.targets[kind].pay).sort((a, b) => b[1] - a[1])[0][0]

describe('begging', () => {
  it('reading each target right pays and keeps the estate calm', () => {
    const r = createBegRun({ seed: 4, count: 6 })
    while (!r.over) {
      const t = currentTarget(r)
      approach(r, t.kind === 'security' ? 'skip' : best(t.kind))
    }
    expect(r.over).toBe('done')
    expect(r.collected).toBeGreaterThan(0)
    expect(r.anger).toBeLessThan(100)
  })

  it('begging from the wrong person ends the run', () => {
    const r = createBegRun({ seed: 2, wrongPerson: 'nephew', wrongAt: 1 })
    approach(r, 'skip')
    expect(currentTarget(r).wrong).toBe(true)
    approach(r, 'praise')
    expect(r.over).toBe('wrongPerson')
    expect(begResult(r).outcome).toBe('wrongPerson')
  })

  it('letting the wrong person pass is safe', () => {
    const r = createBegRun({ seed: 2, wrongPerson: 'bassey', wrongAt: 0 })
    expect(approach(r, 'skip').outcome).toBe('dodged')
    expect(r.over).toBe(null)
  })

  it('blocking every car gets you chased out', () => {
    const r = createBegRun({ seed: 7, count: 20 })
    while (!r.over) approach(r, 'block')
    expect(r.over).toBe('chased')
  })
})
