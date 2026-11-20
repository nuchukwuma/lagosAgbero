// CAMPUS · Akara Fry. Mama's stall at dawn, before the danfo drivers come.
// Six places in the hot oil. Tap an empty place to drop a ball of batter; it
// browns. Tap it when it's golden to flip it; tap it golden again to lift it
// into the basket. Too early and it's raw inside; too late and it burns.
// Finished akara fills the orders on the board, and customers won't wait forever.
// Params: target (orders to fill, 5) · seconds (70)
// Outcomes: won | lost
import { rng, rect, box, label, disc, clamp, ui } from '../px.js'

export const GOLD = [0.5, 0.78] // the golden window
export const BURNT = 1.05

const SHADES = ['#f3e2b0', '#eccd7a', '#e0a83f', '#c97a23', '#8a4a16', '#3a2008']
export function shade(cook) {
  if (cook >= BURNT) return SHADES[5]
  if (cook >= GOLD[1]) return SHADES[4]
  if (cook >= GOLD[0]) return SHADES[3]
  if (cook >= 0.3) return SHADES[2]
  if (cook >= 0.12) return SHADES[1]
  return SHADES[0]
}

function newOrder(s) {
  const n = 2 + Math.floor(s.r() * 4)
  const who = ['Danfo driver', 'Conductor', 'Mama Bisi', 'Bus-stop pastor', 'Okada man', 'Schoolgirl'][Math.floor(s.r() * 6)]
  return { n, got: 0, patience: 12 + n * 3, max: 12 + n * 3, who }
}

export function create(params = {}, seed = 1) {
  const r = rng(seed)
  const s = { r, time: params.seconds ?? 70, target: params.target ?? 5, slots: Array.from({ length: 6 }, (_, i) => ({ state: 'empty', cook: 0, speed: (0.16 + ((i * 7) % 5) * 0.012) * (params.cookMul ?? 1) })), orders: [], filled: 0, burnt: 0, perfect: 0, walked: 0, msg: '', msgT: 0, over: false, sound: [] }
  s.orders.push(newOrder(s), newOrder(s))
  return s
}

export function tapSlot(s, i) {
  const sl = s.slots[i]
  if (!sl) return
  if (sl.state === 'empty') {
    sl.state = 'side1'
    sl.cook = 0
    s.sound.push('slide')
    return
  }
  if (sl.cook >= BURNT) {
    sl.state = 'empty'
    s.burnt++
    s.msg = 'Burnt! Into the dustbin.'
    s.msgT = 1
    s.sound.push('wrong')
    return
  }
  if (sl.cook < GOLD[0]) {
    s.msg = 'Still raw! Wait for golden.'
    s.msgT = 0.8
    s.sound.push('bump')
    return
  }
  const golden = sl.cook <= GOLD[1]
  if (sl.state === 'side1') {
    sl.state = 'side2'
    sl.cook = 0
    sl.goodSide1 = golden
    s.sound.push('click')
    return
  }
  // side2 done: lift it out
  sl.state = 'empty'
  if (golden && sl.goodSide1) s.perfect++
  s.sound.push('coin')
  const o = s.orders[0]
  if (o) {
    o.got++
    if (o.got >= o.n) {
      s.orders.shift()
      s.filled++
      s.msg = `${o.who}: "Mama Somto's akara! Correct!"`
      s.msgT = 1.4
      s.sound.push('cash')
    }
  }
}

export function step(s, dt) {
  s.time -= dt
  s.msgT -= dt
  for (const sl of s.slots) if (sl.state !== 'empty') sl.cook += dt * sl.speed
  for (const o of s.orders) o.patience -= dt
  if (s.orders[0] && s.orders[0].patience <= 0) {
    const o = s.orders.shift()
    s.walked++
    s.msg = `${o.who} kissed their teeth and left.`
    s.msgT = 1.5
    s.sound.push('wrong')
  }
  while (s.orders.length < 3) s.orders.push(newOrder(s))
  if (s.time <= 0 || s.walked >= 3) s.over = true
}

export function slotPos(v, i) {
  const pw = Math.min(v.W * 0.62, v.H * 0.8)
  const cx = v.W * 0.58
  const cy = v.H * 0.5
  const col = i % 3
  const row = Math.floor(i / 3)
  return { x: cx + (col - 1) * pw * 0.26, y: cy + (row - 0.5) * pw * 0.2, r: pw * 0.085 }
}

