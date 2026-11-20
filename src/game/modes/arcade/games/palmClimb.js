// GRASS TO GRACE · Palm Climb, a vertical platformer. Up the old palm at the
// edge of the farm to bring down the calabash of fresh palm wine. Jump from
// frond to frond (and jump again in the air), up and up: the camera climbs
// with you. Soldier ants march along some fronds, wasps zip back and forth
// under their nests, and ripe palm fruit drops from the crown (a shadow at
// the top shows where). When the wind comes, stand still on a frond and hold
// on: in the air or moving, it blows you sideways. Every sting costs one of
// your three; fall off the bottom of the view and you slide back down to the
// last rest frond, stung. Reach the calabash at the top before time runs out.
// Palm nuts on the way are a bonus.
// Params: height (fronds to the top, 32) · seconds (60) · hazard (0..1, 0.62) · stingMax (3)
// Outcomes: won | lost
import { rng, rect, box, label, clamp } from '../px.js'
import { lookFor } from '../people.js'
import { drawEris } from '../../../characters/eris.js'

// world units: 10 to a metre; y grows downwards and the farm is y = 0
export const G = 1500
export const RUN = 135
export const JUMP_V = 560 // about 100 up
export const DOUBLE_V = 470
export const GAP = 62 // between frond levels
export const HALF = 120 // fronds reach this far either side of the trunk
const PW = 14
const STAND_H = 52
const WIND_PUSH = 160
const REST_EVERY = 8 // a wide rest frond (a checkpoint) every so many levels
const FALL_LINE = 320 // this far below the camera you've fallen out of the view

/** The palm: fronds (platforms) up both sides, ants, wasps, palm nuts, the calabash at the top. */
export function buildPalm({ height = 32, hazard = 0.62, seed = 1 } = {}) {
  const r = rng(seed)
  const fronds = [{ x: -HALF, w: HALF * 2, y: 0, ground: true }] // the farm
  const ants = []
  const wasps = []
  const nuts = []
  let side = r() < 0.5 ? -1 : 1
  for (let i = 1; i <= height; i++) {
    const y = -i * GAP
    if (i % REST_EVERY === 0 || i === height) {
      fronds.push({ x: -55, w: 110, y, rest: true, top: i === height })
      continue
    }
    // mostly alternating sides, sometimes two on a level
    side = r() < 0.75 ? -side : side
    const w = 46 + r() * 30
    const x = side < 0 ? -HALF + r() * 30 : HALF - w - r() * 30
    const f = { x, w, y, sway: r() < 0.25 + hazard * 0.2 ? 6 + r() * 10 : 0, ph: r() * 6 }
    fronds.push(f)
    if (r() < 0.3) fronds.push({ x: -16 - r() * 10, w: 32, y: y - GAP / 2, stub: true }) // an old frond stub on the trunk
    if (i > 2 && r() < hazard * 0.45) ants.push({ frond: fronds.length - 1, t: r() * 10, speed: 18 + r() * 14 })
    if (i > 4 && r() < hazard * 0.3) wasps.push({ y: y + GAP * 0.45, x0: -HALF + 10, x1: HALF - 10, t: r() * 6, speed: 0.5 + r() * 0.5 })
    if (r() < 0.45) nuts.push({ x: x + w / 2, y: y - 22, got: false })
  }
  return { fronds, ants, wasps, nuts, top: -height * GAP, height }
}

function freshClimber(x = 0, y = 0) {
  return { x, y, vx: 0, vy: 0, dir: 1, ground: true, jumps: 0, coyote: 0, invul: 0, hit: 0 }
}

export function create(params = {}, seed = 1) {
  const r = rng(seed)
  const palm = buildPalm({ height: params.height ?? 32, hazard: params.hazard ?? 0.62, seed })
  return {
    r,
    you: params.you || 7,
    palm,
    p: freshClimber(),
    held: { left: false, right: false },
    stick: null,
    stings: 0,
    stingMax: params.stingMax ?? 3,
    time: params.seconds ?? 60,
    best: 0, // highest frond level reached
    checkpoint: { x: 0, y: 0 },
    nuts: 0,
    fruit: [], // ripe palm fruit falling
    fruitNext: 4 + r() * 3,
    gust: 0,
    gustDir: 1,
    warn: 0,
    gustNext: 7 + r() * 4,
    camY: -150,
    t: 0,
    msg: 'Up the palm! Jump from frond to frond.',
    msgT: 2.5,
    reached: false,
    over: false,
    sound: [],
  }
}

