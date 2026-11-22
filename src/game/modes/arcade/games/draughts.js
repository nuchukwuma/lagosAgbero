// AREA BOY · Draughts with Professor. The old men's game at the tea table, on a
// board scratched into plywood, with bottle tops for pieces: red Coke caps are
// yours, green ones are Professor's.
//
// The rules are the official ones. By default, International draughts (FMJD),
// the game Nigeria plays at home and in competition:
//   - 10x10 board, 20 men each on the dark squares of the first four rows; you (white) move first
//   - men move one square diagonally forward, and capture forwards AND backwards
//   - capturing is compulsory, and you must take the MOST pieces you can (kings and men count the same)
//   - in a multiple capture, taken pieces come off only at the end, and none can be jumped twice
//   - a man is crowned only if his move ENDS on the far row (passing through it mid-capture doesn't count)
//   - kings fly: any distance along a free diagonal, and capture from a distance, landing on any free square beyond
//   - you win when the other side has no pieces or no legal move; 25 moves each with only kings
//     moving and nothing taken is a draw
// variant: 'english' plays English draughts (8x8, 12 each; men capture forwards only;
// kings move one square; any capture may be chosen; crowning ends the move).
// Params: skill (0..1: Professor's level 1-5, or aiLevel to set it) · variant ('international' | 'english') · name
// Outcomes: won | lost
import { rng, rect, box, label, disc, inside } from '../px.js'

export const VARIANTS = {
  international: { n: 10, rows: 4, back: true, flying: true, max: true, crownEnds: false, kingDraw: 50, name: 'International draughts' },
  english: { n: 8, rows: 3, back: false, flying: false, max: false, crownEnds: true, kingDraw: 80, name: 'English draughts' },
}
const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]]

export const idx = (r, c, n = 10) => r * n + c
const onBoard = (n, r, c) => r >= 0 && r < n && c >= 0 && c < n

export function initialBoard(R = VARIANTS.international) {
  const { n, rows } = R
  const b = new Array(n * n).fill(null)
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if ((r + c) % 2 === 0) continue
      if (r < rows) b[r * n + c] = { side: 'o', king: false }
      if (r >= n - rows) b[r * n + c] = { side: 'p', king: false }
    }
  return b
}

const forward = (side) => (side === 'p' ? -1 : 1)
const crownRow = (side, n) => (side === 'p' ? 0 : n - 1)

/** Every capture sequence for the piece on `from`: [{ path: [from, ..., to], caps: [...] }]. */
function captures(b, from, R) {
  const { n } = R
  const piece = b[from]
  const out = []
  const empty = (sq) => b[sq] == null || sq === from // the moving piece has left its square
  const dfs = (sq, path, caps, king) => {
    const r = Math.floor(sq / n)
    const c = sq % n
    let more = false
    for (const [dr, dc] of DIRS) {
      if (!king && !R.back && dr !== forward(piece.side)) continue
      if (king && R.flying) {
        // fly along the diagonal to the first piece; if it's theirs (and not already taken), land anywhere free beyond
        let r1 = r + dr
        let c1 = c + dc
        while (onBoard(n, r1, c1) && empty(r1 * n + c1)) {
          r1 += dr
          c1 += dc
        }
        if (!onBoard(n, r1, c1)) continue
        const mid = r1 * n + c1
        if (b[mid].side === piece.side || caps.includes(mid)) continue
        let r2 = r1 + dr
        let c2 = c1 + dc
        while (onBoard(n, r2, c2) && empty(r2 * n + c2)) {
          more = true
          dfs(r2 * n + c2, [...path, r2 * n + c2], [...caps, mid], true)
          r2 += dr
          c2 += dc
        }
      } else {
        const r1 = r + dr
        const c1 = c + dc
        const r2 = r + 2 * dr
        const c2 = c + 2 * dc
        if (!onBoard(n, r2, c2)) continue
        const mid = r1 * n + c1
        const land = r2 * n + c2
        if (!b[mid] || b[mid].side === piece.side || caps.includes(mid) || !empty(land)) continue
        more = true
        // English: a man reaching the far row is crowned and the move ends there
        if (!king && R.crownEnds && r2 === crownRow(piece.side, n)) out.push({ path: [...path, land], caps: [...caps, mid] })
        else dfs(land, [...path, land], [...caps, mid], king)
      }
    }
    if (!more && caps.length) out.push({ path, caps })
  }
  dfs(from, [from], [], piece.king)
  return out
}

