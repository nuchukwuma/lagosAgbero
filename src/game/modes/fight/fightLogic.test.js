import { describe, it, expect } from 'vitest'
import { createFight, stepFight, animOf, MOVES, ARENA, THROWABLES, itemNear } from './fightLogic.js'

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

  it('clean hits close together build a combo that hits harder', () => {
    const s = createFight({ hp: 200, aggression: 0, block: 0 })
    const hits = []
    for (let n = 0; n < 3; n++) {
      s.p.x = -0.6
      s.o.x = 0.6
      const before = s.o.hp
      stepFight(s, { punch: true }, 1 / 30, () => 0.99)
      run(s, () => ({}), 0.7)
      hits.push(before - s.o.hp)
    }
    expect(s.p.combo).toBe(3)
    expect(hits[0]).toBe(8)
    expect(hits[1]).toBeGreaterThan(hits[0])
    expect(hits[2]).toBeGreaterThan(hits[1])
    run(s, () => ({}), 2) // wait too long: the chain is gone
    expect(s.p.combo).toBe(0)
  })

  it('trading blows keeps your combo; the opponent gets no combo bonus', () => {
    const s = createFight({ hp: 200, aggression: 1, block: 0 })
    s.p.combo = 3
    s.p.comboT = 5
    s.p.x = -0.6
    s.o.x = 0.6
    const losses = []
    let last = s.p.hp
    for (let t = 0; t < 3; t += 1 / 30) {
      stepFight(s, {}, 1 / 30, () => 0.1)
      if (s.p.hp < last) losses.push(last - s.p.hp)
      last = s.p.hp
    }
    expect(losses.length).toBeGreaterThan(1)
    expect(s.p.combo).toBe(3)
    expect(Math.max(...losses.filter((d) => d === losses[0]))).toBe(losses[0]) // same move, same damage every time
    expect(s.o.combo).toBeGreaterThan(1)
  })

  it('a blocked hit breaks the combo', () => {
    const s = createFight({ hp: 200, aggression: 0, block: 0 })
    s.p.combo = 3
    s.p.comboT = 5
    s.p.x = -0.6
    s.o.x = 0.6
    s.o.blocking = true
    s.o.ai.blockT = 2
    stepFight(s, { punch: true }, 1 / 30, () => 0.99)
    run(s, () => ({}), 0.5)
    expect(s.p.combo).toBe(0)
  })
})

describe('fight power-ups', () => {
  it('Heavy Hands hits harder and Iron Jaw takes less', () => {
    const swing = (mods, who) => {
      const f = createFight({ hp: 500, power: 1 }, { energy: 70 })
      f.mods = mods
      f.o.x = f.p.x + 1.2
      const attacker = who === 'player' ? f.p : f.o
      attacker.action = { type: 'punch', t: MOVES.punch.startup + 0.01, hit: false }
      f.o.ai.think = 99
      f.o.ai.blockT = 0
      stepFight(f, {}, 0.001, () => 0.99)
      return who === 'player' ? f.o.maxHp - f.o.hp : f.p.maxHp - f.p.hp
    }
    expect(swing({ dealt: 1.3 }, 'player')).toBeGreaterThan(swing({}, 'player'))
    expect(swing({ taken: 0.65 }, 'opponent')).toBeLessThan(swing({}, 'opponent'))
  })
})

