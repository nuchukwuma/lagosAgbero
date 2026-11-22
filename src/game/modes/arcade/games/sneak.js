// CAMPUS · Back Gate After Curfew. Top-down stealth with takedowns: the Dons'
// boys and campus security guard the way to the back gate after lights-out.
// Tap where you want to go and you walk there (round the crates and walls);
// the stick works too. Each guard walks a round with a torch: the beam is what
// he can see, and crates and walls block it. Get to a guard from outside his
// beam and you take him down (he sleeps till morning, and drops what he took
// from the freshers). Let him see you and a "?" fills, then "!": he comes
// after you, faster than he walks; break his line of sight and he gives up
// after a while. If he catches you, you're marched back to the hostel. Take
// every guard down and the back gate opens. Three levels; three tries; and
// the night runs out at dawn.
// Params: lives (3) · tickMul (guards' pace: higher is slower, 1) · seconds (the night, 240)
// Outcomes: won | lost
import { rect, box, label, clamp } from '../px.js'
import { lookFor } from '../people.js'

// # wall · C crate · . floor · S start (the hostel door) · E the back gate
// guards: their round, as waypoints (they walk between them, there and back)
export const LEVELS = [
  {
    name: 'Hostel Corridor',
    map: ['#########', '#S..#...#', '#.C.#.C.#', '#...C...#', '#.#...#.#', '#.#.C.#.#', '#...#...#', '#.C...C.#', '#...#..E#', '#########'],
    guards: [
      { path: [[5, 3], [7, 3], [7, 6], [5, 6]], kind: 'security' },
      { path: [[3, 8], [3, 7], [5, 7], [5, 5]], kind: 'don' },
    ],
  },
  {
    name: 'The Quad',
    map: ['###########', '#S....#...#', '#.CC..#.C.#', '#.....C...#', '###.#...#.#', '#...#.C.#.#', '#.C.....#.#', '#...#C....#', '#.#.#..CC.#', '#.#...#...#', '#...#...#E#', '###########'],
    guards: [
      { path: [[4, 1], [5, 3], [2, 3]], kind: 'security' },
      { path: [[7, 1], [9, 1], [9, 6]], kind: 'don' },
      { path: [[1, 9], [3, 9], [3, 7], [1, 7]], kind: 'don' },
    ],
  },
  {
    name: 'Behind the Senate',
    map: ['###########', '#S..#.....#', '#.C.#.CC..#', '#...#.....#', '#.###.###.#', '#.........#', '#.CC.#.CC.#', '#....#....#', '##.#####.##', '#....C....#', '#.C.....C.#', '#....#...E#', '###########'],
    guards: [
      { path: [[5, 1], [9, 1], [9, 3], [5, 3]], kind: 'security' },
      { path: [[1, 5], [9, 5]], kind: 'don' },
      { path: [[1, 9], [4, 9], [4, 10], [1, 10]], kind: 'security' },
      { path: [[6, 9], [9, 9], [9, 10], [6, 10]], kind: 'don' },
    ],
  },
]

export const SPEED = 3.1 // you, squares a second
export const PATROL = 1.25 // a guard on his round
export const CHASE = 2.7 // a guard who has seen you (a little slower than you)
export const RANGE = 3.4 // how far a torch reaches (squares)
export const CONE = (36 * Math.PI) / 180 // half the beam's angle
const R = 0.26 // your size (squares)
const SPOT_TIME = 0.35 // seconds in the light before "!"
const GIVE_UP = 3 // seconds without seeing you before a chasing guard goes back to his round
const REACH = 0.6 // close enough to take a guard down (or for him to grab you)
const COIN = 200 // naira a guard drops

export const cellAt = (lv, x, y) => (lv.map[Math.floor(y)] && lv.map[Math.floor(y)][Math.floor(x)]) || '#'
const solid = (lv, x, y) => {
  const c = cellAt(lv, x, y)
  return c === '#' || c === 'C'
}

