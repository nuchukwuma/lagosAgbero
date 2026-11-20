// CAMPUS · Back Gate After Curfew. Top-down stealth: get from the hostel to the
// back gate after lights-out. Campus security and the Dons walk their rounds
// with torches; the beam is what they can see (walls block it). Move freely
// with the stick (or hold the arrows, or tap where to go). In a beam, a "?"
// fills up before it turns to "!": get out of the light in time. Hedges hide
// you even in the beam; bumping into a guard always gets you caught. Caught
// means back to the hostel; three times and the porter locks the door on you.
// Params: lives (3) · tickMul (guards' pace: higher is slower, 1)
// Outcomes: won | lost
import { rect, box, label, clamp } from '../px.js'
import { lookFor } from '../people.js'

// # wall · . path · B hedge (hide) · S start (the hostel) · E the gate
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

export const SPEED = 2.6 // squares a second at a full push
export const RANGE = 3.2 // how far a torch reaches (squares)
export const CONE = (34 * Math.PI) / 180 // half the beam's angle
const R = 0.28 // your size (squares)
const SPOT_TIME = 0.4 // seconds in the light before "!"
const LOOK_TIME = 0.7 // a guard stops and looks round at each end of the round

export const cellAt = (lv, x, y) => (lv.map[Math.floor(y)] && lv.map[Math.floor(y)][Math.floor(x)]) || '#'
const wall = (lv, x, y) => cellAt(lv, x, y) === '#'

function startLevel(s, n) {
  const lv = LEVELS[n]
  s.level = n
  s.lv = lv
  for (let y = 0; y < lv.map.length; y++) for (let x = 0; x < lv.map[y].length; x++) if (lv.map[y][x] === 'S') s.pos = [x + 0.5, y + 0.5]
  // each guard: where along the round (u, in squares), which way, a pause at the ends
  s.guards = lv.guards.map((g, i) => ({ ...g, u: (i * 2) % g.path.length, dir: 1, wait: 0, x: 0, y: 0, fx: 1, fy: 0 }))
  for (const g of s.guards) placeGuard(g, 0)
  s.spot = 0
  s.caughtT = 0
  s.target = null
}

/** Put a guard where `u` says along its round, facing the way it walks (or looking round at an end). */
function placeGuard(g, t) {
  const n = g.path.length - 1
  const u = clamp(g.u, 0, n)
  const i = Math.min(n - 1, Math.floor(u))
  const f = u - i
  const [ax, ay] = g.path[i]
  const [bx, by] = g.path[Math.min(n, i + 1)]
  g.x = ax + (bx - ax) * f + 0.5
  g.y = ay + (by - ay) * f + 0.5
  const dx = (bx - ax) * g.dir
  const dy = (by - ay) * g.dir
  if (g.wait > 0) {
    // looking round: the beam sweeps
    const base = Math.atan2(dy || 0.0001, dx)
    const a = base + Math.sin(t * 3) * 1.2
    g.fx = Math.cos(a)
    g.fy = Math.sin(a)
  } else if (dx || dy) {
    g.fx = dx
    g.fy = dy
  }
}

