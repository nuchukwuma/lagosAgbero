import { describe, it, expect, beforeEach } from 'vitest'
import { buildSchedule, useFeeRun } from './feeRunStore.js'
import { clearTraffic, spawnVehicle } from '../../systems/traffic.js'

describe('fee run', () => {
  beforeEach(() => clearTraffic())

  it('schedules named drivers and the defaulter late in the run', () => {
    const s = buildSchedule({ duration: 120, vehicles: 14, drivers: ['pastorDriver', 'iyaKeke'], defaulter: 'biodun', defaulterAt: 0.72 })
    expect(s.length).toBe(15)
    expect(s.some((x) => x.driver.id === 'pastorDriver')).toBe(true)
    expect(s.some((x) => x.driver.id === 'iyaKeke' && x.kind === 'keke')).toBe(true)
    const d = s.find((x) => x.driver.defaulter)
    expect(d.driver.id).toBe('biodun')
    expect(d.at).toBeCloseTo(120 * 0.72)
    // times are increasing
    for (let i = 1; i < s.length; i++) expect(s[i].at).toBeGreaterThanOrEqual(s[i - 1].at)
  })

  it('collecting from a defaulter ends the run with "defaulter"', async () => {
    const run = useFeeRun.getState()
    run.start({ duration: 60, vehicles: 1, rememberAs: 'ch1_firstRun' }, { quota: 15000, stopFee: 500 })
    run.begin()
    const v = spawnVehicle({ kind: 'danfo', lane: 'west', tag: { feeRun: true, driver: { name: 'Bíọ́dún', defaulter: true } } })
    v.state = 'stopped'
    useFeeRun.getState().collect(v.id)
    expect(useFeeRun.getState().popup.line).toMatch(/tomorrow/i)
    await new Promise((r) => setTimeout(r, 3400))
    expect(useFeeRun.getState().ended).toBe('defaulter')
    const result = useFeeRun.getState().result()
    expect(result.outcome).toBe('defaulter')
    expect(result.remember).toEqual({ ch1_firstRun: 'poor' })
  })

  it('a missed vehicle is logged and counted', () => {
    const run = useFeeRun.getState()
    run.start({ duration: 60, vehicles: 1 }, { quota: 15000, stopFee: 500 })
    const v = spawnVehicle({ kind: 'taxi', lane: 'west', tag: { feeRun: true, driver: { name: 'Driver Musa' } } })
    useFeeRun.getState().missed(v)
    expect(useFeeRun.getState().counts.missed).toBe(1)
    expect(useFeeRun.getState().log.at(-1).text).toMatch(/Missed/)
  })
})

import { weary, fatigueOf } from './feeRunStore.js'
import { feeFor, driverResponse, insist } from '../../systems/fees.js'

describe('fee runs over a day', () => {
  // what a sensible player takes from one run: pays, and the full fee after insisting
  function yieldOf(schedule, asked0, fee = 500, seed = 7) {
    let s = seed
    const rng = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    let money = 0
    schedule.forEach((slot, i) => {
      const d = weary(slot.driver, fatigueOf(asked0 + i + 1))
      const r = driverResponse(d, feeFor(slot.kind, fee), feeFor(slot.kind, 500), rng)
      if (r.type === 'pay') money += r.amount
      else if (r.type === 'haggle') money += insist(d, rng) === 'pay' ? r.amount : 0
    })
    return money
  }
  const params = { duration: 110, vehicles: 17 }
  const avg = (asked0) => {
    let total = 0
    for (let k = 0; k < 40; k++) {
      let s = 11 + k
      const rng = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
      total += yieldOf(buildSchedule(params, rng), asked0, 500, k + 3)
    }
    return total / 40
  }

  it("a good morning run covers a third of Baba Ticket's share; three runs can meet it", () => {
    const first = avg(0)
    expect(first).toBeGreaterThan(15000 / 3)
    expect(first + avg(17) + avg(34)).toBeGreaterThan(15000)
  })

  it('drivers get harder to collect from as the day goes on', () => {
    expect(avg(0)).toBeGreaterThan(avg(34) * 1.15)
    const d = { tolerance: 1.2, stingy: 0.4 }
    expect(weary(d, 1).tolerance).toBeLessThan(d.tolerance)
    expect(weary(d, 1).stingy).toBeGreaterThan(d.stingy)
    expect(weary(d, 0)).toBe(d)
  })
})
