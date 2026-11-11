import { describe, it, expect, beforeEach } from 'vitest'
import { traffic, spawnVehicle, updateTraffic, clearTraffic, releaseVehicle, LANES } from './traffic.js'

const run = (seconds, player = null) => {
  for (let t = 0; t < seconds; t += 0.05) updateTraffic(0.05, player)
}
const front = (v) => v.x + LANES[v.lane].dir * (v.length / 2)

describe('traffic', () => {
  beforeEach(() => clearTraffic())

  it('a danfo stops with its nose at the bus stop and waits', () => {
    const v = spawnVehicle({ kind: 'danfo', lane: 'west', stopAt: { x: 4, wait: null } })
    run(30)
    expect(v.state).toBe('stopped')
    expect(Math.abs(front(v) - 4)).toBeLessThan(0.6)
  })

  it('vehicles queue behind each other without overlapping', () => {
    const a = spawnVehicle({ kind: 'danfo', lane: 'west', stopAt: { x: 4, wait: null } })
    run(4)
    const b = spawnVehicle({ kind: 'danfo', lane: 'west', stopAt: { x: 4, wait: null } })
    run(30)
    const gap = (b.x - a.x) - (a.length + b.length) / 2
    expect(gap).toBeGreaterThan(1.5)
  })

  it('never runs over the player standing in the lane', () => {
    const v = spawnVehicle({ kind: 'taxi', lane: 'east' })
    const player = { x: 0, z: LANES.east.z }
    run(40, player)
    expect(front(v)).toBeLessThan(player.x)
  })

  it('a released vehicle drives off and is removed at the map edge', () => {
    const v = spawnVehicle({ kind: 'danfo', lane: 'west', stopAt: { x: 4, wait: null } })
    run(30)
    releaseVehicle(v, { speedBoost: 1.5 })
    run(40)
    expect(traffic.vehicles.includes(v)).toBe(false)
  })
})
