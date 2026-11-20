// MAMA SUGAR · Whot! with Commander Bassey. Friday nights, after the envelope,
// he plays one game of Whot at the bar "to relax". Match the top card's shape
// or number. Specials: 1 Hold On (play again), 2 Pick Two, 5 Pick Three,
// 8 Suspension (he misses his turn), 14 General Market (he picks one), and
// 20 Whot (play it on anything and call the shape). Can't play? Go to market.
// First to empty their hand wins; if the market runs out, the lower count wins.
// Params: skill (0..1, 0.6) · name (opponent, "Commander Bassey") · cards (to deal, 5)
// Outcomes: won | lost
import { rng, shuffle, rect, box, label, disc, inside, clamp } from '../px.js'

export const SHAPES = ['circle', 'triangle', 'cross', 'square', 'star']
const NUMS = {
  circle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  triangle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  cross: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  square: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  star: [1, 2, 3, 4, 5, 7, 8],
}
export function makeDeck() {
  const d = []
  for (const sh of SHAPES) for (const n of NUMS[sh]) d.push({ shape: sh, n })
  for (let i = 0; i < 5; i++) d.push({ shape: 'whot', n: 20 })
  return d
}
export const value = (c) => (c.shape === 'star' ? c.n * 2 : c.n)
const isSpecial = (c) => [1, 2, 5, 8, 14, 20].includes(c.n)

/** Can this card go on the pile? (After a Whot, the called shape stands in for the top card's shape.) */
export function playable(c, top, need) {
  if (c.n === 20) return true
  if (need) return c.shape === need
  return c.shape === top.shape || c.n === top.n
}

export function create(params = {}, seed = 1) {
  const r = rng(seed)
  const deck = shuffle(r, makeDeck())
  const deal = params.cards ?? 5
  const hands = { p: deck.splice(0, deal), o: deck.splice(0, deal) }
  if (params.startWhot && !hands.p.some((c) => c.n === 20)) {
    const k = deck.findIndex((c) => c.n === 20)
    if (k >= 0) hands.p[0] = deck.splice(k, 1)[0]
  }
  let i = deck.findIndex((c) => !isSpecial(c))
  const top = deck.splice(i, 1)[0]
  return { r, deck, top, need: null, hands, turn: 'p', choosing: false, aiWait: 0, skill: params.skill ?? 0.6, name: params.name || 'Commander Bassey', msg: 'Your turn. Match the shape or the number.', msgT: 99, over: false, winner: null, sound: [] }
}

function draw1(s, who, n = 1) {
  let got = 0
  for (let k = 0; k < n; k++) {
    if (!s.deck.length) break
    s.hands[who].push(s.deck.pop())
    got++
  }
  if (!s.deck.length) endByCount(s)
  return got
}

function endByCount(s) {
  if (s.over) return
  const a = s.hands.p.reduce((x, c) => x + value(c), 0)
  const b = s.hands.o.reduce((x, c) => x + value(c), 0)
  s.over = true
  s.winner = a < b ? 'p' : b < a ? 'o' : 'draw'
  s.msg = `Market finished! Count: you ${a}, ${s.name} ${b}.`
  s.msgT = 99
}

const other = (w) => (w === 'p' ? 'o' : 'p')

/** Play card index k from who's hand. Returns false if not allowed. */
export function playCard(s, who, k, call = null) {
  const c = s.hands[who][k]
  if (!c || !playable(c, s.top, s.need)) return false
  s.hands[who].splice(k, 1)
  s.top = c
  s.need = null
  s.sound.push(c.n === 20 ? 'special' : isSpecial(c) ? 'punch' : 'click')
  const them = other(who)
  const nameOf = (w) => (w === 'p' ? 'You' : s.name)
  if (!s.hands[who].length) {
    s.over = true
    s.winner = who
    s.msg = who === 'p' ? 'CHECK UP! You win!' : `${s.name}: "Check up!"`
    s.msgT = 99
    return true
  }
  let again = false
  if (c.n === 1) {
    again = true
    s.msg = `${nameOf(who)}: "Hold on!"`
  } else if (c.n === 2) {
    draw1(s, them, 2)
    again = true
    s.msg = `${nameOf(who)}: "Pick two!"`
  } else if (c.n === 5) {
    draw1(s, them, 3)
    again = true
    s.msg = `${nameOf(who)}: "Pick three!"`
  } else if (c.n === 8) {
    again = true
    s.msg = `${nameOf(who)}: "Suspension!"`
  } else if (c.n === 14) {
    draw1(s, them, 1)
    again = true
    s.msg = `${nameOf(who)}: "General market!"`
  } else if (c.n === 20) {
    if (who === 'p' && !call) {
      s.choosing = true
      s.msg = 'WHOT! Call a shape.'
      s.msgT = 99
      return true
    }
    s.need = call
    s.msg = `${nameOf(who)}: "Whot! I need ${call}."`
  } else s.msg = ''
  s.msgT = 2.2
  if (s.over) return true
  if (s.hands[who].length === 1) s.msg += who === 'p' ? ' (Last card!)' : ` ${s.name}: "Last card!"`
  s.turn = again ? who : them
  s.aiWait = 1
  return true
}

