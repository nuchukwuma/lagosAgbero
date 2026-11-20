// Fight rules, pure (no React): two fighters on a line, the player on the
// left facing right. Cartoon fighting: no blood, knock-outs are a flop to
// the ground.
//
// Moves: punch (light), kick (heavy), special ("Lagos Roundabout"), block
// (hold the shield, or hold back while they swing; blocks every move, even
// the special), dodge (quick backstep with a moment of no-hit), jump (hop over
// a kick; punch or kick in the air for a flying kick), squat (hold down: duck
// under punches and the spin kick; kicks still land). Hits fill the special
// meter. A heavy blow that's blocked leaves its thrower open for a moment.
// The crowd dashes money (coins) for good combos and specials: the winner
// keeps it.
// Things lie about the arena (bottles, stones, a crate, an old tyre): stand by
// one and THROW it. It flies slowly enough to see coming, so it can be
// blocked, ducked (bottles and stones fly high), jumped (a tyre rolls along
// the road) or dodged; the opponent picks them up and throws them too.
// The arena has walls at both ends (ARENA): nobody goes past them.
// The whole fight runs at `pace` (slower early in the story).
// Combos: clean hits landed close together count up (x2, x3...) and each
// step hits harder. Being blocked or dodged, or waiting too long, breaks
// the chain. Only the player's chain adds damage (the opponent's power
// already scales with difficulty).

export const MOVES = {
  punch: { startup: 0.18, active: 0.16, recover: 0.28, range: 1.62, dmg: 8, anim: 'punch', animSpeed: 2.2 },
  kick: { startup: 0.32, active: 0.16, recover: 0.42, range: 2.05, dmg: 12, anim: 'kick', animSpeed: 1.7 },
  special: { startup: 0.45, active: 0.24, recover: 0.6, range: 2.25, dmg: 26, anim: 'roundhouse', animSpeed: 1.95 },
  air: { startup: 0.07, active: 0.28, recover: 0.12, range: 1.85, dmg: 11, anim: 'kick', animSpeed: 2 },
  throw: { startup: 0.3, active: 0.04, recover: 0.36, range: 0, dmg: 0, anim: 'punch', animSpeed: 1.4 },
}
// what can be thrown: damage, speed (m/s: slow enough to react to), height it flies at, whether it breaks
export const THROWABLES = {
  bottle: { dmg: 9, speed: 5.2, y: 1.05, breaks: true },
  stone: { dmg: 8, speed: 5.8, y: 0.95, breaks: false },
  crate: { dmg: 13, speed: 4.4, y: 0.8, breaks: true },
  tyre: { dmg: 10, speed: 4.6, y: 0.22, breaks: false }, // rolls along the road: jump it
}
export const PICK_RANGE = 0.75 // stand this close to an item to throw it
const HEAVY = new Set(['kick', 'air'])
export const JUMP_V = 6.2 // m/s up: about a metre high, 0.7 s in the air
export const GRAVITY = 18
const RECOIL = 0.34 // a blocked heavy blow: open for this long
const OVER_KICK = 0.35 // this high off the ground, a kick passes underneath
export const COIN = 50 // naira per coin the crowd throws
const MOVE_SPEED = 2.3
const DODGE_TIME = 0.42
const DODGE_COOLDOWN = 1.0
const STUN_TIME = 0.38
const MIN_GAP = 0.85
export const ARENA = 5.5 // metres either side of the centre: the walls
const BLOCK_FACTOR = 0.2
const SPECIAL_CHIP = 0.35 // a blocked special still stings a little
const HIGH = new Set(['punch', 'special']) // what a squat ducks under
export const COMBO_WINDOW = 1.6 // seconds to land the next hit
const COMBO_BONUS = 0.15 // extra damage per step after the first
const COMBO_MAX = 5

