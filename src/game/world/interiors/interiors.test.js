import { describe, it, expect } from 'vitest'
import { WORLDS, getLayout, isInterior } from '../worlds.js'
import { resolveCollisions } from '../layout.js'

const interiors = Object.values(WORLDS).filter((w) => w.interior)
const doors = Object.values(WORLDS).flatMap((w) => (w.activities || []).filter((a) => a.mode === 'enter').map((a) => ({ world: w.id, ...a })))

// would a person standing here be pushed? (i.e. is the point inside a wall or furniture)
function blocked(layout, x, z) {
  const p = { x, z }
  resolveCollisions(p, 0.35, layout.colliders, layout.bounds)
  return Math.hypot(p.x - x, p.z - z) > 0.01
}

describe('buildings you can walk into', () => {
  it('there are interiors, and every door leads to one', () => {
    expect(interiors.length).toBeGreaterThanOrEqual(3)
    expect(doors.length).toBeGreaterThanOrEqual(3)
    for (const d of doors) expect(isInterior(d.params.interior), `${d.world}: ${d.id}`).toBe(true)
  })

  it('every interior: you arrive on open floor, the way out is reachable, and its walls block', () => {
    for (const w of interiors) {
      const L = getLayout(w.id, false)
      expect(blocked(L, w.spawn.pos[0], w.spawn.pos[1]), `${w.id}: spawn`).toBe(false)
      const exit = (w.activities || []).find((a) => a.mode === 'exit')
      expect(exit, `${w.id}: has a way out`).toBeTruthy()
      const door = L.spots[exit.spot]
      expect(blocked(L, door.pos[0], door.pos[1]), `${w.id}: the door spot`).toBe(false)
      expect(L.colliders.filter((c) => c.wall).length).toBe(w.interior.walls.length)
      // the middle of every wall pushes you out
      for (const [x1, z1, x2, z2] of w.interior.walls) expect(blocked(L, (x1 + x2) / 2, (z1 + z2) / 2), `${w.id}: wall ${[x1, z1, x2, z2]}`).toBe(true)
    }
  })

  it('every room of every interior has floor you can stand on', () => {
    for (const w of interiors) {
      const L = getLayout(w.id, false)
      for (const r of w.interior.rooms) {
        let free = 0
        for (let x = r.x + 0.5; x < r.x + r.w; x += 0.5) for (let z = r.z + 0.5; z < r.z + r.d; z += 0.5) if (!blocked(L, x, z)) free++
        expect(free, `${w.id}: ${r.name}`).toBeGreaterThan(8)
      }
    }
  })
})
