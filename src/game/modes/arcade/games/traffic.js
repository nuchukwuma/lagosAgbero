// AREA BOY · Go-Slow. The traffic light at the junction is dead again, so the
// agbero is the traffic light. Tap to switch which road flows: north-south or
// east-west (a short amber while the junction clears). Keep every queue under
// eight cars. When a siren sounds, the convoy's road must flow before it arrives.
// Params: target (cars through, 30) · seconds (60)
// Outcomes: won | lost
import { rng, pickOf, rect, box, label, clamp } from '../px.js'

export const DIRS = ['N', 'S', 'E', 'W']
const AXIS = { N: 'NS', S: 'NS', E: 'EW', W: 'EW' }
const KINDS = [
  { k: 'car', gap: 0.55, color: '#3f6fc0', len: 6 },
  { k: 'car', gap: 0.55, color: '#c0392b', len: 6 },
  { k: 'danfo', gap: 0.7, color: '#f2c230', len: 8 },
  { k: 'okada', gap: 0.3, color: '#222', len: 4 },
  { k: 'trailer', gap: 1.3, color: '#7f8c8d', len: 12 },
]
export const MAX_QUEUE = 8

export function create(params = {}, seed = 1) {
  const s = { r: rng(seed), maxQueue: params.maxQueue ?? MAX_QUEUE, spawnMul: params.spawnMul ?? 1, time: params.seconds ?? 60, total: params.seconds ?? 60, target: params.target ?? 30, green: 'NS', amber: 0, q: { N: [], S: [], E: [], W: [] }, gapLeft: { N: 0, S: 0, E: 0, W: 0 }, spawn: 0.5, passed: 0, strikes: 0, siren: null, sirenNext: 14, flash: 0, msg: '', msgT: 0, over: false, gridlock: null, sound: [] }
  for (const d of DIRS) for (let i = 0; i < 2; i++) s.q[d].push(pickOf(s.r, KINDS))
  return s
}

export function toggle(s) {
  if (s.amber > 0) return
  s.amber = 0.8
  s.green = s.green === 'NS' ? 'EW' : 'NS'
  s.sound.push('whistle')
}

export function step(s, dt) {
  s.time -= dt
  s.msgT -= dt
  s.flash += dt
  const elapsed = s.total - s.time
  // arrivals: faster as the evening rush builds
  s.spawn -= dt
  if (s.spawn <= 0) {
    const d = pickOf(s.r, DIRS)
    s.q[d].push(pickOf(s.r, KINDS))
    s.spawn = (clamp(1.05 - elapsed * 0.012, 0.42, 1.05) * (0.7 + s.r() * 0.6)) / s.spawnMul
  }
  // the green road drains, one vehicle at a time
  if (s.amber > 0) s.amber -= dt
  else
    for (const d of DIRS) {
      if (AXIS[d] !== s.green || !s.q[d].length) continue
      s.gapLeft[d] -= dt
      if (s.gapLeft[d] <= 0) {
        const v = s.q[d].shift()
        s.passed++
        s.gapLeft[d] = v.gap
        if (v.k === 'danfo' && s.r() < 0.2) s.sound.push('horn')
      }
    }
  // the convoy
  s.sirenNext -= dt
  if (!s.siren && s.sirenNext <= 0) {
    s.siren = { from: pickOf(s.r, DIRS), left: 4 }
    s.sound.push('siren')
  }
  if (s.siren) {
    s.siren.left -= dt
    if (AXIS[s.siren.from] === s.green && s.amber <= 0) {
      s.msg = 'Convoy through! Siren gone.'
      s.msgT = 1.5
      s.passed += 3
      s.siren = null
      s.sirenNext = 12 + s.r() * 8
    } else if (s.siren.left <= 0) {
      s.strikes++
      s.msg = '"WHO BLOCKED THE CONVOY?!" (a soldier slaps your cap off)'
      s.msgT = 2
      s.sound.push('wrong')
      s.siren = null
      s.sirenNext = 12 + s.r() * 8
    }
  }
  for (const d of DIRS)
    if (s.q[d].length >= s.maxQueue) {
      s.gridlock = d
      s.over = true
      s.sound.push('hornLong')
    }
  if (s.time <= 0 || s.strikes >= 3) s.over = true
}

export function input(s, ev) {
  if (ev.type === 'button' && ev.id === 'switch') toggle(s)
  if (ev.type === 'down') toggle(s)
}

const CARD = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }

export function draw(ctx, s, v) {
  const { W, H, P } = v
  const cx = W / 2
  const cy = H * 0.52
  const rw = P * 22 // road width
  rect(ctx, 0, 0, W, H, '#7aa35a')
  // pavements and roads
  rect(ctx, cx - rw / 2 - P * 3, 0, rw + P * 6, H, '#b9b2a3')
  rect(ctx, 0, cy - rw / 2 - P * 3, W, rw + P * 6, '#b9b2a3')
  rect(ctx, cx - rw / 2, 0, rw, H, '#4b4b52')
  rect(ctx, 0, cy - rw / 2, W, rw, '#4b4b52')
  for (let y = 0; y < H; y += P * 8) if (Math.abs(y - cy) > rw / 2) rect(ctx, cx - P / 2, y, P, P * 4, '#e8e2c8')
  for (let x = 0; x < W; x += P * 8) if (Math.abs(x - cx) > rw / 2) rect(ctx, x, cy - P / 2, P * 4, P, '#e8e2c8')
  // queues: vehicles waiting at each mouth of the junction (driving on the right)
  for (const d of DIRS) {
    const [dx, dy] = CARD[d]
    let dist = rw / 2 + P * 4
    const lane = (rw / 4) * (d === 'N' || d === 'E' ? -1 : 1)
    s.q[d].forEach((veh) => {
      const len = veh.len * P
      const along = dist + len / 2
      const x = cx + dx * along + (dy !== 0 ? lane : 0)
      const y = cy + dy * along + (dx !== 0 ? -lane : 0)
      const horiz = dx !== 0
      const w = horiz ? len : P * 5
      const h = horiz ? P * 5 : len
      box(ctx, x - w / 2, y - h / 2, w, h, veh.color, Math.max(1, P / 2))
      rect(ctx, x - (horiz ? P : w / 2 - P), y - (horiz ? h / 2 - P : P), horiz ? P * 2 : w - P * 2, horiz ? h - P * 2 : P * 2, '#9fd3ff')
      dist += len + P * 2
    })
    // how full this road is
    const full = s.q[d].length / s.maxQueue
    if (full > 0.6) label(ctx, '!', cx + dx * (rw / 2 + P * 4) - dy * rw * 0.9, cy + dy * (rw / 2 + P * 4) + dx * rw * 0.9, { size: P * 6, color: full > 0.85 ? '#ff4d3a' : '#ffd23a' })
  }
  // the warden in the middle, arms out along the flowing road
  const ns = s.green === 'NS'
  box(ctx, cx - P * 3, cy - P * 3, P * 6, P * 6, s.amber > 0 ? '#ffd23a' : '#ff8a24', P)
  rect(ctx, ns ? cx - P : cx - P * 9, ns ? cy - P * 9 : cy - P, ns ? P * 2 : P * 18, ns ? P * 18 : P * 2, '#ff8a24')
  label(ctx, s.amber > 0 ? 'WAIT' : ns ? '↕ GO' : '↔ GO', cx, cy - rw / 2 - P * 8, { size: P * 4, color: s.amber > 0 ? '#ffd23a' : '#8ff0a4' })
  if (s.siren) {
    const [dx, dy] = CARD[s.siren.from]
    const on = Math.floor(s.flash * 6) % 2
    label(ctx, '🚨', cx + dx * W * 0.38, cy + dy * H * 0.38, { size: P * 7, alpha: on ? 1 : 0.4 })
    label(ctx, `CONVOY ${Math.ceil(s.siren.left)}`, W / 2, P * 30, { size: P * 4.4, color: on ? '#ff4d3a' : '#7fc8ff' })
  }
  if (s.msgT > 0) label(ctx, s.msg, W / 2, H - P * 26, { size: Math.max(12, P * 3.6), alpha: clamp(s.msgT, 0, 1) })
}

export const hud = (s) => [
  { label: 'TIME', value: Math.max(0, Math.ceil(s.time)), warn: s.time < 10 },
  { label: 'THROUGH', value: `${s.passed}/${s.target}` },
  { label: 'CONVOY WAHALA', value: '✖'.repeat(s.strikes) || '–', warn: s.strikes >= 2 },
]
export const buttons = () => [{ id: 'switch', label: 'SWITCH ⇄', color: '#d35400', key: 'Space' }]

export function result(s) {
  const won = !s.gridlock && s.strikes < 3 && s.passed >= s.target
  return {
    outcome: won ? 'won' : 'lost',
    score: s.passed,
    moneyChange: won ? 2000 : 0,
    headline: won ? 'The junction is flowing!' : s.gridlock ? 'GO-SLOW! Total gridlock.' : s.strikes >= 3 ? 'The soldiers have taken over the junction.' : 'Not enough cars got through.',
    line: s.gridlock ? `The ${({ N: 'northern', S: 'southern', E: 'eastern', W: 'western' })[s.gridlock]} road jammed solid. Somebody is already selling gala to the stuck drivers.` : `${s.passed} vehicles through the junction.`,
  }
}

export default {
  id: 'traffic', title: 'Go-Slow', scoreLabel: 'vehicles', start: 'Blow the whistle',
  rules: ['You are the traffic light. Tap anywhere (or SWITCH) to let the other road flow; the junction needs a moment of amber to clear.', 'Vehicles pile up on the red roads. If any road backs up to eight, it\'s gridlock and you lose.', 'Trailers are slow, okadas are quick, danfos honk.', 'A siren means a convoy: let its road flow within four seconds, or the soldiers will have words.'],
  short: 'Tap to switch roads. No road over eight. Convoys first.',
  keys: { Space: 'switch', Enter: 'switch' },
  create, step, input, draw, hud, buttons, result,
}
