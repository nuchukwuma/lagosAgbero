// MAMA SUGAR · Bar Rush. Saturday night at Sugar Palace: four stools, one Mama.
// Customers sit and shout their drink. Tap the drink on the shelf: it goes to
// whoever wants it most urgently. A drink nobody ordered is money wasted; a
// customer left waiting too long walks out, and some of them knock a chair
// over on the way.
// Params: target (₦ takings, 20000) · seconds (60)
// Outcomes: won | lost
import { rng, pickOf, rect, box, label, clamp, ui } from '../px.js'
import { drawPerson } from '../people.js'

export const DRINKS = {
  lager: { name: 'LAGER', color: '#e0b030', price: 900 },
  stout: { name: 'STOUT', color: '#3a2418', price: 1100 },
  malt: { name: 'MALT', color: '#7a3a1a', price: 700 },
  zobo: { name: 'ZOBO', color: '#9b1b3a', price: 500 },
  chapman: { name: 'CHAPMAN', color: '#e8542a', price: 1500 },
}
const IDS = Object.keys(DRINKS)
export const SEATS = 4

export function create(params = {}, seed = 1) {
  const r = rng(seed)
  return { r, patienceMul: params.patienceMul ?? 1, total: params.seconds ?? 60, time: params.seconds ?? 60, target: params.target ?? 20000, seats: Array(SEATS).fill(null), takings: 0, wasted: 0, walked: 0, served: 0, spawn: 0.4, msg: '', msgT: 0, over: false, sound: [] }
}

export function pour(s, drink) {
  if (s.over) return
  const want = s.seats.map((c, i) => ({ c, i })).filter(({ c }) => c && !c.leaving && c.drink === drink)
  if (!want.length) {
    s.wasted += 300
    s.takings = Math.max(0, s.takings - 300)
    s.msg = `Nobody ordered ${DRINKS[drink].name}. −₦300`
    s.msgT = 1.2
    s.sound.push('wrong')
    return
  }
  want.sort((a, b) => a.c.patience - b.c.patience)
  const { c } = want[0]
  const tip = c.patience > c.max * 0.6 ? 200 : 0
  s.takings += DRINKS[drink].price + tip
  s.served++
  c.leaving = 0.8
  c.happy = true
  s.sound.push('coin')
  if (tip) {
    s.msg = '"Mama, you dey fast! Keep the change."'
    s.msgT = 1
  }
}

export function step(s, dt) {
  s.time -= dt
  s.msgT -= dt
  const elapsed = s.total - s.time
  s.spawn -= dt
  if (s.spawn <= 0) {
    const free = s.seats.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0)
    if (free.length) {
      const max = clamp(9 - elapsed * 0.06, 5, 9) * s.patienceMul
      s.seats[pickOf(s.r, free)] = { drink: pickOf(s.r, IDS), patience: max, max, seed: 500 + Math.floor(s.r() * 300) }
    }
    s.spawn = clamp(1.6 - elapsed * 0.015, 0.7, 1.6) * (0.7 + s.r() * 0.6)
  }
  s.seats.forEach((c, i) => {
    if (!c) return
    if (c.leaving != null) {
      c.leaving -= dt
      if (c.leaving <= 0) s.seats[i] = null
      return
    }
    c.patience -= dt
    if (c.patience <= 0) {
      s.walked++
      c.leaving = 0.8
      c.happy = false
      s.msg = s.r() < 0.4 ? 'He kicks the stool over on his way out.' : '"This bar is too slow!" Gone.'
      s.msgT = 1.4
      s.sound.push('bump')
    }
  })
  if (s.time <= 0 || s.walked >= 5) s.over = true
}

