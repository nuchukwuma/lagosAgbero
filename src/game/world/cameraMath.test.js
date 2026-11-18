import { describe, it, expect } from 'vitest'
import { blockedHeight, fightSideBlock } from './cameraMath.js'

describe('camera sight lines', () => {
  it('a fight camera rises until it can see the fighters\' feet over a stopped danfo', () => {
    const danfo = { x: 0, z: 2.5, hw: 2.9, hd: 1.1, angle: 0, h: 2.3 }
    const dist = 6.5
    const H = fightSideBlock({ x: 0, z: 0 }, 1, dist, [danfo])
    expect(H).toBeGreaterThan(2.3)
    // from (0, H, dist) to a fighter's feet (0, 0, 0): at the danfo's near and far edge the line is above its roof
    for (const z of [danfo.z - danfo.hd, danfo.z + danfo.hd]) expect((H * z) / dist).toBeGreaterThan(danfo.h)
  })

  it('a danfo right up against the fight needs a camera too high to be sensible', () => {
    const danfo = { x: 0, z: 1.6, hw: 2.9, hd: 1.1, angle: 0, h: 2.3 }
    expect(fightSideBlock({ x: 0, z: 0 }, 1, 6.5, [danfo])).toBeGreaterThan(9) // CameraRig films from the north then
    expect(fightSideBlock({ x: 0, z: 0 }, -1, 6.5, [danfo])).toBe(0)
  })

  it('nothing in the way: the fight camera stays where it is', () => {
    expect(fightSideBlock({ x: 0, z: 0 }, 1, 6.5, [{ x: 0, z: -4, hw: 2, hd: 1, angle: 0, h: 2.3 }])).toBe(0)
  })

  it('a street camera behind a tall building has to rise', () => {
    const house = { x: 0, z: 6, hw: 4, hd: 3, angle: 0, h: 7 }
    expect(blockedHeight({ x: 0, z: 0 }, { x: 0, z: 11.5 }, [house])).toBeGreaterThan(7)
    expect(blockedHeight({ x: 0, z: 0 }, { x: 0, z: -11.5 }, [house])).toBe(0)
  })
})
