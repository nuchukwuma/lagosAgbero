// GRASS TO GRACE · Ayò at the palm-wine shade. The board game of the old men:
// two rows of six cups, four seeds in each. Pick a cup on your side (the near
// row) and sow its seeds one by one, anticlockwise. If your last seed lands on
// the far side and makes 2 or 3, you take them, and the cups before it too,
// while they hold 2 or 3. If your opponent's side is empty you must give them
// seeds if you can. More than 24 seeds wins.
// Params: skill (0..1, 0.6) · name (opponent, "Papa Ngwo")
// Outcomes: won | lost
import { rng, rect, box, label, disc, inside } from '../px.js'

// cups 0..5: your row, left to right; 6..11: their row, right to left (anticlockwise)
export const own = (i, side) => (side === 'p' ? i < 6 : i >= 6)

export function sow(board, cup) {
  const b = board.slice()
  let seeds = b[cup]
  b[cup] = 0
  let i = cup
  while (seeds > 0) {
    i = (i + 1) % 12
    if (i === cup) continue // a lap of 12 or more skips the cup it started from
    b[i]++
    seeds--
  }
  return { board: b, last: i }
}

/** Play a cup: sow, then capture 2s and 3s on the other side going back from the last seed. */
export function play(board, cup, side) {
  const { board: b, last } = sow(board, cup)
  let taken = 0
  const caught = []
  let i = last
  while (!own(i, side) && (b[i] === 2 || b[i] === 3)) {
    caught.push(i)
    taken += b[i]
    i = (i + 11) % 12
  }
  // taking every seed on their side (a "grand slam") takes nothing
  const theirs = b.reduce((a, n, k) => a + (own(k, side) ? 0 : n), 0)
  if (taken && taken === theirs) return { board: b, taken: 0, last, caught: [] }
  for (const k of caught) b[k] = 0
  return { board: b, taken, last, caught }
}

const sideSeeds = (b, side) => b.reduce((a, n, k) => a + (own(k, side) ? n : 0), 0)

/** Legal cups for a side (if the other side is empty, only moves that feed it). */
export function legal(b, side) {
  const cups = []
  for (let k = 0; k < 12; k++) if (own(k, side) && b[k] > 0) cups.push(k)
  const other = side === 'p' ? 'o' : 'p'
  if (sideSeeds(b, other) === 0) {
    const feeding = cups.filter((k) => sideSeeds(play(b, k, side).board, other) > 0)
    return feeding
  }
  return cups
}

function score(b, store, depth, side, r) {
  const other = side === 'p' ? 'o' : 'p'
  const moves = legal(b, side)
  if (depth === 0 || !moves.length || store.o > 24 || store.p > 24) return store.o - store.p
  let best = side === 'o' ? -Infinity : Infinity
  for (const k of moves) {
    const res = play(b, k, side)
    const st = { ...store, [side]: store[side] + res.taken }
    const val = score(res.board, st, depth - 1, other, r)
    best = side === 'o' ? Math.max(best, val) : Math.min(best, val)
  }
  return best
}

export function aiMove(b, store, skill, r) {
  const moves = legal(b, 'o')
  if (!moves.length) return null
  if (r() > skill) return moves[Math.floor(r() * moves.length)]
  const depth = skill > 0.8 ? 6 : 4
  let best = moves[0]
  let bestV = -Infinity
  for (const k of moves) {
    const res = play(b, k, 'o')
    const v = score(res.board, { ...store, o: store.o + res.taken }, depth - 1, 'p', r) + r() * 0.01
    if (v > bestV) {
      bestV = v
      best = k
    }
  }
  return best
}

export function create(params = {}, seed = 1) {
  return { r: rng(seed), board: new Array(12).fill(4), store: { p: 0, o: 0 }, turn: 'p', aiWait: 0, skill: params.skill ?? 0.6, name: params.name || 'Papa Ngwo', glow: [], lastTaken: 0, lastBy: null, over: false, winner: null, moves: 0, sound: [] }
}

function finishIfDone(s) {
  if (s.store.p > 24 || s.store.o > 24) {
    s.over = true
    s.winner = s.store.p > 24 ? 'p' : 'o'
    return
  }
  if (!legal(s.board, s.turn).length || s.moves > 200) {
    // nobody can play: everybody keeps the seeds on their own side
    s.store.p += sideSeeds(s.board, 'p')
    s.store.o += sideSeeds(s.board, 'o')
    s.board = s.board.map(() => 0)
    s.over = true
    s.winner = s.store.p > s.store.o ? 'p' : s.store.o > s.store.p ? 'o' : 'draw'
  }
}

function doMove(s, cup, side) {
  const res = play(s.board, cup, side)
  s.board = res.board
  s.store[side] += res.taken
  s.glow = res.caught.length ? res.caught : [res.last]
  s.lastTaken = res.taken
  s.lastBy = side
  s.sound.push(res.taken ? 'coin' : 'click')
  s.turn = side === 'p' ? 'o' : 'p'
  s.moves++
  s.aiWait = 0.9
  finishIfDone(s)
}

export function step(s, dt) {
  if (s.turn !== 'o') return
  s.aiWait -= dt
  if (s.aiWait > 0) return
  const k = aiMove(s.board, s.store, s.skill, s.r)
  if (k == null) return finishIfDone(s)
  doMove(s, k, 'o')
}

