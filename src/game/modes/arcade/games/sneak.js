// CAMPUS · Back Gate After Curfew. Get from the hostel to the back gate after
// lights-out. Campus security and the Dons walk their rounds with torches; the
// beam shows the squares they can see. Move one square at a time (arrows, the
// pad, or tap beside yourself). Hedges (green) hide you. Caught means back to
// the hostel; three times and the porter locks the door on you.
// Params: lives (3)
// Outcomes: won | lost
import { rect, box, label } from '../px.js'

// # wall · . path · B hedge (hide) · S start · E the gate
export const LEVELS = [
  {
    name: 'The Quad',
    map: ['###########', '#S...B....#', '#.##.###..#', '#....B..#.#', '#.###.#.#.#', '#...B.....E', '###########'],
    guards: [
      { path: [[1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3]], kind: 'security' },
      { path: [[9, 1], [9, 2], [9, 3], [9, 4], [9, 5]], kind: 'don' },
    ],
    tick: 0.62,
  },
  {
    name: 'Behind the Senate',
    map: ['#############', '#S..#...B...#', '#.#.#.###.#.#', '#.#...B...#.#', '#.###.#.###.#', '#B....#.....#', '#.##.....#B.E', '#############'],
    guards: [
      { path: [[3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3]], kind: 'security' },
      { path: [[11, 1], [11, 2], [11, 3], [11, 4], [11, 5]], kind: 'don' },
      { path: [[4, 6], [5, 6], [6, 6], [7, 6], [8, 6]], kind: 'don' },
      { path: [[5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1]], kind: 'security' },
    ],
    tick: 0.52,
  },
]

const cellAt = (lv, x, y) => (lv.map[y] && lv.map[y][x]) || '#'
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }

function startLevel(s, n) {
  const lv = LEVELS[n]
  s.level = n
  s.lv = lv
  for (let y = 0; y < lv.map.length; y++) for (let x = 0; x < lv.map[y].length; x++) if (lv.map[y][x] === 'S') s.pos = [x, y]
  s.guards = lv.guards.map((g, i) => ({ ...g, i: (i * 2) % g.path.length, dir: 1, at: g.path[(i * 2) % g.path.length] }))
  s.tickLeft = lv.tick * (s.tickMul ?? 1)
  s.caughtT = 0
}

/** What a guard can see: up to 3 squares ahead along the way they face, stopped by walls. */
export function vision(lv, g) {
  const next = g.path[g.i + g.dir] || g.path[g.i - g.dir]
  const fx = Math.sign(next[0] - g.at[0])
  const fy = Math.sign(next[1] - g.at[1])
  const out = []
  for (let k = 1; k <= 3; k++) {
    const x = g.at[0] + fx * k
    const y = g.at[1] + fy * k
    if (cellAt(lv, x, y) === '#') break
    out.push([x, y])
  }
  return out
}

export function seen(s) {
  if (cellAt(s.lv, s.pos[0], s.pos[1]) === 'B') return false
  return s.guards.some((g) => (g.at[0] === s.pos[0] && g.at[1] === s.pos[1]) || vision(s.lv, g).some(([x, y]) => x === s.pos[0] && y === s.pos[1]))
}

export function create(params = {}) {
  const s = { tickMul: params.tickMul ?? 1, lives: params.lives ?? 3, moves: 0, done: 0, over: false, won: false, msg: '', msgT: 0, sound: [] }
  startLevel(s, 0)
  return s
}

function caught(s) {
  s.lives--
  s.sound.push('whistle')
  s.msg = s.guards.some((g) => g.kind === 'don' && vision(s.lv, g).some(([x, y]) => x === s.pos[0] && y === s.pos[1])) ? '"Jambite! Wetin you dey find for here?"' : '"Hey! You! Back to your hostel!"'
  s.msgT = 1.6
  if (s.lives <= 0) {
    s.over = true
    return
  }
  const lvl = s.level
  startLevel(s, lvl)
  s.caughtT = 1
}

export function move(s, d) {
  if (s.over || s.caughtT > 0) return
  const [dx, dy] = DIRS[d]
  const nx = s.pos[0] + dx
  const ny = s.pos[1] + dy
  const c = cellAt(s.lv, nx, ny)
  if (c === '#') return void s.sound.push('bump')
  s.pos = [nx, ny]
  s.moves++
  s.sound.push('click')
  if (c === 'E') {
    s.done++
    s.sound.push('correct')
    if (s.level + 1 >= LEVELS.length) {
      s.won = true
      s.over = true
    } else {
      startLevel(s, s.level + 1)
      s.msg = `Level ${s.level + 1}: ${s.lv.name}`
      s.msgT = 1.6
    }
    return
  }
  if (seen(s)) caught(s)
}

export function step(s, dt) {
  s.msgT -= dt
  if (s.caughtT > 0) {
    s.caughtT -= dt
    return
  }
  s.tickLeft -= dt
  if (s.tickLeft > 0) return
  s.tickLeft = s.lv.tick * s.tickMul
  for (const g of s.guards) {
    if (!g.path[g.i + g.dir]) g.dir = -g.dir
    g.i += g.dir
    g.at = g.path[g.i]
  }
  if (seen(s)) caught(s)
}

export function layoutOf(v, lv) {
  const cols = lv.map[0].length
  const rows = lv.map.length
  const cell = Math.floor(Math.min((v.W * 0.94) / cols, (v.H * 0.66) / rows))
  return { cell, x: Math.round((v.W - cell * cols) / 2), y: Math.round(v.H * 0.2) }
}

