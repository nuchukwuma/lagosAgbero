// GRASS TO GRACE · Original or Fake? Behind the counter at Ọjà, parts arrive
// in boxes. Mama Ngozi taught you the tells: a misspelt brand, a missing seal,
// the wrong box colour, a price too good to be true, "Made in Japen". Mark each
// box ORIGINAL or FAKE before the next customer pushes in.
// Params: count (boxes, 20) · need (correct to pass, 15)
// Outcomes: won | lost
import { rng, pickOf, rect, box, label, clamp } from '../px.js'
import { drawPerson } from '../people.js'

const BRANDS = [
  { name: 'TOYOTA', fake: ['TOYTA', 'TOYOTTA', 'T0YOTA'], color: '#c0392b' },
  { name: 'HONDA', fake: ['HODNA', 'H0NDA', 'HONDDA'], color: '#c0392b' },
  { name: 'BOSCH', fake: ['BOSH', 'B0SCH', 'BOSHC'], color: '#2f6fd6' },
  { name: 'NGK', fake: ['NKG', 'NGG', 'MGK'], color: '#2f6fd6' },
  { name: 'DENSO', fake: ['DENSSO', 'DENS0', 'DENCO'], color: '#c0392b' },
]
const PARTS = [
  { name: 'Brake pads', price: 18000 },
  { name: 'Spark plugs', price: 6000 },
  { name: 'Oil filter', price: 4500 },
  { name: 'Fan belt', price: 9000 },
  { name: 'Shock absorber', price: 32000 },
]
export const TELLS = {
  spelling: 'The brand is misspelt. Read slowly.',
  seal: 'No hologram seal on the box. Originals always have one.',
  colour: 'Wrong box colour for that brand.',
  price: 'Far too cheap. Nobody sells originals at a loss.',
  origin: '"Made in Japen". Countries are spelt right on originals.',
}

export function makeBox(r, fakeChance = 0.5) {
  const brand = pickOf(r, BRANDS)
  const part = pickOf(r, PARTS)
  const b = { brand: brand.name, color: brand.color, part: part.name, price: part.price, seal: true, origin: 'Made in Japan', fake: false, tell: null }
  if (r() < fakeChance) {
    b.fake = true
    b.tell = pickOf(r, Object.keys(TELLS))
    if (b.tell === 'spelling') b.brand = pickOf(r, brand.fake)
    if (b.tell === 'seal') b.seal = false
    if (b.tell === 'colour') b.color = brand.color === '#c0392b' ? '#27ae60' : '#e67e22'
    if (b.tell === 'price') b.price = Math.round((part.price * (0.15 + r() * 0.15)) / 100) * 100
    if (b.tell === 'origin') b.origin = pickOf(r, ['Made in Japen', 'Made in Jappan', 'Maid in Japan'])
  }
  return b
}

export function create(params = {}, seed = 1) {
  const r = rng(seed)
  const count = params.count ?? 20
  const boxes = Array.from({ length: count }, () => makeBox(r))
  return { r, timeMul: params.timeMul ?? 1, boxes, i: 0, right: 0, wrong: 0, need: params.need ?? Math.ceil(count * 0.75), left: 7, slide: 0, tip: '', tipT: 0, flash: null, flashT: 0, over: false, sound: [] }
}

const limitFor = (i) => clamp(7 - i * 0.2, 3.2, 7)

export function judge(s, saysFake) {
  if (s.over) return
  const b = s.boxes[s.i]
  const ok = saysFake === b.fake
  if (ok) {
    s.right++
    s.sound.push('correct')
    s.flash = 'right'
  } else {
    s.wrong++
    s.sound.push('wrong')
    s.flash = 'wrong'
    s.tip = b.fake ? `Mama Ngozi: "${TELLS[b.tell]}"` : 'Mama Ngozi: "That one was original! Look at the seal, the spelling, the price."'
    s.tipT = 2.5
  }
  s.flashT = 0.5
  next(s)
}

function next(s) {
  s.i++
  s.slide = 1
  if (s.i >= s.boxes.length) s.over = true
  else s.left = limitFor(s.i) * s.timeMul
}

export function step(s, dt) {
  s.tipT -= dt
  s.flashT -= dt
  s.slide = Math.max(0, s.slide - dt * 4)
  s.left -= dt
  if (s.left <= 0 && !s.over) {
    s.wrong++
    s.tip = 'Too slow. The customer bought from the boy next door.'
    s.tipT = 2
    s.flash = 'wrong'
    s.flashT = 0.5
    s.sound.push('bump')
    next(s)
  }
}

export function input(s, ev, v) {
  if (ev.type === 'button') judge(s, ev.id === 'fake')
  if (ev.type === 'down') s.swipeFrom = ev.x
  if (ev.type === 'up' && s.swipeFrom != null) {
    const dx = ev.x - s.swipeFrom
    s.swipeFrom = null
    if (Math.abs(dx) > v.W * 0.12) judge(s, dx < 0) // swipe left: fake · swipe right: original
  }
}