const level = (y) => Math.max(0, Math.round(-y / GAP))
/** Where a frond is right now (some sway in the breeze). */
const frondX = (f, t) => f.x + (f.sway ? Math.sin(t * 1.4 + f.ph) * f.sway : 0)

export function press(s, id, down = true) {
  if (id === 'left' || id === 'right') {
    s.held[id] = down
    return
  }
  if (id !== 'jump' || !down || s.over) return
  const p = s.p
  if (p.ground || p.coyote > 0) {
    p.vy = -JUMP_V
    p.ground = false
    p.coyote = 0
    p.jumps = 1
    s.sound.push('jump')
  } else if (p.jumps < 2) {
    p.vy = -DOUBLE_V
    p.jumps = 2
    s.sound.push('jump')
  }
}

/** Kept for the old tap game's API (and the tests): a tap on a side is a jump that way. */
export function climb(s, side) {
  s.held.left = side === 'L'
  s.held.right = side === 'R'
  press(s, 'jump')
}

function sting(s, from, why) {
  const p = s.p
  if (p.invul > 0 || s.over) return
  s.stings++
  p.invul = 1.3
  p.hit = 0.4
  p.vx = (p.x > from ? 1 : -1) * 160
  p.vy = Math.min(p.vy, -200)
  s.msg = why
  s.msgT = 1.4
  s.sound.push('hurt')
  if (s.stings >= s.stingMax) {
    s.over = true
    s.msg = 'Too many stings: you slide all the way down the trunk.'
    s.msgT = 3
  }
}