export function callShape(s, shape) {
  if (!s.choosing) return
  s.choosing = false
  s.need = shape
  s.msg = `You: "Whot! I need ${shape}."`
  s.msgT = 2
  s.turn = 'o'
  s.aiWait = 1
}

export function goMarket(s, who) {
  draw1(s, who, 1)
  if (s.over) return
  s.msg = who === 'p' ? 'You went to market.' : `${s.name} goes to market.`
  s.msgT = 1.5
  s.sound.push('slide')
  s.turn = other(who)
  s.aiWait = 1
}

/** Bassey's choice: specials when they hurt, Whot last, the shape he holds most. */
export function aiPick(s) {
  const hand = s.hands.o
  const opts = hand.map((c, k) => ({ c, k })).filter(({ c }) => playable(c, s.top, s.need))
  if (!opts.length) return null
  if (s.r() > s.skill) return opts[Math.floor(s.r() * opts.length)]
  const score = ({ c }) => {
    if (c.n === 20) return hand.length <= 2 ? 50 : -10
    let v = 10
    if (c.n === 2 || c.n === 5) v += s.hands.p.length <= 3 ? 30 : 15
    if (c.n === 1 || c.n === 8 || c.n === 14) v += 12
    v += hand.filter((x) => x.shape === c.shape).length * 2 // keep shapes you can follow
    v += value(c) * 0.3
    return v
  }
  return opts.sort((a, b) => score(b) - score(a))[0]
}
export function aiCall(s) {
  const counts = {}
  for (const c of s.hands.o) if (c.shape !== 'whot') counts[c.shape] = (counts[c.shape] || 0) + 1
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || 'circle'
}

export function step(s, dt) {
  s.msgT -= dt
  if (s.turn !== 'o' || s.over) return
  s.aiWait -= dt
  if (s.aiWait > 0) return
  const pick = aiPick(s)
  if (!pick) return goMarket(s, 'o')
  playCard(s, 'o', pick.k, pick.c.n === 20 ? aiCall(s) : null)
}

export function handLayout(v, n) {
  const cw = Math.min(v.W / 8, v.H * 0.16)
  const ch = cw * 1.4
  const span = Math.min(v.W * 0.92, n * cw * 1.05)
  const stepX = n > 1 ? (span - cw) / (n - 1) : 0
  const x0 = (v.W - span) / 2
  return { cw, ch, x0, stepX: Math.min(stepX, cw * 1.05), y: v.H - ch - v.P * 3 }
}
export function marketRect(v) {
  const cw = Math.min(v.W / 8, v.H * 0.16)
  return { x: v.W / 2 - cw * 1.8, y: v.H * 0.3, w: cw, h: cw * 1.4 }
}

export function input(s, ev, v) {
  if (s.turn !== 'p' || s.over) return
  if (ev.type === 'button') {
    if (SHAPES.includes(ev.id)) return callShape(s, ev.id)
    if (ev.id === 'market' && !s.choosing) return goMarket(s, 'p')
    return
  }
  if (ev.type !== 'down' || s.choosing) return
  if (inside(ev.x, ev.y, marketRect(v))) return goMarket(s, 'p')
  const L = handLayout(v, s.hands.p.length)
  for (let k = s.hands.p.length - 1; k >= 0; k--) {
    const r = { x: L.x0 + k * L.stepX, y: L.y, w: L.cw, h: L.ch }
    if (inside(ev.x, ev.y, r)) {
      if (!playCard(s, 'p', k)) {
        s.msg = s.need ? `He asked for ${s.need}. Play ${s.need}, Whot, or go to market.` : 'That doesn\'t match. Same shape or same number.'
        s.msgT = 1.8
        s.sound.push('wrong')
      }
      return
    }
  }
}

function shapeIcon(ctx, shape, cx, cy, size, color) {
  const P = Math.max(1, Math.round(size / 8))
  if (shape === 'circle') disc(ctx, cx, cy, size / 2, color, P, color)
  else if (shape === 'square') rect(ctx, cx - size / 2, cy - size / 2, size, size, color)
  else if (shape === 'cross') {
    rect(ctx, cx - size / 6, cy - size / 2, size / 3, size, color)
    rect(ctx, cx - size / 2, cy - size / 6, size, size / 3, color)
  } else if (shape === 'triangle') {
    for (let i = 0; i < 8; i++) rect(ctx, cx - (size / 16) * (i + 1), cy - size / 2 + (i * size) / 8, (size / 8) * (i + 1), size / 8 + 0.5, color)
  } else if (shape === 'star') label(ctx, '★', cx, cy, { size: size * 1.3, color })
  else label(ctx, 'W', cx, cy, { size: size, color })
}