/** Plain moves (no capture) for the piece on `from`. */
function slides(b, from, R) {
  const { n } = R
  const piece = b[from]
  const r = Math.floor(from / n)
  const c = from % n
  const out = []
  for (const [dr, dc] of DIRS) {
    if (!piece.king && dr !== forward(piece.side)) continue
    let r1 = r + dr
    let c1 = c + dc
    while (onBoard(n, r1, c1) && !b[r1 * n + c1]) {
      out.push({ path: [from, r1 * n + c1], caps: [] })
      if (!(piece.king && R.flying)) break
      r1 += dr
      c1 += dc
    }
  }
  return out
}

/** Play a whole turn on a board: the piece moves along its path, the taken pieces come off, crowning if it ends on the far row. */
export function applyTurn(b, turn, R) {
  const nb = b.slice()
  const from = turn.path[0]
  const to = turn.path[turn.path.length - 1]
  const piece = { ...nb[from] }
  nb[from] = null
  for (const c of turn.caps) nb[c] = null
  if (!piece.king && Math.floor(to / R.n) === crownRow(piece.side, R.n)) piece.king = true
  nb[to] = piece
  return nb
}

/** Every legal turn for a side: captures if there are any (only the biggest, under the majority rule), else plain moves. */
export function turnsFor(b, side, R = VARIANTS.international) {
  let caps = []
  for (let i = 0; i < b.length; i++) if (b[i]?.side === side) caps = caps.concat(captures(b, i, R))
  if (caps.length) {
    if (R.max) {
      const most = Math.max(...caps.map((t) => t.caps.length))
      caps = caps.filter((t) => t.caps.length === most)
    }
    return caps.map((t) => ({ ...t, board: applyTurn(b, t, R) }))
  }
  let all = []
  for (let i = 0; i < b.length; i++) if (b[i]?.side === side) all = all.concat(slides(b, i, R))
  return all.map((t) => ({ ...t, board: applyTurn(b, t, R) }))
}

function evaluate(b, R) {
  const { n } = R
  let v = 0
  for (let i = 0; i < b.length; i++) {
    const p = b[i]
    if (!p) continue
    const r = Math.floor(i / n)
    const c = i % n
    const adv = p.side === 'o' ? r : n - 1 - r
    const centre = c > 1 && c < n - 2 ? 0.05 : 0
    const worth = p.king ? (R.flying ? 3.2 : 1.7) : 1 + adv * 0.035 + centre + (adv === 0 ? 0.08 : 0) // keep the back row
    v += p.side === 'o' ? worth : -worth
  }
  return v
}

function minimax(b, depth, side, alpha, beta, R) {
  const turns = turnsFor(b, side, R)
  if (!turns.length) return side === 'o' ? -99 - depth : 99 + depth
  if (depth === 0) return evaluate(b, R)
  if (side === 'o') {
    let best = -Infinity
    for (const t of turns) {
      best = Math.max(best, minimax(t.board, depth - 1, 'p', alpha, beta, R))
      alpha = Math.max(alpha, best)
      if (beta <= alpha) break
    }
    return best
  }
  let best = Infinity
  for (const t of turns) {
    best = Math.min(best, minimax(t.board, depth - 1, 'o', alpha, beta, R))
    beta = Math.min(beta, best)
    if (beta <= alpha) break
  }
  return best
}