// ---------------------------------------------------------------- paths
/** Shortest walk between two squares (A*, 8 directions, no corner cutting). Returns square centres. */
export function findPath(lv, from, to) {
  const W = lv.map[0].length
  const k = (x, y) => y * W + x
  const sx = Math.floor(from[0])
  const sy = Math.floor(from[1])
  const tx = Math.floor(to[0])
  const ty = Math.floor(to[1])
  if (solid(lv, tx + 0.5, ty + 0.5)) return null
  const open = [[sx, sy]]
  const g = new Map([[k(sx, sy), 0]])
  const came = new Map()
  const h = (x, y) => Math.hypot(tx - x, ty - y)
  const f = new Map([[k(sx, sy), h(sx, sy)]])
  let guard = 0
  while (open.length && guard++ < 4000) {
    open.sort((a, b) => f.get(k(...a)) - f.get(k(...b)))
    const [x, y] = open.shift()
    if (x === tx && y === ty) {
      const out = [[x + 0.5, y + 0.5]]
      let c = k(x, y)
      while (came.has(c)) {
        c = came.get(c)
        out.unshift([(c % W) + 0.5, Math.floor(c / W) + 0.5])
      }
      out.shift() // where you already are
      return out
    }
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue
        const nx = x + dx
        const ny = y + dy
        if (solid(lv, nx + 0.5, ny + 0.5)) continue
        if (dx && dy && (solid(lv, x + dx + 0.5, y + 0.5) || solid(lv, x + 0.5, y + dy + 0.5))) continue // no cutting corners
        const cost = g.get(k(x, y)) + (dx && dy ? Math.SQRT2 : 1)
        if (cost < (g.get(k(nx, ny)) ?? Infinity)) {
          g.set(k(nx, ny), cost)
          f.set(k(nx, ny), cost + h(nx, ny))
          came.set(k(nx, ny), k(x, y))
          if (!open.some(([ox, oy]) => ox === nx && oy === ny)) open.push([nx, ny])
        }
      }
  }
  return null
}

