// MAMA SUGAR · Pepper Soup Kitchen. Friday night, the kitchen behind the bar.
// Orders come in on the ticket rail: what meat, then the spices in the order
// Mama always adds them, and how hot. Tap the bowls on the counter in that
// order (each one flies into the pot), then SERVE. Wrong order and the bowl
// goes to Kokoro (he's not complaining). Drawn like a cooking game: the
// counter from above, steel bowls of goat, catfish, chicken, spice mix,
// uziza, scent leaf and peppers, the pot on the gas with a ladle stirring.
// Params: target (bowls, 6) · seconds (75)
// Outcomes: won | lost
import { rng, pickOf, rect, box, label, disc, clamp, ui } from '../px.js'

export const ITEMS = {
  goat: { name: 'GOAT', color: '#8a4a2a', kind: 'meat' },
  catfish: { name: 'CATFISH', color: '#5a6a7a', kind: 'meat' },
  chicken: { name: 'CHICKEN', color: '#e8c48a', kind: 'meat' },
  spice: { name: 'SPICE MIX', color: '#a0522d', kind: 'spice' },
  uziza: { name: 'UZIZA', color: '#2e7a3a', kind: 'spice' },
  scent: { name: 'SCENT LEAF', color: '#4caf50', kind: 'spice' },
  pepper: { name: 'PEPPER', color: '#d9342b', kind: 'heat' },
}
const CUSTOMERS = ['Commander Bassey', 'Chief Dapo', 'A Shell engineer', 'The wedding party', 'Baba Paraga', 'A tired nurse', 'Kokoro (again)']

/** An order: meat, the spice mix, then uziza or scent leaf (or both), then 1-3 peppers. */
export function makeOrder(r, mul = 1) {
  const meat = pickOf(r, ['goat', 'catfish', 'chicken'])
  const leaves = pickOf(r, [['uziza'], ['scent'], ['uziza', 'scent']])
  const heat = 1 + Math.floor(r() * 3)
  const steps = [meat, 'spice', ...leaves, ...Array(heat).fill('pepper')]
  const pat = (14 + steps.length * 2) * mul
  return { who: pickOf(r, CUSTOMERS), steps, heat, patience: pat, max: pat }
}

export function create(params = {}, seed = 1) {
  const r = rng(seed)
  const mul = params.patienceMul ?? 1
  // fly: ingredients on their way into the pot; out: a served bowl sliding away; splash: drops
  return { r, mul, time: params.seconds ?? 75, target: params.target ?? 6, orders: [makeOrder(r, mul), makeOrder(r, mul)], pot: [], served: 0, spoilt: 0, walked: 0, msg: '', msgT: 0, steam: 0, fly: [], out: null, splash: [], over: false, sound: [] }
}

export function add(s, item) {
  const o = s.orders[0]
  if (!o || s.over) return
  const want = o.steps[s.pot.length]
  if (item !== want) {
    s.spoilt++
    s.msg = want ? `Wrong! Mama adds ${ITEMS[want].name} next. That bowl goes to Kokoro.` : 'It\'s ready already: SERVE it!'
    s.msgT = 1.8
    s.pot = []
    s.sound.push('wrong')
    return
  }
  s.pot.push(item)
  s.fly.push({ item, t: 0 })
  s.sound.push(item === 'pepper' ? 'click' : 'slide')
}

export function serve(s) {
  const o = s.orders[0]
  if (!o) return
  if (s.pot.length !== o.steps.length) {
    s.msg = 'Not finished! Check the ticket.'
    s.msgT = 1.2
    s.sound.push('bump')
    return
  }
  s.orders.shift()
  s.out = { color: potColor(s.pot), t: 0 }
  s.pot = []
  s.served++
  s.steam = 1
  s.msg = `${o.who}: "Ehen! This one go wake the dead!"`
  s.msgT = 1.5
  s.sound.push('cash')
}

