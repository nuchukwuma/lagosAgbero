import { describe, it, expect } from 'vitest'
import { getLayout } from '../../world/worlds.js'
import { createMission, stepMission, takedown, grabLoot, missionResult, walkable, findPath, lineOfSight, sees, START, GATE, ROUTES, TAKEDOWN, MISSIONS, carrySpeed } from './stealthLogic.js'

const layout = getLayout('royalCrest', false)
const still = (x, z) => ({ x, z, running: false, moving: false })

describe('Back Gate (3D): the campus at night', () => {
  it('the start, the gate and every patrol point are on open ground, all joined up', () => {
    const m = createMission(layout, { level: 1 }, 3)
    expect(walkable(m.grid, START.x, START.z)).toBe(true)
    expect(walkable(m.grid, GATE.x, GATE.z)).toBe(true)
    expect(findPath(m.grid, [START.x, START.z], [GATE.x, GATE.z])).toBeTruthy()
    expect(m.guards).toHaveLength(ROUTES.length)
    for (const g of m.guards) {
      for (const leg of g.legs) expect(leg.length).toBeGreaterThan(0)
      expect(findPath(m.grid, [START.x, START.z], g.home[0])).toBeTruthy()
    }
  })

  it('easier nights have fewer guards', () => {
    expect(createMission(layout, { level: 0 }, 1).guards).toHaveLength(4)
    expect(createMission(layout, { level: 1 }, 1).guards).toHaveLength(6)
  })

  it('a container blocks a guard’s sight', () => {
    const m = createMission(layout, {}, 1)
    const c = m.cover.find((b) => b.model.startsWith('shippingContainer'))
    // either side of the container, along its short side
    expect(lineOfSight(m.grid, c.x - 6, c.z, c.x + 6, c.z) && lineOfSight(m.grid, c.x, c.z - 6, c.x, c.z + 6)).toBe(false)
  })

  it('walk into a torch beam and the guard comes for you; stay there and he catches you', () => {
    const m = createMission(layout, { level: 0 }, 1)
    const g = m.guards[0]
    g.ry = 0 // facing +z
    const me = still(g.x, g.z + 4)
    expect(sees(m, g, me.x, me.z)).toBe(true)
    let spotted = false
    for (let i = 0; i < 400 && m.tries === 3; i++) {
      stepMission(m, 1 / 30, me)
      if (m.events.some((e) => e.type === 'spotted')) spotted = true
    }
    expect(spotted).toBe(true)
    expect(m.tries).toBe(2)
    expect(g.state).toBe('patrol') // back on his rounds after the catch
  })

  it('from behind, unseen, you put a guard to sleep and take his money; all down opens the gate; then out', () => {
    const m = createMission(layout, { level: 0 }, 1)
    for (const g of m.guards) {
      g.ry = 0 // facing +z: we come from -z, behind him
      const me = still(g.x, g.z - TAKEDOWN * 0.6)
      stepMission(m, 1 / 30, me)
      expect(m.canTakedown).toBe(g.id)
      expect(takedown(m)).toBeTruthy()
    }
    expect(m.open).toBe(true)
    expect(m.cash).toBeGreaterThan(0)
    stepMission(m, 1 / 30, still(GATE.x, GATE.z))
    expect(m.won).toBe(true)
    const r = missionResult(m)
    expect(r.outcome).toBe('won')
    expect(r.moneyChange).toBe(m.cash)
  })

  it('a guard who finds a sleeping colleague goes to look', () => {
    const m = createMission(layout, { level: 0 }, 1)
    const [a, b] = m.guards
    a.state = 'down'
    b.x = a.x
    b.z = a.z - 4
    b.ry = 0
    b.state = 'patrol'
    stepMission(m, 1 / 30, still(START.x, START.z))
    expect(b.state).toBe('search')
  })

  it('dawn ends the night', () => {
    const m = createMission(layout, {}, 1)
    m.time = 0.01
    stepMission(m, 0.1, still(START.x, START.z))
    expect(m.over).toBe(true)
    expect(m.won).toBe(false)
  })
})