// Professor's five levels: how far he looks ahead, and how often he just plays something
export const LEVELS = [
  { name: 'Beginner', depth: 1, random: 0.45 },
  { name: 'Casual', depth: 2, random: 0.25 },
  { name: 'Club player', depth: 3, random: 0.1 },
  { name: 'Strong', depth: 4, random: 0.03 },
  { name: 'Master', depth: 5, random: 0 },
]
export const levelOf = (skill) => Math.max(1, Math.min(5, 1 + Math.round((skill ?? 0.6) * 4)))

/** Professor's turn at a level (1-5). */
export function aiTurn(b, level, r, R = VARIANTS.international) {
  const turns = turnsFor(b, 'o', R)
  if (!turns.length) return null
  if (turns.length === 1) return turns[0]
  const L = LEVELS[level - 1]
  if (r() < L.random) return turns[Math.floor(r() * turns.length)]
  // the big board with flying kings branches a lot: a level-5 search looks one move less there late on
  const depth = R.flying && L.depth > 4 && turns.length > 12 ? 4 : L.depth
  let best = null
  let bestV = -Infinity
  for (const t of turns) {
    const val = minimax(t.board, depth - 1, 'p', -Infinity, Infinity, R) + r() * 0.01
    if (val > bestV) {
      bestV = val
      best = t
    }
  }
  return best
}

export const countOf = (b, side) => b.filter((p) => p?.side === side).length

export function create(params = {}, seed = 1) {
  const R = VARIANTS[params.variant] || VARIANTS.international
  // online (params.remote): the other side is a real person; seat 1 waits for seat 0's first move
  const s = { r: rng(seed), R, remote: Boolean(params.remote), outbox: [], board: initialBoard(R), turn: params.remote && params.seat === 1 ? 'o' : 'p', path: [], turns: [], aiWait: 0, plies: 0, kingPlies: 0, level: params.aiLevel ?? levelOf(params.skill ?? 0.6), name: params.name || 'Professor', last: [], over: false, winner: null, msg: '', msgT: 0, sound: [] }
  s.turns = s.turn === 'p' ? turnsFor(s.board, 'p', R) : []
  return s
}

/** After a turn: the next side's moves, and is the game over (no move, or the kings-only draw)? */
function nextTurn(s, turn) {
  const moved = s.board[turn.path[turn.path.length - 1]]
  s.kingPlies = turn.caps.length || !moved?.king ? 0 : s.kingPlies + 1
  s.plies++
  s.turn = s.turn === 'p' ? 'o' : 'p'
  s.path = []
  s.turns = turnsFor(s.board, s.turn, s.R)
  if (!s.turns.length) {
    s.over = true
    s.winner = s.turn === 'p' ? 'o' : 'p'
  } else if (s.kingPlies >= s.R.kingDraw || s.plies >= 400) {
    s.over = true
    s.winner = 'draw'
  }
  if (s.turn === 'o') s.aiWait = 0.7
}

export function step(s, dt) {
  s.msgT -= dt
  if (s.turn !== 'o' || s.over || s.remote) return
  s.aiWait -= dt
  if (s.aiWait > 0) return
  const t = aiTurn(s.board, s.level, s.r, s.R)
  if (!t) return nextTurn(s, { path: [0], caps: [] })
  s.board = t.board
  s.last = t.path.slice()
  s.sound.push(t.caps.length ? 'punch' : 'click')
  if (t.caps.length > 1) {
    s.msg = `${s.name} takes ${t.caps.length}!`
    s.msgT = 1.4
  }
  nextTurn(s, t)
}

export function boardRect(v, n = 10) {
  const size = Math.floor(Math.min(v.H * 0.86, v.W * 0.92) / n) * n
  return { x: Math.round((v.W - size) / 2), y: Math.round(v.H * 0.54 - size / 2), size, cell: size / n }
}

/** Your turns that start the way you've tapped so far. */
const matching = (s) => s.turns.filter((t) => s.path.every((sq, i) => t.path[i] === sq))

