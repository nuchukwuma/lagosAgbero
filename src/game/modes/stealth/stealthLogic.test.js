import { describe, it, expect } from 'vitest'
import { getLayout } from '../../world/worlds.js'
import { createMission, stepMission, takedown, missionResult, walkable, findPath, lineOfSight, sees, START, GATE, ROUTES, TAKEDOWN } from './stealthLogic.js'

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
