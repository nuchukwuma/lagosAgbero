import { describe, it, expect } from 'vitest'
import { createEscape, stepEscape, press, buildLevel, surfaceUnder, canSee, metresLeft, PX_PER_M, RUN, G, JUMP_V, DOUBLE_V, OFFICER_RUN, BOUNTY, SIGHT, MAX_AMMO } from './platformerLogic.js'
import { earned } from './escape.js'
import dummy from './dummy.json'
import vehicles from './vehicles.json'

const run = (s, seconds, dt = 1 / 60) => {
  for (let i = 0; i < seconds / dt && !s.over; i++) stepEscape(s, dt)
}

/** A simple player: hold right; jump at anything in the way; jump again near the top. */
function botStep(s) {
  const p = s.p
  const lv = s.level
  s.held.right = true
  const ahead = p.x + 34
  const gapAhead = !lv.ground.some((g) => ahead >= g.x0 && ahead <= g.x1)
  const wall = lv.blocks.some((b) => ahead > b.x && p.x < b.x && b.y < p.y - 4)
  const hazard = lv.hazards.some((h) => ahead + 20 > h.x && p.x < h.x + h.w)
  const banner = lv.hazards.some((h) => h.kind === 'banner' && ahead + 10 > h.x && p.x < h.x + h.w)
  if (banner && p.ground && p.roll <= 0) press(s, 'roll')
  else if (p.ground && (gapAhead || wall || hazard)) press(s, 'jump')
  else if (!p.ground && p.jumps === 1 && p.vy > -60) press(s, 'jump')
}