// each brand's logo, drawn small (on the chart) or big (on a box)
function logo(ctx, brand, x, y, s, color) {
  const c = color || '#c0392b'
  ctx.save()
  ctx.translate(x, y)
  ctx.lineWidth = Math.max(1, s * 0.12)
  ctx.strokeStyle = c
  ctx.fillStyle = c
  const name = brand.replace(/[^A-Z]/g, '')
  if (/^T/.test(name)) {
    // three ovals
    ctx.beginPath()
    ctx.ellipse(0, 0, s, s * 0.62, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(0, -s * 0.12, s * 0.62, s * 0.3, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(0, s * 0.05, s * 0.24, s * 0.55, 0, 0, Math.PI * 2)
    ctx.stroke()
  } else if (/^HO|^HD/.test(name)) {
    // a bold H in a rounded square
    ctx.strokeRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6)
    ctx.fillRect(-s * 0.5, -s * 0.5, s * 0.25, s)
    ctx.fillRect(s * 0.25, -s * 0.5, s * 0.25, s)
    ctx.fillRect(-s * 0.3, -s * 0.12, s * 0.6, s * 0.22)
  } else if (/^B/.test(name)) {
    // a circle with the armature inside
    ctx.beginPath()
    ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillRect(-s * 0.55, -s * 0.08, s * 1.1, s * 0.16)
    ctx.fillRect(-s * 0.08, -s * 0.5, s * 0.16, s * 1)
  } else if (/^N|^M/.test(name)) {
    // letters on a band
    ctx.fillRect(-s, -s * 0.45, s * 2, s * 0.9)
    ctx.fillStyle = '#ffffff'
    ctx.font = `900 ${Math.round(s * 0.7)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('NGK', 0, 0)
  } else {
    // a big D
    ctx.font = `900 italic ${Math.round(s * 1.5)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('D', 0, 0)
  }
  ctx.restore()
}

// the hologram seal: a shiny rainbow sticker that says GENUINE
function seal(ctx, x, y, w, t) {
  const cols = ['#ff8ad8', '#7fc8ff', '#8ff0a4', '#ffe680']
  for (let i = 0; i < 4; i++) rect(ctx, x + (i * w) / 4, y, w / 4 + 1, w * 0.62, cols[(i + Math.floor(t * 4)) % 4])
  rect(ctx, x, y, w, Math.max(1, w * 0.06), '#ffffff')
  label(ctx, 'GENUINE', x + w / 2, y + w * 0.31, { size: Math.max(7, w * 0.17), color: '#1a1a1a', weight: 900 })
}

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  // the stall: shelves of parts behind, the counter in front
  rect(ctx, 0, 0, W, H, '#4a3a2c')
  for (let y = H * 0.16; y < H * 0.5; y += Math.max(P * 16, H * 0.17)) {
    rect(ctx, 0, y, W, P * 2, '#2a1f18')
    for (let x = P * 3; x < W; x += P * 13) box(ctx, x, y - P * 7, P * 7, P * 6, ['#c0392b', '#2f6fd6', '#f2c230', '#7f8c8d'][Math.floor(x / P / 10) % 4], Math.max(1, P / 2))
  }
  rect(ctx, 0, H * 0.64, W, H * 0.36, '#8a5a2b')
  rect(ctx, 0, H * 0.64, W, P * 2, '#5a3416')
  drawPerson(ctx, 'ngozi', W * 0.06 + P * 6, H * 0.98, P, { pose: s.flash === 'wrong' && s.flashT > 0 ? 'hit' : 'idle', t })
  // Mama Ngozi's chart on the wall: each brand's logo and box colour, the seal, the usual prices
  const cw = Math.min(W * (H > W ? 0.44 : 0.36), H * 1.05)
  const ch = H * 0.92
  const cx = Math.max(P * 2, W * 0.02)
  const cy = H * 0.04
  box(ctx, cx, cy, cw, ch, '#fff8e6', Math.max(1, P / 2))
  const row = ch / 13.5
  const fs = Math.max(8, Math.min(row * 0.52, cw * 0.075))
  const pad = cw * 0.05
  label(ctx, "MAMA NGOZI'S CHART", cx + cw / 2, cy + row * 0.6, { size: fs, color: '#1a1a1a', weight: 900 })
  BRANDS.forEach((b, i) => {
    const y = cy + row * (1.6 + i)
    const sw = Math.min(row * 0.9, cw * 0.14)
    rect(ctx, cx + pad, y - sw * 0.35, sw, sw * 0.7, b.color) // the box colour
    logo(ctx, b.name, cx + pad + sw + row * 0.55, y, Math.min(row * 0.34, cw * 0.06), b.color)
    label(ctx, b.name, cx + pad + sw + row * 1.2, y, { size: fs, color: '#1a1a1a', align: 'left', weight: 700 })
  })
  const sy = cy + row * 6.7
  label(ctx, 'Seal:', cx + pad, sy, { size: fs, color: '#1a1a1a', align: 'left', weight: 700 })
  seal(ctx, cx + cw * 0.42, sy - row * 0.4, Math.min(row * 1.3, cw * 0.4), t)
  label(ctx, 'Usual prices:', cx + pad, cy + row * 7.8, { size: fs, color: '#1a1a1a', align: 'left', weight: 700 })
  PARTS.forEach((pt, i) => {
    label(ctx, `${pt.name}  ₦${pt.price.toLocaleString('en-NG')}`, cx + pad, cy + row * (8.8 + i * 0.95), { size: fs * 0.9, color: '#3a2a10', align: 'left' })
  })
  if (s.over) return
  // the box on the counter
  const b = s.boxes[s.i]
  const room = W - (cx + cw) - P * 4
  const bw = Math.min(room * 0.92, P * 80, H * 0.9)
  const bh = bw * 0.62
  const bx = cx + cw + P * 2 + (room - bw) / 2 + s.slide * W * 0.6
  const by = Math.min(H * 0.66, H - P * 3) - bh
  box(ctx, bx, by, bw, bh, b.color, P)
  rect(ctx, bx + P * 2, by + P * 2, bw - P * 4, bh * 0.36, '#ffffff')
  logo(ctx, b.brand, bx + P * 2 + bh * 0.2, by + P * 2 + bh * 0.18, bh * 0.12, b.color === '#ffffff' ? '#000' : b.color)
  label(ctx, b.brand, bx + bw / 2 + bh * 0.1, by + P * 2 + bh * 0.18, { size: bh * 0.2, color: b.color === '#ffffff' ? '#000' : b.color })
  label(ctx, b.part, bx + bw / 2, by + bh * 0.52, { size: bh * 0.11 })
  label(ctx, b.origin, bx + bw / 2, by + bh * 0.68, { size: bh * 0.085, color: '#fff2a8' })
  // the hologram seal (or a bare patch where it should be)
  const sw = bh * 0.32
  if (b.seal) seal(ctx, bx + bw - sw - P * 2, by + bh - sw * 0.62 - P * 2, sw, t)
  else {
    ctx.save()
    ctx.globalAlpha = 0.35
    rect(ctx, bx + bw - sw - P * 2, by + bh - sw * 0.62 - P * 2, sw, sw * 0.62, '#000000')
    ctx.restore()
  }
  // the price tag on a string
  box(ctx, bx + P * 2, by + bh - P * 9, P * 22, P * 7, '#fff2a8', Math.max(1, P / 2))
  label(ctx, `₦${b.price.toLocaleString('en-NG')}`, bx + P * 13, by + bh - P * 5.5, { size: P * 3.2, color: '#1a1a1a' })
  // the customer's patience
  const tw = bw * clamp(s.left / (limitFor(s.i) * s.timeMul), 0, 1)
  rect(ctx, bx, by - P * 5, bw, P * 2, '#1a1a1a')
  rect(ctx, bx, by - P * 5, tw, P * 2, s.left < 2 ? '#e74c3c' : '#ffd23a')
  if (s.flashT > 0) label(ctx, s.flash === 'right' ? '✔' : '✖', bx + bw / 2, by - P * 12, { size: P * 10, color: s.flash === 'right' ? '#8ff0a4' : '#ff6b4a', alpha: s.flashT * 2 })
  if (s.tipT > 0) label(ctx, s.tip, bx + bw / 2, Math.min(H - P * 4, by + bh + P * 6), { size: Math.max(11, P * 3.2), color: '#fff2a8', alpha: clamp(s.tipT, 0, 1) })
}

export const hud = (s) => [
  { label: 'BOX', value: `${Math.min(s.i + 1, s.boxes.length)}/${s.boxes.length}` },
  { label: 'RIGHT', value: s.right },
  { label: 'NEED', value: s.need },
]
export const buttons = () => [
  { id: 'fake', label: '✖ FAKE', color: '#b3261e', key: '←' },
  { id: 'original', label: 'ORIGINAL ✔', color: '#1e8449', key: '→' },
]

export function result(s) {
  const won = s.right >= s.need
  return {
    outcome: won ? 'won' : 'lost',
    score: s.right,
    moneyChange: s.right * 300,
    headline: won ? 'Mama Ngozi is impressed. She will never say so.' : 'Fake parts went out with your stamp on them.',
    line: `${s.right} of ${s.boxes.length} right.`,
  }
}

export default {
  id: 'fakeParts', title: 'Original or Fake?', scoreLabel: 'boxes right', start: 'Open the stall',
  rules: ['Each box is ORIGINAL or FAKE. Mark it with the buttons, or swipe: left for fake, right for original.', 'The tells: a misspelt brand, no hologram seal, the wrong box colour, a price far too cheap, a country spelt wrong.', 'The customer won\'t wait forever, and they get pushier as the day goes on.', 'Get enough right to pass Mama Ngozi\'s test.'],
  short: 'Spelling, seal, colour, price, country.',
  keys: { ArrowLeft: 'fake', ArrowRight: 'original', KeyF: 'fake', KeyO: 'original' },
  create, step, input, draw, hud, buttons, result,
}
