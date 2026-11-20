// GRASS TO GRACE · Palm Climb. Up the palm in a rope loop to bring down the
// calabash of palm wine. Tap LEFT or RIGHT to move your hands up that side of
// the trunk; soldier ants and wasp nests sit on one side or the other, so climb
// the clear side. When the wind gusts, hold still. Three stings and you slide
// all the way down. Reach the top before the sun gets hot.
// Params: height (rings to climb, 32) · seconds (45)
// Outcomes: won | lost
import { rng, rect, box, label, clamp } from '../px.js'
import { drawPerson } from '../people.js'

export function makeTrunk(r, n, hazard = 0.62) {
  const h = [null, null, null]
  let last = null
  for (let i = 3; i < n; i++) {
    let x = null
    if (r() < hazard) x = r() < 0.5 ? 'L' : 'R'
    if (x && x === last && r() < 0.3) x = null // breathing space
    h.push(x ? { side: x, kind: r() < 0.7 ? 'ants' : 'wasps' } : null)
    last = x
  }
  return h
}

export function create(params = {}, seed = 1) {
  const r = rng(seed)
  const top = params.height ?? 32
  return { r, you: params.you || 7, top, trunk: makeTrunk(r, top + 4, params.hazard ?? 0.62), stingMax: params.stingMax ?? 3, at: 0, time: params.seconds ?? 45, stings: 0, gust: 0, gustNext: 6 + r() * 4, warn: 0, slip: 0, lastSide: 'L', msg: '', msgT: 0, over: false, reached: false, sound: [] }
}

/** Tap a side: climb one ring, unless that side of the next ring has a hazard (or the wind is blowing). */
export function climb(s, side) {
  if (s.over || s.slip > 0) return
  s.lastSide = side
  if (s.gust > 0) {
    s.stings++
    s.at = Math.max(0, s.at - 2)
    s.slip = 0.5
    s.msg = 'The wind! Hold on, don\'t climb!'
    s.msgT = 1.2
    s.sound.push('wrong')
    return checkFall(s)
  }
  const next = s.trunk[s.at + 1]
  if (next && next.side === side) {
    s.stings++
    s.at = Math.max(0, s.at - 2)
    s.slip = 0.5
    s.msg = next.kind === 'ants' ? 'Soldier ants! Ah, my hand!' : 'Wasps! Yeee!'
    s.msgT = 1.2
    s.sound.push('hurt')
    return checkFall(s)
  }
  s.at++
  s.sound.push('click')
  if (s.at >= s.top) {
    s.reached = true
    s.over = true
    s.sound.push('win')
  }
}

function checkFall(s) {
  if (s.stings >= s.stingMax) {
    s.over = true
    s.at = 0
    s.msg = 'You slide all the way down the trunk.'
    s.msgT = 3
  }
}

export function step(s, dt) {
  s.time -= dt
  s.msgT -= dt
  s.slip = Math.max(0, s.slip - dt)
  if (s.gust > 0) s.gust -= dt
  else if (s.warn > 0) {
    s.warn -= dt
    if (s.warn <= 0) {
      s.gust = 1.4
      s.sound.push('whoosh')
    }
  } else {
    s.gustNext -= dt
    if (s.gustNext <= 0) {
      s.warn = 0.9
      s.gustNext = 5 + s.r() * 5
    }
  }
  if (s.time <= 0) s.over = true
}