export function step(s, dt) {
  s.time -= dt
  s.msgT -= dt
  s.steam = Math.max(0, s.steam - dt)
  for (const f of s.fly) f.t += dt
  // a piece that lands splashes
  for (const f of s.fly) if (f.t >= FLY && !f.landed) {
    f.landed = true
    for (let i = 0; i < 6; i++) s.splash.push({ a: (i / 6) * Math.PI * 2 + s.r(), v: 0.6 + s.r() * 0.6, t: 0 })
  }
  s.fly = s.fly.filter((f) => f.t < FLY + 0.05)
  for (const d of s.splash) d.t += dt
  s.splash = s.splash.filter((d) => d.t < 0.4)
  if (s.out) {
    s.out.t += dt
    if (s.out.t > 1.1) s.out = null
  }
  for (const o of s.orders) o.patience -= dt
  if (s.orders[0] && s.orders[0].patience <= 0) {
    const o = s.orders.shift()
    s.pot = []
    s.walked++
    s.msg = `${o.who} got tired of waiting and left.`
    s.msgT = 1.6
    s.sound.push('wrong')
  }
  while (s.orders.length < 3) s.orders.push(makeOrder(s.r, s.mul))
  if (s.time <= 0 || s.walked >= 3) s.over = true
}

export function input(s, ev, v) {
  if (ev.type === 'button') {
    if (ev.id === 'serve') serve(s)
    else if (ITEMS[ev.id]) add(s, ev.id)
    return
  }
  if (ev.type !== 'down' || !v) return
  // tap a bowl to add it; tap the pot to serve
  const L = kitchen(v)
  for (const b of L.bowls) if (Math.hypot(ev.x - b.x, ev.y - b.y) < b.r * 1.15) return add(s, b.id)
  if (Math.hypot(ev.x - L.pot.x, ev.y - L.pot.y) < L.pot.r) serve(s)
}

const FLY = 0.35 // seconds an ingredient takes to fly into the pot
const ORDER = Object.keys(ITEMS)

/** Where everything sits: the ticket on the left, the pot and seven bowls on the counter. */
export function kitchen(v) {
  const { W, H } = v
  const x0 = Math.min(W * 0.36, W - H * 1.2)
  const aw = W - x0
  const r = Math.max(9, Math.min(aw / 10, H * 0.085))
  const pot = { x: x0 + aw / 2, y: H * 0.3, r: Math.min(aw * 0.17, H * 0.17) }
  const bowls = ORDER.map((id, i) => {
    const row = i < 4 ? 0 : 1
    const n = row ? 3 : 4
    const k = row ? i - 4 : i
    return { id, x: x0 + aw * ((k + 0.5) / n) * (row ? 0.75 : 1) + (row ? aw * 0.125 : 0), y: H * (row ? 0.8 : 0.6), r }
  })
  return { x0, pot, bowls }
}

const potColor = (pot) => (pot.includes('pepper') ? '#b5541e' : pot.includes('scent') || pot.includes('uziza') ? '#9a6a2a' : pot.length ? '#c98a3a' : '#d9b07a')

