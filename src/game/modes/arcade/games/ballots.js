// THE HONOURABLE · Count the Votes. Polling unit, after the queue. You are the
// party agent at the counting table: every ballot paper goes into the right
// pile. One thumbprint inside one box counts for that candidate; two prints,
// a print outside the boxes, or a smudge is VOID. And watch for bundles of
// papers already thumbprinted with a rubber band round them: Mr. Adjust's
// "extra votes" are VOID too.
// Params: count (ballots, 30) · need (accuracy to pass, 0.85)
// Outcomes: won | lost
import { rng, pickOf, rect, box, label, clamp } from '../px.js'

export const CANDIDATES = [
  { id: 'teacher', name: 'TEACHER', symbol: 'chalk', color: '#1e8449' },
  { id: 'nephew', name: 'NEPHEW', symbol: 'agbada', color: '#b3261e' },
  { id: 'other', name: 'OTHERS', symbol: 'key', color: '#2f6fd6' },
]

export function makeBallot(r) {
  const x = r()
  if (x < 0.07) return { kind: 'bundle', answer: 'void' }
  if (x < 0.22) {
    const why = pickOf(r, ['two', 'outside', 'smudge'])
    const a = Math.floor(r() * 3)
    return { kind: why, prints: why === 'two' ? [a, (a + 1 + Math.floor(r() * 2)) % 3] : [a], answer: 'void' }
  }
  const w = r()
  const c = w < 0.45 ? 0 : w < 0.85 ? 1 : 2
  return { kind: 'valid', prints: [c], answer: CANDIDATES[c].id, jitter: r() }
}

export function create(params = {}, seed = 1) {
  const r = rng(seed)
  const count = params.count ?? 30
  return { r, timeMul: params.timeMul ?? 1, ballots: Array.from({ length: count }, () => makeBallot(r)), i: 0, right: 0, wrong: 0, tally: { teacher: 0, nephew: 0, other: 0, void: 0 }, left: 5, need: params.need ?? 0.85, flash: null, flashT: 0, msg: '', msgT: 0, over: false, sound: [] }
}

const limit = (i) => clamp(5 - i * 0.1, 2.2, 5)

export function sortInto(s, pile) {
  if (s.over) return
  const b = s.ballots[s.i]
  const ok = b.answer === pile
  s.tally[pile]++
  if (ok) {
    s.right++
    s.flash = 'right'
    s.sound.push('click')
  } else {
    s.wrong++
    s.flash = 'wrong'
    s.sound.push('wrong')
    s.msg = b.kind === 'bundle' ? 'That was a pre-thumbprinted bundle! VOID.' : b.kind === 'valid' ? `That was a clean vote for ${CANDIDATES.find((c) => c.id === b.answer).name}.` : b.kind === 'two' ? 'Two thumbprints: VOID.' : b.kind === 'outside' ? 'Thumbprint outside the boxes: VOID.' : 'A smudge across the paper: VOID.'
    s.msgT = 2
  }
  s.flashT = 0.4
  s.i++
  if (s.i >= s.ballots.length) s.over = true
  else s.left = limit(s.i) * s.timeMul
}

export function step(s, dt) {
  s.flashT -= dt
  s.msgT -= dt
  s.left -= dt
  if (s.left <= 0 && !s.over) {
    s.msg = 'Too slow: the other agents shout "next!" and it goes in the wrong pile.'
    s.msgT = 2
    s.wrong++
    s.flash = 'wrong'
    s.flashT = 0.4
    s.i++
    if (s.i >= s.ballots.length) s.over = true
    else s.left = limit(s.i) * s.timeMul
  }
}

export function input(s, ev, v) {
  if (ev.type === 'button') sortInto(s, ev.id)
}

