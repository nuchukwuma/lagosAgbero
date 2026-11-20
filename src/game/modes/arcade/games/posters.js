// THE HONOURABLE · Poster War. The long wall at the Front Stop, the night
// before the rally. Tap a spot to paste your poster (one scoop of paste each).
// The other side's boys sneak up to paste over yours: tap a boy before he
// finishes to chase him off. The bucket runs dry: REFILL takes a moment. When
// the time is up, the wall should be yours.
// Params: seconds (45) · need (spots to hold at the end, 5 of 9)
// Outcomes: won | lost
import { rng, rect, box, label, clamp, inside } from '../px.js'
import { drawPerson } from '../people.js'

export const SPOTS = 9

export function create(params = {}, seed = 1) {
  const r = rng(seed)
  const wall = Array.from({ length: SPOTS }, () => (r() < 0.45 ? 'them' : null))
  return { r, wall, boys: [], spawnMul: params.spawnMul ?? 1, cap: params.paste ?? 6, time: params.seconds ?? 45, need: params.need ?? 5, paste: params.paste ?? 6, refill: 0, spawn: 1.4, chased: 0, pasted: 0, msg: '', msgT: 0, over: false, sound: [] }
}

export const mine = (s) => s.wall.filter((w) => w === 'you').length

export function tapSpot(s, i) {
  const boy = s.boys.find((b) => b.spot === i)
  if (boy) {
    s.boys = s.boys.filter((b) => b !== boy)
    s.chased++
    s.sound.push('whistle')
    s.msg = ['"Run! Na Teacher people!"', '"I no do anything o!"', 'He drops his bucket and runs.'][s.chased % 3]
    s.msgT = 1
    return
  }
  if (s.wall[i] === 'you') return
  if (s.refill > 0 || s.paste <= 0) {
    s.msg = 'The bucket is empty. REFILL!'
    s.msgT = 1
    s.sound.push('bump')
    return
  }
  s.paste--
  s.wall[i] = 'you'
  s.pasted++
  s.sound.push('slide')
}

export function step(s, dt) {
  s.time -= dt
  s.msgT -= dt
  if (s.refill > 0) {
    s.refill -= dt
    if (s.refill <= 0) s.paste = s.cap
  }
  const elapsed = 45 - s.time
  s.spawn -= dt
  if (s.spawn <= 0) {
    const targets = [...Array(SPOTS).keys()].filter((i) => s.wall[i] !== 'them' && !s.boys.some((b) => b.spot === i))
    if (targets.length) {
      // they prefer your posters
      const yours = targets.filter((i) => s.wall[i] === 'you')
      const pool = yours.length && s.r() < 0.75 ? yours : targets
      s.boys.push({ spot: pool[Math.floor(s.r() * pool.length)], left: clamp(2.2 - elapsed * 0.025, 1.1, 2.2), seed: 200 + Math.floor(s.r() * 50) })
    }
    s.spawn = (clamp(1.6 - elapsed * 0.02, 0.6, 1.6) * (0.7 + s.r() * 0.6)) / s.spawnMul
  }
  for (const b of s.boys) b.left -= dt
  for (const b of s.boys.filter((x) => x.left <= 0)) {
    s.wall[b.spot] = 'them'
    s.sound.push('slide')
  }
  s.boys = s.boys.filter((b) => b.left > 0)
  if (s.time <= 0) s.over = true
}

export function spotRect(v, i) {
  const cols = 3
  const ww = Math.min(v.W * 0.86, v.H * 1.3)
  const cw = ww / cols
  const ch = cw * 0.52
  const x0 = (v.W - ww) / 2
  const y0 = v.H * 0.22
  return { x: x0 + (i % cols) * cw + cw * 0.06, y: y0 + Math.floor(i / cols) * ch * 1.08, w: cw * 0.88, h: ch }
}

export function input(s, ev, v) {
  if (ev.type === 'button' && ev.id === 'refill') {
    if (s.refill <= 0 && s.paste < s.cap) {
      s.refill = 1.6
      s.sound.push('fuel')
    }
    return
  }
  if (ev.type === 'button') return tapSpot(s, Number(ev.id))
  if (ev.type !== 'down') return
  for (let i = 0; i < SPOTS; i++) if (inside(ev.x, ev.y, spotRect(v, i))) return tapSpot(s, i)
}