function fighter(x, hp) {
  return { x, y: 0, vy: 0, airUsed: false, crouching: false, hp, maxHp: hp, action: null, blocking: false, dodgeT: 0, dodgeCd: 0, stunT: 0, special: 0, moving: 0, combo: 0, comboT: 0, ai: { think: 0.6, blockT: 0, move: 0 } }
}

/**
 * profile: opponent { hp, power, speed, block, aggression }
 * opts: { energy, notoriety, difficulty }
 */
export function createFight(profile, { energy = 70, notoriety = 0, difficulty = 1, pace = 1, items = true, seed = 1 } = {}) {
  const scale = 1 + notoriety / 200 + (difficulty - 1) * 0.15
  // a few things lying about, away from where the fighters start
  const kinds = Object.keys(THROWABLES)
  const spots = [-4.4, -3, 3, 4.4]
  const placed = items ? spots.map((x, i) => ({ id: i, kind: kinds[(seed + i * 3) % kinds.length], x: x + (((seed * 7 + i * 13) % 10) - 5) * 0.04 })) : []
  return {
    pace,
    items: placed,
    flying: [],
    p: fighter(-1.6, Math.round(70 + energy * 0.3)),
    o: fighter(1.6, Math.round((profile.hp || 90) * scale)),
    profile: { speed: 1, block: 0.25, aggression: 0.5, ...profile, power: (profile.power || 1) * scale },
    time: 0,
    over: null,
    events: [],
    coins: 0,
  }
}

const total = (m) => m.startup + m.active + m.recover
const busy = (f) => Boolean(f.action) || f.stunT > 0
export const airborne = (f) => f.y > 0 || f.vy > 0

/** The item on the ground within reach of this fighter, if any. */
export function itemNear(state, f) {
  if (airborne(f)) return null
  let best = null
  for (const it of state.items || []) if (Math.abs(it.x - f.x) < PICK_RANGE && (!best || Math.abs(it.x - f.x) < Math.abs(best.x - f.x))) best = it
  return best
}

function startMove(f, type, state = null) {
  if (busy(f) || f.dodgeT > 0) return false
  if (type === 'throw') {
    const it = state && itemNear(state, f)
    if (!it) return false
    state.items = state.items.filter((x) => x !== it)
    f.action = { type, t: 0, hit: false, item: it.kind }
    f.blocking = false
    return true
  }
  // in the air, any attack is the flying kick (one a jump); on the ground, never
  if (airborne(f)) {
    if (f.airUsed) return false
    type = 'air'
    f.airUsed = true
  } else if (type === 'air') return false
  if (type === 'special' && f.special < 100) return false
  if (type === 'special') f.special = 0
  f.action = { type, t: 0, hit: false }
  f.blocking = false
  return true
}

function tryJump(f) {
  if (busy(f) || airborne(f) || f.dodgeT > 0) return false
  f.vy = JUMP_V
  f.airUsed = false
  f.blocking = false
  return true
}

function tryDodge(f, dir) {
  if (busy(f) || f.dodgeCd > 0 || airborne(f)) return false
  f.dodgeT = DODGE_TIME
  f.dodgeCd = DODGE_COOLDOWN
  f.x += dir * 0.9
  f.blocking = false
  return true
}