/** Is there a clear line between two points (no wall)? */
export function clearLine(lv, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0)
  const n = Math.ceil(d / 0.1)
  for (let i = 1; i < n; i++) if (wall(lv, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return false
  return true
}

/** Can this guard see the point? In the beam (range and angle) with nothing in between. */
export function inBeam(lv, g, x, y) {
  const dx = x - g.x
  const dy = y - g.y
  const d = Math.hypot(dx, dy)
  if (d > RANGE) return false
  if (d < 0.2) return true
  const ang = Math.acos(clamp((dx * g.fx + dy * g.fy) / (d * Math.hypot(g.fx, g.fy)), -1, 1))
  return ang <= CONE && clearLine(lv, g.x, g.y, x, y)
}

export function seen(s) {
  if (cellAt(s.lv, s.pos[0], s.pos[1]) === 'B') return false
  return s.guards.some((g) => inBeam(s.lv, g, s.pos[0], s.pos[1]))
}

export function create(params = {}) {
  const s = { you: params.you || 3, tickMul: params.tickMul ?? 1, lives: params.lives ?? 3, moves: 0, done: 0, over: false, won: false, msg: '', msgT: 0, held: {}, stick: null, t: 0, walkT: 0, sound: [] }
  startLevel(s, 0)
  return s
}

function caught(s, by) {
  s.lives--
  s.sound.push('whistle')
  s.msg = by?.kind === 'don' ? '"Jambite! Wetin you dey find for here?"' : '"Hey! You! Back to your hostel!"'
  s.msgT = 1.6
  if (s.lives <= 0) {
    s.over = true
    return
  }
  startLevel(s, s.level)
  s.caughtT = 1
}

/** Slide along walls: move on each axis separately. */
function tryMove(s, dx, dy) {
  const [x, y] = s.pos
  const free = (px, py) => !wall(s.lv, px - R, py - R) && !wall(s.lv, px + R, py - R) && !wall(s.lv, px - R, py + R) && !wall(s.lv, px + R, py + R)
  if (dx && free(x + dx, y)) s.pos[0] = x + dx
  if (dy && free(s.pos[0], y + dy)) s.pos[1] = y + dy
}

/** The old one-square step (keys and tests still use it): a quick shove that way. */
export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
export function move(s, d) {
  if (s.over || s.caughtT > 0) return
  const [dx, dy] = DIRS[d]
  const before = [...s.pos]
  for (let i = 0; i < 10; i++) tryMove(s, dx * 0.1, dy * 0.1)
  if (s.pos[0] === before[0] && s.pos[1] === before[1]) s.sound.push('bump')
  else s.moves++
  arrive(s)
}

function arrive(s) {
  if (cellAt(s.lv, s.pos[0], s.pos[1]) !== 'E') return
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
}

export function step(s, dt) {
  s.t += dt
  s.msgT -= dt
  if (s.over) return
  if (s.caughtT > 0) {
    s.caughtT -= dt
    return
  }
  // where you want to go: the stick, held arrows, or a tapped spot
  let vx = 0
  let vy = 0
  if (s.stick && Math.hypot(s.stick.x, s.stick.y) > 0.15) {
    vx = s.stick.x
    vy = -s.stick.y
  } else if (s.held.left || s.held.right || s.held.up || s.held.down) {
    vx = (s.held.right ? 1 : 0) - (s.held.left ? 1 : 0)
    vy = (s.held.down ? 1 : 0) - (s.held.up ? 1 : 0)
  } else if (s.target) {
    const dx = s.target[0] - s.pos[0]
    const dy = s.target[1] - s.pos[1]
    const d = Math.hypot(dx, dy)
    if (d < 0.08) s.target = null
    else {
      vx = dx / d
      vy = dy / d
    }
  }
  const mag = Math.hypot(vx, vy)
  if (mag > 1) {
    vx /= mag
    vy /= mag
  }
  if (mag > 0.05) {
    s.face = Math.atan2(vy, vx)
    s.walkT += dt * Math.min(1, mag) * 8
    tryMove(s, vx * SPEED * dt, vy * SPEED * dt)
    arrive(s)
    if (s.over || s.caughtT > 0) return
  }
  // the guards walk their rounds, pausing to look round at each end
  const pace = 1 / (s.lv.tick * s.tickMul)
  for (const g of s.guards) {
    if (g.wait > 0) g.wait -= dt
    else {
      g.u += g.dir * pace * dt
      const n = g.path.length - 1
      if (g.u >= n || g.u <= 0) {
        g.u = clamp(g.u, 0, n)
        g.dir = -g.dir
        g.wait = LOOK_TIME
      }
    }
    placeGuard(g, s.t + g.u)
  }
  // bumping into one is always caught; in a beam, the "?" fills up
  const bump = s.guards.find((g) => Math.hypot(g.x - s.pos[0], g.y - s.pos[1]) < 0.55)
  if (bump) return caught(s, bump)
  const by = cellAt(s.lv, s.pos[0], s.pos[1]) === 'B' ? null : s.guards.find((g) => inBeam(s.lv, g, s.pos[0], s.pos[1]))
  s.spotBy = by
  s.spot = by ? s.spot + dt / SPOT_TIME : Math.max(0, s.spot - dt * 1.5)
  if (s.spot >= 1) caught(s, by)
}

export function layoutOf(v, lv) {
  const cols = lv.map[0].length
  const rows = lv.map.length
  const cell = Math.floor(Math.min((v.W * 0.96) / cols, (v.H * 0.9) / (rows + 0.3)))
  return { cell, x: Math.round((v.W - cell * cols) / 2), y: Math.round((v.H - cell * rows) / 2) }
}

export function input(s, ev, v) {
  if (ev.type === 'button') {
    if (ev.down === false) s.held[ev.id] = false
    else if (DIRS[ev.id]) s.held[ev.id] = true
    return
  }
  if (ev.type === 'stick') {
    s.stick = { x: ev.x, y: ev.y }
    return
  }
  if (ev.type !== 'down' || !v) return
  // tap: walk there
  const L = layoutOf(v, s.lv)
  s.target = [(ev.x - L.x) / L.cell, (ev.y - L.y) / L.cell]
}

// ---------------------------------------------------------------- drawing
function torch(ctx, s, g, L) {
  // the beam: rays fanning out, each stopped by the first wall
  const steps = 18
  const a0 = Math.atan2(g.fy, g.fx)
  ctx.save()
  ctx.fillStyle = g.kind === 'don' ? 'rgba(255,120,90,0.28)' : 'rgba(255,236,140,0.32)'
  ctx.beginPath()
  ctx.moveTo(L.x + g.x * L.cell, L.y + g.y * L.cell)
  for (let i = 0; i <= steps; i++) {
    const a = a0 - CONE + (2 * CONE * i) / steps
    let d = 0
    while (d < RANGE && !wall(s.lv, g.x + Math.cos(a) * d, g.y + Math.sin(a) * d)) d += 0.08
    ctx.lineTo(L.x + (g.x + Math.cos(a) * d) * L.cell, L.y + (g.y + Math.sin(a) * d) * L.cell)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// a person from above: shoulders, arms swinging, the head (hair or a cap)
function topDown(ctx, x, y, c, ang, look, walk, kind) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(ang + Math.PI / 2)
  const u = c / 8.5
  const sw = Math.sin(walk) * u * 1.6
  ctx.fillStyle = 'rgba(0,0,0,0.25)' // a shadow on the floor
  ctx.fillRect(-u * 3.2 + u * 0.6, -u * 2.4 + u * 0.8, u * 6.4, u * 4.8)
  rect(ctx, -u * 3.9, -u * 1.5 + sw, u * 1.6, u * 3.2, look.skin || '#5c3a24') // arms
  rect(ctx, u * 2.3, -u * 1.5 - sw, u * 1.6, u * 3.2, look.skin || '#5c3a24')
  if (kind) {
    // the torch, held out in front
    rect(ctx, u * 2.4, -u * 3.4 - sw, u * 1.2, u * 2, '#2a2a2a')
    rect(ctx, u * 2.4, -u * 3.8 - sw, u * 1.2, u * 0.6, '#fff3b0')
  }
  box(ctx, -u * 2.8, -u * 2, u * 5.6, u * 4, look.shirt || '#c0392b', Math.max(1, u / 2)) // shoulders
  rect(ctx, -u * 1.8, -u * 1.8, u * 3.6, u * 3.6, look.skin || '#5c3a24') // head
  rect(ctx, -u * 1.8, -u * 1.8 + u * 0.8, u * 3.6, u * 2.8, kind === 'don' ? '#b3261e' : kind === 'security' ? '#1f2d4a' : look.hair || '#161110') // hair or cap
  if (kind === 'security') rect(ctx, -u * 1.2, -u * 2.6, u * 2.4, u * 1, '#1f2d4a') // the cap's peak
  ctx.restore()
}

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  const lv = s.lv
  const L = layoutOf(v, lv)
  const c = L.cell
  rect(ctx, 0, 0, W, H, '#1a2418')
  // floors: chequered tiles for the paths, grass under the hedges
  for (let y = 0; y < lv.map.length; y++)
    for (let x = 0; x < lv.map[y].length; x++) {
      const ch = lv.map[y][x]
      if (ch === '#') continue
      const X = L.x + x * c
      const Y = L.y + y * c
      rect(ctx, X, Y, c, c, (x + y) % 2 ? '#c9d6a3' : '#d8e2b4')
      rect(ctx, X, Y, c / 2, c / 2, (x + y) % 2 ? '#bfcc98' : '#ccd8a8')
      rect(ctx, X + c / 2, Y + c / 2, c / 2, c / 2, (x + y) % 2 ? '#bfcc98' : '#ccd8a8')
      if (ch === 'S') {
        rect(ctx, X + c * 0.1, Y + c * 0.1, c * 0.8, c * 0.8, '#a0662e') // the hostel's doormat
        rect(ctx, X + c * 0.18, Y + c * 0.18, c * 0.64, c * 0.64, '#c08850')
      }
      if (ch === 'E') {
        // the back gate: iron bars, open just enough
        for (let i = 0; i < 5; i++) rect(ctx, X + c * 0.1 + i * c * 0.18, Y + c * 0.1, c * 0.06, c * 0.8, '#3a3a3a')
        rect(ctx, X + c * 0.1, Y + c * 0.45, c * 0.8, c * 0.06, '#3a3a3a')
        label(ctx, 'GATE', X + c / 2, Y - c * 0.15, { size: Math.max(8, c * 0.24), color: '#ffd23a' })
      }
    }
  // torch beams over the floor
  for (const g of s.guards) torch(ctx, s, g, L)
  // walls: raised blocks, a lighter top and a shadowed front face
  for (let y = 0; y < lv.map.length; y++)
    for (let x = 0; x < lv.map[y].length; x++) {
      if (lv.map[y][x] !== '#') continue
      const X = L.x + x * c
      const Y = L.y + y * c
      rect(ctx, X, Y - c * 0.22, c, c, '#7f97b5')
      rect(ctx, X, Y + c * 0.78, c, c * 0.22, '#4a5d78')
      if (cellAt(lv, x, y + 1) !== '#') rect(ctx, X, Y + c * 0.78, c, c * 0.26, '#3c4e66')
      rect(ctx, X, Y - c * 0.22, c, Math.max(1, P / 2), '#a9bcd4')
    }
  // hedges: round bushes you can hide in
  for (let y = 0; y < lv.map.length; y++)
    for (let x = 0; x < lv.map[y].length; x++) {
      if (lv.map[y][x] !== 'B') continue
      const X = L.x + x * c
      const Y = L.y + y * c
      rect(ctx, X + c * 0.1, Y + c * 0.15, c * 0.8, c * 0.75, '#2e7a3a')
      rect(ctx, X + c * 0.2, Y + c * 0.05, c * 0.6, c * 0.9, '#2e7a3a')
      rect(ctx, X + c * 0.25, Y + c * 0.2, c * 0.25, c * 0.2, '#4caf50')
      rect(ctx, X + c * 0.55, Y + c * 0.5, c * 0.2, c * 0.2, '#4caf50')
    }
  // the guards
  for (const g of s.guards) {
    const gx = L.x + g.x * c
    const gy = L.y + g.y * c
    topDown(ctx, gx, gy, c, Math.atan2(g.fy, g.fx), g.kind === 'don' ? { shirt: '#7a1f1a', skin: '#4e2f1d' } : { shirt: '#2c3e66', skin: '#5c3a24' }, g.wait > 0 ? 0 : s.t * 7 + g.u, g.kind)
  }
  // you (hidden in a hedge: just a shadow)
  const hidden = cellAt(lv, s.pos[0], s.pos[1]) === 'B'
  const px = L.x + s.pos[0] * c
  const py = L.y + s.pos[1] * c
  ctx.save()
  ctx.globalAlpha = hidden ? 0.45 : 1
  // a green ring under you, so you always find yourself
  ctx.strokeStyle = '#3ddc84'
  ctx.lineWidth = Math.max(2, c * 0.06)
  ctx.beginPath()
  ctx.ellipse(px, py, c * 0.42, c * 0.42, 0, 0, Math.PI * 2)
  ctx.stroke()
  topDown(ctx, px, py, c, s.face ?? -Math.PI / 2, lookFor(s.you || 3), s.walkT, null)
  ctx.restore()
  // the hostel's name over its door
  for (let y = 0; y < lv.map.length; y++) {
    const x = lv.map[y].indexOf('S')
    if (x >= 0) label(ctx, 'HOSTEL', L.x + (x + 0.5) * c, L.y + y * c - c * 0.32, { size: Math.max(8, c * 0.22), color: '#ffd23a' })
  }
  // the "?" filling to "!"
  if (s.spot > 0.02 && s.spotBy) {
    const g = s.spotBy
    const full = s.spot >= 0.99
    label(ctx, full ? '!' : '?', L.x + g.x * c, L.y + g.y * c - c * 0.7, { size: c * 0.6, color: full ? '#ff3a3a' : '#ffd23a' })
    rect(ctx, px - c * 0.4, py - c * 0.7, c * 0.8, c * 0.1, '#1a1a1a')
    rect(ctx, px - c * 0.4, py - c * 0.7, c * 0.8 * clamp(s.spot, 0, 1), c * 0.1, '#ff6b4a')
  }
  if (s.target) label(ctx, '×', L.x + s.target[0] * c, L.y + s.target[1] * c, { size: c * 0.4, color: '#1e8449' })
  label(ctx, `${s.lv.name}${hidden ? ' · hidden in the hedge' : ''}`, W / 2, Math.max(10, L.y - c * 0.5), { size: Math.max(11, P * 3.4), color: '#c9d6a3' })
  if (s.msgT > 0) label(ctx, s.msg, W / 2, H - Math.max(12, P * 4), { size: Math.max(12, P * 3.6), alpha: clamp(s.msgT, 0, 1) })
  void t
}

export const hud = (s) => [
  { label: 'LEVEL', value: `${s.level + 1}/${LEVELS.length}` },
  { label: 'TRIES', value: '♥'.repeat(Math.max(0, s.lives)) || '✖', warn: s.lives <= 1 },
]

export const buttons = () => [
  { id: 'left', label: '◀', key: '←', side: 'left', move: true, hold: true },
  { id: 'up', label: '▲', key: '↑', side: 'left', move: true, hold: true },
  { id: 'down', label: '▼', key: '↓', side: 'left', move: true, hold: true },
  { id: 'right', label: '▶', key: '→', side: 'left', move: true, hold: true },
]

export function result(s) {
  return {
    outcome: s.won ? 'won' : 'lost',
    score: s.won ? Math.max(10, 150 + s.lives * 30 - Math.round(s.t)) : s.done * 50,
    headline: s.won ? 'Out of the back gate. The night is yours.' : 'The porter locks the hostel door.',
    line: s.won ? 'Nobody saw a thing. (Tomorrow you will say you slept early.)' : 'Back to bed. Curfew wins tonight.',
  }
}

export default {
  id: 'sneak',
  title: 'Back Gate After Curfew',
  scoreLabel: 'points',
  start: 'Lights out',
  rules: [
    'Get from the HOSTEL to the GATE. Move with the stick, hold the arrows, or tap where to walk.',
    'Security and the Dons walk their rounds with torches. The beam is what they see, and walls block it.',
    'Caught in a beam, a "?" fills up before it turns to "!": get out of the light quickly. Hedges hide you even in the beam.',
    'Walking into a guard always gets you caught. Caught means back to the hostel; three times and you\'re done for the night.',
  ],
  short: 'Stay out of the torch beams. Hedges hide you.',
  stick: true,
  keys: { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' },
  holdIds: ['up', 'down', 'left', 'right'],
  create, step, input, draw, hud, buttons, result,
}