export function step(s, dt) {
  if (s.over) return
  s.t += dt
  s.time -= dt
  s.msgT -= dt
  const p = s.p
  const pm = s.palm
  p.invul = Math.max(0, p.invul - dt)
  p.hit = Math.max(0, p.hit - dt)
  // the wind: a warning, then a gust that blows anyone not standing still on a frond
  if (s.gust > 0) s.gust -= dt
  else if (s.warn > 0) {
    s.warn -= dt
    if (s.warn <= 0) {
      s.gust = 1.5
      s.gustDir = s.r() < 0.5 ? -1 : 1
      s.sound.push('whoosh')
    }
  } else if ((s.gustNext -= dt) <= 0) {
    s.warn = 1.1
    s.gustNext = 6 + s.r() * 5
  }
  // moving: the stick or the buttons
  const want = s.stick != null && Math.abs(s.stick) > 0.15 ? s.stick : (s.held.right ? 1 : 0) - (s.held.left ? 1 : 0)
  if (want) p.dir = Math.sign(want)
  if (p.hit <= 0) p.vx += (want * RUN - p.vx) * Math.min(1, dt * (p.ground ? 14 : 6))
  const holding = p.ground && !want
  if (s.gust > 0 && !holding) p.vx += s.gustDir * WIND_PUSH * dt * 4
  // gravity, landing on fronds from above (they're one-way)
  const oldY = p.y
  p.vy = Math.min(p.vy + G * dt, 1000)
  let ny = p.y + p.vy * dt
  let landed = null
  if (p.vy >= 0)
    for (const f of pm.fronds) {
      const fx = frondX(f, s.t)
      if (p.x + PW / 2 > fx && p.x - PW / 2 < fx + f.w && f.y >= oldY - 0.01 && f.y <= ny + 0.01) landed = !landed || f.y < landed.y ? f : landed
    }
  if (landed) {
    ny = landed.y
    p.vy = 0
    p.ground = true
    p.jumps = 0
    p.coyote = 0.1
    // riding a swaying frond
    if (landed.sway) p.x += frondX(landed, s.t) - frondX(landed, s.t - dt)
    const lv = level(landed.y)
    if (lv > s.best) s.best = lv
    if (landed.rest && landed.y < s.checkpoint.y) {
      s.checkpoint = { x: frondX(landed, s.t) + landed.w / 2, y: landed.y }
      s.msg = 'A good wide frond: if you fall, you start again from here.'
      s.msgT = 1.6
      s.sound.push('correct')
    }
    if (landed.top && !s.reached) {
      s.reached = true
      s.over = true
      s.sound.push('win')
    }
  } else {
    if (p.ground) p.coyote = 0.1
    p.ground = false
  }
  p.coyote = Math.max(0, p.coyote - dt)
  p.y = ny
  p.x = clamp(p.x + p.vx * dt, -HALF - 30, HALF + 30)
  // the camera climbs with you, and doesn't come back down
  const target = p.y - 150
  if (target < s.camY) s.camY += (target - s.camY) * Math.min(1, dt * 5)
  // fell off the bottom of the view: slide back to the last rest frond, stung
  if (p.y > s.camY + FALL_LINE) {
    const cp = s.checkpoint
    s.p = freshClimber(cp.x, cp.y)
    s.camY = cp.y - 150
    sting(s, cp.x, 'You slip down the trunk to the last wide frond.')
    s.p.vx = 0
    s.p.vy = 0
  }
  // soldier ants along their fronds
  for (const a of pm.ants) {
    a.t += dt
    const f = pm.fronds[a.frond]
    const fx = frondX(f, s.t)
    const ax = fx + 6 + ((Math.sin(a.t * a.speed * 0.05) + 1) / 2) * (f.w - 12)
    a.x = ax
    a.y = f.y
    if (Math.abs(ax - p.x) < 12 && Math.abs(f.y - p.y) < 8) sting(s, ax, 'Soldier ants! Ah, my leg!')
  }
  // wasps zipping back and forth
  for (const w of pm.wasps) {
    w.t += dt
    w.x = w.x0 + ((Math.sin(w.t * w.speed) + 1) / 2) * (w.x1 - w.x0)
    if (Math.abs(w.x - p.x) < 12 && p.y - STAND_H < w.y + 6 && p.y > w.y - 6) sting(s, w.x, 'Wasp! Yeee!')
  }
  // ripe palm fruit drops from the crown, above you
  if ((s.fruitNext -= dt) <= 0) {
    s.fruit.push({ x: clamp(p.x + (s.r() - 0.5) * 140, -HALF + 10, HALF - 10), y: s.camY - 60, vy: 0, warn: 0.9 })
    s.fruitNext = 3 + s.r() * 3
  }
  for (const f of s.fruit) {
    if (f.warn > 0) {
      f.warn -= dt
      continue
    }
    f.vy += G * 0.6 * dt
    f.y += f.vy * dt
    if (Math.abs(f.x - p.x) < 12 && f.y > p.y - STAND_H && f.y < p.y + 4) {
      f.gone = true
      sting(s, f.x, 'Palm fruit on the head! Ouch.')
    }
  }
  s.fruit = s.fruit.filter((f) => !f.gone && f.y < s.camY + 400)
  // palm nuts
  for (const n of pm.nuts)
    if (!n.got && Math.abs(n.x - p.x) < 14 && n.y > p.y - STAND_H && n.y < p.y + 6) {
      n.got = true
      s.nuts++
      s.sound.push('coin')
    }
  if (s.time <= 0) s.over = true
}

export function input(s, ev) {
  if (ev.type === 'button') press(s, ev.id, ev.down !== false)
  else if (ev.type === 'stick') {
    s.stick = ev.x
    if (ev.y > 0.6 && !s.stickUp) press(s, 'jump')
    s.stickUp = ev.y > 0.6
  }
}

