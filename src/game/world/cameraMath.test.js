import { describe, it, expect } from 'vitest'
import { blockedHeight } from './cameraMath.js'

describe('camera sight lines', () => {
  it('a street camera behind a tall building has to rise', () => {
    const house = { x: 0, z: 6, hw: 4, hd: 3, angle: 0, h: 7 }
    expect(blockedHeight({ x: 0, z: 0 }, { x: 0, z: 11.5 }, [house])).toBeGreaterThan(7)
    expect(blockedHeight({ x: 0, z: 0 }, { x: 0, z: -11.5 }, [house])).toBe(0)
  })

  it('low and thin things never block the view', () => {
    const stall = { x: 0, z: 6, hw: 1.5, hd: 1, angle: 0, h: 2 }
    const pole = { x: 0, z: 6, hw: 0.2, hd: 0.2, angle: 0, h: 8 }
    expect(blockedHeight({ x: 0, z: 0 }, { x: 0, z: 11.5 }, [stall, pole])).toBe(0)
  })
})