export function tapCup(s, cup) {
  if (s.turn !== 'p' || s.over) return
  if (!legal(s.board, 'p').includes(cup)) return void s.sound.push('wrong')
  doMove(s, cup, 'p')
}

export function cupRect(v, k) {
  const bw = Math.min(v.W * 0.92, v.H * 1.6)
  const cw = bw / 8
  const x0 = (v.W - bw) / 2 + cw
  const yMid = v.H * 0.55
  const col = k < 6 ? k : 11 - k
  const y = k < 6 ? yMid + cw * 0.08 : yMid - cw * 1.08
  return { x: x0 + col * cw + cw * 0.06, y, w: cw * 0.88, h: cw }
}

export function input(s, ev, v) {
  if (ev.type !== 'down') return
  for (let k = 0; k < 6; k++) if (inside(ev.x, ev.y, cupRect(v, k))) return tapCup(s, k)
}

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  // the palm-wine shade: thatch overhead, red earth below
  rect(ctx, 0, 0, W, H, '#c9773e')
  rect(ctx, 0, 0, W, H * 0.16, '#8a6a2a')
  for (let x = 0; x < W; x += P * 4) rect(ctx, x, H * 0.16, P * 2, P * (3 + ((x / P) % 5)), '#6b5020')
  const bw = Math.min(W * 0.92, H * 1.6)
  const cw = bw / 8
  const bx = (W - bw) / 2
  const yMid = H * 0.55
  box(ctx, bx, yMid - cw * 1.25, bw, cw * 2.5, '#7a4a24', P)
  rect(ctx, bx, yMid - P / 2, bw, P, '#5a3416')
  // the stores at each end
  for (const side of ['o', 'p']) {
    const x = side === 'o' ? bx + cw * 0.1 : bx + bw - cw * 0.9
    box(ctx, x, yMid - cw * 1.05, cw * 0.8, cw * 2.1, '#4a2a12', Math.max(1, P / 2))
    label(ctx, String(s.store[side]), x + cw * 0.4, yMid, { size: cw * 0.38, color: side === 'p' ? '#ffd23a' : '#bfe8c8' })
  }
  const can = s.turn === 'p' ? legal(s.board, 'p') : []
  for (let k = 0; k < 12; k++) {
    const r = cupRect(v, k)
    const cx = r.x + r.w / 2
    const cy = r.y + r.h / 2
    disc(ctx, cx, cy, r.w * 0.42, s.glow.includes(k) ? '#3a2410' : '#2a1808', Math.max(1, Math.round(P / 1.5)), can.includes(k) ? '#ffd23a' : '#1a0e04')
    // the seeds: up to eight drawn, the count always
    const n = s.board[k]
    for (let i = 0; i < Math.min(n, 8); i++) {
      const a = i * 2.4 + k
      const rr = r.w * (i < 4 ? 0.13 : 0.24)
      rect(ctx, cx + Math.cos(a) * rr - P, cy + Math.sin(a) * rr - P, P * 2, P * 2, '#d7c8a0')
    }
    label(ctx, String(n), cx, k < 6 ? r.y + r.h + P * 3 : r.y - P * 3, { size: Math.max(11, P * 3.4), color: k < 6 ? '#fff2a8' : '#e3f6e8' })
  }
  const msg = s.over ? '' : s.turn === 'o' ? `${s.name} is counting…` : s.lastBy === 'o' && s.lastTaken ? `${s.name} took ${s.lastTaken}! Your turn.` : 'Your turn: tap a cup on your side'
  label(ctx, msg, W / 2, H * 0.24, { size: Math.max(12, P * 4), color: '#fff2a8' })
  if (s.lastBy === 'p' && s.lastTaken && s.turn === 'o') label(ctx, `+${s.lastTaken}!`, W / 2, H * 0.86, { size: P * 6, color: '#8ff0a4', alpha: Math.min(1, s.aiWait + 0.2) })
}

export const hud = (s) => [
  { label: 'YOU', value: s.store.p },
  { label: s.name.toUpperCase(), value: s.store.o },
  { label: 'TO WIN', value: 25 },
]

export function result(s) {
  const won = s.winner === 'p'
  return {
    outcome: won ? 'won' : 'lost',
    score: s.store.p,
    headline: won ? `You beat ${s.name} at Ayò!` : s.winner === 'draw' ? 'Twenty-four each. A draw.' : `${s.name} wins.`,
    line: won ? '"Hm! Lagos has not spoilt your hands." He pours you the first cup from the new keg.' : '"Stupidity is better planned with palm wine," he says, and sets up the seeds again.',
  }
}

export default {
  id: 'ayo', scoreLabel: 'seeds', start: 'Pour the seeds',
  title: (p) => `Ayò with ${p.name || 'Papa Ngwo'}`,
  rules: ['The near row of six cups is yours. Tap a cup to sow its seeds one by one, anticlockwise.', 'If your last seed lands on the far side and makes 2 or 3, you take them, and the cups just before it too while they hold 2 or 3.', 'If your opponent has no seeds left, you must play a cup that gives them some.', 'Collect more than 24 seeds to win.'],
  short: 'Last seed makes 2 or 3 on their side: take them.',
  create, step, input, draw, hud, result,
}