// ---------------------------------------------------------------- drawing
function frond(ctx, x, y, w, k, t, rest) {
  // a palm frond seen side-on: the stalk, leaflets drooping off it
  const thick = rest ? 6 : 4
  rect(ctx, x, y, w, thick * k, '#6b8a2a')
  rect(ctx, x, y + thick * k, w, 2 * k, '#4a6a1e')
  for (let i = 0; i < w / (6 * k); i++) {
    const lx = x + i * 6 * k + 2 * k
    const droop = (6 + ((i * 7) % 5)) * k
    rect(ctx, lx, y + thick * k, 2 * k, droop, i % 2 ? '#3f8a2a' : '#5aa63a')
  }
  void t
}

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  // the view: the palm's width fits the screen; the camera follows you up
  const k = Math.max(1, Math.min(W / (HALF * 2 + 80), H / 300))
  const cx = W / 2
  const X = (x) => cx + x * k
  const Y = (y) => H * 0.62 + (y - s.camY - 150) * k // you climb at about two-thirds down the screen
  const pm = s.palm
  const hgt = clamp(-s.camY / -pm.top, 0, 1)
  // sky: deeper blue the higher you climb
  rect(ctx, 0, 0, W, H, hgt > 0.6 ? '#6cc3f2' : '#8fd3ff')
  // far palms and the farm, drifting slower than the trunk
  for (let i = 0; i < 6; i++) {
    const fx = ((i * 0.19 + 0.05) % 1) * W
    const base = H * 0.95 + (-s.camY) * k * 0.25
    rect(ctx, fx, base - H * 0.6, P * 2, H, '#7a6a4a')
    rect(ctx, fx - P * 7, base - H * 0.6, P * 16, P * 3, '#3f7a2a')
  }
  const ground = Y(0)
  if (ground < H) rect(ctx, 0, ground, W, H - ground, '#5e8c3a')
  // the trunk, ringed
  const tw = 30 * k
  const top = Y(pm.top - 40)
  rect(ctx, cx - tw / 2, Math.max(0, top), tw, Math.min(H, ground) - Math.max(0, top), '#7a5c3a')
  for (let y = Math.floor(s.camY / 14) * 14 - 40; y < s.camY + 400; y += 14) {
    if (y < pm.top - 40 || y > 0) continue
    rect(ctx, cx - tw / 2, Y(y), tw, 2 * k, '#5a4024')
    rect(ctx, cx - tw / 2 + ((y / 14) % 2 ? 4 : 10) * k, Y(y) + 4 * k, 6 * k, 2 * k, '#8a6a44')
  }
  // the crown and the calabash
  const cy = Y(pm.top)
  if (cy > -60 * k) {
    for (let f = -4; f <= 4; f++) rect(ctx, cx + f * 14 * k - 10 * k, cy - 40 * k - Math.abs(f) * 4 * k, 24 * k, 5 * k, '#2f7a2a')
    box(ctx, cx - 9 * k, cy - 28 * k, 18 * k, 16 * k, '#c8a46a', k)
    rect(ctx, cx - 3 * k, cy - 32 * k, 6 * k, 4 * k, '#8a6a44')
    label(ctx, 'PALM WINE', cx, cy - 50 * k, { size: Math.max(10, 5 * k), color: '#fff' })
  }
  // fronds
  for (const f of pm.fronds) {
    if (f.ground) continue
    const y = Y(f.y)
    if (y < -20 || y > H + 20) continue
    frond(ctx, X(frondX(f, s.t)), y, f.w * k, k, t, f.rest)
  }
  // palm nuts
  for (const n of pm.nuts) {
    if (n.got) continue
    const y = Y(n.y)
    if (y < -10 || y > H + 10) continue
    rect(ctx, X(n.x) - 3 * k, y - 3 * k, 6 * k, 6 * k, '#e05a1a')
    rect(ctx, X(n.x) - 1 * k, y - 2 * k, 2 * k, 2 * k, '#ffb070')
  }
  // ants and wasps
  for (const a of pm.ants) {
    if (a.x == null) continue
    const y = Y(a.y)
    if (y < -10 || y > H + 10) continue
    for (let i = 0; i < 4; i++) rect(ctx, X(a.x - 6 + i * 4), y - 2 * k - (i % 2) * k, 2 * k, 2 * k, '#b3261e')
  }
  for (const w of pm.wasps) {
    if (w.x == null) continue
    const y = Y(w.y)
    if (y < -10 || y > H + 10) continue
    rect(ctx, X(w.x) - 4 * k, y - 2 * k, 8 * k, 4 * k, '#ffd23a')
    rect(ctx, X(w.x) - 1 * k, y - 2 * k, 2 * k, 4 * k, '#1a1a1a')
    rect(ctx, X(w.x) - 3 * k, y - 5 * k + Math.sin(t * 40) * k, 6 * k, 2 * k, 'rgba(255,255,255,0.8)')
  }
  // falling fruit (a red warning at the top first)
  for (const f of s.fruit) {
    if (f.warn > 0) {
      label(ctx, '!', X(f.x), 10 + P * 3, { size: P * 6, color: '#ff4d3a' })
      continue
    }
    rect(ctx, X(f.x) - 4 * k, Y(f.y) - 4 * k, 8 * k, 8 * k, '#c0391b')
    rect(ctx, X(f.x) - 2 * k, Y(f.y) - 6 * k, 4 * k, 2 * k, '#2e7a3a')
  }
  // you
  const p = s.p
  const blink = p.invul > 0 && Math.floor(t * 12) % 2 ? 0.4 : 1
  const anim = !p.ground ? 'jump' : Math.abs(p.vx) > 20 ? 'run' : 'idle'
  const frame = !p.ground ? (p.vy < -150 ? 1 : p.vy < 200 ? 2 : 3) : t * (anim === 'run' ? 12 : 4)
  if (!drawEris(ctx, lookFor(s.you), anim, frame, X(p.x), Y(p.y), (STAND_H / 25) * k, { dir: p.dir, alpha: blink, rotate: p.hit > 0 ? -0.3 * p.dir : 0 })) rect(ctx, X(p.x) - 6 * k, Y(p.y) - STAND_H * k, 12 * k, STAND_H * k, '#2f8f83')
  // the wind
  if (s.warn > 0) label(ctx, 'WIND COMING… STAND STILL ON A FROND!', W / 2, H * 0.14, { size: Math.max(11, P * 3.8), color: '#ffd23a' })
  if (s.gust > 0) {
    label(ctx, s.gustDir > 0 ? 'HOLD ON! →→→' : '←←← HOLD ON!', W / 2, H * 0.14, { size: Math.max(12, P * 4.6), color: '#ff6b4a' })
    for (let i = 0; i < 6; i++) rect(ctx, ((t * 400 * s.gustDir + i * 137) % W + W) % W, (i * 71) % H, P * 8, P, 'rgba(255,255,255,0.6)')
  }
  if (s.msgT > 0) label(ctx, s.msg, W / 2, H * 0.92, { size: Math.max(11, P * 3.4), alpha: clamp(s.msgT, 0, 1) })
  // the height gauge
  const gh = H * 0.6
  rect(ctx, W - P * 6, H * 0.2, P * 3, gh, '#2a1808')
  rect(ctx, W - P * 6, H * 0.2 + gh * (1 - s.best / pm.height), P * 3, gh * (s.best / pm.height), '#ffd23a')
}

