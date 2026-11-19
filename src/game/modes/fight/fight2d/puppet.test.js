import { describe, it, expect } from 'vitest'
import { makeFighter, drawFighter, poseFor, POSES, reachPoints } from './puppet.js'
import { MOVES } from '../fightLogic.js'
import people from '../../../../assets/peopleIndex.json'

// a canvas stand-in that accepts every call and checks the numbers it gets
function fakeCanvas() {
  const bad = []
  const calls = { n: 0 }
  const ctx = new Proxy(
    {},
    {
      get(target, key) {
        if (key in target) return target[key]
        return (...args) => {
          calls.n++
          for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) bad.push(`${String(key)}(${args.join(', ')})`)
          // gradients: hand back one that checks its stops too
          if (String(key).startsWith('create') && String(key).endsWith('Gradient'))
            return { addColorStop: (o, c) => (!Number.isFinite(o) || typeof c !== 'string' || c.includes('NaN')) && bad.push(`addColorStop(${o}, ${c})`) }
        }
      },
      set(target, key, value) {
        target[key] = value
        return true
      },
    },
  )
  return { ctx, bad, calls }
}

describe('2D fighters', () => {
  it('every body can be drawn in every pose, with finite numbers only', () => {
    for (const body of Object.keys(people.bodies)) {
      const fx = makeFighter({ body, accessories: [{ type: 'cap' }, { type: 'glasses' }, { type: 'chain' }, { type: 'wristband' }] })
      for (const pose of Object.values(POSES)) {
        const { ctx, bad, calls } = fakeCanvas()
        drawFighter(ctx, fx, pose)
        expect(bad, `${body}`).toEqual([])
        expect(calls.n).toBeGreaterThan(50)
      }
    }
  })

  it('moves animate through their phases and the fist reaches out on a jab', () => {
    const fx = makeFighter({})
    const f = { x: 0, stunT: 0, dodgeT: 0, blocking: false, moving: 0, action: null }
    const opts = { over: null, winner: false, t: 0, overT: 0, stunMax: 0.38 }
    const rest = reachPoints(fx, poseFor(f, MOVES, opts)).fist[0]
    f.action = { type: 'punch', t: MOVES.punch.startup + 0.05 }
    const out = reachPoints(fx, poseFor(f, MOVES, opts)).fist[0]
    expect(out - rest).toBeGreaterThan(0.3)
    for (const type of Object.keys(MOVES)) {
      for (let t = 0; t < MOVES[type].startup + MOVES[type].active + MOVES[type].recover; t += 0.05) {
        f.action = { type, t }
        const p = poseFor(f, MOVES, opts)
        expect(Number.isFinite(p.hip[0] + p.hip[1] + p.lean + p.turn)).toBe(true)
      }
    }
  })

  it('the loser falls and lies down; the winner celebrates', () => {
    const f = { x: 0, stunT: 0, dodgeT: 0, blocking: false, moving: 0, action: null }
    const down = poseFor(f, MOVES, { over: 'won', winner: false, t: 0, overT: 2, stunMax: 0.38 })
    expect(down.lying).toBe(true)
    expect(down.hip[1]).toBeLessThan(0.3)
    const win = poseFor(f, MOVES, { over: 'won', winner: true, t: 0, overT: 2, stunMax: 0.38 })
    expect(win.fB[1]).toBeGreaterThan(0.4) // fist in the air
  })
})
