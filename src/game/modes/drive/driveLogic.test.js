import { describe, it, expect } from 'vitest'
import { createDrive, stepDrive, buyFuel, checkpointChoice, driveResult, placeAt, SHOULDER, LANES } from './driveLogic.js'

const run = (d, input, seconds, dt = 0.05) => {
  for (let t = 0; t < seconds && !d.over; t += dt) stepDrive(d, typeof input === 'function' ? input(d) : input, dt)
  return d
}

describe('danfo driving', () => {
  it('gas makes the bus go and burns fuel', () => {
    const d = createDrive({ seed: 1, police: false })
    d.cars = []
    d.spawnTimer = 999
    run(d, { gas: 1 }, 10)
    expect(d.speed).toBeGreaterThan(10)
    expect(d.d).toBeGreaterThan(80)
    expect(d.fuel).toBeLessThan(55)
  })

  it('steering only works while moving', () => {
    const d = createDrive({ seed: 2, police: false })
    d.spawnTimer = 999
    run(d, { steer: 1 }, 2)
    expect(d.x).toBe(LANES[1])
  })

  it('an empty tank stops the bus and ends the run', () => {
    const d = createDrive({ seed: 3, fuel: 0.5, police: false })
    d.spawnTimer = 999
    run(d, { gas: 1 }, 60)
    expect(d.over).toBe('outOfFuel')
  })

  it('stopping on the shoulder at a bus stop loads passengers and fares', () => {
    const d = createDrive({ seed: 4, police: false })
    d.spawnTimer = 999
    const stop = d.places.find((p) => p.type === 'stop')
    d.d = stop.d
    d.x = SHOULDER
    run(d, {}, 6)
    expect(d.passengers.length).toBeGreaterThan(0)
    expect(d.fares).toBeGreaterThan(0)
    expect(stop.served).toBe(true)
  })

  it('a filling station sells fuel within your money', () => {
    const d = createDrive({ seed: 5, fuel: 20, police: false })
    expect(buyFuel(d, 50, 2400)).toBe(2400)
    expect(d.fuel).toBe(40)
  })

  it('running a checkpoint starts a chase; stopping and paying does not', () => {
    const d = createDrive({ seed: 6, checkpoints: 1 })
    d.spawnTimer = 999
    const cp = d.places.find((p) => p.type === 'checkpoint')
    d.d = cp.d + 11
    d.speed = 15
    stepDrive(d, { gas: 1 }, 0.05)
    expect(d.chase).toBeTruthy()

    const e = createDrive({ seed: 6, checkpoints: 1 })
    const cp2 = e.places.find((p) => p.type === 'checkpoint')
    e.d = cp2.d
    expect(placeAt(e)).toBe(cp2)
    expect(checkpointChoice(e, cp2, 'bribe').cost).toBe(cp2.bribe)
    e.d = cp2.d + 11
    stepDrive(e, {}, 0.05)
    expect(e.chase).toBe(null)
  })

  it('a slow bus gets caught; a fast one escapes', () => {
    const slow = createDrive({ seed: 7 })
    slow.spawnTimer = 999
    slow.chase = { gap: 20, speed: 18, escapeAt: 99999, siren: 0 }
    run(slow, { brake: 1 }, 10)
    expect(slow.over).toBe('caught')

    const fast = createDrive({ seed: 7, police: false })
    fast.spawnTimer = 999
    fast.cars = []
    fast.speed = 21
    fast.chase = { gap: 40, speed: 10, escapeAt: fast.d + 300, siren: 0 }
    run(fast, { gas: 1 }, 25)
    expect(fast.chase).toBe(null)
    expect(fast.escaped).toBe(1)
  })

  it('crashing hard enough wrecks the bus', () => {
    const d = createDrive({ seed: 8, police: false })
    d.spawnTimer = 999
    for (let i = 0; i < 8 && !d.over; i++) {
      d.speed = 20
      d.cars = [{ id: i, kind: 'okada', x: d.x, targetX: d.x, d: d.d + 3, speed: 0, w: 0.8, l: 1.9 }]
      stepDrive(d, { gas: 1 }, 0.02)
    }
    expect(d.over).toBe('wrecked')
  })

  it('wrecking the bus during a chase means abandoning it', () => {
    const d = createDrive({ seed: 8, police: false })
    d.spawnTimer = 999
    d.damage = 99
    d.chase = { gap: 60, speed: 10, escapeAt: 99999, siren: 5 }
    d.speed = 20
    d.cars = [{ id: 1, kind: 'taxi', x: d.x, targetX: d.x, d: d.d + 4, speed: 0, w: 2, l: 4.4 }]
    stepDrive(d, { gas: 1 }, 0.02)
    expect(['abandoned', 'roadRage']).toContain(d.over)
  })

  it('the result pays fares minus fuel, bribes and repairs', () => {
    const d = createDrive({ seed: 9 })
    d.fares = 6000
    d.spent = 1500
    d.damage = 10
    d.over = 'done'
    const r = driveResult(d)
    expect(r.moneyChange).toBe(6000 - 1500 - 600)
    expect(r.flags).toContain('droveRoute')
  })

  it('a careful driver can finish a whole route', () => {
    const d = createDrive({ seed: 11, police: false, length: 900, stops: 2, fuel: 90 })
    // a simple autopilot: keep to the middle lane, horn at cars ahead
    run(d, (s) => {
      const ahead = s.cars.find((c) => Math.abs(c.x - s.x) < 2.2 && c.d > s.d && c.d - s.d < 18)
      return { gas: ahead ? 0.2 : 0.8, brake: ahead && ahead.d - s.d < 9 ? 1 : 0, horn: Boolean(ahead), steer: (LANES[1] - s.x) * 0.5 }
    }, 240)
    expect(d.over).toBe('done')
  })
})
