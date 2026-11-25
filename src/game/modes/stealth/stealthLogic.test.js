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