function thumb(ctx, x, y, P, smudge = false) {
  ctx.save()
  ctx.globalAlpha = 0.85
  rect(ctx, x - P * 2, y - P * 3, P * 4, P * 6, '#3a2a8a')
  rect(ctx, x - P * 3, y - P * 2, P * 6, P * 4, '#3a2a8a')
  for (let k = -2; k <= 2; k++) rect(ctx, x - P * 2, y + k * P, P * 4, P / 2 + 0.5, '#6a5ac0')
  if (smudge) rect(ctx, x - P * 12, y - P, P * 22, P * 3, '#3a2a8a')
  ctx.restore()
}

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  rect(ctx, 0, 0, W, H, '#c9b48a')
  rect(ctx, 0, H * 0.7, W, H * 0.3, '#7a5a3a') // the table
  // the piles on the table
  const piles = [...CANDIDATES.map((c) => ({ id: c.id, name: c.name, color: c.color })), { id: 'void', name: 'VOID', color: '#555' }]
  piles.forEach((p, k) => {
    const pw = W / 4
    const x = k * pw + pw * 0.15
    box(ctx, x, H * 0.74, pw * 0.7, P * 5 + Math.min(s.tally[p.id], 20) * P * 0.6, p.color, Math.max(1, P / 2))
    label(ctx, `${p.name} ${s.tally[p.id]}`, x + pw * 0.35, H * 0.74 - P * 3, { size: P * 2.8 })
  })
  if (s.over) return
  const b = s.ballots[s.i]
  const bw = Math.min(W * 0.6, P * 110)
  const bh = bw * 0.48
  const bx = W / 2 - bw / 2
  const by = H * 0.36 - bh / 2
  if (b.kind === 'bundle') {
    for (let k = 3; k >= 0; k--) box(ctx, bx + k * P * 2, by - k * P * 2, bw, bh, '#f4ecd8', Math.max(1, P / 2))
    rect(ctx, bx + bw * 0.45, by - P * 6, P * 3, bh + P * 6, '#c0392b') // the rubber band
    label(ctx, '(already thumbprinted)', bx + bw / 2, by + bh + P * 5, { size: P * 2.8, color: '#5a3a1a' })
  } else box(ctx, bx, by, bw, bh, '#f4ecd8', Math.max(1, P / 2))
  label(ctx, 'IYANA-WAHALA WARD · COUNCILLOR', bx + bw / 2, by + P * 4, { size: P * 2.6, color: '#1a1a1a', weight: 700 })
  const cw = bw / 3
  CANDIDATES.forEach((c, k) => {
    const x = bx + k * cw + cw * 0.1
    const y = by + bh * 0.25
    rect(ctx, x, y, cw * 0.8, bh * 0.62, '#ffffff')
    rect(ctx, x, y, cw * 0.8, P, c.color)
    label(ctx, c.name, x + cw * 0.4, y + P * 4, { size: P * 2.6, color: c.color, weight: 800 })
    label(ctx, c.symbol === 'chalk' ? '✎' : c.symbol === 'agbada' ? '☗' : '⚿', x + cw * 0.4, y + bh * 0.36, { size: P * 6, color: c.color })
  })
  if (b.kind === 'bundle') {
    thumb(ctx, bx + cw * 1.5, by + bh * 0.62, P)
  } else if (b.kind === 'outside') thumb(ctx, bx + bw * 0.95, by + bh * 0.12, P)
  else
    for (const k of b.prints) thumb(ctx, bx + k * cw + cw * 0.5 + ((b.jitter ?? 0.5) - 0.5) * cw * 0.3, by + bh * 0.62, P, b.kind === 'smudge')
  const tw = bw * clamp(s.left / (limit(s.i) * s.timeMul), 0, 1)
  rect(ctx, bx, by + bh + P * 9, bw, P * 2, '#1a1a1a')
  rect(ctx, bx, by + bh + P * 9, tw, P * 2, s.left < 1.5 ? '#e74c3c' : '#ffd23a')
  if (s.flashT > 0) label(ctx, s.flash === 'right' ? '✔' : '✖', bx + bw + P * 8, by + bh / 2, { size: P * 9, color: s.flash === 'right' ? '#1e8449' : '#b3261e', alpha: s.flashT * 2.5 })
  if (s.msgT > 0) label(ctx, s.msg, W / 2, H * 0.08, { size: Math.max(11, P * 3.2), alpha: clamp(s.msgT, 0, 1) })
}

export const hud = (s) => [
  { label: 'BALLOT', value: `${Math.min(s.i + 1, s.ballots.length)}/${s.ballots.length}` },
  { label: 'RIGHT', value: s.right },
  { label: 'WRONG', value: s.wrong, warn: s.wrong / s.ballots.length > 1 - s.need },
]
export const buttons = () => [
  ...CANDIDATES.map((c, i) => ({ id: c.id, label: c.name, color: c.color, key: String(i + 1) })),
  { id: 'void', label: 'VOID', color: '#555', key: '4' },
]

export function result(s) {
  const acc = s.right / s.ballots.length
  const won = acc >= s.need
  return {
    outcome: won ? 'won' : 'lost',
    score: s.right,
    headline: won ? 'The count is clean, and everybody signed the sheet.' : 'The other agents dispute the count. It goes to the collation centre in a mess.',
    line: `${Math.round(acc * 100)}% sorted right. Teacher ${s.tally.teacher} · Nephew ${s.tally.nephew} · Others ${s.tally.other} · Void ${s.tally.void}.`,
  }
}

export default {
  id: 'ballots', title: 'Count the Votes', scoreLabel: 'ballots right', start: 'Open the box',
  rules: ['Each ballot goes into a pile: TEACHER, NEPHEW, OTHERS or VOID.', 'One thumbprint inside one box is a vote for that candidate.', 'Two prints, a print outside the boxes, or a smudge across the paper: VOID.', 'A stack held with a rubber band, already thumbprinted, is Mr. Adjust\'s "extra votes": VOID.', 'Sort fast and sort right: the count is checked at the end.'],
  short: 'One clean print = a vote. Anything else = VOID.',
  keys: { Digit1: 'teacher', Digit2: 'nephew', Digit3: 'other', Digit4: 'void' },
  create, step, input, draw, hud, buttons, result,
}
