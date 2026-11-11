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