describe('Steal Untouched: the shrine heist', () => {
  const village = getLayout('nkwoAgu', false)
  const id = 'shrineHeist'

  it('the start, the regalia, the way out and every sentry round are on open ground, all joined up', () => {
    const m = createMission(village, { level: 1 }, 2, id)
    const { start, loot } = MISSIONS[id]
    expect(walkable(m.grid, start.x, start.z)).toBe(true)
    // the regalia is reached through the compound gate (round the walls)
    const path = findPath(m.grid, [start.x, start.z], [loot.x, loot.z])
    expect(path).toBeTruthy()
    expect(path.length).toBeGreaterThan(15)
    expect(m.guards).toHaveLength(6)
    for (const g of m.guards) {
      for (const leg of g.legs) expect(leg.length).toBeGreaterThan(0)
      expect(findPath(m.grid, [start.x, start.z], g.home[0]), `sentry ${g.id}`).toBeTruthy()
    }
  })

  it('the way out only opens with the regalia in hand; unseen all night it is "untouched" (respect ×3)', () => {
    const m = createMission(village, { level: 0 }, 2, id)
    for (const g of m.guards) g.state = 'down' // (asleep, so nobody sees the test walk)
    const { start, loot } = MISSIONS[id]
    stepMission(m, 1 / 30, still(start.x, start.z))
    expect(m.over).toBe(false) // nothing in hand yet
    stepMission(m, 1 / 30, still(loot.x, loot.z))
    expect(m.canGrab).toBe(0) // standing at the first (and only) thing to take
    expect(grabLoot(m)).toBe(true)
    stepMission(m, 1 / 30, still(start.x, start.z))
    expect(m.won).toBe(true)
    const r = missionResult(m)
    expect(r).toMatchObject({ outcome: 'won', untouched: true, respectMul: 3 })
  })

  it('seen once, even if you get away with it, is not untouched', () => {
    const m = createMission(village, { level: 0 }, 2, id)
    m.spotted = true
    m.hasLoot = true
    m.open = true
    stepMission(m, 1 / 30, still(MISSIONS[id].exit.x, MISSIONS[id].exit.z))
    expect(missionResult(m)).toMatchObject({ outcome: 'won', untouched: false, respectMul: 1 })
  })
})

describe('EFCC Raid Escape: the duplex', () => {
  const duplex = getLayout('duplex', false)
  const id = 'raidEscape'

  it('every thing to take, the back door and every operative round can be reached from where you start', () => {
    const m = createMission(duplex, { level: 1 }, 4, id)
    const { start, exit } = MISSIONS[id]
    expect(walkable(m.grid, start.x, start.z)).toBe(true)
    for (const l of m.loot) expect(findPath(m.grid, [start.x, start.z], [l.x, l.z]), l.label).toBeTruthy()
    expect(findPath(m.grid, [start.x, start.z], [exit.x, exit.z]), 'the back door').toBeTruthy()
    for (const g of m.guards) expect(findPath(m.grid, [start.x, start.z], g.home[0]), `operative ${g.id}`).toBeTruthy()
  })

  it('they come in one after another', () => {
    const m = createMission(duplex, { level: 1 }, 4, id)
    expect(m.guards[0].wait).toBeGreaterThan(5) // a head start
    expect(m.guards[3].wait).toBeGreaterThan(m.guards[1].wait)
    let arrived = 0
    for (let i = 0; i < 30 * 20; i++) {
      stepMission(m, 1 / 30, still(-7, 5)) // out of the way, in a corner
      arrived += m.events.filter((e) => e.type === 'arrive').length
      if (m.over) break
    }
    expect(arrived).toBeGreaterThanOrEqual(1)
  })

  it('all three taken (each one slower) opens the back door, and out', () => {
    const m = createMission(duplex, { level: 0 }, 4, id)
    for (const g of m.guards) g.state = 'down'
    expect(carrySpeed(m)).toBe(1)
    for (const l of m.loot) {
      stepMission(m, 1 / 30, still(l.x, l.z))
      expect(grabLoot(m), l.label).toBe(true)
    }
    expect(carrySpeed(m)).toBeCloseTo(0.7)
    expect(m.open).toBe(true)
    stepMission(m, 1 / 30, still(MISSIONS[id].exit.x, MISSIONS[id].exit.z))
    expect(m.won).toBe(true)
    expect(missionResult(m)).toMatchObject({ outcome: 'won', moneyChange: 50000 })
  })
})