// what's in each bowl, drawn on the soup-coloured inside
function contents(ctx, id, x, y, r, P) {
  const u = Math.max(1, r / 7)
  const bits = (n, f) => {
    for (let i = 0; i < n; i++) {
      const a = i * 2.4
      const d = (i % 3) * 0.22 + 0.12
      f(x + Math.cos(a) * r * d, y + Math.sin(a) * r * d * 0.8, i)
    }
  }
  if (id === 'goat') bits(7, (px, py, i) => rect(ctx, px - u * 1.5, py - u, u * 3, u * 2.2, i % 2 ? '#7a3f22' : '#9a5530'))
  else if (id === 'catfish')
    bits(5, (px, py) => {
      rect(ctx, px - u * 2, py - u, u * 4, u * 2, '#6b7b8b')
      rect(ctx, px - u * 0.5, py - u, u, u * 2, '#4a5866')
    })
  else if (id === 'chicken')
    bits(5, (px, py) => {
      rect(ctx, px - u * 1.5, py - u * 1.5, u * 3, u * 2.5, '#e8c48a')
      rect(ctx, px + u * 1.2, py - u * 0.5, u * 1.5, u, '#f6ecd2')
    })
  else if (id === 'spice') {
    rect(ctx, x - r * 0.45, y - r * 0.2, r * 0.9, r * 0.45, '#8a3f1d')
    rect(ctx, x - r * 0.3, y - r * 0.35, r * 0.6, r * 0.2, '#a0522d')
    bits(9, (px, py) => rect(ctx, px, py, u * 0.8, u * 0.8, '#d98a4a'))
  } else if (id === 'uziza') bits(12, (px, py, i) => rect(ctx, px, py, u * 1.2, u * 1.2, i % 2 ? '#2a3a1a' : '#4a5a2a'))
  else if (id === 'scent')
    bits(5, (px, py, i) => {
      rect(ctx, px - u * 2, py - u * 0.8, u * 4, u * 1.6, i % 2 ? '#3f9a3a' : '#5cbf4a')
      rect(ctx, px - u * 0.2, py - u * 0.8, u * 0.4, u * 1.6, '#2a6a26')
    })
  else
    bits(5, (px, py) => {
      rect(ctx, px - u, py - u * 1.2, u * 2.2, u * 2.4, '#d9342b')
      rect(ctx, px - u * 0.3, py - u * 2, u * 0.8, u, '#2e7a3a')
    })
  void P
}

// a filled pixel circle (disc() wants the pixel size, and a rim colour)
const fill = (ctx, x, y, r, c, P) => disc(ctx, x, y, r, c, Math.max(1, Math.round(P / 2)), c)