/** The player taps a square: pick a piece, then each square it lands on (for a capture, every landing in turn). */
export function tapSquare(s, sq) {
  if (s.turn !== 'p' || s.over) return
  const mine = s.board[sq]?.side === 'p'
  if (mine && s.path.length <= 1) {
    if (s.turns.some((t) => t.path[0] === sq)) s.path = [sq]
    else {
      s.path = []
      s.sound.push('wrong')
      const capNow = s.turns[0]?.caps.length
      if (capNow) {
        s.msg = s.R.max ? `You must capture, and take the most you can (${capNow}).` : 'You must capture.'
        s.msgT = 1.8
      }
    }
    return
  }
  if (!s.path.length) return
  const next = matching(s).filter((t) => t.path[s.path.length] === sq)
  if (!next.length) return void s.sound.push('wrong')
  s.path = [...s.path, sq]
  const done = next.find((t) => t.path.length === s.path.length)
  if (!done) return void s.sound.push('click') // keep jumping
  s.board = done.board
  s.last = done.path.slice()
  s.sound.push(done.caps.length ? 'punch' : 'click')
  if (s.remote) s.outbox.push({ path: done.path })
  nextTurn(s, done)
}

export function input(s, ev, v) {
  if (ev.type === 'remote') {
    // the other player's move, already turned round to your side of the board
    if (s.turn !== 'o' || s.over) return
    const path = ev.move.path || []
    const t = turnsFor(s.board, 'o', s.R).find((x) => x.path.length === path.length && x.path.every((q, i) => q === path[i]))
    if (!t) return
    s.board = t.board
    s.last = t.path.slice()
    s.sound.push(t.caps.length ? 'punch' : 'click')
    nextTurn(s, t)
    return
  }
  if (ev.type !== 'down') return
  const n = s.R.n
  const br = boardRect(v, n)
  if (!inside(ev.x, ev.y, { x: br.x, y: br.y, w: br.size, h: br.size })) return
  const c = Math.floor((ev.x - br.x) / br.cell)
  const r = Math.floor((ev.y - br.y) / br.cell)
  tapSquare(s, r * n + c)
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
  const n = s.R.n
  rect(ctx, 0, 0, W, H, '#2a1f18')
  // the tea table under the board
  rect(ctx, 0, H * 0.15, W, H * 0.85, '#6b4a2e')
  for (let y = H * 0.15; y < H; y += P * 6) rect(ctx, 0, y, W, P, '#5a3d25')
  const br = boardRect(v, n)
  box(ctx, br.x, br.y, br.size, br.size, '#e8c48a', Math.max(1, P / 2))
  const live = s.turn === 'p' && !s.over ? matching(s) : []
  const nextSquares = new Set(s.path.length ? live.map((tt) => tt.path[s.path.length]).filter((x) => x != null) : [])
  const starts = new Set(s.path.length ? [] : live.map((tt) => tt.path[0]))
  // pieces taken so far in the capture you're making
  const takenSoFar = new Set()
  if (s.path.length > 1) for (const tt of live) tt.caps.slice(0, s.path.length - 1).forEach((c) => takenSoFar.add(c))
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const x = br.x + c * br.cell
      const y = br.y + r * br.cell
      const i = r * n + c
      if ((r + c) % 2) rect(ctx, x, y, br.cell, br.cell, '#8a5a2b')
      if (s.last.includes(i)) rect(ctx, x, y, br.cell, br.cell, 'rgba(255,210,58,0.25)')
      if (nextSquares.has(i)) rect(ctx, x + br.cell * 0.3, y + br.cell * 0.3, br.cell * 0.4, br.cell * 0.4, '#ffd23a')
      if (starts.has(i)) rect(ctx, x, y + br.cell - Math.max(1, P / 2), br.cell, Math.max(1, P / 2) * 2, '#ffd23a')
    }
  const moving = s.path.length ? s.path[0] : null
  for (let i = 0; i < s.board.length; i++) {
    const p = s.board[i]
    if (!p || i === moving) continue
    const x = br.x + (i % n) * br.cell + br.cell / 2
    const y = br.y + Math.floor(i / n) * br.cell + br.cell / 2
    if (takenSoFar.has(i)) ctx.globalAlpha = 0.35
    cap(ctx, x, y, br.cell, Math.max(1, P * (n > 8 ? 0.75 : 1)), p.side, p.king, 0)
    ctx.globalAlpha = 1
  }
  if (moving != null) {
    // the piece you're moving, lifted, where it has got to
    const at = s.path[s.path.length - 1]
    const x = br.x + (at % n) * br.cell + br.cell / 2
    const y = br.y + Math.floor(at / n) * br.cell + br.cell / 2
    cap(ctx, x, y, br.cell, Math.max(1, P * (n > 8 ? 0.75 : 1)), 'p', s.board[moving].king, P * 2 + Math.sin(t * 8) * P)
  }
  const msg = s.over ? '' : s.turn === 'o' ? `${s.name} is thinking…` : s.path.length > 1 ? 'Keep jumping!' : live[0]?.caps.length ? `You must take ${live[0].caps.length > 1 && s.R.max ? `${live[0].caps.length} pieces` : 'a piece'}` : 'Your move'
  label(ctx, msg, W / 2, Math.max(P * 4, br.y - P * 4), { size: Math.max(11, P * 3.6), color: s.turn === 'o' ? '#bfe8c8' : '#ffd23a' })
  if (s.msgT > 0) label(ctx, s.msg, W / 2, br.y + br.size / 2, { size: Math.max(12, P * 4), alpha: Math.min(1, s.msgT) })
}