describe('fight: jump, heavy blows, crowd money', () => {
  it('a jump goes up and comes back down', () => {
    const s = createFight(idleOpponent)
    stepFight(s, { jump: true }, 1 / 30, () => 0.99)
    let top = 0
    for (let t = 0; t < 1.2; t += 1 / 30) {
      stepFight(s, {}, 1 / 30, () => 0.99)
      top = Math.max(top, s.p.y)
    }
    expect(top).toBeGreaterThan(0.8)
    expect(top).toBeLessThan(1.4)
    expect(s.p.y).toBe(0)
  })

  it('jumping over a kick makes it miss', () => {
    const s = createFight(idleOpponent)
    s.p.x = -0.8
    s.o.x = 0.8
    s.p.y = 0.8 // in the air
    s.p.vy = 0.1
    s.o.action = { type: 'kick', t: MOVES.kick.startup, hit: false }
    const hp = s.p.hp
    stepFight(s, {}, 1 / 60, () => 0.99)
    expect(s.p.hp).toBe(hp)
    expect(s.events.some((e) => e.type === 'jumped')).toBe(true)
  })

  it('an attack in the air is a flying kick, one a jump, and it lands', () => {
    const s = createFight(idleOpponent)
    s.p.x = -0.7
    s.o.x = 0.7
    stepFight(s, { jump: true }, 1 / 30, () => 0.99)
    run(s, () => ({}), 0.15)
    stepFight(s, { punch: true }, 1 / 30, () => 0.99)
    expect(s.p.action?.type).toBe('air')
    run(s, () => ({}), 0.3)
    expect(s.o.hp).toBe(50 - MOVES.air.dmg)
    const first = s.p.action
    stepFight(s, { kick: true }, 1 / 60, () => 0.99)
    expect(s.p.action === first || s.p.action === null).toBe(true) // no second one this jump
    expect(s.p.airUsed).toBe(true)
    run(s, () => ({}), 1)
    expect(s.p.y).toBe(0)
  })

  it('a blocked kick leaves the kicker open; a blocked punch does not', () => {
    for (const [move, open] of [['kick', true], ['punch', false]]) {
      const s = createFight(idleOpponent)
      s.p.x = -0.6
      s.o.x = 0.6
      s.o.blocking = true
      s.o.ai.blockT = 9
      s.p.action = { type: move, t: MOVES[move].startup, hit: false }
      stepFight(s, {}, 1 / 60, () => 0.99)
      expect(s.p.stunT > 0).toBe(open)
    }
  })

  it('the crowd throws money for combos and specials; only the winner keeps it', async () => {
    const s = createFight({ hp: 500, aggression: 0, block: 0 })
    s.p.x = -0.6
    s.o.x = 0.6
    for (let i = 0; i < 4; i++) {
      stepFight(s, { punch: true }, 1 / 30, () => 0.99)
      run(s, () => ({}), 0.65)
    }
    expect(s.coins).toBe(3) // hits 2, 3 and 4 of the chain
    const { useFight } = await import('./fightStore.js')
    useFight.setState({ coins: s.coins, ended: 'won', stats: { dealt: 0, taken: 0 } })
    expect(useFight.getState().result().moneyChange).toBe(150)
    useFight.setState({ ended: 'lost' })
    expect(useFight.getState().result().moneyChange).toBeUndefined()
  })
})

