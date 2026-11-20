// AREA BOY · Exact Change. At the danfo door, passengers pay with big notes and
// you give change from your pouch: tap the notes, then GIVE. Exact is a tip;
// short is a shouting match; too much is your own money gone. Patience gets
// shorter as the rush builds.
// Params: target (passengers to serve, 8) · seconds (60) · tip (₦ per correct change, 50)
// Outcomes: won | lost
import { rng, pickOf, rect, box, label, clamp } from '../px.js'
import { drawPerson } from '../people.js'

export const NOTES = [
  { v: 500, color: '#7a5bb5' },
  { v: 200, color: '#2f8f83' },
  { v: 100, color: '#3f6fc0' },
  { v: 50, color: '#c0478a' },
  { v: 20, color: '#d4892e' },
  { v: 10, color: '#a7533b' },
]
const FARES = [150, 200, 250, 300, 350, 400, 450, 600, 700]
const PAYS = [500, 1000, 1000, 1000, 2000]

function nextPassenger(s) {
  const fare = pickOf(s.r, FARES)
  let paid = pickOf(s.r, PAYS)
  if (paid <= fare) paid = 1000
  const max = clamp(13 - s.served * 0.6, 5, 13)
  s.p = { fare, paid, patience: max, max, seed: 10 + Math.floor(s.r() * 900) }
  s.given = []
}

export const changeOwed = (p) => p.paid - p.fare
export const givenTotal = (s) => s.given.reduce((a, b) => a + b, 0)

export function create(params = {}, seed = 1) {
  const s = { r: rng(seed), time: params.seconds ?? 60, target: params.target ?? 8, tip: params.tip ?? 50, served: 0, strikes: 0, overpaid: 0, msg: '', msgT: 0, mood: 'idle', over: false, sound: [] }
  nextPassenger(s)
  return s
}

export function step(s, dt) {
  s.time -= dt
  s.msgT -= dt
  s.p.patience -= dt
  if (s.p.patience <= 0) {
    s.strikes++
    s.msg = '"I no fit wait! Thief!" (walked off)'
    s.msgT = 1.5
    s.mood = 'hit'
    s.sound.push('wrong')
    nextPassenger(s)
  }
  if (s.time <= 0 || s.strikes >= 3) s.over = true
}

export function give(s) {
  const owed = changeOwed(s.p)
  const g = givenTotal(s)
  if (g === owed) {
    s.served++
    s.msg = `"Correct!" +₦${s.tip}`
    s.mood = 'cheer'
    s.sound.push('coin')
  } else if (g < owed) {
    s.strikes++
    s.msg = `"My change no complete! ₦${owed - g} remain!"`
    s.mood = 'hit'
    s.sound.push('wrong')
  } else {
    s.served++
    s.overpaid += g - owed
    s.msg = `(They take the extra ₦${g - owed} and run.)`
    s.mood = 'cheer'
    s.sound.push('bump')
  }
  s.msgT = 1.4
  nextPassenger(s)
}