describe('escape platformer', () => {
  it('the atlases have every animation the game draws', () => {
    for (const a of ['idle', 'walk', 'run', 'jump', 'double', 'land', 'roll', 'strike', 'knocked']) expect(dummy.anims[a]?.frames, a).toBeGreaterThan(0)
    for (const v of ['danfo', 'corolla', 'lorry', 'okada']) expect(vehicles.vehicles[v], v).toBeTruthy()
  })

  it('the level is long, has bus stops, and every gutter can be jumped', () => {
    const lv = buildLevel({ metres: 700, seed: 3 })
    expect(lv.goal).toBe(700 * PX_PER_M)
    expect(lv.checkpoints.length).toBeGreaterThan(3)
    const airtime = (2 * JUMP_V) / G + (2 * DOUBLE_V) / G
    const ground = [...lv.ground].sort((a, b) => a.x0 - b.x0)
    for (let i = 1; i < ground.length; i++) expect(ground[i].x0 - ground[i - 1].x1).toBeLessThan(RUN * airtime * 0.8)
  })

  it('you can stand still, walk, jump and land', () => {
    const s = createEscape({}, 1)
    s.level.officers = []
    run(s, 1)
    expect(s.p.ground).toBe(true)
    const x0 = s.p.x
    run(s, 1)
    expect(s.p.x).toBeCloseTo(x0, 0) // standing still is allowed
    press(s, 'right', true)
    run(s, 0.5)
    expect(s.p.x).toBeGreaterThan(x0 + 40)
    press(s, 'jump')
    stepEscape(s, 1 / 60)
    expect(s.p.ground).toBe(false)
    run(s, 1.2)
    expect(s.p.ground).toBe(true)
  })

  it('a gutter is a life lost, and you come back at the bus stop', () => {
    const s = createEscape({}, 2)
    s.level.ground = [{ x0: -400, x1: 100 }, { x0: 400, x1: 99999 }]
    s.p.x = 150
    s.p.ground = false
    run(s, 3)
    expect(s.lives).toBe(2)
    expect(s.p.x).toBeLessThan(100)
  })

  it('officers see what is in front of them, at their level', () => {
    const o = { x: 100, y: 0, dir: 1 }
    expect(canSee(o, { x: 200, y: 0, roll: 0 })).toBe(true)
    expect(canSee(o, { x: 20, y: 0, roll: 0 })).toBe(false) // behind
    expect(canSee(o, { x: 160, y: -100, roll: 0 })).toBe(false) // up on a car roof
  })

  it('three strikes put an officer down, and so does a stomp', () => {
    const s = createEscape({}, 4)
    s.level.officers = [{ x: 60, y: 0, home: [40, 300], dir: -1, state: 'patrol', hp: 3, t: 0, alertT: 0, windup: 0, cool: 0, stun: 0, seenT: 0, lostT: 0 }]
    const o = s.level.officers[0]
    s.p.x = 30
    s.p.invul = 99
    for (let i = 0; i < 3; i++) {
      press(s, 'hit')
      run(s, 0.4)
      o.x = s.p.x + 25
      o.stun = 0
    }
    expect(o.state).toBe('down')
    const s2 = createEscape({}, 5)
    s2.level.officers = [{ x: 100, y: 0, home: [100, 100], dir: 1, state: 'patrol', hp: 3, t: 0, alertT: 0, windup: 0, cool: 0, stun: 0, seenT: 0, lostT: 0 }]
    Object.assign(s2.p, { x: 100, y: -120, vy: 300, ground: false, invul: 99 })
    run(s2, 0.3)
    expect(s2.level.officers[0].state).toBe('down')
  })

  it('reaching the goal is an escape', () => {
    const s = createEscape({ metres: 100 }, 6)
    s.p.x = s.level.goal - 5
    press(s, 'right', true)
    run(s, 1)
    expect(s.escaped).toBe(true)
    expect(metresLeft(s)).toBe(0)
  })

  it('every street can be crossed (a simple bot, no officers)', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const s = createEscape({ metres: 500, lives: 99 }, seed)
      s.level.officers = []
      let deaths = 0
      for (let i = 0; i < 60 * 240 && !s.over; i++) {
        if (s.p.dead > 0 && s.p.dead > 1.29) deaths++
        botStep(s)
        stepEscape(s, 1 / 60)
      }
      expect(s.escaped, `seed ${seed}: stuck at ${Math.round(s.p.x)} of ${s.level.goal} (${deaths} deaths)`).toBe(true)
    }
  })

  it('surfaces: the road, a car roof, and nothing over a gutter', () => {
    const lv = { ground: [{ x0: 0, x1: 100 }], blocks: [{ x: 200, y: -50, w: 60, h: 50 }], ledges: [] }
    expect(surfaceUnder(lv, 40, 50, 2, -5)).toBe(0)
    expect(surfaceUnder(lv, 210, 220, -48, -60)).toBe(-50)
    expect(surfaceUnder(lv, 140, 150, 5, -5)).toBe(null)
  })

  const cop = (x, dir, extra = {}) => ({ x, y: 0, home: [x - 200, x + 200], dir, state: 'patrol', hp: 3, t: 0, alertT: 0, windup: 0, cool: 0, stun: 0, seenT: 0, lostT: 0, ...extra })

  it('a creeping runner is seen from about half as far as a running one', () => {
    const o = { x: 100, y: 0, dir: 1 }
    const at = SIGHT * 0.75 + 100
    expect(canSee(o, { x: at, y: 0, roll: 0, vx: RUN })).toBe(true)
    expect(canSee(o, { x: at, y: 0, roll: 0, vx: 40 })).toBe(false)
    expect(canSee(o, { x: at, y: 0, roll: 0, vx: 0 })).toBe(false)
  })

  it('once seen, officers rush faster than you can run, and the whistle brings the others', () => {
    expect(OFFICER_RUN).toBeGreaterThan(RUN)
    const s = createEscape({}, 7)
    s.level.officers = [cop(200, -1), cop(420, 1), cop(1400, -1)]
    s.p.x = 120
    s.p.invul = 99
    run(s, 0.6)
    const [a, b, far] = s.level.officers
    expect(a.state).toBe('chase')
    expect(b.state).toBe('chase') // heard the whistle, though he was looking away
    expect(far.state).toBe('patrol') // too far to hear
  })

  it('a strike from behind on an officer who has not seen you is a one-blow takedown, and it pays', () => {
    const s = createEscape({ rewardMul: 1 }, 8)
    s.level.officers = [cop(60, 1)] // facing away from you
    s.p.x = 30
    press(s, 'hit')
    run(s, 0.3)
    expect(s.level.officers[0].state).toBe('down')
    expect(s.sneaks).toBe(1)
    expect(s.bounty).toBe(BOUNTY.sneak)
    expect(earned(s)).toBe(BOUNTY.sneak + s.notes * 100)
  })

  it('the bounty grows with the reward multiplier', () => {
    const s = createEscape({ rewardMul: 1.5 }, 9)
    s.level.officers = [cop(60, 1)]
    s.p.x = 30
    press(s, 'hit')
    run(s, 0.3)
    expect(s.bounty).toBe(Math.round((BOUNTY.sneak * 1.5) / 10) * 10)
  })

  it('the stick moves you: a small push creeps, a full push runs', () => {
    const s = createEscape({}, 10)
    s.level.officers = []
    s.stick = 0.3
    run(s, 1)
    expect(Math.abs(s.p.vx)).toBeLessThan(70)
    s.stick = 1
    run(s, 1)
    expect(s.p.vx).toBeGreaterThan(RUN * 0.9)
  })

  it('the street has bottles and power-ups to pick up', () => {
    const lv = buildLevel({ metres: 700, seed: 3 })
    const kinds = lv.pickups.map((u) => u.kind)
    expect(kinds.filter((k) => k === 'bottle').length).toBeGreaterThan(3)
    expect(kinds.some((k) => k !== 'bottle')).toBe(true)
  })

  it('a thrown bottle stuns an officer and hurts him; ammo is limited', () => {
    const s = createEscape({}, 11)
    s.level.officers = [cop(160, -1)]
    s.p.x = 60
    s.p.invul = 99
    press(s, 'throw')
    expect(s.ammo).toBe(0)
    press(s, 'throw') // nothing left
    expect(s.shots).toHaveLength(1)
    run(s, 0.6)
    const o = s.level.officers[0]
    expect(o.hp).toBe(1)
    s.ammo = MAX_AMMO
    s.level.pickups = [{ x: s.p.x, y: s.p.y - 10, kind: 'bottle', got: false }]
    run(s, 0.05)
    expect(s.ammo).toBe(MAX_AMMO) // hands full: it stays on the road
    expect(s.level.pickups[0].got).toBe(false)
  })

  it('the star makes you untouchable and bowls officers over', () => {
    const s = createEscape({}, 12)
    s.level.officers = [cop(80, -1, { state: 'chase' })]
    s.p.x = 40
    s.p.invul = 0
    s.level.pickups = [{ x: 40, y: -10, kind: 'star', got: false }]
    s.held.right = true
    run(s, 0.8)
    expect(s.starT).toBeGreaterThan(0)
    expect(s.p.hp).toBe(s.maxHp)
    expect(s.level.officers[0].state).toBe('down')
  })
})
