import { describe, it, expect, beforeEach } from 'vitest'
import { practice, recordPlay, practiceBump, rewardMulFor, resetRecords } from './records.js'

// a tiny localStorage for the node test run
const store = new Map()
globalThis.window = globalThis.window || {}
window.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }

describe('practice: harder the more you play, and better paid', () => {
  beforeEach(() => resetRecords())

  it('counts plays and wins per game', () => {
    recordPlay('akara', true)
    recordPlay('akara', false)
    recordPlay('whot', true)
    expect(practice('akara')).toEqual({ plays: 2, wins: 1 })
    expect(practice('whot')).toEqual({ plays: 1, wins: 1 })
    expect(practice('ayo')).toEqual({ plays: 0, wins: 0 })
  })

  it('makes a game harder with practice, up to a limit', () => {
    expect(practiceBump('fight')).toBe(0)
    recordPlay('fight', false)
    const after1 = practiceBump('fight')
    recordPlay('fight', true)
    expect(practiceBump('fight')).toBeGreaterThan(after1)
    for (let i = 0; i < 50; i++) recordPlay('fight', true)
    expect(practiceBump('fight')).toBeCloseTo(0.35)
  })

  it('pays more later in the story and the more you have won', () => {
    expect(rewardMulFor('penalty', 0)).toBe(1)
    expect(rewardMulFor('penalty', 1)).toBeCloseTo(1.6)
    for (let i = 0; i < 5; i++) recordPlay('penalty', true)
    expect(rewardMulFor('penalty', 0)).toBeCloseTo(1.3)
    for (let i = 0; i < 50; i++) recordPlay('penalty', true)
    expect(rewardMulFor('penalty', 1)).toBeCloseTo(2.2)
  })
})