export function input(s, ev) {
  if (ev.type !== 'button') return
  if (ev.id === 'give') return give(s)
  if (ev.id === 'undo') return void s.given.pop()
  const n = NOTES.find((x) => `n${x.v}` === ev.id)
  if (n && s.given.length < 12) {
    s.given.push(n.v)
    s.sound.push('click')
  }
}

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  // inside the danfo: yellow walls, black stripe, the door frame open on the street
  rect(ctx, 0, 0, W, H, '#f2c230')
  rect(ctx, 0, H * 0.18, W, P * 4, '#1a1a1a')
  rect(ctx, 0, H * 0.18 + P * 6, W, P * 2, '#1a1a1a')
  const dx = W * 0.5
  const dw = Math.min(W * 0.42, H * 0.6)
  box(ctx, dx - dw / 2, H * 0.08, dw, H * 0.62, '#9fd3ff', P)
  rect(ctx, dx - dw / 2, H * 0.48, dw, H * 0.22, '#b8a68a') // the road outside
  rect(ctx, dx - dw / 2, H * 0.5, dw, P, '#ffffff')
  // the passenger at the door
  const shake = s.mood === 'hit' && s.msgT > 0 ? Math.sin(t * 50) * P : 0
  drawPerson(ctx, s.p.seed, dx + shake, H * 0.7, Math.max(2, Math.round(P * 1.4)), { pose: s.msgT > 0 && s.mood === 'cheer' ? 'cheer' : 'stand', t })
  // what they paid, what they owe, their patience
  const bw = Math.min(W * 0.36, P * 70)
  box(ctx, P * 3, H * 0.1, bw, P * 22, '#fff8e6', P)
  label(ctx, `Fare ₦${s.p.fare}`, P * 3 + bw / 2, H * 0.1 + P * 5, { size: P * 4.2, color: '#1a1a1a' })
  label(ctx, `Paid ₦${s.p.paid}`, P * 3 + bw / 2, H * 0.1 + P * 11, { size: P * 4.2, color: '#1a1a1a' })
  label(ctx, `Change ₦?`, P * 3 + bw / 2, H * 0.1 + P * 17, { size: P * 4.2, color: '#b3261e' })
  const pw = bw * clamp(s.p.patience / s.p.max, 0, 1)
  rect(ctx, P * 3, H * 0.1 + P * 24, bw, P * 3, '#1a1a1a')
  rect(ctx, P * 3, H * 0.1 + P * 24, pw, P * 3, s.p.patience < 3 ? '#e74c3c' : '#2ecc71')
  // your hand: the notes you're giving, fanned
  const hx = W - bw - P * 3
  box(ctx, hx, H * 0.1, bw, P * 22, '#fff8e6', P)
  label(ctx, `You give ₦${givenTotal(s)}`, hx + bw / 2, H * 0.1 + P * 5, { size: P * 4.2, color: '#1a1a1a' })
  s.given.forEach((g, i) => {
    const n = NOTES.find((x) => x.v === g)
    const x = hx + P * 3 + (i % 6) * P * 9
    const y = H * 0.1 + P * 9 + Math.floor(i / 6) * P * 6
    box(ctx, x, y, P * 8, P * 4, n.color, Math.max(1, P / 2))
    label(ctx, String(g), x + P * 4, y + P * 2, { size: P * 2.4 })
  })
  if (s.msgT > 0) label(ctx, s.msg, W / 2, H * 0.78, { size: Math.max(12, P * 3.6), color: s.mood === 'hit' ? '#ffb3a8' : '#ffffff', alpha: clamp(s.msgT, 0, 1) })
}

export const hud = (s) => [
  { label: 'TIME', value: Math.max(0, Math.ceil(s.time)), warn: s.time < 10 },
  { label: 'SERVED', value: `${s.served}/${s.target}` },
  { label: 'WAHALA', value: '✖'.repeat(s.strikes) || '–', warn: s.strikes >= 2 },
]

export const buttons = () => [
  ...NOTES.map((n, i) => ({ id: `n${n.v}`, label: `₦${n.v}`, color: n.color, key: String(i + 1) })),
  { id: 'undo', label: '↶', color: '#555' },
  { id: 'give', label: 'GIVE', color: '#1e8449' },
]

export function result(s) {
  const won = s.served >= s.target && s.strikes < 3
  return {
    outcome: won ? 'won' : 'lost',
    score: s.served,
    moneyChange: s.served * s.tip - s.overpaid,
    headline: won ? 'The bus moves with no wahala!' : s.strikes >= 3 ? 'The whole bus is shouting at you.' : 'Too slow, conductor.',
    line: `${s.served} passengers served${s.overpaid ? `, ₦${s.overpaid} given away by mistake` : ''}.`,
  }
}

export default {
  id: 'change', title: 'Exact Change', scoreLabel: 'passengers', start: 'Open the door',
  rules: ['Each passenger pays with a big note. Work out their change: paid minus fare.', 'Tap notes from your pouch, then GIVE. ↶ takes the last note back.', 'Exact change earns a tip. Short change is a strike; three strikes and the bus revolts. Too much is your own money.', 'Serve enough passengers before the time runs out. They get less patient as the rush builds.'],
  short: 'Paid minus fare. Tap the notes, then GIVE.',
  keys: { Digit1: 'n500', Digit2: 'n200', Digit3: 'n100', Digit4: 'n50', Digit5: 'n20', Digit6: 'n10', Backspace: 'undo', Enter: 'give', Space: 'give' },
  create, step, input, draw, hud, buttons, result,
}
