import { describe, it, expect } from 'vitest'
import { FRAMES, frameFor, reachOf, CW, CH, AX, AY, M_PER_PX } from './pixel.js'
import { backdropFor } from './pixelStage.js'
import { MOVES } from '../fightLogic.js'

const worlds = import.meta.glob('../../../data/world/*.json', { eager: true, import: 'default' })
// frameFor only needs the frame lists
const fighter = { frames: FRAMES }
const idle = { x: 0, y: 0, vy: 0, stunT: 0, action: null, dodgeT: 0, blocking: false, moving: 0 }

describe('pixel fighters', () => {
  it('every frame keeps its hands and feet inside the frame canvas', () => {
    const inside = ([x, y]) => x + AX >= 1 && x + AX < CW - 2 && y + AY >= 1 && y + AY < CH - 1
    const bad = []
    for (const [name, list] of Object.entries(FRAMES))
      list.forEach((f, i) => {
        const [bx, by] = f.b || [0, 0]
        for (const p of [[f.aF[0] + bx, f.aF[1] + by], [f.aB[0] + bx, f.aB[1] + by], f.lF, f.lB]) if (!inside(p)) bad.push(`${name}[${i}] ${p}`)
      })
    expect(bad).toEqual([])
  })

  it('there is a frame for every moment of a fight, at any time (even a hair before zero)', () => {
    const states = [
      idle,
      { ...idle, moving: 1 },
      { ...idle, moving: -1 },
      { ...idle, blocking: true },
      { ...idle, dodgeT: 0.2 },
      { ...idle, stunT: 0.2 },
      { ...idle, y: 0.5, vy: 2 },
      { ...idle, y: 0.5, vy: -2 },
      ...Object.keys(MOVES).flatMap((type) => [0, 0.05, 0.2, 0.4, 0.6, 1.2].map((t) => ({ ...idle, action: { type, t } }))),
    ]
    for (const f of states)
      for (const t of [-0.07, 0, 0.33, 5.1, 100]) {
        expect(frameFor(fighter, f, MOVES, { over: null, winner: false, t, overT: 0 }).frame).toBeTruthy()
        for (const winner of [true, false]) for (const overT of [0, 0.3, 2]) expect(frameFor(fighter, f, MOVES, { over: 'won', winner, t, overT }).frame).toBeTruthy()
      }
  })

  it('a strike reaches about as far as the rules say it hits', () => {
    // fist/foot reach (with the lunge) should be within half a metre of the move's range minus a body
    const strike = { punch: FRAMES.punch[1], kick: FRAMES.kick[1], special: FRAMES.special[2] }
    for (const [type, frame] of Object.entries(strike)) {
      const r = reachOf(frame)
      const tip = type === 'punch' ? r.fist[0] : r.foot[0]
      expect(Math.abs(tip - (MOVES[type].range - 0.45))).toBeLessThan(0.55)
    }
    expect(M_PER_PX).toBeGreaterThan(0)
  })
})

describe('fight backdrops', () => {
  it('every spot in every world has a backdrop', () => {
    for (const w of Object.values(worlds))
      for (const spot of Object.keys(w.spots || {})) {
        const b = backdropFor(w.id, spot)
        expect(['lagos', 'village', 'campus']).toContain(b.kind)
        expect(typeof b.place).toBe('string')
      }
    expect(backdropFor('nkwoAgu', 'farm')).toEqual({ kind: 'village', place: 'farm' })
    expect(backdropFor('iyanaWahala', 'underBridge')).toEqual({ kind: 'lagos', place: 'bridge' })
    expect(backdropFor('royalCrest', 'hostel')).toEqual({ kind: 'campus', place: 'hostel' })
  })
})