export function input(s, ev, v) {
  if (ev.type === 'button') climb(s, ev.id)
  else if (ev.type === 'down') climb(s, ev.x < v.W / 2 ? 'L' : 'R')
}

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  const ring = P * 7
  // the climber stays at about two-thirds height; the trunk scrolls under them
  const climberY = H * 0.66
  const sway = s.gust > 0 ? Math.sin(t * 20) * P * 2 : 0
  rect(ctx, 0, 0, W, H, '#8fd3ff')
  rect(ctx, 0, H * 0.75 + s.at * ring * 0.15, W, H, '#5e8c3a') // the ground drops away as you climb
  // other palms far away
  for (let i = 0; i < 5; i++) {
    const x = ((i * 0.23 + 0.06) % 1) * W
    rect(ctx, x, H * 0.35 + s.at * P * 0.5, P * 2, H, '#7a6a4a')
    rect(ctx, x - P * 6, H * 0.35 + s.at * P * 0.5, P * 14, P * 2, '#3f7a2a')
  }
  const cx = W / 2 + sway
  const tw = P * 12
  // the trunk: rings, hazards on either side
  for (let i = -2; i < 16; i++) {
    const k = s.at + i
    const y = climberY - i * ring
    if (y < -ring || y > H + ring) continue
    if (k > s.top) continue
    rect(ctx, cx - tw / 2, y - ring, tw, ring, k % 2 ? '#8a6a44' : '#7a5c3a')
    rect(ctx, cx - tw / 2, y - P, tw, P, '#5a4024')
    const hz = s.trunk[k]
    if (hz) {
      const hx = hz.side === 'L' ? cx - tw / 2 - P * 5 : cx + tw / 2 + P
      if (hz.kind === 'ants') for (let a = 0; a < 6; a++) rect(ctx, hx + ((a * 3) % 4) * P, y - ring + P + a * P, P, P, '#b3261e')
      else {
        box(ctx, hx, y - ring + P, P * 4, P * 5, '#c9b07a', Math.max(1, P / 2))
        const bz = Math.sin(t * 15 + k) * P
        rect(ctx, hx + P * 2 + bz, y - ring - P, P, P, '#ffd23a')
      }
    }
  }
  // the crown of fronds and the calabash at the top
  const topY = climberY - (s.top - s.at) * ring
  if (topY > -P * 30) {
    for (let f = -3; f <= 3; f++) rect(ctx, cx + f * P * 6 - P * 3, topY - ring - Math.abs(f) * P * 2, P * 9, P * 3, '#2f7a2a')
    box(ctx, cx - P * 4, topY - ring + P * 2, P * 8, P * 6, '#c8a46a', P)
  }
  // the climber in the rope loop
  drawPerson(ctx, s.you, cx + (s.lastSide === 'L' ? -P * 2 : P * 2), climberY + P * 8, P, { pose: s.slip > 0 ? 'hit' : 'idle', t })
  rect(ctx, cx - tw / 2 - P * 2, climberY - P * 6, tw + P * 4, P, '#c8a46a')
  if (s.warn > 0) label(ctx, 'WIND COMING… HOLD!', W / 2, H * 0.16, { size: P * 4.5, color: '#ffd23a' })
  if (s.gust > 0) label(ctx, 'HOLD ON!', W / 2, H * 0.16, { size: P * 6, color: '#ff6b4a' })
  if (s.msgT > 0) label(ctx, s.msg, W / 2, H * 0.9, { size: Math.max(12, P * 3.6), alpha: clamp(s.msgT, 0, 1) })
  // height gauge
  const gh = H * 0.5
  rect(ctx, W - P * 6, H * 0.25, P * 3, gh, '#2a1808')
  rect(ctx, W - P * 6, H * 0.25 + gh * (1 - s.at / s.top), P * 3, gh * (s.at / s.top), '#ffd23a')
}

export const hud = (s) => [
  { label: 'TIME', value: Math.max(0, Math.ceil(s.time)), warn: s.time < 8 },
  { label: 'HEIGHT', value: `${s.at}/${s.top}` },
  { label: 'STINGS', value: '✖'.repeat(s.stings) || '–', warn: s.stings >= 2 },
]
export const buttons = (s) => [
  { id: 'L', label: '◀ LEFT', color: s.gust > 0 ? '#555' : '#7a5c3a', key: '←' },
  { id: 'R', label: 'RIGHT ▶', color: s.gust > 0 ? '#555' : '#7a5c3a', key: '→' },
]

export function result(s) {
  const won = s.reached
  return {
    outcome: won ? 'won' : 'lost',
    score: s.reached ? s.top + Math.ceil(s.time) : s.at,
    moneyChange: won ? 3000 : 0,
    headline: won ? 'Fresh palm wine, straight from the tree!' : s.stings >= 3 ? 'Down you come, faster than you went up.' : 'The sun is too hot to climb now.',
    line: won ? 'The calabash is full and still fizzing. Papa Ngwo would have approved.' : 'The old men under the shade pretend they didn\'t see.',
  }
}

export default {
  id: 'palmClimb', title: 'Palm Climb', scoreLabel: 'rings', start: 'Tie the rope loop',
  rules: ['Tap LEFT or RIGHT (or the left and right of the screen) to climb that side of the trunk.', 'Soldier ants and wasp nests sit on one side of a ring: climb the clear side.', '"WIND COMING" means stop tapping until it passes.', 'Three stings and you slide down. Reach the calabash at the top before time runs out.'],
  short: 'Climb the clear side. Hold still in the wind.',
  keys: { ArrowLeft: 'L', ArrowRight: 'R', KeyA: 'L', KeyD: 'R' },
  create, step, input, draw, hud, buttons, result,
}
