// CAMPUS · Hostel Cup Penalties. The inter-hostel final went to penalties.
// You take a kick, then you keep goal, five each. Shooting: tap where in the
// goal you're aiming, then stop the power bar in the green. Keeping: watch the
// kicker's run-up (their body leans the way they'll shoot, most of the time)
// and dive LEFT, STAY or RIGHT. Level after five: sudden death.
// Params: skill (the other team, 0.5) · name (the other hostel)
// Outcomes: won | lost
import { rng, rect, box, label, disc, clamp, inside, ui } from '../px.js'
import { drawPerson } from '../people.js'

export const ZONES = ['TL', 'TC', 'TR', 'BL', 'BC', 'BR']
const col = (z) => ({ L: 0, C: 1, R: 2 })[z[1]]

export function create(params = {}, seed = 1) {
  return { r: rng(seed), you: params.you || 3, skill: params.skill ?? 0.5, name: params.name || 'Kings Hall', phase: 'aim', kicks: { you: [], them: [] }, aim: null, power: 0, pdir: 1, anim: 0, ball: null, keeperCol: 1, lean: 1, leanTrue: true, runup: 0, result: '', over: false, sound: [] }
}

const goals = (list) => list.filter(Boolean).length

function decided(s) {
  const a = s.kicks.you
  const b = s.kicks.them
  const ga = goals(a)
  const gb = goals(b)
  if (a.length <= 5 && b.length <= 5) {
    const leftA = 5 - a.length
    const leftB = 5 - b.length
    if (ga > gb + leftB || gb > ga + leftA) return true
    return a.length === 5 && b.length === 5 && ga !== gb
  }
  return a.length === b.length && ga !== gb
}

function afterKick(s) {
  if (decided(s) || s.kicks.you.length > 10) {
    s.over = true
    return
  }
  if (s.kicks.you.length > s.kicks.them.length) {
    s.phase = 'keep'
    s.runup = 1.6
    // where they'll shoot, and whether their lean tells the truth
    s.theirZone = ZONES[Math.floor(s.r() * 6)]
    s.leanTrue = s.r() < 0.75
    const c = col(s.theirZone)
    s.lean = s.leanTrue ? c : [0, 1, 2].filter((x) => x !== c)[Math.floor(s.r() * 2)]
    s.dive = null
  } else s.phase = 'aim'
}

export function shoot(s) {
  // power: green is 0.55..0.85; too soft is easy to save, too hard goes over
  const p = s.power
  const keeperZoneCol = Math.floor(s.r() * 3)
  let goal
  if (p > 0.92) {
    goal = false
    s.result = 'Over the bar! Into the hostel windows!'
  } else if (p < 0.4) {
    goal = col(s.aim) !== keeperZoneCol && s.r() < 0.4
    s.result = goal ? 'Soft, but it trickles in!' : 'Too soft. Easy save.'
  } else {
    // a keeper who guesses the side still has to reach it: the top corners are hard to reach
    goal = col(s.aim) !== keeperZoneCol || (s.aim[0] === 'T' && s.r() < 0.7)
    s.result = goal ? 'GOAL!' : 'Saved! He guessed right.'
  }
  s.keeperCol = keeperZoneCol
  s.kicks.you.push(goal)
  s.sound.push(goal ? 'crowd' : 'bump')
  s.ball = { zone: s.aim, goal, t: 0 }
  s.phase = 'flight'
  s.anim = 1.3
  s.nextIsKeep = true
}

export function dive(s, c) {
  if (s.phase !== 'keep' || s.dive != null) return
  s.dive = c
}

function theirKick(s) {
  const c = col(s.theirZone)
  const miss = s.r() > 0.75 + s.skill * 0.2
  const saved = !miss && s.dive === c && (s.theirZone[0] === 'B' || s.r() < 0.55)
  const goal = !miss && !saved
  s.result = miss ? 'Wide! Their striker holds his head.' : saved ? 'SAVED! The hostel goes mad!' : 'They score.'
  s.keeperCol = s.dive ?? 1
  s.kicks.them.push(goal)
  s.sound.push(goal ? 'bump' : 'crowd')
  s.ball = { zone: s.theirZone, goal, t: 0, miss }
  s.phase = 'flight'
  s.anim = 1.3
}

export function step(s, dt) {
  if (s.phase === 'power') {
    s.power += s.pdir * dt * 1.25
    if (s.power >= 1) {
      s.power = 1
      s.pdir = -1
    }
    if (s.power <= 0) {
      s.power = 0
      s.pdir = 1
    }
  }
  if (s.phase === 'keep') {
    s.runup -= dt
    if (s.runup <= 0) theirKick(s)
  }
  if (s.phase === 'flight') {
    s.anim -= dt
    if (s.ball) s.ball.t = clamp(1 - (s.anim - 0.5) / 0.8, 0, 1)
    if (s.anim <= 0) {
      s.ball = null
      afterKick(s)
    }
  }
}

