// MAMA SUGAR · Pepper Soup Kitchen. Friday night, the kitchen behind the bar.
// Orders come in on the ticket rail: what meat, then the spices in the order
// Mama always adds them, and how hot. Tap the ingredients in that order, then
// SERVE. Wrong order and the bowl goes to Kokoro (he's not complaining).
// Params: target (bowls, 6) · seconds (75)
// Outcomes: won | lost
import { rng, pickOf, rect, box, label, disc, clamp } from '../px.js'

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
export function makeOrder(r) {
  const meat = pickOf(r, ['goat', 'catfish', 'chicken'])
  const leaves = pickOf(r, [['uziza'], ['scent'], ['uziza', 'scent']])
  const heat = 1 + Math.floor(r() * 3)
  const steps = [meat, 'spice', ...leaves, ...Array(heat).fill('pepper')]
  return { who: pickOf(r, CUSTOMERS), steps, heat, patience: 14 + steps.length * 2, max: 14 + steps.length * 2 }
}

export function create(params = {}, seed = 1) {
  const r = rng(seed)
  return { r, time: params.seconds ?? 75, target: params.target ?? 6, orders: [makeOrder(r), makeOrder(r)], pot: [], served: 0, spoilt: 0, walked: 0, msg: '', msgT: 0, steam: 0, over: false, sound: [] }
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
  for (const o of s.orders) o.patience -= dt
  if (s.orders[0] && s.orders[0].patience <= 0) {
    const o = s.orders.shift()
    s.pot = []
    s.walked++
    s.msg = `${o.who} got tired of waiting and left.`
    s.msgT = 1.6
    s.sound.push('wrong')
  }
  while (s.orders.length < 3) s.orders.push(makeOrder(s.r))
  if (s.time <= 0 || s.walked >= 3) s.over = true
}

export function input(s, ev) {
  if (ev.type !== 'button') return
  if (ev.id === 'serve') serve(s)
  else if (ITEMS[ev.id]) add(s, ev.id)
}

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  rect(ctx, 0, 0, W, H, '#3a2a20')
  rect(ctx, 0, 0, W, H * 0.12, '#2a1f18')
  for (let x = 0; x < W; x += P * 8) rect(ctx, x, H * 0.12, P * 7, P * 7, (x / P / 8) % 2 ? '#d9d2c0' : '#bfb7a2') // tiles
  // the ticket rail: the current order big, the next ones small
  const o = s.orders[0]
  if (o) {
    const tw = Math.min(W * 0.42, P * 80)
    box(ctx, P * 3, H * 0.18, tw, P * 12 + o.steps.length * P * 5, '#fff8e6', P)
    label(ctx, o.who, P * 3 + tw / 2, H * 0.18 + P * 4, { size: P * 3, color: '#1a1a1a' })
    o.steps.forEach((st, i) => {
      const y = H * 0.18 + P * 10 + i * P * 5
      const done = i < s.pot.length
      rect(ctx, P * 6, y - P * 1.5, P * 3, P * 3, ITEMS[st].color)
      label(ctx, `${i + 1}. ${ITEMS[st].name}${done ? ' ✔' : ''}`, P * 11, y, { size: P * 2.8, align: 'left', color: done ? '#1e8449' : i === s.pot.length ? '#b3261e' : '#1a1a1a', weight: 800 })
    })
    rect(ctx, P * 3, H * 0.18 - P * 3, tw * clamp(o.patience / o.max, 0, 1), P * 2, o.patience < 5 ? '#e74c3c' : '#ffd23a')
  }
  s.orders.slice(1, 3).forEach((n, i) => label(ctx, `next: ${n.who}`, W - P * 4, H * 0.18 + i * P * 5, { size: P * 2.6, align: 'right', color: '#d9c7a8', weight: 700 }))
  // the pot on the gas ring
  const cx = W * 0.68
  const cy = H * 0.52
  const pr = Math.min(W * 0.16, H * 0.2)
  for (let i = 0; i < 6; i++) rect(ctx, cx - pr + i * (pr / 3), cy + pr * 0.9 + Math.sin(t * 12 + i) * P, P * 3, P * 3, i % 2 ? '#4aa3ff' : '#9fd3ff')
  disc(ctx, cx, cy, pr, '#5a5a5a', P)
  disc(ctx, cx, cy, pr * 0.82, s.pot.includes('pepper') ? '#b5541e' : s.pot.length ? '#c98a3a' : '#d9b07a', P, '#3a3a3a')
  s.pot.forEach((it, i) => rect(ctx, cx - pr * 0.5 + ((i * 37) % 10) * pr * 0.1, cy - pr * 0.3 + ((i * 53) % 7) * pr * 0.1, P * 3, P * 3, ITEMS[it].color))
  const steamUp = s.pot.length ? 3 : 1
  for (let k = 0; k < steamUp + (s.steam > 0 ? 4 : 0); k++) {
    const yy = cy - pr - ((t * 30 + k * 13) % 40) * P * 0.6
    ctx.save()
    ctx.globalAlpha = 0.35
    rect(ctx, cx - pr * 0.4 + k * pr * 0.2, yy, P * 3, P * 3, '#ffffff')
    ctx.restore()
  }
  if (s.msgT > 0) label(ctx, s.msg, W / 2, H * 0.08, { size: Math.max(11, P * 3.2), alpha: clamp(s.msgT, 0, 1) })
}

export const hud = (s) => [
  { label: 'TIME', value: Math.max(0, Math.ceil(s.time)), warn: s.time < 10 },
  { label: 'BOWLS', value: `${s.served}/${s.target}` },
  { label: 'LEFT HUNGRY', value: '✖'.repeat(s.walked) || '–', warn: s.walked >= 2 },
]
export const buttons = () => [
  ...Object.entries(ITEMS).map(([id, it], i) => ({ id, label: it.name, color: it.color, key: String(i + 1) })),
  { id: 'serve', label: 'SERVE', color: '#1e8449', key: 'Enter' },
]

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
  rules: ['The ticket shows the order and Mama\'s way: the meat, the spice mix, the leaves, then pepper (once for each level of heat).', 'Tap the ingredients in exactly that order, then SERVE.', 'A wrong ingredient spoils the bowl: start that order again.', 'Customers won\'t wait forever. Three walk out and the night is over.'],
  short: 'Meat, spice, leaves, pepper. Then SERVE.',
  keys: { Digit1: 'goat', Digit2: 'catfish', Digit3: 'chicken', Digit4: 'spice', Digit5: 'uziza', Digit6: 'scent', Digit7: 'pepper', Enter: 'serve', Space: 'serve' },
  create, step, input, draw, hud, buttons, result,
}
