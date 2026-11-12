import { describe, it, expect } from 'vitest'
import { feeFor, driverResponse, threaten, BASE_FAIR_FEE, pickLine } from './fees.js'

const fixed = (v) => () => v

describe('fees', () => {
  it('scales the fee by vehicle', () => {
    expect(feeFor('danfo', 500)).toBe(500)
    expect(feeFor('keke', 500)).toBe(200)
    expect(feeFor('okada', 500)).toBe(100)
    expect(feeFor('lorry', 500)).toBe(1000)
    expect(feeFor('molue', 500)).toBe(750)
  })

  it('a normal driver pays a fair fee', () => {
    const r = driverResponse({ tolerance: 1.2, stingy: 0.2 }, 500, BASE_FAIR_FEE, fixed(0.9))
    expect(r.type).toBe('pay')
  })

  it('overcharging makes drivers refuse more', () => {
    let refusals = 0
    for (let i = 0; i < 200; i++) if (driverResponse({ tolerance: 1, stingy: 0.5 }, 900, BASE_FAIR_FEE).type === 'refuse') refusals++
    expect(refusals).toBeGreaterThan(150)
  })

  it('haggle offers are less than the fee', () => {
    const r = driverResponse({ tolerance: 1.0, stingy: 1 }, 500, BASE_FAIR_FEE, fixed(0.1))
    expect(r.type).toBe('haggle')
    expect(r.offer).toBeLessThan(500)
  })

  it('notoriety makes threats work better', () => {
    const d = { stingy: 0.5 }
    expect(threaten(d, 0, fixed(0.5))).toBe('refuse')
    expect(threaten(d, 80, fixed(0.5))).toBe('pay')
  })

  it('fills money into driver lines', () => {
    expect(pickLine('haggle', { fee: 500, offer: 300 }, { lines: { haggle: ['₦{fee}? Take ₦{offer}.'] } })).toBe('₦500? Take ₦300.')
  })
})