describe('more missions on the same engine', () => {
  for (const id of ['penthouseRaid', 'warehouseHeist', 'examSneak', 'serverBreak', 'hostelDash', 'paperRelay', 'droneDodge']) {
    it(`${id}: start, every objective, the way out and every round reachable; doing it all wins`, () => {
      const cfg = MISSIONS[id]
      const L = getLayout(cfg.world, false)
      const m = createMission(L, { level: 1 }, 5, id)
      expect(walkable(m.grid, cfg.start.x, cfg.start.z), 'start').toBe(true)
      for (const l of m.loot) expect(findPath(m.grid, [cfg.start.x, cfg.start.z], [l.x, l.z]), l.label).toBeTruthy()
      expect(findPath(m.grid, [cfg.start.x, cfg.start.z], [cfg.exit.x, cfg.exit.z]), 'way out').toBeTruthy()
      for (const g of m.guards) if (!g.fixed) expect(findPath(m.grid, [cfg.start.x, cfg.start.z], g.home[0]), `guard ${g.id}`).toBeTruthy()
      // with everybody looking away: do every job (standing still for the slow ones), then leave
      for (const g of m.guards) g.state = g.fixed ? 'patrol' : 'down'
      for (const g of m.guards) if (g.fixed) g.cool = 9999
      for (const l of m.loot) {
        stepMission(m, 1 / 30, still(l.x, l.z))
        expect(grabLoot(m), l.label).toBe(true)
        for (let i = 0; i < 30 * ((l.work || 0) + 0.2); i++) stepMission(m, 1 / 30, still(l.x, l.z))
        expect(l.taken, l.label).toBe(true)
      }
      expect(m.open).toBe(true)
      stepMission(m, 1 / 30, still(cfg.exit.x, cfg.exit.z))
      expect(m.won).toBe(true)
      expect(missionResult(m).outcome).toBe('won')
    })
  }

  it('a slow job stops if you move; a camera raises the alarm and sends the guards; the exam hall fails you for walking in a sightline', () => {
    const cfg = MISSIONS.penthouseRaid
    const m = createMission(getLayout('penthouse', false), { level: 0 }, 5, 'penthouseRaid')
    for (const g of m.guards) if (!g.fixed) g.state = 'down'
    const safe = m.loot[0]
    stepMission(m, 1 / 30, still(safe.x, safe.z))
    grabLoot(m)
    expect(m.working).toBeTruthy()
    stepMission(m, 1 / 30, { x: safe.x, z: safe.z, moving: true, running: false })
    expect(m.working).toBe(null)
    expect(safe.taken).toBe(false)
    // the lounge camera sees you standing in front of it
    const cam = m.guards.find((g) => g.fixed)
    for (const g of m.guards) if (!g.fixed) g.state = 'patrol'
    const before = m.guards.filter((g) => !g.fixed).map((g) => g.state)
    let alarm = false
    for (let i = 0; i < 30 * 6 && !alarm; i++) {
      stepMission(m, 1 / 30, still(cam.x + Math.sin(cam.ry) * 3, cam.z + Math.cos(cam.ry) * 3))
      alarm = m.events.some((e) => e.type === 'alarm')
    }
    expect(alarm).toBe(true)
    expect(before.length).toBeGreaterThan(0)
    expect(m.guards.some((g) => !g.fixed && g.state === 'search')).toBe(true)
    // the exam hall
    const e = createMission(getLayout('examHall', false), { level: 0 }, 5, 'examSneak')
    const inv = e.guards[0]
    inv.ry = 0
    stepMission(e, 1 / 30, { x: inv.x, z: inv.z + 3, moving: true, running: false })
    expect(e.over).toBe(true)
    expect(e.won).toBe(false)
    expect(cfg.loot.length).toBe(2)
  })

  it('a drone flies its loop over the walls; stand in its light and it marks you, rings the alarm and follows you', () => {
    const m = createMission(getLayout('lekki', false), { level: 1 }, 5, 'droneDodge')
    const d = m.guards.find((g) => g.drone)
    expect(d).toBeTruthy()
    const far = still(-34, -6)
    const x0 = d.x
    for (let i = 0; i < 30; i++) stepMission(m, 1 / 30, far)
    expect(d.x).not.toBe(x0) // it moves
    // under it: the ? fills, then the alarm
    let alarm = false
    for (let i = 0; i < 30 * 4 && !alarm; i++) {
      stepMission(m, 1 / 30, { x: d.x, z: d.z, moving: true, running: false })
      alarm = m.events.some((e) => e.type === 'alarm' && e.id === d.id)
    }
    expect(alarm).toBe(true)
    expect(d.trackT).toBeGreaterThan(0)
    expect(m.guards.some((g) => !g.fixed && g.state === 'search')).toBe(true)
    // it follows: run away and it closes in
    const me = { x: d.x + 6, z: d.z, moving: true, running: true }
    const before = Math.hypot(me.x - d.x, me.z - d.z)
    for (let i = 0; i < 30; i++) stepMission(m, 1 / 30, me)
    expect(Math.hypot(me.x - d.x, me.z - d.z)).toBeLessThan(before)
    // no takedown on a drone
    expect(m.canTakedown).not.toBe(d.id)
  })
})