function steelBowl(ctx, x, y, r, P) {
  fill(ctx, x + r * 0.08, y + r * 0.12, r, 'rgba(0,0,0,0.25)', P)
  disc(ctx, x, y, r, '#c9ced6', Math.max(1, Math.round(P / 2)), '#6c727c')
  fill(ctx, x, y, r * 0.8, '#e9ecf0', P)
  rect(ctx, x - r * 0.55, y - r * 0.7, r * 0.3, r * 0.12, '#ffffff') // shine
}

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  const L = kitchen(v)
  // the counter: blue tiles behind, a warm wooden worktop in front
  rect(ctx, 0, 0, W, H, '#c8955c')
  for (let y = 0; y < H; y += P * 10) rect(ctx, 0, y, W, P, '#b07f4a')
  for (let x = 0; x < W; x += P * 9) for (let y = 0; y < H * 0.12; y += P * 9) rect(ctx, x + P, y + P, P * 8, P * 8, (x / P / 9 + y / P / 9) % 2 ? '#5da9d9' : '#7cbde6')
  rect(ctx, 0, H * 0.12, W, P * 2, '#8a5a2b')
  // the ticket rail: the current order big, the next ones small
  const o = s.orders[0]
  if (o) {
    const U = ui(v.P)
    const tw = Math.min(L.x0 - U * 4, U * 80)
    box(ctx, U * 3, H * 0.16, tw, U * 12 + o.steps.length * U * 5, '#fff8e6', U)
    rect(ctx, U * 3 + tw / 2 - U * 2, H * 0.16 - U * 2, U * 4, U * 3, '#9aa0a8') // the clip
    label(ctx, o.who, U * 3 + tw / 2, H * 0.16 + U * 4, { size: U * 3, color: '#1a1a1a' })
    o.steps.forEach((st, k) => {
      const y = H * 0.16 + U * 10 + k * U * 5
      const done = k < s.pot.length
      rect(ctx, U * 6, y - U * 1.5, U * 3, U * 3, ITEMS[st].color)
      label(ctx, `${k + 1}. ${ITEMS[st].name}${done ? ' ✔' : ''}`, U * 11, y, { size: U * 2.8, align: 'left', color: done ? '#1e8449' : k === s.pot.length ? '#b3261e' : '#1a1a1a', weight: 800 })
    })
    rect(ctx, U * 3, H * 0.16 - U * 4, tw * clamp(o.patience / o.max, 0, 1), U * 1.5, o.patience < 5 ? '#e74c3c' : '#ffd23a')
    s.orders.slice(1, 3).forEach((n, k) => label(ctx, `next: ${n.who}`, W - U * 3, H * 0.17 + k * U * 4, { size: U * 2.4, align: 'right', color: '#4a2a10', weight: 700 }))
  }
  // the gas ring under the pot, flames licking round it
  const { x: cx, y: cy, r: pr } = L.pot
  fill(ctx, cx, cy, pr * 1.18, '#2a2a2e', P)
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2
    const fl = 1 + 0.25 * Math.sin(t * 18 + k * 2)
    rect(ctx, cx + Math.cos(a) * pr * 1.06 * fl - P, cy + Math.sin(a) * pr * 1.06 * fl - P, P * 2, P * 2, k % 2 ? '#4aa3ff' : '#9fd3ff')
  }
  // the pot: dark rim, the soup, bits of what's gone in, bubbles, the ladle stirring
  disc(ctx, cx, cy, pr, '#4a4a50', Math.max(1, Math.round(P / 2)), '#2a2a2e')
  fill(ctx, cx, cy, pr * 0.84, potColor(s.pot), P)
  rect(ctx, cx - pr * 1.2, cy - P, pr * 0.22, P * 2, '#2a2a2e') // handles
  rect(ctx, cx + pr * 0.98, cy - P, pr * 0.22, P * 2, '#2a2a2e')
  const swirl = t * 1.6
  s.pot.forEach((it, k) => {
    const a = swirl + k * 1.7
    const d = pr * (0.25 + (k % 3) * 0.17)
    rect(ctx, cx + Math.cos(a) * d - P * 1.5, cy + Math.sin(a) * d * 0.9 - P * 1.5, P * 3, P * 3, ITEMS[it].color)
  })
  for (let k = 0; k < 5; k++) {
    const ph = (t * 1.3 + k * 0.37) % 1
    const a = k * 2.1 + Math.floor(t * 1.3 + k * 0.37) * 1.3
    ctx.save()
    ctx.globalAlpha = 0.6 * (1 - ph)
    fill(ctx, cx + Math.cos(a) * pr * 0.5, cy + Math.sin(a) * pr * 0.45, P * (1 + ph * 2), '#f6d9a8', P)
    ctx.restore()
  }
  // the ladle: a long wooden handle going round with the stirring
  const la = swirl
  const lx = cx + Math.cos(la) * pr * 0.45
  const ly = cy + Math.sin(la) * pr * 0.4
  disc(ctx, lx, ly, pr * 0.16, '#8a6a44', Math.max(1, Math.round(P / 2)), '#5a4024')
  for (let k = 0; k < 10; k++) rect(ctx, lx + (k * pr * 0.09) * Math.cos(la - 0.9) - P, ly + (k * pr * 0.09) * Math.sin(la - 0.9) - P * 1.5 - k * P * 0.6, P * 2, P * 2, '#a0784a')
  // splashes where something just landed
  for (const d of s.splash) rect(ctx, cx + Math.cos(d.a) * pr * 0.5 * (1 + d.t * 3 * d.v) - P, cy + Math.sin(d.a) * pr * 0.4 * (1 + d.t * 3 * d.v) - P - d.t * pr * 0.8 * (1 - d.t * 2), P * 2, P * 2, '#f6d9a8')
  // steam
  const puffs = (s.pot.length ? 3 : 1) + (s.steam > 0 ? 4 : 0)
  for (let k = 0; k < puffs; k++) {
    const ph = (t * 0.6 + k * 0.23) % 1
    ctx.save()
    ctx.globalAlpha = 0.45 * (1 - ph)
    fill(ctx, cx - pr * 0.4 + k * pr * 0.2 + Math.sin(t * 2 + k) * P * 2, cy - pr * 0.9 - ph * pr, P * (2 + ph * 3), '#ffffff', P)
    ctx.restore()
  }
  // the bowls of ingredients, each with its name
  for (const b of L.bowls) {
    steelBowl(ctx, b.x, b.y, b.r, P)
    contents(ctx, b.id, b.x, b.y, b.r * 0.8, P)
    label(ctx, ITEMS[b.id].name, b.x, b.y + b.r + Math.max(7, P * 2.6), { size: Math.max(9, Math.min(P * 2.6, b.r * 0.42)), color: '#2a1408', weight: 900 })
  }
  // ingredients flying from their bowl into the pot
  for (const f of s.fly) {
    if (f.landed) continue
    const b = L.bowls.find((q) => q.id === f.item)
    const k = clamp(f.t / FLY, 0, 1)
    const x = b.x + (cx - b.x) * k
    const y = b.y + (cy - b.y) * k - Math.sin(k * Math.PI) * pr * 0.7
    contents(ctx, f.item, x, y, b.r * 0.45, P)
  }
  // a served bowl, ladled out and sliding off to the table
  if (s.out) {
    const k = clamp(s.out.t / 1.1, 0, 1)
    const x = cx + pr * 1.3 + k * (W - cx)
    steelBowl(ctx, x, cy, pr * 0.42, P)
    fill(ctx, x, cy, pr * 0.3, s.out.color, P)
  }
  if (s.msgT > 0) label(ctx, s.msg, W / 2, H * 0.06, { size: Math.max(11, P * 3.2), alpha: clamp(s.msgT, 0, 1) })
}