describe('fight: guarding and squatting', () => {
  const hit = (move, defender) => {
    const s = createFight({ hp: 100, aggression: 0, block: 0 })
    s.p.x = -0.7
    s.o.x = 0.7
    Object.assign(s.o, defender)
    s.o.ai.think = 9
    s.p.action = { type: move, t: MOVES[move].startup, hit: false }
    stepFight(s, {}, 1 / 60, () => 0.99)
    return s
  }
  it('the shield blocks the special too (it only chips)', () => {
    const s = hit('special', { blocking: true, ai: { think: 9, blockT: 9, move: 0 } })
    expect(s.events.some((e) => e.type === 'blocked')).toBe(true)
    expect(100 - s.o.hp).toBeLessThan(MOVES.special.dmg * 0.5)
  })
  it('holding back while they swing guards you', () => {
    const s = createFight({ hp: 100, aggression: 0, block: 0 })
    s.p.x = -0.7
    s.o.x = 0.7
    s.o.ai.think = 9
    s.o.action = { type: 'punch', t: MOVES.punch.startup - 0.02, hit: false }
    const hp = s.p.hp
    for (let i = 0; i < 6; i++) stepFight(s, { move: -1 }, 1 / 60, () => 0.99)
    expect(hp - s.p.hp).toBeLessThan(MOVES.punch.dmg)
  })
  it('a squat ducks a punch but not a kick', () => {
    const s = createFight({ hp: 100, aggression: 0, block: 0 })
    s.p.x = -0.7
    s.o.x = 0.7
    s.o.ai.think = 9
    stepFight(s, { crouch: true }, 1 / 60, () => 0.99)
    expect(s.p.crouching).toBe(true)
    s.o.action = { type: 'punch', t: MOVES.punch.startup, hit: false }
    stepFight(s, { crouch: true }, 1 / 60, () => 0.99)
    expect(s.events.some((e) => e.type === 'ducked')).toBe(true)
    s.o.action = { type: 'kick', t: MOVES.kick.startup, hit: false }
    const hp = s.p.hp
    stepFight(s, { crouch: true }, 1 / 60, () => 0.99)
    expect(s.p.hp).toBeLessThan(hp)
  })

  describe('throwing things', () => {
    const idle = { move: 0 }
    const still = () => 0.99 // the opponent never decides anything
    const setup = (kind, gap = 3) => {
      const s = createFight({ hp: 100, aggression: 0, block: 0 }, { items: false })
      s.p.x = -1.5
      s.o.x = -1.5 + gap
      s.items = [{ id: 1, kind, x: -1.4 }]
      return s
    }
    const run = (s, sec, input = idle) => {
      for (let i = 0; i < sec * 60; i++) stepFight(s, i === 0 ? { ...input } : idle, 1 / 60, still)
    }

    it('only works standing by something, and the thing flies slowly enough to react to', () => {
      const s = setup('bottle')
      expect(itemNear(s, s.p)).toBeTruthy()
      s.items[0].x = 2
      expect(itemNear(s, s.p)).toBeNull()
      for (const T of Object.values(THROWABLES)) expect(T.speed).toBeLessThan(6.5) // 3 m takes about half a second or more
    })

    it('a thrown bottle hits; a guard takes most of the sting; a squat ducks it', () => {
      const a = setup('bottle')
      run(a, 1.5, { throw: true })
      expect(a.o.hp).toBe(100 - THROWABLES.bottle.dmg)
      expect(a.items).toHaveLength(0) // it broke
      const b = setup('bottle')
      b.o.ai.blockT = 99
      run(b, 1.5, { throw: true })
      expect(100 - b.o.hp).toBeLessThan(THROWABLES.bottle.dmg / 2)
      const c = setup('bottle')
      run(c, 0.1, { throw: true })
      c.o.crouching = true
      const hp = c.o.hp
      for (let i = 0; i < 90; i++) {
        c.o.crouching = true
        stepFight(c, idle, 1 / 60, still)
        c.o.crouching = true
      }
      expect(c.o.hp).toBe(hp)
    })

    it('a stone that hits falls to the ground to be thrown again; a tyre rolls under a jump', () => {
      const s = setup('stone')
      run(s, 1.5, { throw: true })
      expect(s.items.map((i) => i.kind)).toEqual(['stone'])
      const t = setup('tyre')
      run(t, 0.6, { throw: true }) // the tyre is on its way
      t.o.y = 0.5
      t.o.vy = 4 // ...and they hop it
      const hp = t.o.hp
      run(t, 0.5)
      expect(t.o.hp).toBe(hp)
    })

    it('runs at its pace, and nobody goes through the walls', () => {
      const slow = createFight({ hp: 100 }, { pace: 0.5 })
      stepFight(slow, idle, 1, still)
      expect(slow.time).toBeCloseTo(0.5)
      const s = createFight({ hp: 100 }, {})
      for (let i = 0; i < 400; i++) stepFight(s, { move: -1 }, 1 / 60, still)
      expect(s.p.x).toBeGreaterThanOrEqual(-ARENA)
    })
  })
})