export function goalRect(v) {
  const gw = Math.min(v.W * 0.7, v.H * 1.2)
  const gh = gw * 0.36
  return { x: (v.W - gw) / 2, y: v.H * 0.2, w: gw, h: gh }
}
export function zoneRect(v, z) {
  const g = goalRect(v)
  return { x: g.x + col(z) * (g.w / 3), y: g.y + (z[0] === 'T' ? 0 : g.h / 2), w: g.w / 3, h: g.h / 2 }
}

export function input(s, ev, v) {
  if (ev.type === 'button') {
    if (ev.id === 'kick' && s.phase === 'power') return shoot(s)
    if (['0', '1', '2'].includes(ev.id)) return dive(s, Number(ev.id))
    if (ZONES.includes(ev.id) && s.phase === 'aim') {
      s.aim = ev.id
      s.phase = 'power'
      s.power = 0
      s.pdir = 1
    }
    return
  }
  if (ev.type !== 'down') return
  if (s.phase === 'aim') {
    for (const z of ZONES)
      if (inside(ev.x, ev.y, zoneRect(v, z))) {
        s.aim = z
        s.phase = 'power'
        s.power = 0
        s.pdir = 1
        s.sound.push('click')
        return
      }
  } else if (s.phase === 'power') shoot(s)
  else if (s.phase === 'keep') dive(s, ev.x < v.W / 3 ? 0 : ev.x > (v.W * 2) / 3 ? 2 : 1)
}

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  rect(ctx, 0, 0, W, H, '#3b8a3a')
  for (let y = H * 0.12; y < H; y += P * 10) rect(ctx, 0, y, W, P * 5, '#368034')
  // the crowd on the hostel balconies
  rect(ctx, 0, 0, W, H * 0.13, '#c9b48a')
  for (let x = P * 2; x < W; x += P * 6) rect(ctx, x, H * 0.04 + Math.sin(t * 8 + x) * P, P * 3, P * 4, ['#d9342b', '#2f6fd6', '#ffd23a', '#f4ecd8'][Math.floor(x / P) % 4])
  const g = goalRect(v)
  // net and posts
  rect(ctx, g.x, g.y, g.w, g.h, 'rgba(255,255,255,0.12)')
  for (let x = g.x; x <= g.x + g.w; x += P * 4) rect(ctx, x, g.y, 1, g.h, 'rgba(255,255,255,0.35)')
  for (let y = g.y; y <= g.y + g.h; y += P * 4) rect(ctx, g.x, y, g.w, 1, 'rgba(255,255,255,0.35)')
  rect(ctx, g.x - P * 2, g.y - P * 2, g.w + P * 4, P * 2, '#ffffff')
  rect(ctx, g.x - P * 2, g.y, P * 2, g.h, '#ffffff')
  rect(ctx, g.x + g.w, g.y, P * 2, g.h, '#ffffff')
  if (s.phase === 'aim') for (const z of ZONES) {
    const zr = zoneRect(v, z)
    ctx.save()
    ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 4 + col(z))
    rect(ctx, zr.x + P, zr.y + P, zr.w - 2 * P, zr.h - 2 * P, '#ffd23a')
    ctx.restore()
  }
  if (s.aim && (s.phase === 'power' || (s.phase === 'flight' && s.kicks.you.length > s.kicks.them.length))) {
    const zr = zoneRect(v, s.aim)
    label(ctx, '✛', zr.x + zr.w / 2, zr.y + zr.h / 2, { size: P * 8, color: '#ffd23a' })
  }
  // the keeper (them, or you when keeping)
  const keeping = s.phase === 'keep' || (s.phase === 'flight' && s.kicks.them.length >= s.kicks.you.length)
  const kc = s.phase === 'flight' ? s.keeperCol : 1
  const kx = g.x + (kc + 0.5) * (g.w / 3)
  drawPerson(ctx, keeping ? s.you : 101, kx, g.y + g.h, P, { pose: s.phase === 'flight' ? 'jumpUp' : 'stand', t })
  // the kicker at the spot: you, or them leaning which way they'll go
  const spotY = H * 0.86
  if (s.phase === 'keep') {
    const leanX = (s.lean - 1) * P * 3 * clamp(1.6 - s.runup, 0, 1)
    drawPerson(ctx, 102, W / 2 + leanX, spotY - (s.runup > 0 ? s.runup * P * 6 : 0), Math.round(P * 1.3), { pose: 'stroll', t })
    label(ctx, s.dive == null ? 'Read the lean… DIVE!' : ['◀ diving left', '● staying', 'diving right ▶'][s.dive], W / 2, H * 0.66, { size: P * 4.2, color: '#ffd23a' })
  } else if (s.phase !== 'flight' || s.kicks.you.length > s.kicks.them.length) drawPerson(ctx, s.you, W / 2 - P * 6, spotY, Math.round(P * 1.3), { pose: 'stand', t })
  // the ball
  let bx = W / 2
  let by = spotY - P * 2
  if (s.ball) {
    const zr = zoneRect(v, s.ball.zone)
    let tx = zr.x + zr.w / 2
    let ty = zr.y + zr.h / 2
    if (s.ball.miss || (!s.ball.goal && s.power > 0.92 && s.kicks.you.length > s.kicks.them.length)) ty = g.y - P * 10
    if (s.ball.miss) tx += (col(s.ball.zone) - 1) * g.w * 0.3
    bx = W / 2 + (tx - W / 2) * s.ball.t
    by = spotY - P * 2 + (ty - spotY + P * 2) * s.ball.t
  }
  disc(ctx, bx, by, P * 3, '#ffffff', P)
  rect(ctx, bx - P, by - P, P * 2, P * 2, '#222')
  // the power bar
  if (s.phase === 'power') {
    const bw = Math.min(W * 0.5, P * 90)
    const x = W / 2 - bw / 2
    const y = H * 0.66
    rect(ctx, x, y, bw, P * 5, '#1a1a1a')
    rect(ctx, x + bw * 0.55, y, bw * 0.3, P * 5, '#2ecc71')
    rect(ctx, x + bw * 0.92, y, bw * 0.08, P * 5, '#e74c3c')
    rect(ctx, x + bw * s.power - P, y - P * 2, P * 2, P * 9, '#ffd23a')
    label(ctx, 'TAP TO KICK', W / 2, y - P * 6, { size: P * 4, color: '#ffffff' })
  }
  if (s.phase === 'aim') label(ctx, 'Tap where you\'ll shoot', W / 2, H * 0.66, { size: P * 4.2 })
  if (s.phase === 'flight' && s.anim < 0.6) label(ctx, s.result, W / 2, H * 0.6, { size: P * 5, color: '#ffffff' })
  // the score sheet: ● scored, ○ missed
  const sheet = (list) => list.map((k) => (k ? '●' : '○')).join(' ') || '–'
  const Q = ui(P)
  box(ctx, Q * 3, H * 0.15, Q * 44, Q * 12, '#1c1a30', Q)
  label(ctx, `YOU  ${sheet(s.kicks.you)}`, Q * 5, H * 0.15 + Q * 3, { size: Q * 2.8, align: 'left', color: '#ffd23a', weight: 700 })
  label(ctx, `THEM ${sheet(s.kicks.them)}`, Q * 5, H * 0.15 + Q * 9, { size: Q * 2.8, align: 'left', weight: 700 })
}

