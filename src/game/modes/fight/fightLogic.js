// Fight rules, pure (no React): two fighters on a line, the player on the
// left facing right. Cartoon fighting: no blood, knock-outs are a flop to
// the ground.
//
// Moves: punch, kick, special ("Lagos Roundabout"), block (hold), dodge
// (quick backstep with a moment of no-hit). Hits fill the special meter.

export const MOVES = {
  punch: { startup: 0.2, active: 0.12, recover: 0.3, range: 1.45, dmg: 8, anim: 'punch', animSpeed: 2.2 },
  kick: { startup: 0.34, active: 0.12, recover: 0.45, range: 1.9, dmg: 12, anim: 'kick', animSpeed: 1.7 },
  special: { startup: 0.45, active: 0.2, recover: 0.6, range: 2.15, dmg: 26, anim: 'roundhouse', animSpeed: 1.95 },
}
const MOVE_SPEED = 2.3
const DODGE_TIME = 0.42
const DODGE_COOLDOWN = 1.0
const STUN_TIME = 0.38
const MIN_GAP = 0.85
const ARENA = 5.5 // metres either side of the centre
const BLOCK_FACTOR = 0.2

function fighter(x, hp) {
  return { x, hp, maxHp: hp, action: null, blocking: false, dodgeT: 0, dodgeCd: 0, stunT: 0, special: 0, moving: 0, ai: { think: 0.6, blockT: 0, move: 0 } }
}

/**
 * profile: opponent { hp, power, speed, block, aggression }
 * opts: { energy, notoriety, difficulty }
 */
export function createFight(profile, { energy = 70, notoriety = 0, difficulty = 1 } = {}) {
  const scale = 1 + notoriety / 200 + (difficulty - 1) * 0.15
  return {
    p: fighter(-1.6, Math.round(70 + energy * 0.3)),
    o: fighter(1.6, Math.round((profile.hp || 90) * scale)),
    profile: { speed: 1, block: 0.25, aggression: 0.5, ...profile, power: (profile.power || 1) * scale },
    time: 0,
    over: null,
    events: [],
  }
}

const total = (m) => m.startup + m.active + m.recover
const busy = (f) => Boolean(f.action) || f.stunT > 0

function startMove(f, type) {
  if (busy(f) || f.dodgeT > 0) return false
  if (type === 'special' && f.special < 100) return false
  if (type === 'special') f.special = 0
  f.action = { type, t: 0, hit: false }
  f.blocking = false
  return true
}

function tryDodge(f, dir) {
  if (busy(f) || f.dodgeCd > 0) return false
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
  if (defender.dodgeT > 0) {
    state.events.push({ type: 'dodged', who })
    return
  }
  const blocked = defender.blocking && attacker.action.type !== 'special'
  const dmg = Math.round(m.dmg * power * (blocked ? BLOCK_FACTOR : 1))
  defender.hp = Math.max(0, defender.hp - dmg)
  attacker.special = Math.min(100, attacker.special + dmg * 2.2)
  defender.special = Math.min(100, defender.special + dmg * 1.2)
  if (!blocked) {
    defender.stunT = STUN_TIME
    defender.action = null
    const dir = Math.sign(defender.x - attacker.x) || 1
    defender.x += dir * (attacker.action.type === 'special' ? 1.2 : 0.35)
  }
  state.events.push({ type: blocked ? 'blocked' : 'hit', who, move: attacker.action.type, dmg })
}

function think(state, dt, rng) {
  const o = state.o
  const p = state.p
  const prof = state.profile
  o.ai.think -= dt
  o.ai.blockT = Math.max(0, o.ai.blockT - dt)
  // react to an incoming attack
  if (p.action && p.action.t < 0.12 && !busy(o) && o.ai.blockT <= 0 && rng() < prof.block * dt * 12) {
    if (rng() < 0.3) tryDodge(o, 1)
    else o.ai.blockT = 0.55
  }
  o.blocking = o.ai.blockT > 0 && !busy(o)
  if (o.ai.think > 0 || busy(o) || o.blocking) return
  o.ai.think = Math.max(0.18, 0.55 - prof.aggression * 0.3) * (0.7 + rng() * 0.6)
  const dist = o.x - p.x
  if (o.special >= 100 && dist < MOVES.special.range && rng() < 0.6) return startMove(o, 'special')
  if (dist > MOVES.kick.range - 0.05) o.ai.move = -1 // close in
  else if (dist < 0.95) o.ai.move = 1 // too close: step back
  else if (rng() < prof.aggression) {
    o.ai.move = 0
    // only throw what can reach
    startMove(o, dist <= MOVES.punch.range - 0.05 && rng() < 0.55 ? 'punch' : 'kick')
  } else o.ai.move = dist > MOVES.punch.range ? -1 : rng() < 0.5 ? 1 : 0
}

/**
 * Advance the fight. input: { move: -1..1, punch, kick, special, dodge (pressed this frame), block (held) }
 * Returns the same (mutated) state; read state.events for what happened this step.
 */
export function stepFight(state, input, dt, rng = Math.random) {
  if (state.over) return state
  state.events = []
  state.time += dt
  const { p, o } = state

  for (const f of [p, o]) {
    f.stunT = Math.max(0, f.stunT - dt)
    f.dodgeT = Math.max(0, f.dodgeT - dt)
    f.dodgeCd = Math.max(0, f.dodgeCd - dt)
    if (f.action) {
      f.action.t += dt
      if (f.action.t >= total(MOVES[f.action.type])) f.action = null
    }
  }

  // player intent
  if (input.punch) startMove(p, 'punch')
  if (input.kick) startMove(p, 'kick')
  if (input.special) startMove(p, 'special')
  if (input.dodge) tryDodge(p, -1)
  p.blocking = Boolean(input.block) && !busy(p) && p.dodgeT <= 0
  p.moving = !busy(p) && !p.blocking ? input.move || 0 : 0
  p.x += p.moving * MOVE_SPEED * dt

  // opponent
  think(state, dt, rng)
  o.moving = !busy(o) && !o.blocking ? o.ai.move : 0
  o.x += o.moving * MOVE_SPEED * state.profile.speed * dt

  // hits
  if (p.action) resolveHit(state, p, o, 'player', 1)
  if (o.action) resolveHit(state, o, p, 'opponent', state.profile.power)

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