export function drawCard(ctx, c, x, y, w, h, P, { back = false, dim = false } = {}) {
  box(ctx, x, y, w, h, back ? '#7a1f2b' : '#fff8ec', Math.max(1, Math.round(P / 1.5)))
  if (back) {
    label(ctx, 'WHOT', x + w / 2, y + h / 2, { size: w * 0.24, color: '#ffd9a8' })
    return
  }
  const red = '#8a1f2b'
  if (c.n === 20) {
    label(ctx, 'WHOT', x + w / 2, y + h * 0.42, { size: w * 0.26, color: red })
    label(ctx, '20', x + w / 2, y + h * 0.7, { size: w * 0.22, color: red })
  } else {
    shapeIcon(ctx, c.shape, x + w / 2, y + h / 2, w * 0.42, red)
    label(ctx, String(c.n), x + w * 0.2, y + h * 0.13, { size: w * 0.22, color: red, weight: 900 })
  }
  if (dim) {
    ctx.save()
    ctx.globalAlpha = 0.45
    rect(ctx, x, y, w, h, '#1a1a1a')
    ctx.restore()
  }
}

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  rect(ctx, 0, 0, W, H, '#1e5a3a') // the green cloth over the bar table
  for (let y = 0; y < H; y += P * 4) rect(ctx, 0, y, W, 1, 'rgba(0,0,0,0.08)')
  // Bassey's hand, face down
  const n = s.hands.o.length
  const cw = Math.min(W / 10, H * 0.12)
  for (let k = 0; k < n; k++) drawCard(ctx, null, W / 2 - (n * cw * 0.45) / 2 + k * cw * 0.45, P * 18, cw, cw * 1.4, P, { back: true })
  label(ctx, `${s.name}: ${n} card${n === 1 ? '' : 's'}`, W / 2, P * 14, { size: P * 3.2, color: '#d0f0d8' })
  // the market and the pile
  const m = marketRect(v)
  if (s.deck.length) {
    drawCard(ctx, null, m.x + P, m.y + P, m.w, m.h, P, { back: true })
    drawCard(ctx, null, m.x, m.y, m.w, m.h, P, { back: true })
  }
  label(ctx, `MARKET ${s.deck.length}`, m.x + m.w / 2, m.y + m.h + P * 4, { size: P * 2.8, color: '#d0f0d8' })
  drawCard(ctx, s.top, W / 2 + m.w * 0.3, m.y, m.w, m.h, P)
  if (s.need) label(ctx, `need: ${s.need}`, W / 2 + m.w * 0.8, m.y + m.h + P * 4, { size: P * 3, color: '#ffd23a' })
  // your hand
  const L = handLayout(v, s.hands.p.length)
  s.hands.p.forEach((c, k) => {
    const ok = s.turn === 'p' && !s.choosing && playable(c, s.top, s.need)
    drawCard(ctx, c, L.x0 + k * L.stepX, L.y - (ok ? P * 3 : 0), L.cw, L.ch, P, { dim: s.turn === 'p' && !ok })
  })
  if (s.msgT > 0 && s.msg) label(ctx, s.msg, W / 2, L.y - P * 9, { size: Math.max(12, P * 3.6), color: '#ffffff', alpha: clamp(s.msgT, 0, 1) })
  if (s.turn === 'o' && !s.over) label(ctx, `${s.name} is thinking…`, W / 2, m.y - P * 5, { size: P * 3, color: '#bfe8c8' })
}

export const hud = (s) => [
  { label: 'YOUR CARDS', value: s.hands.p.length },
  { label: s.name.toUpperCase(), value: s.hands.o.length },
  { label: 'MARKET', value: s.deck.length },
]
export const buttons = (s) =>
  s.choosing
    ? SHAPES.map((sh) => ({ id: sh, label: sh.toUpperCase(), color: '#8a1f2b' }))
    : [{ id: 'market', label: 'GO TO MARKET', color: '#5a3416', disabled: s.turn !== 'p' || s.over, key: 'M' }]

export function result(s) {
  const won = s.winner === 'p'
  return {
    outcome: won ? 'won' : 'lost',
    score: won ? 50 + s.hands.o.length * 5 : Math.max(0, 20 - s.hands.p.length * 2),
    headline: won ? `You beat ${s.name} at Whot!` : s.winner === 'draw' ? 'A draw. He counts again to be sure.' : `${s.name} wins, and laughs about it all week.`,
    line: won ? '"Mama Sugar! You dey play like soldier!" He leaves without his envelope. For once.' : '"Next Friday," he says. "Same time. Same envelope."',
  }
}

export default {
  id: 'whot', scoreLabel: 'points', start: 'Shuffle',
  title: (p) => `Whot! with ${p.name || 'Commander Bassey'}`,
  rules: ['Play a card with the same shape or the same number as the pile. Bright cards can go; dim ones can\'t.', 'Specials: 1 Hold On (play again) · 2 Pick Two · 5 Pick Three · 8 Suspension · 14 General Market · 20 Whot (play on anything, then call a shape).', 'Can\'t play? GO TO MARKET (or tap the deck).', 'Empty your hand first to win. If the market runs out, the lowest count wins (stars count double).'],
  short: 'Shape or number. Whot calls a shape.',
  keys: { KeyM: 'market' },
  create, step, input, draw, hud, buttons, result,
}
