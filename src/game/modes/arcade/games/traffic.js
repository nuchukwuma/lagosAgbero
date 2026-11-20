// AREA BOY · Go-Slow. The traffic light at the junction is dead again, so the
// agbero is the traffic light. Tap to switch which road flows: north-south or
// east-west (a short amber while the junction clears). Keep every queue under
// eight cars. When a siren sounds, the convoy's road must flow before it arrives.
// Drawn as an isometric junction with the game's own vehicles (sprites baked
// from the 3D models by scripts/bake-goslow-sprites.cjs): they drive in, queue
// bumper to bumper, pull away when their road flows, and some turn.
// Params: target (cars through, 30) · seconds (60)
// Outcomes: won | lost
import { rng, pickOf, rect, label, clamp } from '../px.js'
import { ASSET_ROOT } from '../../../../assets/assetManifest.js'
import { drawPerson } from '../people.js'
import SPRITES from './goslowSprites.json'

export const DIRS = ['N', 'S', 'E', 'W']
const AXIS = { N: 'NS', S: 'NS', E: 'EW', W: 'EW' }
// gap: seconds the next one waits; m: length in metres; sprite: row in the baked atlas
const KINDS = [
  { k: 'car', gap: 0.55, m: 4.1, sprite: 'car' },
  { k: 'car', gap: 0.55, m: 4.4, sprite: 'taxi' },
  { k: 'car', gap: 0.6, m: 4.6, sprite: 'suv' },
  { k: 'danfo', gap: 0.7, m: 5.7, sprite: 'danfo' },
  { k: 'danfo', gap: 0.7, m: 5.7, sprite: 'danfo' },
  { k: 'molue', gap: 1.0, m: 7, sprite: 'molue' },
  { k: 'okada', gap: 0.3, m: 1.9, sprite: 'okada' },
  { k: 'keke', gap: 0.4, m: 2.6, sprite: 'keke' },
  { k: 'trailer', gap: 1.3, m: 5.2, sprite: 'truck' },
  { k: 'trailer', gap: 1.1, m: 4.7, sprite: 'lorry' },
]
const vehicle = (s) => ({ ...pickOf(s.r, KINDS), u: -70 - s.r() * 10, v: 9, turn: s.r() < 0.3 ? (s.r() < 0.5 ? 'L' : 'R') : null })
export const MAX_QUEUE = 8

export function create(params = {}, seed = 1) {
  const s = { r: rng(seed), maxQueue: params.maxQueue ?? MAX_QUEUE, spawnMul: params.spawnMul ?? 1, time: params.seconds ?? 60, total: params.seconds ?? 60, target: params.target ?? 30, green: 'NS', amber: 0, q: { N: [], S: [], E: [], W: [] }, gapLeft: { N: 0, S: 0, E: 0, W: 0 }, spawn: 0.5, passed: 0, strikes: 0, siren: null, sirenNext: 14, flash: 0, msg: '', msgT: 0, over: false, gridlock: null, moving: [], sound: [] }
  for (const d of DIRS)
    for (let i = 0; i < 2; i++) {
      const veh = vehicle(s)
      veh.u = -8 - i * 7 // already waiting at the start
      s.q[d].push(veh)
    }
  return s
}

export function toggle(s) {
  if (s.amber > 0) return
  s.amber = 0.8
  s.green = s.green === 'NS' ? 'EW' : 'NS'
  s.sound.push('whistle')
}

