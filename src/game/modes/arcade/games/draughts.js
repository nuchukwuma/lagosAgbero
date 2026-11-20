// AREA BOY · Draughts with Professor. The old men's game at the tea table, on a
// board scratched into plywood, with bottle tops for pieces: red Coke caps are
// yours, green ones are Professor's. 8x8, men move forward one diagonal, kings
// both ways; a capture is compulsory and a jump that can continue must; a man
// reaching the far side is crowned (and the turn ends).
// Params: skill (0..1, Professor's strength, 0.7) · opponent (character id for the name)
// Outcomes: won | lost
import { rng, rect, box, label, disc, inside } from '../px.js'

const N = 8
export const idx = (r, c) => r * N + c
const onBoard = (r, c) => r >= 0 && r < N && c >= 0 && c < N

export function initialBoard() {
  const b = new Array(N * N).fill(null)
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      if ((r + c) % 2 === 0) continue
      if (r < 3) b[idx(r, c)] = { side: 'o', king: false }
      if (r > 4) b[idx(r, c)] = { side: 'p', king: false }
    }
  return b
}

const dirsOf = (piece) => (piece.king ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : piece.side === 'p' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]])

/** Single steps for one piece: { from, to, cap } (cap = the square jumped over). */
function stepsFrom(b, from) {
  const piece = b[from]
  const r = Math.floor(from / N)
  const c = from % N
  const out = []
  for (const [dr, dc] of dirsOf(piece)) {
    const r1 = r + dr
    const c1 = c + dc
    if (!onBoard(r1, c1)) continue
    const mid = b[idx(r1, c1)]
    if (!mid) out.push({ from, to: idx(r1, c1), cap: null })
    else if (mid.side !== piece.side) {
      const r2 = r1 + dr
      const c2 = c1 + dc
      if (onBoard(r2, c2) && !b[idx(r2, c2)]) out.push({ from, to: idx(r2, c2), cap: idx(r1, c1) })
    }
  }
  return out
}

/** The legal single steps for a side (captures only, if any capture exists). `only` limits to one piece (a jump in progress). */
export function legalMoves(b, side, only = null) {
  let all = []
  for (let i = 0; i < b.length; i++) if (b[i]?.side === side && (only == null || i === only)) all = all.concat(stepsFrom(b, i))
  const caps = all.filter((m) => m.cap != null)
  if (only != null) return caps
  return caps.length ? caps : all
}

/** Apply one step. Returns { board, crowned }. */
export function applyStep(b, m) {
  const nb = b.slice()
  const piece = { ...nb[m.from] }
  nb[m.from] = null
  if (m.cap != null) nb[m.cap] = null
  const r = Math.floor(m.to / N)
  let crowned = false
  if (!piece.king && ((piece.side === 'p' && r === 0) || (piece.side === 'o' && r === N - 1))) {
    piece.king = true
    crowned = true
  }
  nb[m.to] = piece
  return { board: nb, crowned }
}

/** Every full turn for a side (a jump keeps going while it can). */
export function turnsFor(b, side) {
  const out = []
  const extend = (board, m, path) => {
    const { board: nb, crowned } = applyStep(board, m)
    const p2 = [...path, m]
    if (m.cap != null && !crowned) {
      const more = legalMoves(nb, side, m.to)
      if (more.length) return more.forEach((m2) => extend(nb, m2, p2))
    }
    out.push({ path: p2, board: nb })
  }
  for (const m of legalMoves(b, side)) extend(b, m, [])
  return out
}

function evaluate(b) {
  let v = 0
  for (let i = 0; i < b.length; i++) {
    const p = b[i]
    if (!p) continue
    const r = Math.floor(i / N)
    const worth = p.king ? 1.7 : 1 + (p.side === 'o' ? r : N - 1 - r) * 0.04
    v += p.side === 'o' ? worth : -worth
  }
  return v
}