export const hud = (s) => [
  { label: 'YOU', value: goals(s.kicks.you) },
  { label: s.name.toUpperCase(), value: goals(s.kicks.them) },
  { label: 'KICK', value: Math.max(s.kicks.you.length, s.kicks.them.length) + (s.phase === 'aim' || s.phase === 'power' ? 1 : 0) },
]
export const buttons = (s) =>
  s.phase === 'keep'
    ? [
        { id: '0', label: '◀ DIVE', color: '#2f6fd6', key: '←' },
        { id: '1', label: 'STAY', color: '#2f6fd6', key: '↓' },
        { id: '2', label: 'DIVE ▶', color: '#2f6fd6', key: '→' },
      ]
    : s.phase === 'power'
      ? [{ id: 'kick', label: 'KICK!', color: '#1e8449', key: 'Space' }]
      : []

export function result(s) {
  const a = goals(s.kicks.you)
  const b = goals(s.kicks.them)
  const won = a > b
  return {
    outcome: won ? 'won' : 'lost',
    score: a * 10 + s.kicks.them.filter((k) => !k).length * 5,
    headline: won ? 'HOSTEL CUP CHAMPIONS!' : `${s.name} lift the cup.`,
    line: `${a} – ${b} on penalties.`,
  }
}

export default {
  id: 'penalty', title: 'Hostel Cup Penalties', scoreLabel: 'points', start: 'Place the ball',
  rules: ['Shooting: tap where in the goal you want to shoot, then tap again (or KICK) to stop the power bar in the green.', 'Too soft is easy to save; in the red it flies over the bar. Top corners are hard to reach.', 'Keeping: watch their run-up. Their body usually leans the way they\'ll shoot. Dive LEFT, STAY or RIGHT before they kick.', 'Five each. Level? Sudden death.'],
  short: 'Aim, stop the bar in the green. Read the lean.',
  keys: { Space: 'kick', Enter: 'kick', ArrowLeft: '0', ArrowDown: '1', ArrowRight: '2' },
  create, step, input, draw, hud, buttons, result,
}
