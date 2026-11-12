import { describe, it, expect } from 'vitest'
import { parseLayout } from './layout.js'
import { buildRow, generateFill } from './cityFill.js'
import street from '../data/world/iyanaWahala.json'

describe('city fill', () => {
  it('is the same every time (seeded)', () => {
    const a = generateFill(street, [], [])
    const b = generateFill(street, [], [])
    expect(JSON.stringify(a.prims)).toBe(JSON.stringify(b.prims))
    expect(a.blocks.length).toBe(b.blocks.length)
  })

  it('rows fit inside their line and do not overlap', () => {
    const row = buildRow({ from: [0, 0], to: [80, 0], face: 0, set: 'houses', seed: 4 })
    expect(row.length).toBeGreaterThan(3)
    for (let i = 1; i < row.length; i++) {
      const prev = row[i - 1].collider
      const cur = row[i].collider
      expect(cur.x - cur.hw).toBeGreaterThan(prev.x + prev.hw - 0.01)
    }
  })

  it('fills the street: many buildings, props and a skyline', () => {
    const layout = parseLayout(street)
    const buildings = layout.groups.filter((g) => g.kind === 'building').reduce((n, g) => n + g.items.length, 0)
    expect(buildings).toBeGreaterThan(50)
    expect(layout.fill.prims.length).toBeGreaterThan(300)
    expect(layout.fill.blocks.length).toBeGreaterThan(40)
  })

  it('keeps clutter off story marks, spots and the road', () => {
    const marks = [[8, -6.2], [-13, -7]]
    const layout = parseLayout(street, { reserved: marks })
    const solidProps = layout.fill.colliders
    for (const c of solidProps) {
      expect(Math.abs(c.z) > 4.2 || Math.abs(c.x) > 60).toBe(true) // never on the main road
      for (const [x, z] of marks) expect(Math.hypot(c.x - x, c.z - z)).toBeGreaterThan(1.5)
      for (const s of Object.values(street.spots)) expect(Math.hypot(c.x - s.pos[0], c.z - s.pos[1])).toBeGreaterThan(1.2)
    }
  })
})