export const hud = (s) => [
  { label: 'YOU', value: countOf(s.board, 'p') },
  { label: s.name.toUpperCase(), value: countOf(s.board, 'o') },
  s.remote ? { label: 'ONLINE', value: 'live game' } : { label: 'LEVEL', value: `${s.level} · ${LEVELS[s.level - 1].name}` },
]

export function result(s) {
  const won = s.winner === 'p'
  const total = s.R.n === 10 ? 20 : 12
  return {
    outcome: won ? 'won' : 'lost',
    score: Math.max(0, total - countOf(s.board, 'o')) + (won ? s.level * 5 : 0),
    moneyChange: won ? 500 * s.level : 0,
    headline: won ? `You beat ${s.name}!` : s.winner === 'draw' ? 'A draw. Nobody buys the tea.' : `${s.name} wins. Again.`,
    line: won ? '"Hm. Somebody has been practising." He pours you tea. On credit.' : s.winner === 'draw' ? `${s.R.kingDraw / 2} moves each with only kings moving: a draw, by the rules.` : '"Rule number eleven: never play an old man at his own table."',
  }
}

export default {
  id: 'draughts', scoreLabel: 'points', start: 'Set the bottle tops',
  title: (p) => `Draughts with ${p.name || 'Professor'}`,
  rules: (p) =>
    p.variant === 'english'
      ? ['English draughts, 8×8. Red bottle tops are yours. Tap a piece, then tap where it goes: one square diagonally forward.', 'Jump over an enemy piece to take it. If you can take, you must; if the same piece can jump again, it keeps going.', 'Reach the far side and your piece is crowned (the move ends there): kings move one square forwards or backwards.', 'Take all his pieces, or leave him with no move, to win.']
      : [
          'International draughts (the official rules, as played in Nigeria): a 10×10 board, 20 pieces each. Red bottle tops are yours, and you move first.',
          'Tap a piece, then where it goes: men step one square diagonally forward.',
          'Jump an enemy piece to take it: men take forwards AND backwards. Taking is compulsory, and you must take the most pieces you can. In a run of jumps, tap each landing square; the pieces come off at the end.',
          'A man that ENDS his move on the far row is crowned. Kings fly any distance along a free diagonal, and take from a distance.',
          'Win by taking all his pieces or leaving him no move. 25 moves each with only kings moving is a draw.',
          'Professor has five levels, from Beginner to Master: he gets stronger as the story goes on and the more you beat him.',
        ],
  short: 'Captures are compulsory: take the most you can. Kings fly.',
  create, step, input, draw, hud, result,
}