export const hud = (s) => [
  { label: 'TIME', value: Math.max(0, Math.ceil(s.time)), warn: s.time < 10 },
  { label: 'HEIGHT', value: `${s.best}/${s.palm.height}` },
  { label: 'STINGS', value: '✖'.repeat(s.stings) || '–', warn: s.stings >= s.stingMax - 1 },
  { label: 'NUTS', value: s.nuts },
]
export const buttons = () => [
  { id: 'left', label: '◀', hold: true, side: 'left', big: true, key: 'A', move: true },
  { id: 'right', label: '▶', hold: true, side: 'left', big: true, key: 'D', move: true },
  { id: 'jump', label: 'JUMP', color: '#1e8449', big: true, key: 'W' },
]

export function result(s) {
  const won = s.reached
  return {
    outcome: won ? 'won' : 'lost',
    score: s.best * 3 + s.nuts * 2 + (won ? Math.ceil(s.time) : 0),
    moneyChange: won ? 3000 + s.nuts * 100 : 0,
    headline: won ? 'Fresh palm wine, straight from the tree!' : s.stings >= s.stingMax ? 'Down you come, faster than you went up.' : 'The sun is too hot to climb now.',
    line: won ? `The calabash is full and still fizzing. ${s.nuts} palm nuts in your pocket too.` : `You got ${s.best} fronds up. The old men under the shade pretend they didn't see.`,
  }
}

export default {
  id: 'palmClimb', title: 'Palm Climb', scoreLabel: 'points', start: 'Start climbing',
  rules: [
    'Move with the stick or ◀ ▶, and JUMP from frond to frond (press again in the air to jump higher). The camera climbs with you.',
    'Soldier ants march along some fronds, wasps zip back and forth, and ripe palm fruit drops from the top (watch for the red !). Each one stings.',
    '"WIND COMING" means stand still on a frond: anyone moving or in the air gets blown sideways.',
    'Fall off the bottom and you slide back to the last wide frond, stung. Three stings and you\'re down. Reach the calabash at the top before time runs out.',
  ],
  short: 'Frond to frond to the top. Stand still in the wind.',
  stick: true,
  keys: { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump' },
  holdIds: ['left', 'right'],
  create, step, input, draw, hud, buttons, result,
}