function resolveHit(state, attacker, defender, who, power) {
  const m = MOVES[attacker.action.type]
  const dist = Math.abs(defender.x - attacker.x)
  if (attacker.action.hit || attacker.action.t < m.startup || attacker.action.t > m.startup + m.active) return
  if (dist > m.range) return
  attacker.action.hit = true
  if (attacker.action.type === 'kick' && defender.y > OVER_KICK) {
    attacker.combo = 0
    state.events.push({ type: 'jumped', who })
    return
  }
  if (defender.crouching && HIGH.has(attacker.action.type)) {
    attacker.combo = 0
    state.events.push({ type: 'ducked', who })
    return
  }
  if (defender.dodgeT > 0) {
    attacker.combo = 0
    state.events.push({ type: 'dodged', who })
    return
  }
  const moveType = attacker.action.type
  const blocked = defender.blocking
  // a clean hit soon after the last one continues the chain
  attacker.combo = blocked ? 0 : Math.min(COMBO_MAX, attacker.comboT > 0 ? attacker.combo + 1 : 1)
  attacker.comboT = blocked ? 0 : COMBO_WINDOW
  const chain = who === 'player' ? 1 + Math.max(0, attacker.combo - 1) * COMBO_BONUS : 1
  const dmg = Math.round(m.dmg * power * chain * (blocked ? (moveType === 'special' ? SPECIAL_CHIP : BLOCK_FACTOR) : 1))
  defender.hp = Math.max(0, defender.hp - dmg)
  attacker.special = Math.min(100, attacker.special + dmg * 2.2)
  defender.special = Math.min(100, defender.special + dmg * 1.2)
  if (!blocked) {
    defender.stunT = STUN_TIME
    defender.action = null
    const dir = Math.sign(defender.x - attacker.x) || 1
    defender.x += dir * (attacker.action.type === 'special' ? 1.2 : 0.35)
  }
  // a heavy blow into a guard: the thrower stumbles back, open for a moment
  const recoil = blocked && HEAVY.has(attacker.action.type)
  if (recoil) {
    attacker.action = null
    attacker.stunT = RECOIL
  }
  // the crowd throws money for the good stuff (only the player's)
  let coins = 0
  if (!blocked && who === 'player') coins = moveType === 'special' ? 3 : attacker.combo >= 2 ? 1 : 0
  if (coins) state.coins += coins
  state.events.push({ type: blocked ? 'blocked' : 'hit', who, move: moveType, dmg, combo: attacker.combo, recoil, coins })
}

function think(state, dt, rng) {
  const o = state.o
  const p = state.p
  const prof = state.profile
  o.ai.think -= dt
  o.ai.blockT = Math.max(0, o.ai.blockT - dt)
  // react to an incoming attack
  if (p.action && p.action.t < 0.12 && !busy(o) && o.ai.blockT <= 0 && rng() < prof.block * dt * 7) {
    if (rng() < 0.3) tryDodge(o, 1)
    else o.ai.blockT = 0.55
  }
  // something thrown at them: they may see it coming and guard
  const incoming = (state.flying || []).find((q) => q.owner === 'p' && q.x < o.x && o.x - q.x < 2.4)
  if (incoming && !busy(o) && o.ai.blockT <= 0 && rng() < prof.block * dt * 6) o.ai.blockT = 0.6
  o.blocking = o.ai.blockT > 0 && !busy(o)
  if (o.ai.think > 0 || busy(o) || o.blocking) return
  o.ai.think = Math.max(0.18, 0.55 - prof.aggression * 0.3) * (0.7 + rng() * 0.6)
  const dist = o.x - p.x
  // in the air: the flying kick when it can reach
  if (airborne(o)) {
    if (dist < MOVES.air.range && !o.airUsed) startMove(o, 'air')
    return
  }
  // now and then, leap in from just out of reach
  if (dist > 1.7 && dist < 2.7 && rng() < prof.aggression * 0.22) {
    o.ai.move = -1
    o.ai.think = 0.15 // look again soon, while in the air
    return tryJump(o)
  }
  if (o.special >= 100 && dist < MOVES.special.range && rng() < 0.6) return startMove(o, 'special')
  // standing by something to throw, and not too close: let it fly
  if (dist > 1.6 && itemNear(state, o) && rng() < prof.aggression * 0.6) return startMove(o, 'throw', state)
  // walk over to pick something up now and then
  if (dist > 2.2 && rng() < prof.aggression * 0.15) {
    const it = (state.items || []).filter((x) => x.x > p.x + 1).sort((a, b) => Math.abs(a.x - o.x) - Math.abs(b.x - o.x))[0]
    if (it && Math.abs(it.x - o.x) < 2.5) {
      o.ai.move = Math.sign(it.x - o.x)
      return
    }
  }
  if (dist > MOVES.kick.range - 0.05) o.ai.move = -1 // close in
  else if (dist < 0.95) o.ai.move = 1 // too close: step back
  else if (rng() < prof.aggression) {
    o.ai.move = 0
    // only throw what can reach
    startMove(o, dist <= MOVES.punch.range - 0.05 && rng() < 0.55 ? 'punch' : 'kick')
  } else o.ai.move = dist > MOVES.punch.range ? -1 : rng() < 0.5 ? 1 : 0
}