export function step(s, dt) {
  s.time -= dt
  s.msgT -= dt
  s.flash += dt
  const elapsed = s.total - s.time
  // arrivals: faster as the evening rush builds
  s.spawn -= dt
  if (s.spawn <= 0) {
    const d = pickOf(s.r, DIRS)
    s.q[d].push(vehicle(s))
    s.spawn = (clamp(1.05 - elapsed * 0.012, 0.42, 1.05) * (0.7 + s.r() * 0.6)) / s.spawnMul
  }
  // the green road drains, one vehicle at a time
  if (s.amber > 0) s.amber -= dt
  else
    for (const d of DIRS) {
      if (AXIS[d] !== s.green || !s.q[d].length) continue
      s.gapLeft[d] -= dt
      if (s.gapLeft[d] <= 0) {
        const v = s.q[d].shift()
        s.passed++
        s.gapLeft[d] = v.gap
        s.moving.push({ ...v, d, v: Math.max(v.v, 2) }) // it pulls away across the junction
        if (v.k === 'danfo' && s.r() < 0.2) s.sound.push('horn')
      }
    }
  // the convoy
  s.sirenNext -= dt
  if (!s.siren && s.sirenNext <= 0) {
    s.siren = { from: pickOf(s.r, DIRS), left: 4 }
    s.sound.push('siren')
  }
  if (s.siren) {
    s.siren.left -= dt
    if (AXIS[s.siren.from] === s.green && s.amber <= 0) {
      s.msg = 'Convoy through! Siren gone.'
      s.msgT = 1.5
      s.passed += 3
      for (let i = 0; i < 3; i++) s.moving.push({ k: 'convoy', sprite: 'convoy', m: 4.6, d: s.siren.from, u: -14 - i * 7, v: 15, turn: null, convoy: true })
      s.siren = null
      s.sirenNext = 12 + s.r() * 8
    } else if (s.siren.left <= 0) {
      s.strikes++
      s.msg = '"WHO BLOCKED THE CONVOY?!" (a soldier slaps your cap off)'
      s.msgT = 2
      s.sound.push('wrong')
      s.siren = null
      s.sirenNext = 12 + s.r() * 8
    }
  }
  animate(s, dt)
  for (const d of DIRS)
    if (s.q[d].length >= s.maxQueue) {
      s.gridlock = d
      s.over = true
      s.sound.push('hornLong')
    }
  if (s.time <= 0 || s.strikes >= 3) s.over = true
}

export function input(s, ev) {
  if (ev.type === 'button' && ev.id === 'switch') toggle(s)
  if (ev.type === 'down') toggle(s)
}

// ---------------------------------------------------------------- the moving picture
// World: metres on the ground, the junction at (0, 0). Roads run along z
// (north at -z) and x (east at +x); vehicles drive on the right. A vehicle's
// `u` is how far it has come along its road, 0 at the stop line.
const TRAVEL = { N: [0, 1], S: [0, -1], E: [-1, 0], W: [1, 0] } // where cars from that road head
const STOP = 6.5 // the stop line, metres from the middle
const LANE = 1.75
/** Position and heading for a vehicle from road d at distance u (turning L or R after the stop line). */
export function pathPoint(d, turn, u) {
  const [fx, fz] = TRAVEL[d]
  const [rx, rz] = [-fz, fx] // its right hand (y is up)
  const sx = -fx * STOP + rx * LANE // where it stops: its own lane, at the stop line
  const sz = -fz * STOP + rz * LANE
  if (u <= 0 || !turn) return { x: sx + fx * u, z: sz + fz * u, dx: fx, dz: fz }
  // the turn: a quarter circle to the right (tight) or the left (wide), then straight on
  const sgn = turn === 'R' ? 1 : -1
  const r = turn === 'R' ? STOP - LANE : STOP + LANE
  const cx = sx + rx * r * sgn
  const cz = sz + rz * r * sgn
  const arc = (r * Math.PI) / 2
  const a = (Math.min(u, arc) / r) * sgn
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const turnV = (x, z) => [x * cos - z * sin, x * sin + z * cos]
  const [ox, oz] = turnV(sx - cx, sz - cz)
  const [hx, hz] = turnV(fx, fz)
  const extra = Math.max(0, u - arc)
  return { x: cx + ox + hx * extra, z: cz + oz + hz * extra, dx: hx, dz: hz }
}