export function input(s, ev, v) {
  if (ev.type === 'button') return move(s, ev.id)
  if (ev.type !== 'down') return
  const L = layoutOf(v, s.lv)
  const px = L.x + (s.pos[0] + 0.5) * L.cell
  const py = L.y + (s.pos[1] + 0.5) * L.cell
  const dx = ev.x - px
  const dy = ev.y - py
  if (Math.abs(dx) < L.cell * 0.4 && Math.abs(dy) < L.cell * 0.4) return
  move(s, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
}

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  rect(ctx, 0, 0, W, H, '#0b1020')
  const L = layoutOf(v, s.lv)
  const lv = s.lv
  for (let y = 0; y < lv.map.length; y++)
    for (let x = 0; x < lv.map[y].length; x++) {
      const c = lv.map[y][x]
      const X = L.x + x * L.cell
      const Y = L.y + y * L.cell
      if (c === '#') {
        rect(ctx, X, Y, L.cell, L.cell, '#3a3550')
        rect(ctx, X, Y, L.cell, P, '#55507a')
        if ((x + y) % 3 === 0) rect(ctx, X + L.cell * 0.3, Y + L.cell * 0.3, L.cell * 0.25, L.cell * 0.3, '#f5d76e') // a lit window
      } else {
        rect(ctx, X, Y, L.cell, L.cell, '#1f2a1f')
        if (c === 'B') {
          rect(ctx, X + P, Y + P, L.cell - 2 * P, L.cell - 2 * P, '#2f6b2f')
          rect(ctx, X + P * 2, Y + P * 2, P * 2, P * 2, '#4c9a4c')
        }
        if (c === 'E') {
          rect(ctx, X, Y, L.cell, L.cell, '#5a3416')
          label(ctx, 'GATE', X + L.cell / 2, Y + L.cell / 2, { size: L.cell * 0.28, color: '#ffd23a' })
        }
        if (c === 'S') label(ctx, 'H', X + L.cell / 2, Y + L.cell / 2, { size: L.cell * 0.4, color: '#7fc8ff', alpha: 0.5 })
      }
    }
  // torch beams, then the guards
  for (const g of s.guards) {
    for (const [x, y] of vision(lv, g)) {
      ctx.save()
      ctx.globalAlpha = 0.35 + Math.sin(t * 6) * 0.05
      rect(ctx, L.x + x * L.cell, L.y + y * L.cell, L.cell, L.cell, '#fff2a8')
      ctx.restore()
    }
    const gx = L.x + g.at[0] * L.cell
    const gy = L.y + g.at[1] * L.cell
    box(ctx, gx + L.cell * 0.2, gy + L.cell * 0.2, L.cell * 0.6, L.cell * 0.6, g.kind === 'don' ? '#c0392b' : '#2f6fd6', Math.max(1, P / 2))
    if (g.kind === 'don') rect(ctx, gx + L.cell * 0.2, gy + L.cell * 0.2, L.cell * 0.6, L.cell * 0.15, '#ff3a3a')
  }
  // you
  const hid = cellAt(lv, s.pos[0], s.pos[1]) === 'B'
  const X = L.x + s.pos[0] * L.cell
  const Y = L.y + s.pos[1] * L.cell
  ctx.save()
  ctx.globalAlpha = hid ? 0.55 : 1
  box(ctx, X + L.cell * 0.25, Y + L.cell * 0.25, L.cell * 0.5, L.cell * 0.5, '#ffd23a', Math.max(1, P / 2))
  ctx.restore()
  if (s.caughtT > 0) rect(ctx, 0, 0, W, H, `rgba(255,255,255,${s.caughtT * 0.3})`)
  label(ctx, `${lv.name}${hid ? ' · hiding in the hedge' : ''}`, W / 2, L.y - P * 5, { size: Math.max(12, P * 3.6), color: '#cfd8ff' })
  if (s.msgT > 0) label(ctx, s.msg, W / 2, Math.min(H - P * 24, L.y + lv.map.length * L.cell + P * 6), { size: Math.max(12, P * 3.6), color: '#ffd23a', alpha: Math.min(1, s.msgT) })
}

export const hud = (s) => [
  { label: 'LEVEL', value: `${s.level + 1}/${LEVELS.length}` },
  { label: 'TRIES', value: '♥'.repeat(s.lives), warn: s.lives === 1 },
  { label: 'STEPS', value: s.moves },
]
export const buttons = () => [
  { id: 'left', label: '◀', key: '←' },
  { id: 'up', label: '▲', key: '↑' },
  { id: 'down', label: '▼', key: '↓' },
  { id: 'right', label: '▶', key: '→' },
]

export function result(s) {
  return {
    outcome: s.won ? 'won' : 'lost',
    score: s.won ? Math.max(10, 200 - s.moves) : s.done * 50,
    headline: s.won ? 'Through the back gate. Nobody saw a thing.' : 'The porter locks the hostel door. You sleep in the common room.',
    line: s.won ? `${s.moves} steps, ${3 - s.lives === 0 ? 'not seen once' : `caught ${3 - s.lives} time${3 - s.lives === 1 ? '' : 's'}`}.` : 'Security has your name in the curfew book now.',
  }
}

export default {
  id: 'sneak', title: 'Back Gate After Curfew', scoreLabel: 'points', start: 'Lights out',
  rules: ['Move one square at a time: arrow keys, the pad, or tap beside yourself. H is the hostel; get to the GATE.', 'Guards walk their rounds. The bright squares in front of them are what their torches see: don\'t be there.', 'Green hedges hide you, even in the beam.', 'Get caught and it\'s back to the hostel. Three times and you\'re done for the night.'],
  short: 'Stay out of the torch beams. Hedges hide you.',
  keys: { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' },
  create, step, input, draw, hud, buttons, result,
}