/** Thrown things fly; whoever they reach blocks, ducks, jumps, dodges or takes it. */
function stepFlying(state, dt) {
  if (!state.flying?.length) return
  const keep = []
  for (const q of state.flying) {
    q.x += q.vx * dt
    q.spin += dt * (q.kind === 'tyre' ? 9 : 14)
    const T = THROWABLES[q.kind]
    const target = q.owner === 'p' ? state.o : state.p
    const who = q.owner === 'p' ? 'player' : 'opponent'
    const thrower = q.owner === 'p' ? state.p : state.o
    const reached = !q.passed && Math.abs(q.x - target.x) < 0.35
    const off = Math.abs(q.x) > ARENA + 0.3
    const drop = (x) => !T.breaks && state.items.push({ id: `${q.kind}${state.time}`, kind: q.kind, x: Math.max(-ARENA + 0.3, Math.min(ARENA - 0.3, x)) })
    if (off) {
      drop(Math.sign(q.x) * (ARENA - 0.4)) // it hits the wall and falls
      continue
    }
    if (!reached) {
      keep.push(q)
      continue
    }
    const high = T.y > 0.6
    if (target.dodgeT > 0 || (high && target.crouching) || (!high && target.y > 0.3)) {
      state.events.push({ type: target.dodgeT > 0 ? 'dodged' : high ? 'ducked' : 'jumped', who })
      q.passed = true // it sails on past
      keep.push(q)
      continue
    }
    const power = q.owner === 'p' ? state.mods?.dealt ?? 1 : state.profile.power * (state.mods?.taken ?? 1)
    const blocked = target.blocking
    const dmg = Math.round(T.dmg * power * (blocked ? BLOCK_FACTOR : 1))
    target.hp = Math.max(0, target.hp - dmg)
    thrower.special = Math.min(100, thrower.special + dmg * 1.5)
    if (!blocked) {
      target.stunT = STUN_TIME
      target.action = null
    }
    state.events.push({ type: blocked ? 'blocked' : 'hit', who, move: 'throw', item: q.kind, dmg, combo: 0, coins: 0 })
    drop(target.x + Math.sign(q.vx) * 0.6)
  }
  state.flying = keep
}

/**
 * Advance the fight. input: { move: -1..1, punch, kick, special, dodge (pressed this frame), block (held) }
 * Returns the same (mutated) state; read state.events for what happened this step.
 */
