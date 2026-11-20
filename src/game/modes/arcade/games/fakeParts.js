// GRASS TO GRACE · Original or Fake? Behind the counter at Ọjà, parts arrive
// in boxes. Mama Ngozi taught you the tells: a misspelt brand, a missing seal,
// the wrong box colour, a price too good to be true, "Made in Japen". Mark each
// box ORIGINAL or FAKE before the next customer pushes in.
// Params: count (boxes, 20) · need (correct to pass, 15)
// Outcomes: won | lost
import { rng, pickOf, rect, box, label, clamp, ui } from '../px.js'
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
  return { r, boxes, i: 0, right: 0, wrong: 0, need: params.need ?? Math.ceil(count * 0.75), left: 7, slide: 0, tip: '', tipT: 0, flash: null, flashT: 0, over: false, sound: [] }
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
  else s.left = limitFor(s.i)
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

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  // the stall: a wooden counter, shelves of parts behind
  rect(ctx, 0, 0, W, H, '#4a3a2c')
  for (let y = H * 0.16; y < H * 0.5; y += Math.max(P * 16, H * 0.17)) {
    rect(ctx, 0, y, W, P * 2, '#2a1f18')
    for (let x = P * 3; x < W; x += P * 13) box(ctx, x, y - P * 7, P * 7, P * 6, ['#c0392b', '#2f6fd6', '#f2c230', '#7f8c8d'][Math.floor(x / P / 10) % 4], Math.max(1, P / 2))
  }
  drawPerson(ctx, 'ngozi', W * 0.12, H * 0.72, P, { pose: s.flash === 'wrong' && s.flashT > 0 ? 'hit' : 'idle', t })
  // Mama Ngozi's chart on the wall: which brand comes in which colour box
  {
  const P = ui(v.P)
  const cw = P * 34
  box(ctx, W - cw - P * 3, P * 3, cw, P * 22, '#fff8e6', P)
  label(ctx, 'ORIGINAL BOXES', W - cw / 2 - P * 3, P * 6, { size: P * 2.6, color: '#1a1a1a', weight: 700 })
  BRANDS.forEach((b, i) => {
    const y = P * 9 + i * P * 3.4
    rect(ctx, W - cw, y - P, P * 3, P * 2, b.color)
    label(ctx, b.name, W - cw + P * 5, y, { size: P * 2.4, color: '#1a1a1a', align: 'left', weight: 700 })
  })
  }
  rect(ctx, 0, H * 0.64, W, H * 0.36, '#8a5a2b')
  rect(ctx, 0, H * 0.64, W, P * 2, '#5a3416')
  if (s.over) return
  const b = s.boxes[s.i]
  const bw = Math.min(W * 0.5, P * 80)
  const bh = bw * 0.62
  const bx = W / 2 - bw / 2 + s.slide * W * 0.6
  const by = H * 0.6 - bh
  box(ctx, bx, by, bw, bh, b.color, P)
  rect(ctx, bx + P * 2, by + P * 2, bw - P * 4, bh * 0.36, '#ffffff')
  label(ctx, b.brand, bx + bw / 2, by + P * 2 + bh * 0.18, { size: bh * 0.2, color: b.color === '#ffffff' ? '#000' : b.color })
  label(ctx, b.part, bx + bw / 2, by + bh * 0.52, { size: bh * 0.11 })
  label(ctx, b.origin, bx + bw / 2, by + bh * 0.68, { size: bh * 0.085, color: '#fff2a8' })
  if (b.seal) {
    rect(ctx, bx + bw - P * 10, by + bh - P * 9, P * 7, P * 7, '#c9ccd2')
    rect(ctx, bx + bw - P * 9, by + bh - P * 8, P * 2, P * 2, '#7fc8ff')
    rect(ctx, bx + bw - P * 6, by + bh - P * 6, P * 2, P * 2, '#ff8ad8')
  }
  // the price tag on a string
  box(ctx, bx + P * 2, by + bh - P * 9, P * 22, P * 7, '#fff2a8', Math.max(1, P / 2))
  label(ctx, `₦${b.price.toLocaleString('en-NG')}`, bx + P * 13, by + bh - P * 5.5, { size: P * 3.2, color: '#1a1a1a' })
  // the customer's patience
  const tw = bw * clamp(s.left / limitFor(s.i), 0, 1)
  rect(ctx, bx, by - P * 5, bw, P * 2, '#1a1a1a')
  rect(ctx, bx, by - P * 5, tw, P * 2, s.left < 2 ? '#e74c3c' : '#ffd23a')
  if (s.flashT > 0) label(ctx, s.flash === 'right' ? '✔' : '✖', W / 2, by - P * 12, { size: P * 10, color: s.flash === 'right' ? '#8ff0a4' : '#ff6b4a', alpha: s.flashT * 2 })
  if (s.tipT > 0) label(ctx, s.tip, W / 2, H * 0.8, { size: Math.max(11, P * 3.2), color: '#fff2a8', alpha: clamp(s.tipT, 0, 1) })
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