/** Is there a clear line between two points (no wall or crate)? */
export function clearLine(lv, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0)
  const n = Math.ceil(d / 0.1)
  for (let i = 1; i < n; i++) if (solid(lv, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return false
  return true
}

/** Can this guard see the point? In his beam (range and angle) with nothing in between. */
export function inBeam(lv, g, x, y) {
  if (g.down) return false
  const dx = x - g.x
  const dy = y - g.y
  const d = Math.hypot(dx, dy)
  if (d > RANGE) return false
  if (d < 0.25) return true
  const ang = Math.acos(clamp((dx * g.fx + dy * g.fy) / (d * Math.hypot(g.fx, g.fy)), -1, 1))
  return ang <= CONE && clearLine(lv, g.x, g.y, x, y)
}

// ---------------------------------------------------------------- the game
function startLevel(s, n) {
  const lv = LEVELS[n]
  s.level = n
  s.lv = lv
  for (let y = 0; y < lv.map.length; y++) for (let x = 0; x < lv.map[y].length; x++) if (lv.map[y][x] === 'S') s.pos = [x + 0.5, y + 0.5]
  s.guards = lv.guards.map((g) => {
    const [x, y] = g.path[0]
    return { kind: g.kind, path: g.path.map(([px, py]) => [px + 0.5, py + 0.5]), wp: 1, x: x + 0.5, y: y + 0.5, fx: 1, fy: 0, route: [], state: 'patrol', spot: 0, lostT: 0, lastSeen: null, down: false, walk: 0 }
  })
  s.coins = []
  s.route = []
  s.target = null
  s.caughtT = 0
  s.face = -Math.PI / 2
}

export function create(params = {}) {
  const s = { you: params.you || 3, tickMul: params.tickMul ?? 1, lives: params.lives ?? 3, time: params.seconds ?? 240, takedowns: 0, cash: 0, done: 0, over: false, won: false, msg: 'Take down every guard, then out the back gate.', msgT: 3, held: {}, stick: null, t: 0, walkT: 0, sound: [] }
  startLevel(s, 0)
  return s
}

export const gateOpen = (s) => s.guards.every((g) => g.down)

/** Walk to a spot: the route goes round crates and walls. */
export function walkTo(s, x, y) {
  const r = findPath(s.lv, s.pos, [x, y])
  if (!r) return false
  s.route = r
  s.target = [x, y]
  return true
}

function caught(s, by) {
  s.lives--
  s.sound.push('whistle')
  s.msg = by?.kind === 'don' ? '"Jambite! Wetin you dey find for here?"' : '"Hey! You! Back to your hostel!"'
  s.msgT = 1.8
  if (s.lives <= 0) {
    s.over = true
    return
  }
  startLevel(s, s.level)
  s.caughtT = 1
}

function takedown(s, g) {
  g.down = true
  g.state = 'down'
  s.takedowns++
  s.coins.push({ x: g.x + 0.3, y: g.y + 0.2, got: false })
  s.sound.push('punch')
  s.msg = gateOpen(s) ? 'The last one! The back gate is open: go!' : ['Down. He never saw you.', 'Lights out for this one.', 'Quietly does it.'][s.takedowns % 3]
  s.msgT = 1.6
  if (gateOpen(s)) s.sound.push('correct')
}

function moveBy(s, dx, dy) {
  const [x, y] = s.pos
  const free = (px, py) => !solid(s.lv, px - R, py - R) && !solid(s.lv, px + R, py - R) && !solid(s.lv, px - R, py + R) && !solid(s.lv, px + R, py + R)
  if (dx && free(x + dx, y)) s.pos[0] = x + dx
  if (dy && free(s.pos[0], y + dy)) s.pos[1] = y + dy
}

/** The old one-square step (keys and tests): walk a square that way. */
export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
export function move(s, d) {
  if (s.over || s.caughtT > 0) return
  const [dx, dy] = DIRS[d]
  walkTo(s, s.pos[0] + dx, s.pos[1] + dy)
}

/** A guard walks toward a point along his route (re-planned when needed). */
function guardWalk(s, g, goal, speed, dt) {
  if (!g.route.length || !g.goal || Math.hypot(g.goal[0] - goal[0], g.goal[1] - goal[1]) > 0.6) {
    g.route = findPath(s.lv, [g.x, g.y], goal) || []
    g.goal = goal
  }
  const next = g.route[0]
  if (!next) return true
  const dx = next[0] - g.x
  const dy = next[1] - g.y
  const d = Math.hypot(dx, dy)
  const st = speed * dt
  if (d <= st) {
    g.x = next[0]
    g.y = next[1]
    g.route.shift()
  } else {
    g.x += (dx / d) * st
    g.y += (dy / d) * st
  }
  if (d > 0.01) {
    g.fx += (dx / d - g.fx) * Math.min(1, dt * 10)
    g.fy += (dy / d - g.fy) * Math.min(1, dt * 10)
  }
  g.walk += dt * speed * 6
  return !g.route.length
}

export function step(s, dt) {
  s.t += dt
  s.msgT -= dt
  if (s.over) return
  s.time -= dt
  if (s.time <= 0) {
    s.over = true
    s.msg = 'Dawn. The cleaners are out: back to the hostel.'
    s.msgT = 3
    return
  }
  if (s.caughtT > 0) {
    s.caughtT -= dt
    return
  }
  // you: the stick or held arrows steer directly; otherwise follow the tapped route
  let vx = 0
  let vy = 0
  if (s.stick && Math.hypot(s.stick.x, s.stick.y) > 0.15) {
    vx = s.stick.x
    vy = -s.stick.y
    s.route = []
  } else if (s.held.left || s.held.right || s.held.up || s.held.down) {
    vx = (s.held.right ? 1 : 0) - (s.held.left ? 1 : 0)
    vy = (s.held.down ? 1 : 0) - (s.held.up ? 1 : 0)
    s.route = []
  } else if (s.route.length) {
    const [nx, ny] = s.route[0]
    const dx = nx - s.pos[0]
    const dy = ny - s.pos[1]
    const d = Math.hypot(dx, dy)
    if (d < 0.08) s.route.shift()
    else {
      vx = dx / d
      vy = dy / d
    }
  } else s.target = null
  const mag = Math.hypot(vx, vy)
  if (mag > 1) {
    vx /= mag
    vy /= mag
  }
  if (mag > 0.05) {
    s.face = Math.atan2(vy, vx)
    s.walkT += dt * 8
    moveBy(s, vx * SPEED * dt, vy * SPEED * dt)
  }
  // naira dropped by guards you took down
  for (const c of s.coins)
    if (!c.got && Math.hypot(c.x - s.pos[0], c.y - s.pos[1]) < 0.5) {
      c.got = true
      s.cash += COIN
      s.sound.push('coin')
    }
  // out of the back gate
  if (cellAt(s.lv, s.pos[0], s.pos[1]) === 'E') {
    if (!gateOpen(s)) {
      if (s.msgT < 0) {
        s.msg = 'Locked. Take down every guard first.'
        s.msgT = 1.4
        s.sound.push('bump')
      }
    } else {
      s.done++
      s.sound.push('win')
      if (s.level + 1 >= LEVELS.length) {
        s.won = true
        s.over = true
      } else {
        startLevel(s, s.level + 1)
        s.msg = `Level ${s.level + 1}: ${s.lv.name}`
        s.msgT = 1.8
      }
      return
    }
  }
  // the guards
  const slow = s.tickMul || 1
  for (const g of s.guards) {
    if (g.down) continue
    const sees = inBeam(s.lv, g, s.pos[0], s.pos[1])
    // close enough: a takedown if he can't see you; caught if he's after you and grabs you
    const near = Math.hypot(g.x - s.pos[0], g.y - s.pos[1]) < REACH
    if (near && !sees && g.state !== 'chase') {
      takedown(s, g)
      continue
    }
    if (near && g.state === 'chase') return caught(s, g)
    if (g.state === 'patrol') {
      g.spot = sees ? g.spot + dt / SPOT_TIME : Math.max(0, g.spot - dt * 1.5)
      if (g.spot >= 1) {
        g.state = 'chase'
        g.lastSeen = [...s.pos]
        g.lostT = 0
        g.route = []
        s.sound.push('whistle')
        continue
      }
      const wp = g.path[g.wp]
      if (guardWalk(s, g, wp, PATROL / slow, dt)) g.wp = (g.wp + 1) % g.path.length
    } else if (g.state === 'chase') {
      if (sees) {
        g.lastSeen = [...s.pos]
        g.lostT = 0
      } else g.lostT += dt
      if (g.lostT > GIVE_UP) {
        g.state = 'patrol'
        g.spot = 0
        g.route = []
        continue
      }
      guardWalk(s, g, g.lastSeen, CHASE / slow, dt)
    }
  }
}

export function layoutOf(v, lv) {
  const cols = lv.map[0].length
  const rows = lv.map.length
  const cell = Math.floor(Math.min((v.W * 0.96) / cols, (v.H * 0.94) / rows))
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
  if (ev.type !== 'down' || !v || s.over || s.caughtT > 0) return
  // tap: walk there (round whatever is in the way)
  const L = layoutOf(v, s.lv)
  const x = (ev.x - L.x) / L.cell
  const y = (ev.y - L.y) / L.cell
  if (walkTo(s, x, y)) s.sound.push('click')
}

// ---------------------------------------------------------------- drawing
function torch(ctx, s, g, L) {
  // the beam: rays fanning out, each stopped by the first wall or crate
  const steps = 22
  const a0 = Math.atan2(g.fy, g.fx)
  ctx.save()
  ctx.fillStyle = g.state === 'chase' ? 'rgba(255,70,60,0.3)' : 'rgba(255,255,235,0.22)'
  ctx.beginPath()
  ctx.moveTo(L.x + g.x * L.cell, L.y + g.y * L.cell)
  for (let i = 0; i <= steps; i++) {
    const a = a0 - CONE + (2 * CONE * i) / steps
    let d = 0
    while (d < RANGE && !solid(s.lv, g.x + Math.cos(a) * d, g.y + Math.sin(a) * d)) d += 0.06
    ctx.lineTo(L.x + (g.x + Math.cos(a) * d) * L.cell, L.y + (g.y + Math.sin(a) * d) * L.cell)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// a person from above: a shadow, shoulders, arms swinging, the head (hair or a cap)
function topDown(ctx, x, y, c, ang, look, walk, kind, down = false) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(ang + Math.PI / 2 + (down ? 1.4 : 0))
  const u = c / 8
  ctx.globalAlpha = down ? 0.75 : 1
  const sw = down ? 0 : Math.sin(walk) * u * 1.4
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.fillRect(-u * 3 + u * 0.7, -u * 2.3 + u * 0.9, u * 6, u * 4.6)
  rect(ctx, -u * 3.8, -u * 1.4 + sw, u * 1.5, u * 3, look.skin || '#5c3a24') // arms
  rect(ctx, u * 2.3, -u * 1.4 - sw, u * 1.5, u * 3, look.skin || '#5c3a24')
  if (kind && !down) {
    rect(ctx, u * 2.3, -u * 3.3 - sw, u * 1.2, u * 2, '#2a2a2a') // the torch
    rect(ctx, u * 2.3, -u * 3.7 - sw, u * 1.2, u * 0.6, '#fff3b0')
  }
  box(ctx, -u * 2.8, -u * 2, u * 5.6, u * 4, look.shirt || '#c0392b', Math.max(1, u / 2)) // shoulders
  rect(ctx, -u * 1.8, -u * 1.8, u * 3.6, u * 3.6, look.skin || '#5c3a24') // head
  rect(ctx, -u * 1.8, -u * 1.8 + u * 0.8, u * 3.6, u * 2.8, kind === 'don' ? '#b3261e' : kind === 'security' ? '#1f2d4a' : look.hair || '#161110')
  if (kind === 'security') rect(ctx, -u * 1.2, -u * 2.6, u * 2.4, u, '#1f2d4a')
  ctx.restore()
}

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  const lv = s.lv
  const L = layoutOf(v, lv)
  const c = L.cell
  rect(ctx, 0, 0, W, H, '#2b2f38')
  // the floor: grey tiles
  for (let y = 0; y < lv.map.length; y++)
    for (let x = 0; x < lv.map[y].length; x++) {
      const ch = lv.map[y][x]
      if (ch === '#') continue
      const X = L.x + x * c
      const Y = L.y + y * c
      rect(ctx, X, Y, c, c, (x + y) % 2 ? '#8b8e97' : '#959aa3')
      rect(ctx, X, Y, c, Math.max(1, c * 0.03), '#7e818a')
      if (ch === 'S') {
        rect(ctx, X + c * 0.1, Y + c * 0.1, c * 0.8, c * 0.8, '#a0662e')
        rect(ctx, X + c * 0.18, Y + c * 0.18, c * 0.64, c * 0.64, '#c08850')
      }
      if (ch === 'E') {
        const open = gateOpen(s)
        for (let i = 0; i < 5; i++) rect(ctx, X + c * 0.1 + i * c * 0.18, Y + c * 0.1 + (open ? c * 0.55 : 0), c * 0.06, open ? c * 0.3 : c * 0.8, open ? '#3ddc84' : '#3a3a3a')
        rect(ctx, X + c * 0.1, Y + c * 0.45, c * 0.8, c * 0.06, open ? '#3ddc84' : '#3a3a3a')
      }
    }
  // naira the guards dropped
  for (const co of s.coins) {
    if (co.got) continue
    const bob = Math.sin(t * 5 + co.x) * c * 0.04
    rect(ctx, L.x + co.x * c - c * 0.16, L.y + co.y * c - c * 0.12 + bob, c * 0.32, c * 0.22, '#2ecc71')
    rect(ctx, L.x + co.x * c - c * 0.05, L.y + co.y * c - c * 0.05 + bob, c * 0.1, c * 0.1, '#c8f0d0')
  }
  // torch beams (under the walls and crates, over the floor)
  for (const g of s.guards) if (!g.down) torch(ctx, s, g, L)
  // walls and crates: raised blocks, a lighter top and a shadowed front
  for (let y = 0; y < lv.map.length; y++)
    for (let x = 0; x < lv.map[y].length; x++) {
      const ch = lv.map[y][x]
      const X = L.x + x * c
      const Y = L.y + y * c
      if (ch === '#') {
        rect(ctx, X, Y - c * 0.18, c, c, '#5f6676')
        rect(ctx, X, Y + c * 0.82, c, c * 0.18, '#3e4350')
        rect(ctx, X, Y - c * 0.18, c, Math.max(1, P / 2), '#8890a2')
      } else if (ch === 'C') {
        // a wooden crate
        rect(ctx, X + c * 0.06, Y + c * 0.1, c * 0.88, c * 0.86, '#6b4220')
        rect(ctx, X + c * 0.06, Y - c * 0.02, c * 0.88, c * 0.86, '#b07a3c')
        rect(ctx, X + c * 0.06, Y - c * 0.02, c * 0.88, Math.max(1, c * 0.06), '#d29a58')
        for (let i = 1; i < 4; i++) rect(ctx, X + c * 0.06, Y - c * 0.02 + i * c * 0.21, c * 0.88, Math.max(1, c * 0.03), '#8a5a2b')
        rect(ctx, X + c * 0.08, Y, Math.max(1, c * 0.05), c * 0.82, '#8a5a2b')
        rect(ctx, X + c * 0.87, Y, Math.max(1, c * 0.05), c * 0.82, '#8a5a2b')
      }
    }
  // your route
  if (s.route.length) {
    let px = s.pos[0]
    let py = s.pos[1]
    for (const [nx, ny] of s.route) {
      const steps = Math.max(1, Math.round(Math.hypot(nx - px, ny - py) / 0.3))
      for (let i = 1; i <= steps; i++) rect(ctx, L.x + (px + ((nx - px) * i) / steps) * c - c * 0.04, L.y + (py + ((ny - py) * i) / steps) * c - c * 0.04, c * 0.08, c * 0.08, '#ffd23a')
      px = nx
      py = ny
    }
    if (s.target) label(ctx, '✕', L.x + s.target[0] * c, L.y + s.target[1] * c, { size: c * 0.45, color: '#ffd23a' })
  }
  // the guards (taken-down ones lying on the floor)
  for (const g of s.guards) {
    const gx = L.x + g.x * c
    const gy = L.y + g.y * c
    topDown(ctx, gx, gy, c, Math.atan2(g.fy, g.fx), g.kind === 'don' ? { shirt: '#7a1f1a', skin: '#4e2f1d' } : { shirt: '#2c3e66', skin: '#5c3a24' }, g.walk, g.kind, g.down)
    if (g.down) label(ctx, 'z', gx + c * 0.3, gy - c * 0.35 - ((t * 0.6) % 1) * c * 0.3, { size: c * 0.3, color: '#ffffff', alpha: 0.7 })
    else if (g.state === 'chase') label(ctx, '!', gx, gy - c * 0.7, { size: c * 0.6, color: '#ff3a3a' })
    else if (g.spot > 0.05) label(ctx, '?', gx, gy - c * 0.7, { size: c * 0.55, color: '#ffd23a', alpha: 0.5 + g.spot * 0.5 })
  }
  // you: a green ring so you always find yourself
  const px = L.x + s.pos[0] * c
  const py = L.y + s.pos[1] * c
  ctx.save()
  ctx.strokeStyle = '#3ddc84'
  ctx.lineWidth = Math.max(2, c * 0.06)
  ctx.beginPath()
  ctx.ellipse(px, py, c * 0.42, c * 0.42, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
  topDown(ctx, px, py, c, s.face, lookFor(s.you || 3), s.walkT, null)
  label(ctx, s.lv.name, W / 2, Math.max(10, L.y - c * 0.45), { size: Math.max(11, P * 3.4), color: '#c9d6a3' })
  if (s.msgT > 0) label(ctx, s.msg, W / 2, H - Math.max(12, P * 4), { size: Math.max(12, P * 3.6), alpha: clamp(s.msgT, 0, 1) })
}

export const hud = (s) => [
  { label: 'LEVEL', value: `${s.level + 1}/${LEVELS.length}` },
  { label: 'DAWN', value: `${Math.floor(Math.max(0, s.time) / 60)}:${String(Math.floor(Math.max(0, s.time) % 60)).padStart(2, '0')}`, warn: s.time < 30 },
  { label: 'GUARDS', value: `${s.guards.filter((g) => g.down).length}/${s.guards.length}` },
  { label: '₦', value: s.cash.toLocaleString('en-NG') },
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
    score: s.takedowns * 30 + Math.round(s.cash / 20) + (s.won ? 100 + s.lives * 30 : 0),
    moneyChange: s.cash,
    headline: s.won ? 'Out of the back gate. The night is yours.' : 'The porter locks the hostel door.',
    line: s.won ? `${s.takedowns} guards sleeping till morning, ₦${s.cash.toLocaleString('en-NG')} back from them. (Tomorrow you will say you slept early.)` : `${s.takedowns} guards down before they got you. Back to bed.`,
  }
}

export default {
  id: 'sneak',
  title: 'Back Gate After Curfew',
  scoreLabel: 'points',
  start: 'Lights out',
  rules: [
    'Tap where you want to go: you walk there round the crates and walls. (The stick and arrows work too.)',
    'Each guard\'s torch beam is what he sees; crates and walls block it. Reach a guard from outside his beam and you take him down. He drops naira.',
    'Seen, a "?" fills, then "!": he comes after you (a little slower than you). Get out of his sight and he gives up. If he grabs you, back to the hostel.',
    'Take down every guard and the back gate opens. Three levels; three tries; and you must be out before dawn.',
  ],
  short: 'Tap to move. Takedowns from outside the beam. Clear them all, then the gate.',
  stick: true,
  keys: { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' },
  holdIds: ['up', 'down', 'left', 'right'],
  create, step, input, draw, hud, buttons, result,
}