/** Queued vehicles roll up to their place in the line; released ones accelerate away. */
function animate(s, dt) {
  for (const d of DIRS) {
    let back = -1 // the front bumper of the first one sits just behind the stop line
    for (const veh of s.q[d]) {
      const target = back - veh.m / 2
      const want = clamp((target - veh.u) * 2.4, 0, 11)
      veh.v += (want - veh.v) * Math.min(1, dt * 5)
      veh.u = Math.min(target, veh.u + veh.v * dt)
      back = Math.min(target, veh.u) - veh.m / 2 - 1.3
    }
  }
  for (const veh of s.moving) {
    veh.v = Math.min(veh.convoy ? 17 : 13, veh.v + dt * (veh.convoy ? 9 : 6))
    veh.u += veh.v * dt
  }
  s.moving = s.moving.filter((veh) => veh.u < 75)
}

// ---------------------------------------------------------------- drawing
let atlas = null
function atlasImage() {
  if (!atlas && typeof Image !== 'undefined') {
    atlas = new Image()
    atlas.src = `${ASSET_ROOT}/goslow/vehicles.png`
  }
  return atlas && atlas.complete && atlas.naturalWidth ? atlas : null
}
const ISO_X = Math.SQRT1_2
const ISO_Y = Math.SQRT1_2 * Math.sin((35 * Math.PI) / 180)
function proj(view, x, z, y = 0) {
  return [view.cx + (x - z) * ISO_X * view.S, view.cy + (x + z) * ISO_Y * view.S - y * Math.cos((35 * Math.PI) / 180) * view.S]
}
function quad(ctx, view, pts, color) {
  ctx.fillStyle = color
  ctx.beginPath()
  pts.forEach(([x, z], i) => {
    const [px, py] = proj(view, x, z)
    if (i) ctx.lineTo(px, py)
    else ctx.moveTo(px, py)
  })
  ctx.closePath()
  ctx.fill()
}
const ROW = Object.fromEntries(SPRITES.rows.map((n, i) => [n, i]))
function drawVehicle(ctx, view, img, veh, d, turn, u) {
  const p = pathPoint(d, turn, u)
  const h = (Math.round(Math.atan2(p.dx, -p.dz) / (Math.PI / 4)) + 8) % 8
  const [sx, sy] = proj(view, p.x, p.z)
  const cell = SPRITES.cell
  const k = view.S / SPRITES.ppm
  const lift = 0.9 * Math.cos((35 * Math.PI) / 180) * SPRITES.ppm // the bake looked at 0.9 m up
  if (img) ctx.drawImage(img, h * cell, ROW[veh.sprite] * cell, cell, cell, sx - (cell / 2) * k, sy - (cell / 2 + lift) * k, cell * k, cell * k)
  else rect(ctx, sx - 4, sy - 4, 8, 8, '#f2c230')
}
// a low-poly block on a corner, like the city kit's
function building(ctx, view, x0, z0, x1, z1, hgt, wall, roof) {
  const c = (x, z, y) => proj(view, x, z, y)
  const poly = (pts, color) => {
    ctx.fillStyle = color
    ctx.beginPath()
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
    ctx.closePath()
    ctx.fill()
  }
  poly([c(x1, z0, 0), c(x1, z1, 0), c(x1, z1, hgt), c(x1, z0, hgt)], wall) // east face
  poly([c(x0, z1, 0), c(x1, z1, 0), c(x1, z1, hgt), c(x0, z1, hgt)], shadeOf(wall, 0.8)) // south face
  poly([c(x0, z0, hgt), c(x1, z0, hgt), c(x1, z1, hgt), c(x0, z1, hgt)], roof)
  // windows on the south face
  ctx.fillStyle = 'rgba(30,40,60,0.55)'
  for (let y = 1.2; y < hgt - 0.6; y += 2.2)
    for (let x = x0 + 1; x < x1 - 0.8; x += 2) {
      const [a, b] = c(x, z1, y)
      ctx.fillRect(a, b - view.S * 0.9, view.S * 0.6, view.S * 0.8)
    }
}
function shadeOf(hex, k) {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${Math.round(((n >> 16) & 255) * k)},${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)})`
}

export function draw(ctx, s, v, t) {
  const { W, H, P } = v
  const R = 21 // metres of road to show from the middle
  const S = Math.min(W / (2 * R * ISO_X * 2) * 1.05, H / (2 * R * ISO_Y * 2) * 1.6)
  const view = { cx: W / 2, cy: H * 0.5, S }
  const img = atlasImage()
  rect(ctx, 0, 0, W, H, '#79a85a')
  const L = 80
  const RD = 4 // half a road's width
  const PV = 6.2 // to the edge of the pavement
  // pavements, then roads on top
  quad(ctx, view, [[-PV, -L], [PV, -L], [PV, L], [-PV, L]], '#c9c2b2')
  quad(ctx, view, [[-L, -PV], [L, -PV], [L, PV], [-L, PV]], '#c9c2b2')
  quad(ctx, view, [[-RD, -L], [RD, -L], [RD, L], [-RD, L]], '#55565e')
  quad(ctx, view, [[-L, -RD], [L, -RD], [L, RD], [-L, RD]], '#55565e')
  // centre dashes, zebra crossings and stop lines on every arm
  for (let a = PV + 2; a < L; a += 4) {
    for (const sg of [-1, 1]) {
      quad(ctx, view, [[-0.12, sg * a], [0.12, sg * a], [0.12, sg * (a + 2)], [-0.12, sg * (a + 2)]], '#e8e2c8')
      quad(ctx, view, [[sg * a, -0.12], [sg * a, 0.12], [sg * (a + 2), 0.12], [sg * (a + 2), -0.12]], '#e8e2c8')
    }
  }
  for (let k = -RD + 0.4; k < RD - 0.3; k += 1) {
    for (const sg of [-1, 1]) {
      quad(ctx, view, [[k, sg * 4.3], [k + 0.55, sg * 4.3], [k + 0.55, sg * 5.9], [k, sg * 5.9]], '#f2efe6')
      quad(ctx, view, [[sg * 4.3, k], [sg * 5.9, k], [sg * 5.9, k + 0.55], [sg * 4.3, k + 0.55]], '#f2efe6')
    }
  }
  // corner blocks behind and beside the junction (the near corner stays open, so the queues show)
  building(ctx, view, -26, -26, -9, -9, 7, '#d8b27a', '#b5523b')
  building(ctx, view, 9, -24, 22, -9, 5, '#9fb7c9', '#5d6f7d')
  building(ctx, view, -24, 9, -9, 22, 4, '#e3d9c4', '#7a8f5a')
  // everyone on the road, back to front
  const all = []
  for (const d of DIRS) for (const veh of s.q[d]) all.push({ veh, d, turn: null, u: veh.u })
  for (const m of s.moving) all.push({ veh: m, d: m.d, turn: m.turn, u: m.u })
  all.sort((a, b) => {
    const pa = pathPoint(a.d, a.turn, a.u)
    const pb = pathPoint(b.d, b.turn, b.u)
    return pa.x + pa.z - (pb.x + pb.z)
  })
  // the warden stands in the middle and goes in the queue order by depth
  let wardenDrawn = false
  const warden = () => {
    const [wx, wy] = proj(view, 0, 0)
    // a white box to stand on, and the whistle pose: facing the road that flows
    quad(ctx, view, [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]], s.amber > 0 ? '#ffd23a' : '#f2efe6')
    drawPerson(ctx, { skin: '#5c3a24', shirt: '#ff8a24', trousers: '#2c3e50', shoes: '#111111', accessories: [{ type: 'cap', color: '#1a1a1a' }] }, wx, wy, Math.max(0.5, S / 24), { pose: s.amber > 0 ? 'cheer' : 'stand', t, facing: s.green === 'NS' ? 1 : -1 })
    wardenDrawn = true
  }
  for (const it of all) {
    const p = pathPoint(it.d, it.turn, it.u)
    if (!wardenDrawn && p.x + p.z > 0) warden()
    drawVehicle(ctx, view, img, it.veh, it.d, it.turn, it.u)
  }
  if (!wardenDrawn) warden()
  // signals: arrows along the road that flows, a count at the mouth of every road
  const go = s.amber > 0 ? null : s.green
  for (const d of DIRS) {
    const [ax, az] = TRAVEL[d]
    const [mx, my] = proj(view, -ax * (STOP + 3) + -az * -LANE * 3.2, -az * (STOP + 3) + ax * -LANE * 3.2)
    const n = s.q[d].length
    const full = n / s.maxQueue
    const flowing = go && AXIS[d] === go
    rect(ctx, mx - P * 6, my - P * 3, P * 12, P * 6, flowing ? '#1e8449' : full > 0.75 ? '#b3261e' : '#1a1a1a')
    label(ctx, `${n}/${s.maxQueue}`, mx, my, { size: Math.max(10, P * 3.2), color: '#fff' })
  }
  label(ctx, s.amber > 0 ? 'WAIT…' : s.green === 'NS' ? '⤢ GO' : '⤡ GO', W / 2, P * 6, { size: Math.max(12, P * 4.4), color: s.amber > 0 ? '#ffd23a' : '#8ff0a4' })
  if (s.siren) {
    const [ax, az] = TRAVEL[s.siren.from]
    const [sx, sy] = proj(view, -ax * 18, -az * 18)
    const on = Math.floor(s.flash * 6) % 2
    rect(ctx, sx - P * 3, sy - P * 3, P * 3, P * 3, on ? '#ff3a3a' : '#3a7aff')
    rect(ctx, sx, sy - P * 3, P * 3, P * 3, on ? '#3a7aff' : '#ff3a3a')
    label(ctx, `CONVOY ${Math.ceil(s.siren.left)}`, W / 2, P * 13, { size: Math.max(12, P * 4.4), color: on ? '#ff4d3a' : '#7fc8ff' })
  }
  if (s.msgT > 0) label(ctx, s.msg, W / 2, H - P * 8, { size: Math.max(12, P * 3.6), alpha: clamp(s.msgT, 0, 1) })
}

export const hud = (s) => [
  { label: 'TIME', value: Math.max(0, Math.ceil(s.time)), warn: s.time < 10 },
  { label: 'THROUGH', value: `${s.passed}/${s.target}` },
  { label: 'CONVOY WAHALA', value: '✖'.repeat(s.strikes) || '–', warn: s.strikes >= 2 },
]
export const buttons = () => [{ id: 'switch', label: 'SWITCH ⇄', color: '#d35400', key: 'Space' }]

export function result(s) {
  const won = !s.gridlock && s.strikes < 3 && s.passed >= s.target
  return {
    outcome: won ? 'won' : 'lost',
    score: s.passed,
    moneyChange: won ? 2000 : 0,
    headline: won ? 'The junction is flowing!' : s.gridlock ? 'GO-SLOW! Total gridlock.' : s.strikes >= 3 ? 'The soldiers have taken over the junction.' : 'Not enough cars got through.',
    line: s.gridlock ? `The ${({ N: 'northern', S: 'southern', E: 'eastern', W: 'western' })[s.gridlock]} road jammed solid. Somebody is already selling gala to the stuck drivers.` : `${s.passed} vehicles through the junction.`,
  }
}

export default {
  id: 'traffic', title: 'Go-Slow', scoreLabel: 'vehicles', start: 'Blow the whistle',
  rules: ['You are the traffic light. Tap anywhere (or SWITCH) to let the other road flow; the junction needs a moment of amber to clear. The count at each road shows how many are waiting.', 'Vehicles pile up on the red roads. If any road backs up to eight, it\'s gridlock and you lose.', 'Trailers are slow, okadas are quick, danfos honk.', 'A siren means a convoy: let its road flow within four seconds, or the soldiers will have words.'],
  short: 'Tap to switch roads. No road over eight. Convoys first.',
  keys: { Space: 'switch', Enter: 'switch' },
  create, step, input, draw, hud, buttons, result,
}