export const hud = (s) => [
  { label: 'TIME', value: Math.max(0, Math.ceil(s.time)), warn: s.time < 10 },
  { label: 'BOWLS', value: `${s.served}/${s.target}` },
  { label: 'LEFT HUNGRY', value: '✖'.repeat(s.walked) || '–', warn: s.walked >= 2 },
]
// the bowls on the counter are the ingredients (tap them, or keys 1-7); SERVE is the only button
export const buttons = () => [{ id: 'serve', label: 'SERVE 🍲', color: '#1e8449', key: 'Enter', big: true }]

export function result(s) {
  const won = s.served >= s.target && s.walked < 3
  return {
    outcome: won ? 'won' : 'lost',
    score: s.served * 10 - s.spoilt * 3,
    moneyChange: s.served * 2500,
    headline: won ? 'The kitchen is the best thing about Sugar Palace tonight.' : s.walked >= 3 ? 'Three tables walked out hungry.' : 'Not enough bowls went out.',
    line: `${s.served} bowls served · ${s.spoilt} spoilt (Kokoro ate well).`,
  }
}

export default {
  id: 'pepperSoup', title: 'Pepper Soup Kitchen', scoreLabel: 'points', start: 'Light the gas',
  rules: ['The ticket shows the order and Mama\'s way: the meat, the spice mix, the leaves, then pepper (once for each level of heat).', 'Tap the bowls on the counter in exactly that order (keys 1-7 work too), then SERVE (or tap the pot).', 'A wrong ingredient spoils the bowl: start that order again.', 'Customers won\'t wait forever. Three walk out and the night is over.'],
  short: 'Meat, spice, leaves, pepper. Then SERVE.',
  keys: { Digit1: 'goat', Digit2: 'catfish', Digit3: 'chicken', Digit4: 'spice', Digit5: 'uziza', Digit6: 'scent', Digit7: 'pepper', Enter: 'serve', Space: 'serve' },
  create, step, input, draw, hud, buttons, result,
}