export function input(s, ev, v) {
  if (ev.type === 'button') return tapSlot(s, Number(ev.id))
  if (ev.type !== 'down') return
  for (let i = 0; i < 6; i++) {
    const p = slotPos(v, i)
    if (Math.hypot(ev.x - p.x, ev.y - p.y) < p.r * 1.5) return tapSlot(s, i)
  }
}

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  rect(ctx, 0, 0, W, H, '#c9a46a')
  rect(ctx, 0, 0, W, H * 0.3, '#ffb36b') // dawn
  rect(ctx, 0, H * 0.3, W, P * 2, '#7a4a24')
  // the big black pan on its stand, firewood glowing beneath
  const pw = Math.min(W * 0.62, H * 0.8)
  const cy = H * 0.5
  const px0 = W * 0.58
  for (let i = 0; i < 8; i++) rect(ctx, px0 - pw * 0.4 + i * pw * 0.1, cy + pw * 0.3 + Math.sin(t * 9 + i) * P, P * 3, P * 3, i % 2 ? '#ff8a24' : '#ffd23a')
  disc(ctx, px0, cy, pw * 0.48, '#2a2a2a', P)
  disc(ctx, px0, cy, pw * 0.42, '#b07a2a', P, '#2a2a2a') // the oil
  for (let i = 0; i < 6; i++) {
    const sl = s.slots[i]
    const p = slotPos(v, i)
    if (sl.state === 'empty') {
      disc(ctx, p.x, p.y, p.r, '#c08a3a', Math.max(1, Math.round(P / 2)), '#9a6a24')
      label(ctx, String(i + 1), p.x, p.y, { size: P * 3, color: '#ffe9b0', alpha: 0.6 })
      continue
    }
    disc(ctx, p.x, p.y, p.r, shade(sl.cook), Math.max(1, Math.round(P / 1.2)))
    if (sl.cook >= BURNT) for (let k = 0; k < 3; k++) rect(ctx, p.x - P + k * P * 2, p.y - p.r - P * 3 - ((t * 20 + k * 5) % 12) * P * 0.5, P * 2, P * 2, 'rgba(60,60,60,0.7)')
    else if (sl.cook >= GOLD[0] && sl.cook <= GOLD[1]) label(ctx, sl.state === 'side1' ? 'FLIP' : 'LIFT', p.x, p.y - p.r - P * 3, { size: P * 2.8, color: '#ffd23a' })
    // bubbles round the edge
    rect(ctx, p.x + Math.cos(t * 7 + i) * p.r, p.y + Math.sin(t * 7 + i) * p.r, P, P, '#ffe9b0')
  }
  // the order board
  {
  const P = ui(v.P)
  const bw = Math.min(W * 0.32, P * 60)
  box(ctx, P * 3, P * 4, bw, P * 26, '#2a3a2a', P)
  label(ctx, 'ORDERS', P * 3 + bw / 2, P * 7, { size: P * 3, color: '#ffd23a' })
  s.orders.slice(0, 3).forEach((o, i) => {
    const y = P * 12 + i * P * 6
    label(ctx, `${o.who}: ${o.got}/${o.n}`, P * 5, y, { size: P * 2.6, align: 'left', color: i === 0 ? '#ffffff' : '#9fbf9f', weight: 700 })
    rect(ctx, P * 5, y + P * 2, (bw - P * 4) * clamp(o.patience / o.max, 0, 1), P, o.patience < 5 ? '#e74c3c' : '#8ff0a4')
  })
  }
  if (s.msgT > 0) label(ctx, s.msg, W / 2, H * 0.93, { size: Math.max(12, P * 3.4), alpha: clamp(s.msgT, 0, 1) })
}

export const hud = (s) => [
  { label: 'TIME', value: Math.max(0, Math.ceil(s.time)), warn: s.time < 10 },
  { label: 'ORDERS', value: `${s.filled}/${s.target}` },
  { label: 'BURNT', value: s.burnt },
  { label: 'LEFT ANGRY', value: '✖'.repeat(s.walked) || '–', warn: s.walked >= 2 },
]

export function result(s) {
  const won = s.filled >= s.target && s.walked < 3
  return {
    outcome: won ? 'won' : 'lost',
    score: s.filled * 10 + s.perfect - s.burnt * 2,
    moneyChange: s.filled * 600,
    headline: won ? 'The whole bus stop is eating your akara!' : s.walked >= 3 ? 'The queue went to the other akara woman.' : 'Not enough orders filled.',
    line: `${s.filled} orders filled · ${s.perfect} perfect golden · ${s.burnt} burnt.`,
  }
}

export default {
  id: 'akara', title: 'Akara Fry', scoreLabel: 'points', start: 'Heat the oil',
  rules: ['Tap an empty place in the pan to drop a ball of batter (or press 1-6).', 'When it turns golden ("FLIP"), tap it to turn it over. When the second side is golden ("LIFT"), tap it again to lift it out.', 'Too early is raw. Too late burns: tap a burnt one to throw it away.', 'Finished akara fills the orders. Fill enough before time runs out; three customers walking off and you\'re done.'],
  short: 'Drop, flip at golden, lift at golden.',
  keys: { Digit1: '0', Digit2: '1', Digit3: '2', Digit4: '3', Digit5: '4', Digit6: '5' },
  create, step, input, draw, hud, result,
}