function minimax(b, depth, side, alpha, beta) {
  const turns = turnsFor(b, side)
  if (!turns.length) return side === 'o' ? -99 : 99
  if (depth === 0) return evaluate(b)
  if (side === 'o') {
    let best = -Infinity
    for (const t of turns) {
      best = Math.max(best, minimax(t.board, depth - 1, 'p', alpha, beta))
      alpha = Math.max(alpha, best)
      if (beta <= alpha) break
    }
    return best
  }
  let best = Infinity
  for (const t of turns) {
    best = Math.min(best, minimax(t.board, depth - 1, 'o', alpha, beta))
    beta = Math.min(beta, best)
    if (beta <= alpha) break
  }
  return best
}

/** Professor's turn: look ahead; at lower skill, sometimes just play something. */
export function aiTurn(b, skill, r) {
  const turns = turnsFor(b, 'o')
  if (!turns.length) return null
  if (r() > skill) return turns[Math.floor(r() * turns.length)]
  const depth = skill > 0.8 ? 4 : 3
  let best = null
  let bestV = -Infinity
  for (const t of turns) {
    const val = minimax(t.board, depth - 1, 'p', -Infinity, Infinity) + r() * 0.01
    if (val > bestV) {
      bestV = val
      best = t
    }
  }
  return best
}

export const countOf = (b, side) => b.filter((p) => p?.side === side).length

export function create(params = {}, seed = 1) {
  return { r: rng(seed), board: initialBoard(), turn: 'p', sel: null, chain: null, aiWait: 0, plies: 0, skill: params.skill ?? 0.7, name: params.name || 'Professor', last: [], over: false, winner: null, sound: [] }
}

function endIfStuck(s) {
  const side = s.turn
  if (!legalMoves(s.board, side).length) {
    s.over = true
    s.winner = side === 'p' ? 'o' : 'p'
  } else if (s.plies >= 160) {
    s.over = true
    const d = countOf(s.board, 'p') - countOf(s.board, 'o')
    s.winner = d > 0 ? 'p' : d < 0 ? 'o' : 'draw'
  }
}

export function step(s, dt) {
  if (s.turn !== 'o') return
  s.aiWait -= dt
  if (s.aiWait > 0) return
  const t = aiTurn(s.board, s.skill, s.r)
  if (!t) return endIfStuck(s)
  s.board = t.board
  s.last = t.path.map((m) => m.to).concat(t.path[0].from)
  s.sound.push(t.path.some((m) => m.cap != null) ? 'punch' : 'click')
  s.turn = 'p'
  s.plies++
  endIfStuck(s)
}

export function boardRect(v) {
  const size = Math.floor(Math.min(v.H * 0.84, v.W * 0.92) / 8) * 8
  return { x: Math.round((v.W - size) / 2), y: Math.round(v.H * 0.53 - size / 2), size, cell: size / 8 }
}

/** The player taps a square: pick a piece, or move the picked one. */
export function tapSquare(s, sq) {
  if (s.turn !== 'p' || s.over) return
  const moves = legalMoves(s.board, 'p', s.chain)
  const mine = s.board[sq]?.side === 'p'
  if (mine && s.chain == null) {
    s.sel = moves.some((m) => m.from === sq) ? sq : null
    if (s.sel == null) s.sound.push('wrong')
    return
  }
  if (s.sel == null) return
  const m = moves.find((x) => x.from === s.sel && x.to === sq)
  if (!m) return
  const { board, crowned } = applyStep(s.board, m)
  s.board = board
  s.sound.push(m.cap != null ? 'punch' : 'click')
  if (m.cap != null && !crowned && legalMoves(board, 'p', m.to).length) {
    s.chain = m.to
    s.sel = m.to
    return
  }
  s.chain = null
  s.sel = null
  s.turn = 'o'
  s.aiWait = 0.7
  s.plies++
  endIfStuck(s)
}

export function input(s, ev, v) {
  if (ev.type !== 'down') return
  const br = boardRect(v)
  if (!inside(ev.x, ev.y, { x: br.x, y: br.y, w: br.size, h: br.size })) return
  const c = Math.floor((ev.x - br.x) / br.cell)
  const r = Math.floor((ev.y - br.y) / br.cell)
  tapSquare(s, idx(r, c))
}

