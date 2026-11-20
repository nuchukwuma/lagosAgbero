// THE HONOURABLE · Rice Day. One bag per family, for voters in this ward.
// Each person in the queue shows a card: a green Iyana-Wahala ward card is
// good; another ward's card, or no card, is not. Everyone you serve gets ink on
// the thumb, so anyone back in the queue with an inked thumb has already
// collected. SERVE or SEND AWAY. Turn honest people away, or keep the queue
// waiting, and the crowd gets angry; serve cheats and the bags run out.
// Params: bags (40) · need (families served, 18) · seconds (75)
// Outcomes: won | lost
import { rng, rect, box, label, clamp } from '../px.js'
import { drawPerson } from '../people.js'

const WARDS = ['OKE-ODO', 'ALAKUKO', 'MILE 2', 'IKOTUN']

export function makePerson(r, served) {
  const x = r()
  if (served.length > 3 && x < 0.18) {
    const back = served[Math.floor(r() * served.length)]
    return { seed: back, card: 'ward', ink: true, ok: false, why: 'Ink on the thumb: they already collected.' }
  }
  if (x < 0.32) return { seed: 300 + Math.floor(r() * 400), card: 'none', ink: false, ok: false, why: 'No ward card.' }
  if (x < 0.46) return { seed: 300 + Math.floor(r() * 400), card: WARDS[Math.floor(r() * WARDS.length)], ink: false, ok: false, why: 'Another ward\'s card.' }
  return { seed: 300 + Math.floor(r() * 400), card: 'ward', ink: false, ok: true }
}

export function create(params = {}, seed = 1) {
  const r = rng(seed)
  const s = { r, bags: params.bags ?? 40, need: params.need ?? 18, time: params.seconds ?? 75, servedSeeds: [], good: 0, cheats: 0, wronged: 0, anger: 0.2, wait: 0, queue: [], msg: '', msgT: 0, over: false, stampede: false, sound: [] }
  for (let i = 0; i < 4; i++) s.queue.push(makePerson(r, s.servedSeeds))
  return s
}

export function decide(s, serve) {
  if (s.over) return
  const p = s.queue.shift()
  if (serve) {
    s.bags--
    s.servedSeeds.push(p.seed)
    if (p.ok) {
      s.good++
      s.anger = Math.max(0, s.anger - 0.04)
      s.sound.push('coin')
    } else {
      s.cheats++
      s.msg = `Cheat served! ${p.why}`
      s.msgT = 1.8
      s.sound.push('wrong')
    }
  } else if (p.ok) {
    s.wronged++
    s.anger += 0.15
    s.msg = '"I live here! My card is right there!" The crowd boos.'
    s.msgT = 1.8
    s.sound.push('crowd')
  } else {
    s.anger = Math.max(0, s.anger - 0.02)
    s.msg = `Sent away. ${p.why}`
    s.msgT = 1.2
    s.sound.push('correct')
  }
  s.wait = 0
  s.queue.push(makePerson(s.r, s.servedSeeds))
  if (s.bags <= 0) s.over = true
}

export function step(s, dt) {
  s.time -= dt
  s.msgT -= dt
  s.wait += dt
  // the queue gets restless if the front person waits
  if (s.wait > 2.5) s.anger += dt * 0.06
  if (s.anger >= 1) {
    s.stampede = true
    s.over = true
    s.sound.push('crowd')
  }
  if (s.time <= 0) s.over = true
}

export function input(s, ev, v) {
  if (ev.type === 'button') decide(s, ev.id === 'serve')
  if (ev.type === 'down') s.swipeFrom = ev.x
  if (ev.type === 'up' && s.swipeFrom != null) {
    const dx = ev.x - s.swipeFrom
    s.swipeFrom = null
    if (Math.abs(dx) > v.W * 0.12) decide(s, dx > 0)
  }
}