function poster(ctx, r, who, P) {
  if (who === 'you') {
    box(ctx, r.x, r.y, r.w, r.h, '#f4ecd8', Math.max(1, P / 2))
    rect(ctx, r.x, r.y, r.w, r.h * 0.25, '#1e8449')
    label(ctx, 'TEACHER', r.x + r.w / 2, r.y + r.h * 0.13, { size: r.h * 0.17 })
    rect(ctx, r.x + r.w * 0.38, r.y + r.h * 0.32, r.w * 0.24, r.h * 0.36, '#7a5a3a')
    label(ctx, 'VOTE ✔', r.x + r.w / 2, r.y + r.h * 0.84, { size: r.h * 0.15, color: '#1e8449' })
  } else if (who === 'them') {
    box(ctx, r.x, r.y, r.w, r.h, '#fff2a8', Math.max(1, P / 2))
    rect(ctx, r.x, r.y, r.w, r.h * 0.25, '#b3261e')
    label(ctx, 'NEPHEW', r.x + r.w / 2, r.y + r.h * 0.13, { size: r.h * 0.17 })
    rect(ctx, r.x + r.w * 0.36, r.y + r.h * 0.32, r.w * 0.28, r.h * 0.36, '#e8c48a')
    label(ctx, 'CONTINUITY!', r.x + r.w / 2, r.y + r.h * 0.84, { size: r.h * 0.13, color: '#b3261e' })
  }
}

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  rect(ctx, 0, 0, W, H, '#1a2140') // night
  for (let i = 0; i < 30; i++) rect(ctx, ((i * 97) % 100) * W / 100, ((i * 37) % 18) * P, P, P, '#fff8c0')
  // the wall: old cement, the rain stains, a street light
  const top = spotRect(v, 0).y - P * 8
  rect(ctx, 0, top, W, H * 0.72 - top + P * 8, '#8f8a80')
  for (let y = top; y < H * 0.72; y += P * 6) rect(ctx, 0, y, W, P / 2 + 0.5, '#7a756c')
  rect(ctx, 0, H * 0.72 + P * 8, W, H, '#4b4b52')
  for (let i = 0; i < SPOTS; i++) {
    const r = spotRect(v, i)
    if (!s.wall[i]) {
      ctx.save()
      ctx.globalAlpha = 0.5
      rect(ctx, r.x, r.y, r.w, r.h, '#a8a296')
      ctx.restore()
      label(ctx, '+', r.x + r.w / 2, r.y + r.h / 2, { size: r.h * 0.4, color: '#e8e2c8', alpha: 0.5 })
    } else poster(ctx, r, s.wall[i], P)
  }
  // the boys with their buckets, pasting
  for (const b of s.boys) {
    const r = spotRect(v, b.spot)
    drawPerson(ctx, b.seed, r.x + r.w / 2, r.y + r.h + P * 2, P, { pose: 'punch', t })
    rect(ctx, r.x + r.w * 0.2, r.y - P * 3, r.w * 0.6 * (1 - clamp(b.left / 2.2, 0, 1)), P * 2, '#ff6b4a')
  }
  // your bucket
  label(ctx, s.refill > 0 ? 'refilling…' : `paste ${'■'.repeat(s.paste)}${'□'.repeat(Math.max(0, s.cap - s.paste))}`, W / 2, H * 0.84, { size: P * 3.6, color: s.paste ? '#fff2a8' : '#ff6b4a' })
  if (s.msgT > 0) label(ctx, s.msg, W / 2, H * 0.14, { size: Math.max(12, P * 3.6), alpha: clamp(s.msgT, 0, 1) })
}

export const hud = (s) => [
  { label: 'TIME', value: Math.max(0, Math.ceil(s.time)), warn: s.time < 10 },
  { label: 'YOUR POSTERS', value: `${mine(s)}/${SPOTS}`, warn: mine(s) < s.need },
  { label: 'BOYS CHASED', value: s.chased },
]
export const buttons = (s) => [{ id: 'refill', label: s.refill > 0 ? '…' : 'REFILL', color: '#7a5a3a', disabled: s.refill > 0 || s.paste >= s.cap, key: 'R' }]

export function result(s) {
  const n = mine(s)
  const won = n >= s.need
  return {
    outcome: won ? 'won' : 'lost',
    score: n * 10 + s.chased * 2,
    headline: won ? 'By morning, the whole wall says TEACHER.' : 'By morning, the wall says CONTINUITY.',
    line: `${n} of ${SPOTS} spots are yours. ${s.chased} boys chased off.`,
  }
}

export default {
  id: 'posters', title: 'Poster War', scoreLabel: 'points', start: 'Mix the paste',
  rules: ['Tap a spot on the wall to paste your poster over theirs. Each poster uses a scoop of paste.', 'The nephew\'s boys sneak up to paste over yours: tap a boy before his bar fills to chase him away.', 'When the bucket is empty, REFILL (it takes a moment).', 'When time\'s up, hold at least five of the nine spots.'],
  short: 'Paste, chase the boys, keep five spots.',
  keys: { KeyR: 'refill', Digit1: '0', Digit2: '1', Digit3: '2', Digit4: '3', Digit5: '4', Digit6: '5', Digit7: '6', Digit8: '7', Digit9: '8' },
  create, step, input, draw, hud, buttons, result,
}