export function input(s, ev) {
  if (ev.type === 'button' && DRINKS[ev.id]) pour(s, ev.id)
}

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  rect(ctx, 0, 0, W, H, '#2a1430')
  // fairy lights and the shelf of bottles
  for (let x = 0; x < W; x += P * 6) rect(ctx, x, P * 4 + Math.sin(x) * P, P * 2, P * 2, ['#ff6b4a', '#ffd23a', '#8ff0a4', '#7fc8ff'][Math.floor(x / P / 6) % 4])
  rect(ctx, 0, H * 0.2, W, P * 2, '#5a3416')
  for (let x = P * 4; x < W; x += P * 7) {
    const d = DRINKS[IDS[Math.floor(x / P / 7) % IDS.length]]
    rect(ctx, x, H * 0.2 - P * 9, P * 3, P * 9, d.color)
    rect(ctx, x + P, H * 0.2 - P * 11, P, P * 2, d.color)
  }
  label(ctx, 'SUGAR PALACE · COLD DRINKS', W / 2, H * 0.27, { size: P * 3.4, color: '#ff8ad8' })
  // the customers on their stools, the bar counter in front
  const sw = W / SEATS
  s.seats.forEach((c, i) => {
    const x = sw * i + sw / 2
    rect(ctx, x - P * 4, H * 0.72, P * 8, P * 2, '#8a5a2b')
    rect(ctx, x - P, H * 0.72, P * 2, H * 0.2, '#5a3416')
    if (!c) return
    const alpha = c.leaving != null ? clamp(c.leaving / 0.8, 0, 1) : 1
    drawPerson(ctx, c.seed, x, H * 0.72, P, { pose: c.leaving != null ? (c.happy ? 'cheer' : 'hit') : 'stand', t: t + i, alpha })
    if (c.leaving == null) {
      const P = ui(v.P)
      const d = DRINKS[c.drink]
      box(ctx, x - P * 12, H * 0.34, P * 24, P * 9, '#ffffff', Math.max(1, P / 2))
      rect(ctx, x - P * 10, H * 0.34 + P * 2, P * 3, P * 5, d.color)
      label(ctx, d.name, x + P * 3, H * 0.34 + P * 4.5, { size: P * 2.6, color: '#1a1a1a', weight: 800 })
      rect(ctx, x - P * 12, H * 0.34 + P * 10, P * 24 * clamp(c.patience / c.max, 0, 1), P * 1.5, c.patience < 2.5 ? '#e74c3c' : '#8ff0a4')
    }
  })
  rect(ctx, 0, H * 0.78, W, H * 0.22, '#6b3a1e')
  rect(ctx, 0, H * 0.78, W, P * 2, '#a0662e')
  if (s.msgT > 0) label(ctx, s.msg, W / 2, H * 0.12, { size: Math.max(11, P * 3.2), alpha: clamp(s.msgT, 0, 1) })
}

export const hud = (s) => [
  { label: 'TIME', value: Math.max(0, Math.ceil(s.time)), warn: s.time < 10 },
  { label: 'TAKINGS', value: `₦${s.takings.toLocaleString('en-NG')}` },
  { label: 'TARGET', value: `₦${s.target.toLocaleString('en-NG')}` },
  { label: 'WALKED', value: s.walked, warn: s.walked >= 3 },
]
export const buttons = () => IDS.map((id, i) => ({ id, label: DRINKS[id].name, color: DRINKS[id].color, key: String(i + 1) }))

export function result(s) {
  const won = s.takings >= s.target && s.walked < 5
  return {
    outcome: won ? 'won' : 'lost',
    score: Math.round(s.takings / 100),
    moneyChange: s.takings,
    headline: won ? 'The till is singing tonight!' : s.walked >= 5 ? 'Half the bar walked out. South Street will talk.' : 'A slow night at Sugar Palace.',
    line: `${s.served} drinks served · takings ₦${s.takings.toLocaleString('en-NG')}${s.wasted ? ` · ₦${s.wasted} wasted` : ''}.`,
  }
}

export default {
  id: 'barRush', title: 'Bar Rush', scoreLabel: 'points', start: 'Open the bar',
  rules: ['Customers sit and shout what they want. Tap that drink: it goes to whoever has waited longest for it.', 'A drink nobody asked for is money poured away.', 'Quick service earns tips. Leave someone waiting too long and they walk out; five walk out and the night is done.', 'Reach the takings target before closing time.'],
  short: 'Tap the drink they shout for. Fast service, good tips.',
  keys: { Digit1: 'lager', Digit2: 'stout', Digit3: 'malt', Digit4: 'zobo', Digit5: 'chapman' },
  create, step, input, draw, hud, buttons, result,
}