function cap(ctx, x, y, cell, P, side, king, lift) {
  const rad = cell * 0.36
  const color = side === 'p' ? '#d9342b' : '#2e9e4f'
  disc(ctx, x, y - lift, rad, color, Math.max(1, Math.round(P / 1.5)))
  // the crimped rim of a bottle top
  for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2
    rect(ctx, x + Math.cos(ang) * rad * 0.82 - P / 2, y - lift + Math.sin(ang) * rad * 0.82 - P / 2, P, P, side === 'p' ? '#ff8a7a' : '#8ff0a4')
  }
  if (king) label(ctx, '♛', x, y - lift, { size: rad * 1.2, color: '#ffd23a' })
}

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  rect(ctx, 0, 0, W, H, '#2a1f18')
  // the tea table under the board
  rect(ctx, 0, H * 0.15, W, H * 0.85, '#6b4a2e')
  for (let y = H * 0.15; y < H; y += P * 6) rect(ctx, 0, y, W, P, '#5a3d25')
  const br = boardRect(v)
  box(ctx, br.x, br.y, br.size, br.size, '#e8c48a', P)
  const moves = s.turn === 'p' ? legalMoves(s.board, 'p', s.chain) : []
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const x = br.x + c * br.cell
      const y = br.y + r * br.cell
      const i = idx(r, c)
      if ((r + c) % 2) rect(ctx, x, y, br.cell, br.cell, '#8a5a2b')
      if (s.last.includes(i)) rect(ctx, x, y, br.cell, br.cell, 'rgba(255,210,58,0.25)')
      if (s.sel != null && moves.some((m) => m.from === s.sel && m.to === i)) rect(ctx, x + br.cell * 0.3, y + br.cell * 0.3, br.cell * 0.4, br.cell * 0.4, '#ffd23a')
      if (s.sel == null && s.turn === 'p' && moves.some((m) => m.from === i)) rect(ctx, x, y + br.cell - P, br.cell, P, '#ffd23a')
    }
  for (let i = 0; i < s.board.length; i++) {
    const p = s.board[i]
    if (!p) continue
    const x = br.x + (i % N) * br.cell + br.cell / 2
    const y = br.y + Math.floor(i / N) * br.cell + br.cell / 2
    cap(ctx, x, y, br.cell, P, p.side, p.king, s.sel === i ? P * 2 + Math.sin(t * 8) * P : 0)
  }
  const msg = s.over ? '' : s.turn === 'o' ? `${s.name} is thinking…` : s.chain != null ? 'Keep jumping!' : 'Your move'
  label(ctx, msg, W / 2, br.y - P * 5, { size: Math.max(12, P * 4), color: s.turn === 'o' ? '#bfe8c8' : '#ffd23a' })
}

export const hud = (s) => [
  { label: 'YOU', value: countOf(s.board, 'p') },
  { label: s.name.toUpperCase(), value: countOf(s.board, 'o') },
]

export function result(s) {
  const won = s.winner === 'p'
  return {
    outcome: won ? 'won' : 'lost',
    score: Math.max(0, 12 - countOf(s.board, 'o')),
    headline: won ? `You beat ${s.name}!` : s.winner === 'draw' ? 'A draw. Nobody buys the tea.' : `${s.name} wins. Again.`,
    line: won ? '"Hm. Somebody has been practising." He pours you tea. On credit.' : '"Rule number eleven: never play an old man at his own table."',
  }
}

export default {
  id: 'draughts', scoreLabel: 'pieces taken', start: 'Set the bottle tops',
  title: (p) => `Draughts with ${p.name || 'Professor'}`,
  rules: ['Red bottle tops are yours. Tap one, then tap where it goes: one square diagonally forward.', 'Jump over an enemy piece to take it. If you can take, you must; if the same piece can jump again, keep going.', 'Reach the far side and your piece is crowned: kings move forwards and backwards.', 'Take all his pieces, or leave him with no move, to win.'],
  short: 'Captures are compulsory. Crowns on the far side.',
  create, step, input, draw, hud, result,
}