export function stepFight(state, input, dt, rng = Math.random) {
  if (state.over) return state
  state.events = []
  dt *= state.pace ?? 1 // the whole fight runs at its pace
  state.time += dt
  const { p, o } = state

  for (const f of [p, o]) {
    // the jump: up, down, and an attack ends when the feet touch the road
    if (airborne(f)) {
      f.vy -= GRAVITY * dt
      f.y += f.vy * dt
      if (f.y <= 0) {
        f.y = 0
        f.vy = 0
        if (f.action?.type === 'air') f.action = null
      }
    }
    f.stunT = Math.max(0, f.stunT - dt)
    f.dodgeT = Math.max(0, f.dodgeT - dt)
    f.dodgeCd = Math.max(0, f.dodgeCd - dt)
    f.comboT = Math.max(0, f.comboT - dt)
    if (f.comboT <= 0) f.combo = 0
    if (f.action) {
      const before = f.action.t
      f.action.t += dt
      // the throw lets go at the end of its wind-up
      if (f.action.type === 'throw' && before < MOVES.throw.startup && f.action.t >= MOVES.throw.startup) {
        const dir = f === p ? 1 : -1
        const T = THROWABLES[f.action.item]
        state.flying = state.flying || []
        state.flying.push({ kind: f.action.item, x: f.x + dir * 0.45, y: T.y, vx: dir * T.speed, owner: f === p ? 'p' : 'o', spin: 0 })
        state.events.push({ type: 'throw', who: f === p ? 'player' : 'opponent', item: f.action.item })
      }
      if (f.action && f.action.t >= total(MOVES[f.action.type])) f.action = null
    }
  }
  stepFlying(state, dt)

  // player intent
  if (input.punch) startMove(p, 'punch')
  if (input.kick) startMove(p, 'kick')
  if (input.special) startMove(p, 'special')
  if (input.throw) startMove(p, 'throw', state)
  if (input.dodge) tryDodge(p, -1)
  if (input.jump) tryJump(p)
  // guarding: the shield, or holding back while their blow is coming. A guard
  // also cuts short the end of your own swing or the tail of a stagger.
  const threat = (o.action && o.action.t < MOVES[o.action.type].startup + MOVES[o.action.type].active) || (state.flying || []).some((q) => q.owner === 'o' && q.x > p.x && q.x - p.x < 2.5)
  const wantsGuard = Boolean(input.block) || ((input.move || 0) < 0 && threat)
  if (wantsGuard && p.action && p.action.t > MOVES[p.action.type].startup + MOVES[p.action.type].active && !airborne(p)) p.action = null
  if (wantsGuard && p.stunT > 0 && p.stunT < 0.15) p.stunT = 0
  p.blocking = wantsGuard && !busy(p) && p.dodgeT <= 0 && !airborne(p)
  p.crouching = Boolean(input.crouch) && !p.blocking && !busy(p) && p.dodgeT <= 0 && !airborne(p)
  // you can steer a little in the air, even while kicking
  p.moving = (!busy(p) || airborne(p)) && !p.blocking && !p.crouching ? input.move || 0 : 0
  p.x += p.moving * MOVE_SPEED * dt

  // opponent
  think(state, dt, rng)
  o.moving = (!busy(o) || airborne(o)) && !o.blocking ? o.ai.move : 0
  o.x += o.moving * MOVE_SPEED * state.profile.speed * dt

  // hits
  // power-ups (systems/powerups.js) scale what you deal and what you take
  if (p.action) resolveHit(state, p, o, 'player', state.mods?.dealt ?? 1)
  if (o.action) resolveHit(state, o, p, 'opponent', state.profile.power * (state.mods?.taken ?? 1))

  // keep them apart and in the arena (player always on the left)
  if (o.x - p.x < MIN_GAP) {
    const mid = (o.x + p.x) / 2
    p.x = mid - MIN_GAP / 2
    o.x = mid + MIN_GAP / 2
  }
  p.x = Math.max(-ARENA, Math.min(ARENA - MIN_GAP, p.x))
  o.x = Math.max(-ARENA + MIN_GAP, Math.min(ARENA, o.x))

  if (o.hp <= 0) state.over = 'won'
  else if (p.hp <= 0) state.over = 'lost'
  return state
}

/** Which animation each fighter should play right now. */
export function animOf(f, over, isWinner) {
  if (over) return isWinner ? 'cheer' : 'knockedOut'
  if (f.stunT > 0) return 'hit'
  if (f.action) return MOVES[f.action.type].anim
  if (f.dodgeT > 0) return 'blockOutward'
  if (f.blocking) return 'block'
  if (f.moving) return 'walk'
  return 'fightIdle'
}

export function animSpeedOf(f) {
  if (f.stunT > 0) return 3 // the flinch peaks about a second into the clip; the stun is short
  if (f.action) return MOVES[f.action.type].animSpeed
  if (f.dodgeT > 0) return 2
  return 1
}
