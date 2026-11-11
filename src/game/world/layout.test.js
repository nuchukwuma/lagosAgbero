import { describe, it, expect } from 'vitest'
import { parseLayout, resolveCollisions } from './layout.js'
import street from '../data/world/iyanaWahala.json'
import { MODELS } from '../../assets/assetManifest.js'

describe('world layout', () => {
  const layout = parseLayout(street)

  it('only uses models that exist in the manifest', () => {
    for (const g of layout.groups) expect(MODELS[g.model], g.model).toBeTruthy()
  })

  it('expands lines into tiles and skips the junction', () => {
    const main = layout.groups.find((g) => g.model === 'roadStraight')
    expect(main.items.length).toBe(13) // 14 tiles from -52 to 52 minus the junction
  })

  it('every spot and the spawn point are walkable', () => {
    const points = [layout.spawn.pos, ...Object.values(layout.spots).map((s) => s.pos)]
    for (const [x, z] of points) {
      const p = resolveCollisions({ x, z }, 0.35, layout.colliders, layout.bounds)
      expect(Math.hypot(p.x - x, p.z - z), `spot at ${x},${z} is inside something`).toBeLessThan(0.05)
    }
  })

  it('pushes the player out of a box', () => {
    const p = resolveCollisions({ x: 0.1, z: 0 }, 0.35, [{ x: 0, z: 0, hw: 1, hd: 1, angle: 0 }])
    expect(Math.abs(p.x) >= 1.34 || Math.abs(p.z) >= 1.34).toBe(true)
  })
})