function card(ctx, x, y, P, c) {
  if (c === 'none') {
    label(ctx, '(no card)', x, y + P * 4, { size: P * 3, color: '#ffb3a8' })
    return
  }
  const ward = c === 'ward'
  box(ctx, x - P * 14, y, P * 28, P * 12, ward ? '#2e9e4f' : '#9b59b6', Math.max(1, P / 2))
  label(ctx, ward ? 'IYANA-WAHALA' : c, x, y + P * 4, { size: P * 2.6, weight: 800 })
  label(ctx, 'WARD CARD', x, y + P * 8.5, { size: P * 2, color: '#e8f8ee', weight: 700 })
}

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  rect(ctx, 0, 0, W, H, '#ffcf8a')
  rect(ctx, 0, H * 0.62, W, H, '#c9a46a')
  // the canopy and the rice bags
  rect(ctx, 0, 0, W, P * 6, '#1e8449')
  for (let x = 0; x < W; x += P * 12) rect(ctx, x, P * 6, P * 6, P * 3, '#1e8449')
  const stack = Math.min(s.bags, 40)
  for (let i = 0; i < stack; i++) box(ctx, W * 0.78 + (i % 5) * P * 7, H * 0.6 - Math.floor(i / 5) * P * 5, P * 6, P * 4, '#f4ecd8', Math.max(1, P / 3))
  label(ctx, `${s.bags} bags`, W * 0.78 + P * 17, H * 0.6 + P * 6, { size: P * 3 })
  // the queue: the front person at the table, the rest behind
  s.queue.forEach((p, k) => {
    const x = W * 0.42 - k * P * 13
    const y = H * 0.62 + k * P
    drawPerson(ctx, p.seed, x, y, Math.max(2, P - (k ? 1 : 0)), { pose: k === 0 && s.anger > 0.6 ? 'hit' : 'stand', t: t + k, alpha: k === 0 ? 1 : 0.85 })
  })
  const front = s.queue[0]
  if (front) {
    card(ctx, W * 0.42 + P * 20, H * 0.32, P, front.card)
    // the thumb, held up
    box(ctx, W * 0.42 + P * 34, H * 0.34, P * 6, P * 9, '#7a4a24', Math.max(1, P / 2))
    if (front.ink) rect(ctx, W * 0.42 + P * 35, H * 0.34 + P, P * 4, P * 3, '#3a2a8a')
    label(ctx, 'thumb', W * 0.42 + P * 37, H * 0.34 + P * 12, { size: P * 2.2, color: '#5a3416', weight: 700 })
  }
  // the crowd's mood
  const aw = Math.min(W * 0.5, P * 90)
  rect(ctx, W / 2 - aw / 2, H * 0.12, aw, P * 3, '#1a1a1a')
  rect(ctx, W / 2 - aw / 2, H * 0.12, aw * clamp(s.anger, 0, 1), P * 3, s.anger > 0.7 ? '#e74c3c' : s.anger > 0.4 ? '#f08a24' : '#2ecc71')
  label(ctx, 'CROWD', W / 2 - aw / 2 - P * 8, H * 0.12 + P * 1.5, { size: P * 2.6 })
  if (s.msgT > 0) label(ctx, s.msg, W / 2, H * 0.22, { size: Math.max(11, P * 3.2), alpha: clamp(s.msgT, 0, 1) })
}

export const hud = (s) => [
  { label: 'TIME', value: Math.max(0, Math.ceil(s.time)), warn: s.time < 10 },
  { label: 'FAMILIES', value: `${s.good}/${s.need}` },
  { label: 'CHEATS SERVED', value: s.cheats, warn: s.cheats > 3 },
]
export const buttons = () => [
  { id: 'away', label: '✖ SEND AWAY', color: '#b3261e', key: '←' },
  { id: 'serve', label: 'SERVE ✔', color: '#1e8449', key: '→' },
]

export function result(s) {
  const won = !s.stampede && s.good >= s.need
  return {
    outcome: won ? 'won' : 'lost',
    score: s.good * 5 - s.cheats * 3,
    headline: won ? 'Rice day went well. Nobody fought, and the right families ate.' : s.stampede ? 'STAMPEDE! The canopy comes down.' : 'Not enough families got a bag.',
    line: `${s.good} families served · ${s.cheats} cheats got bags · ${s.wronged} honest people turned away.`,
  }
}

export default {
  id: 'riceQueue', title: 'Rice Day', scoreLabel: 'points', start: 'Open the canopy',
  rules: ['Look at each card: a green IYANA-WAHALA ward card gets a bag. Another ward, or no card: send them away.', 'Everybody you serve gets ink on their thumb. An inked thumb back in the queue has already collected: send them away.', 'SERVE or SEND AWAY with the buttons, or swipe right to serve, left to send away.', 'Turning honest people away, or keeping the queue waiting, makes the crowd angry. A full anger bar is a stampede.'],
  short: 'Green ward card, clean thumb: serve. Anything else: away.',
  keys: { ArrowRight: 'serve', ArrowLeft: 'away', KeyS: 'serve', KeyX: 'away' },
  create, step, input, draw, hud, buttons, result,
}
