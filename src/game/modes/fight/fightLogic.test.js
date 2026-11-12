import { describe, it, expect } from 'vitest'
import { createFight, stepFight, animOf } from './fightLogic.js'

const idleOpponent = { hp: 50, aggression: 0, block: 0 }
const run = (s, input, seconds, rng = () => 0.99) => {
  for (let t = 0; t < seconds; t += 1 / 30) stepFight(s, input(t), 1 / 30, rng)
  return s
}

describe('fight', () => {
  it('a punch in range hurts and fills the special meter', () => {
    const s = createFight(idleOpponent)
    s.p.x = -0.6
    s.o.x = 0.6
    stepFight(s, { punch: true }, 1 / 30, () => 0.99)
    run(s, () => ({}), 0.5)
    expect(s.o.hp).toBe(42)
    expect(s.p.special).toBeGreaterThan(0)
  })

  it('a punch out of range misses', () => {
    const s = createFight(idleOpponent)
    stepFight(s, { punch: true }, 1 / 30, () => 0.99)
    run(s, () => ({}), 0.5)
    expect(s.o.hp).toBe(50)
  })

  it('blocking takes much less damage', () => {
    const s = createFight({ hp: 50, aggression: 1, block: 0 })
    s.p.x = -0.6
    s.o.x = 0.6
    const startHp = s.p.hp
    run(s, () => ({ block: true }), 3, () => 0.1)
    const blockedLoss = startHp - s.p.hp
    const s2 = createFight({ hp: 50, aggression: 1, block: 0 })
    s2.p.x = -0.6
    s2.o.x = 0.6
    run(s2, () => ({}), 3, () => 0.1)
    expect(blockedLoss).toBeLessThan(s2.p.maxHp - s2.p.hp)
  })

  it('the special needs a full meter', () => {
    const s = createFight(idleOpponent)
    stepFight(s, { special: true }, 1 / 30)
    expect(s.p.action).toBe(null)
    s.p.special = 100
    stepFight(s, { special: true }, 1 / 30)
    expect(s.p.action.type).toBe('special')
  })

  it('knocking the opponent out wins, and the loser flops', () => {
    const s = createFight({ hp: 10, aggression: 0, block: 0 })
    s.p.x = -0.6
    s.o.x = 0.6
    // punch, step back in, punch again
    run(s, (t) => (Math.floor(t * 30) % 20 === 0 ? { punch: true } : { move: s.o.x - s.p.x > 1.2 ? 1 : 0 }), 4)
    expect(s.over).toBe('won')
    expect(animOf(s.o, s.over, false)).toBe('knockedOut')
  })

  it('more energy means more health; notoriety makes opponents tougher', () => {
    expect(createFight(idleOpponent, { energy: 100 }).p.maxHp).toBeGreaterThan(createFight(idleOpponent, { energy: 10 }).p.maxHp)
    expect(createFight(idleOpponent, { notoriety: 80 }).o.maxHp).toBeGreaterThan(createFight(idleOpponent).o.maxHp)
  })
})
