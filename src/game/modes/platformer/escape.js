// AREA BOY · Escape: the side-scrolling platformer (rules in platformerLogic.js).
// The runner and the Task Force are the prototype character sprites
// (recoloured: you in your own shirt, them in khaki with black berets); the
// cars, danfos and okadas are the retro vehicle sprites. Everything else (the
// street, buildings, awnings, gutters, banners, bottles, bus stops) is drawn
// here in the same chunky pixel style.
// Params: metres (700) · difficulty (1-3) · lives (3) · to (where you're running, "Under the Bridge")
// Outcomes: escaped | caught
import dummyMeta from './dummy.json'
import vehMeta from './vehicles.json'
import { ASSET_ROOT } from '../../../assets/assetManifest.js'
import { rect, box, label, clamp } from '../arcade/px.js'
import { createEscape, stepEscape, press, metresLeft, PX_PER_M, VEHICLE_SCALE, STAND_H, ROLL_TIME } from './platformerLogic.js'
import { drawEris } from '../../characters/eris.js'

// ---------------------------------------------------------------- sprites
const SRC = { light: [201, 212, 253], mid: [138, 161, 246], dark1: [94, 113, 142], dark2: [27, 36, 71], ink: [44, 52, 56] }
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const shade = (c, k) => c.map((v) => clamp(Math.round(v * k), 0, 255))

let atlas = null
function loadImage(src) {
  const img = new Image()
  img.src = src
  return img
}
function images() {
  if (!atlas) atlas = { dummy: loadImage(`${ASSET_ROOT}/platformer/dummy.png`), veh: loadImage(`${ASSET_ROOT}/platformer/vehicles.png`), tinted: new Map() }
  return atlas
}

/** The dummy atlas recoloured: shirt for the near side, trousers for the far side. */
function tinted(shirt, trousers) {
  const a = images()
  const key = `${shirt}|${trousers}`
  if (a.tinted.has(key)) return a.tinted.get(key)
  if (!a.dummy.complete || !a.dummy.naturalWidth) return null
  const c = document.createElement('canvas')
  c.width = a.dummy.naturalWidth
  c.height = a.dummy.naturalHeight
  const g = c.getContext('2d')
  g.drawImage(a.dummy, 0, 0)
  const data = g.getImageData(0, 0, c.width, c.height)
  const s = hex(shirt)
  const tr = hex(trousers)
  const map = [
    [SRC.light, shade(s, 1.25)],
    [SRC.mid, s],
    [SRC.dark1, shade(tr, 1.2)],
    [SRC.dark2, shade(tr, 0.75)],
    [SRC.ink, [26, 20, 16]],
  ]
  const d = data.data
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue
    let best = map[0]
    let bd = Infinity
    for (const m of map) {
      const dd = (d[i] - m[0][0]) ** 2 + (d[i + 1] - m[0][1]) ** 2 + (d[i + 2] - m[0][2]) ** 2
      if (dd < bd) {
        bd = dd
        best = m
      }
    }
    ;[d[i], d[i + 1], d[i + 2]] = best[1]
  }
  g.putImageData(data, 0, 0)
  a.tinted.set(key, c)
  return c
}

function drawFrame(ctx, sheet, anim, f, sx, sy, dir, k, alpha = 1) {
  const A = dummyMeta.anims[anim]
  if (!sheet || !A) return
  const fi = clamp(Math.floor(f), 0, A.frames - 1)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(Math.round(sx), Math.round(sy))
  ctx.scale(dir * k, k)
  ctx.drawImage(sheet, A.x + fi * A.w, A.y, A.w, A.h, -A.ax, -A.ay, A.w, A.h)
  ctx.restore()
}

// ---------------------------------------------------------------- the game object for the arcade host
export function create(params = {}, seed = 1) {
  const s = createEscape(params, seed)
  s.to = params.to || 'Under the Bridge'
  s.look = params.you || {}
  return s
}

export const step = stepEscape

export function input(s, ev) {
  if (ev.type === 'button') press(s, ev.id, ev.down !== false)
  // the analog stick: push a little to creep, all the way to run; push up to jump
  else if (ev.type === 'stick') {
    s.stick = ev.x
    if (ev.y > 0.7 && !s.stickUp) press(s, 'jump')
    if (ev.y < -0.7 && !s.stickDown) press(s, 'roll')
    s.stickUp = ev.y > 0.7
    s.stickDown = ev.y < -0.7
  }
}

function runnerPose(p, t) {
  if (p.dead > 0) return ['knocked', (1 - p.dead / 1.3) * 10]
  if (p.hit > 0) return ['knocked', 1]
  if (p.roll > 0) return ['roll', (1 - p.roll / 0.55) * 8.9]
  if (p.attack > 0) return ['strike', (1 - p.attack / 0.36) * 2.9]
  if (!p.ground) {
    if (p.jumps >= 2 && p.vy < 100) return ['double', clamp((p.vy + 500) / 600, 0, 1) * 10]
    return ['jump', p.vy < -300 ? 3 : p.vy < 0 ? 4 : p.vy < 300 ? 6 : 7]
  }
  if (p.landT > 0) return ['land', (1 - p.landT / 0.18) * 5]
  const v = Math.abs(p.vx)
  if (v > 100) return ['run', (t * 14) % 12]
  if (v > 18) return ['walk', (t * 12) % 12]
  return ['idle', 0]
}

// the same moves on Eris Esra's template: [anim, frame, rotation]
const ERIS_K = STAND_H / 25 // world units per template pixel (the template is 25 pixels tall)
const TASK_FORCE = { skin: '#4e2f1d', shirt: '#b89a52', trousers: '#4a5530', shoes: '#1a1a1a', accessories: [{ type: 'beret', color: '#111111' }] }
function erisRunner(p, t) {
  if (p.dead > 0) return ['idle', 0, -Math.PI / 2 * Math.min(1, (1.3 - p.dead) * 3)]
  if (p.hit > 0) return ['idle', 0, -0.35]
  if (p.roll > 0) return ['jump', 2, (1 - p.roll / ROLL_TIME) * Math.PI * 2]
  if (p.attack > 0) return ['attack', (1 - p.attack / 0.36) * 6.9, 0]
  if (!p.ground) {
    if (p.jumps >= 2 && p.vy < 150) return ['jump', 2, clamp((p.vy + 500) / 650, 0, 1) * Math.PI * 2]
    return ['jump', p.vy < -150 ? 1 : p.vy < 200 ? 2 : 3, 0]
  }
  if (p.landT > 0) return ['jump', 4, 0]
  const v = Math.abs(p.vx)
  if (v > 100) return ['run', t * 12, 0]
  if (v > 18) return ['walk', t * 8, 0]
  return ['idle', t * 4, 0]
}
function erisOfficer(o, t) {
  if (o.state === 'down') return ['idle', 0, -Math.PI / 2 * Math.min(1, o.t * 3)]
  if (o.stun > 0) return ['idle', 0, -0.3]
  if (o.windup > 0) return ['attack', 1, 0]
  if (o.cool > 0.8) return ['attack', 4, 0]
  if (o.state === 'chase' && o.alertT <= 0) return ['run', t * 11 + o.home[0], 0]
  if (o.state === 'chase') return ['idle', 0, 0]
  return ['walk', t * 6 + o.home[0], 0]
}

function officerPose(o, t) {
  if (o.state === 'down') return ['knocked', Math.min(10, o.t * 14)]
  if (o.stun > 0) return ['knocked', 1]
  if (o.windup > 0) return ['strike', 0]
  if (o.cool > 0.8) return ['strike', 2]
  if (o.state === 'chase' && o.alertT <= 0) return ['run', (t * 12 + o.home[0]) % 12]
  if (o.state === 'chase') return ['idle', 0]
  return ['walk', (t * 8 + o.home[0]) % 12]
}

// a cheap hash for deterministic scenery
const h01 = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
const WALLS = ['#d9c7a8', '#c27b56', '#8aa0b4', '#e2d39a', '#b56d6d', '#9fb88a', '#c9b48a']

export function draw(ctx, s, v, t) {
  const { W, H } = v
  const lv = s.level
  const p = s.p
  // zoom: always about 270 world pixels of height on screen, so a double jump and the road both fit
  const k = clamp(Math.round((H / 270) * 4) / 4, 0.5, 4)
  const vw = W / k
  const vh = H / k
  const camX = Math.max(-80, p.x - vw * 0.36)
  // the road sits low on screen; when the runner climbs or jumps, the camera
  // rises (smoothly) so their head always has room above it
  const baseY = vh * 0.8
  const want = Math.min(-baseY, p.y - STAND_H - Math.max(24, vh * 0.2))
  // up at once (never lose the runner's head), back down gently
  s.camY = s.camY == null || want < s.camY ? want : s.camY + (want - s.camY) * 0.08
  const camY = s.camY
  const lift = camY + baseY
  const X = (wx) => (wx - camX) * k
  const Y = (wy) => (wy - camY) * k
  // sky
  rect(ctx, 0, 0, W, H, '#8fd0ff')
  rect(ctx, 0, H * 0.55, W, H * 0.45, '#b8e2ff')
  // far skyline (slow)
  for (const [par, color, minH, maxH, step] of [
    [0.2, '#9fb3c8', 60, 160, 70],
    [0.45, '#7f93a8', 50, 130, 90],
  ]) {
    const off = camX * par
    const i0 = Math.floor(off / step) - 1
    for (let i = i0; i < i0 + vw / step + 3; i++) {
      const bh = minH + h01(i * 3.1 + par) * (maxH - minH)
      const bx = i * step - off
      rect(ctx, bx * k, Y(-bh * 0.9) + (lift * par - lift) * k, (step - 6) * k, (bh + 400) * k, color)
      if (par > 0.3) for (let wy = 10; wy < bh - 10; wy += 16) for (let wx = 8; wx < step - 18; wx += 16) rect(ctx, (bx + wx) * k, Y(-bh * 0.9 + wy) + (lift * par - lift) * k, 4 * k, 6 * k, '#5f7388')
    }
  }
  // the road, the pavement, the gutters
  const roadTop = Y(0)
  rect(ctx, 0, roadTop, W, H - roadTop, '#4b4b52')
  rect(ctx, 0, roadTop, W, 5 * k, '#b9b2a3')
  for (let x = Math.floor(camX / 40) * 40; x < camX + vw + 40; x += 40) rect(ctx, X(x), Y(24), 18 * k, 2 * k, '#e8e2c8')
  // gutters: everywhere there's no ground
  let prev = -1e9
  for (const g of [...lv.ground].sort((a, b) => a.x0 - b.x0)) {
    if (g.x0 > prev && prev > camX - 200 && prev < camX + vw + 200) {
      rect(ctx, X(prev), roadTop, (g.x0 - prev) * k, H - roadTop, '#1d2a1d')
      rect(ctx, X(prev), Y(30), (g.x0 - prev) * k, 6 * k, '#2f4a2a')
      for (let wx = prev + 4; wx < g.x0 - 4; wx += 10) rect(ctx, X(wx), Y(34 + Math.sin(t * 3 + wx) * 1.5), 5 * k, 1 * k, '#5a7a4a')
    }
    prev = Math.max(prev, g.x1)
  }
  const onScreen = (x0, x1) => x1 > camX - 40 && x0 < camX + vw + 40
  // scenery props
  for (const pr of lv.props) {
    if (!onScreen(pr.x - 20, pr.x + 20)) continue
    if (pr.kind === 'post') rect(ctx, X(pr.x), Y(-62), 3 * k, 62 * k, '#5a4024')
    if (pr.kind === 'busStop') {
      const got = s.checkpoint >= pr.x
      rect(ctx, X(pr.x), Y(-80), 3 * k, 80 * k, '#3a3a3a')
      box(ctx, X(pr.x - 16), Y(-96), 36 * k, 16 * k, got ? '#2e9e4f' : '#f2c230', k)
      label(ctx, 'BUS STOP', X(pr.x + 2), Y(-88), { size: 5 * k, color: '#1a1a1a' })
    }
  }
  // buildings and vehicles (solid), awnings (ledges)
  const veh = images().veh
  for (const b of lv.blocks) {
    if (!onScreen(b.x, b.x + b.w)) continue
    if (b.kind === 'building') {
      const c = WALLS[Math.floor(h01(b.x) * WALLS.length)]
      rect(ctx, X(b.x), Y(b.y), b.w * k, (b.h + 1) * k, c)
      rect(ctx, X(b.x - 3), Y(b.y - 4), (b.w + 6) * k, 5 * k, '#5c3b2e') // parapet
      for (let wy = b.y + 22; wy < -26; wy += 30) for (let wx = b.x + 14; wx < b.x + b.w - 20; wx += 32) box(ctx, X(wx), Y(wy), 12 * k, 14 * k, '#3a4a5c', k)
      box(ctx, X(b.x + 10), Y(-34), (b.w - 20) * k, 12 * k, '#fff2a8', k)
      label(ctx, b.sign, X(b.x + b.w / 2), Y(-28), { size: 6 * k, color: '#7a1f2b' })
      rect(ctx, X(b.x + b.w / 2 - 9), Y(-20), 18 * k, 20 * k, '#3a2a20') // door
    } else if (b.kind === 'vehicle') {
      const m = vehMeta.vehicles[b.vehicle]
      const sh = m.h * VEHICLE_SCALE
      if (veh.complete && veh.naturalWidth) {
        ctx.save()
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(veh, m.x, m.y, m.w, m.h, X(b.x), Y(-sh), m.w * VEHICLE_SCALE * k, sh * k)
        ctx.restore()
      } else box(ctx, X(b.x), Y(b.y), b.w * k, b.h * k, '#f2c230', k)
    }
  }
  for (const l of lv.ledges) {
    if (!onScreen(l.x, l.x + l.w)) continue
    rect(ctx, X(l.x + 4), Y(l.y), 3 * k, -l.y * k, '#5a4024')
    rect(ctx, X(l.x + l.w - 7), Y(l.y), 3 * k, -l.y * k, '#5a4024')
    for (let sx = 0; sx < l.w; sx += 12) rect(ctx, X(l.x + sx), Y(l.y - 2), 6 * k, 8 * k, sx % 24 ? '#f4ecd8' : l.color)
    rect(ctx, X(l.x), Y(l.y + 6), l.w * k, 2 * k, '#3a2a20')
  }
  // hazards
  for (const hz of lv.hazards) {
    if (!onScreen(hz.x, hz.x + hz.w)) continue
    if (hz.kind === 'banner') {
      rect(ctx, X(hz.x), Y(hz.y), hz.w * k, 1 * k, '#2a2a2a')
      box(ctx, X(hz.x + 6), Y(hz.y + 1), (hz.w - 12) * k, (hz.h - 2) * k, '#f4ecd8', k)
      label(ctx, 'VOTE OWÓ ŃLÁ', X(hz.x + hz.w / 2), Y(hz.y + hz.h / 2), { size: 5 * k, color: '#b3261e' })
    } else {
      for (let bx = hz.x; bx < hz.x + hz.w; bx += 5) {
        const hh = 3 + h01(bx) * 5
        rect(ctx, X(bx), Y(-hh), 3 * k, hh * k, h01(bx + 1) > 0.5 ? '#2e9e4f' : '#8a5a2b')
      }
    }
  }
  // the naira notes
  for (const n of lv.notes) {
    if (n.got || !onScreen(n.x, n.x)) continue
    const bob = Math.sin(t * 4 + n.x) * 2
    box(ctx, X(n.x - 5), Y(n.y - 3 + bob), 10 * k, 6 * k, '#4caf50', Math.max(1, k / 2))
    rect(ctx, X(n.x - 1), Y(n.y - 1 + bob), 2 * k, 2 * k, '#c8e6c9')
  }
  // the goal: the bridge
  if (onScreen(lv.goal - 60, lv.goal + 200)) {
    rect(ctx, X(lv.goal + 30), Y(-220), 30 * k, 220 * k, '#8a8f99')
    rect(ctx, X(lv.goal - 40), Y(-230), 400 * k, 18 * k, '#9a9fa8')
    box(ctx, X(lv.goal - 70), Y(-120), 110 * k, 26 * k, '#2e9e4f', k)
    label(ctx, s.to.toUpperCase(), X(lv.goal - 15), Y(-107), { size: 7 * k })
  }
  // the Task Force
  const tf = tinted('#b89a52', '#4a5530')
  for (const o of lv.officers) {
    if (!onScreen(o.x - 30, o.x + 30)) continue
    const [ea, ef, er] = erisOfficer(o, t)
    if (!drawEris(ctx, TASK_FORCE, ea, ef, X(o.x), Y(o.y), ERIS_K * k, { dir: o.dir, rotate: er * o.dir })) {
      const [anim, f] = officerPose(o, t)
      drawFrame(ctx, tf, anim, f, X(o.x), Y(o.y), o.dir, k)
      rect(ctx, X(o.x - 5), Y(o.y - STAND_H - 6), 11 * k, 4 * k, '#111')
    }
    if (o.state !== 'down') {
      // the baton
      const up = o.windup > 0
      rect(ctx, X(o.x + o.dir * (up ? 6 : 12)), Y(o.y - (up ? 66 : 34)), 3 * k, (up ? 18 : 14) * k, '#1a1a1a')
    }
    if (o.state === 'chase' && o.alertT > 0) label(ctx, '!', X(o.x), Y(o.y - STAND_H - 18), { size: 14 * k, color: '#ff3a3a' })
    else if (o.state === 'patrol' && o.seenT > 0.05) label(ctx, '?', X(o.x), Y(o.y - STAND_H - 16), { size: 11 * k, color: '#ffd23a' })
    else if (o.stun > 0) label(ctx, '✶', X(o.x), Y(o.y - STAND_H - 12), { size: 9 * k, color: '#ffd23a' })
  }
  // you
  const you = tinted(s.look?.shirt || '#2f8f83', s.look?.trousers || '#2c3e50')
  const blink = p.invul > 0 && p.dead <= 0 && Math.floor(t * 12) % 2 ? 0.35 : 1
  const [ea, ef, er] = erisRunner(p, t)
  if (!drawEris(ctx, s.look, ea, ef, X(p.x), Y(p.y), ERIS_K * k, { dir: p.dir, rotate: er * p.dir, alpha: blink })) {
    const [anim, f] = runnerPose(p, t)
    drawFrame(ctx, you, anim, f, X(p.x), Y(p.y), p.dir, k, blink)
    if (!you) box(ctx, X(p.x - 8), Y(p.y - STAND_H), 16 * k, STAND_H * k, '#2f8f83', k)
  }
  // what each officer down paid, rising off him
  for (const q of s.pops) label(ctx, q.text, X(q.x), Y(q.y - q.t * 30), { size: Math.max(11, 5 * k), color: '#8ff0a4', alpha: clamp(1.2 - q.t, 0, 1), weight: 800 })
  // the messages
  if (s.msgT > 0) label(ctx, s.msg, W / 2, Math.max(16, H * 0.12), { size: Math.max(12, 5 * k), alpha: clamp(s.msgT, 0, 1) })
  // the distance bar along the top
  const prog = clamp(p.x / lv.goal, 0, 1)
  rect(ctx, W * 0.2, 6, W * 0.6, 5, '#1a1a1a')
  rect(ctx, W * 0.2, 6, W * 0.6 * prog, 5, '#ffd23a')
  for (const c of lv.checkpoints) rect(ctx, W * 0.2 + W * 0.6 * (c / lv.goal) - 1, 4, 3, 9, c <= s.checkpoint ? '#2e9e4f' : '#ffffff')
}

export const hud = (s) => [
  { label: s.to.toUpperCase(), value: `${metresLeft(s)} m` },
  { label: 'HEALTH', value: '♥'.repeat(Math.max(0, s.p.hp)) || '✖', warn: s.p.hp <= 2 },
  { label: 'LIVES', value: s.lives, warn: s.lives <= 1 },
  { label: '₦', value: earned(s).toLocaleString('en-NG') },
  ...(s.downed ? [{ label: 'DOWN', value: s.downed }] : []),
]

/** Notes picked up plus the bounty for every officer down. */
export const earned = (s) => Math.round(s.notes * 100 * s.rewardMul) + s.bounty

export const buttons = (s) => [
  { id: 'left', label: '◀', hold: true, side: 'left', big: true, key: 'A', move: true },
  { id: 'right', label: '▶', hold: true, side: 'left', big: true, key: 'D', move: true },
  { id: 'creep', label: 'CREEP', hold: true, side: 'left', key: '⇧', color: s?.held?.creep ? '#2e6b3a' : '#3a3a4a', move: true },
  { id: 'roll', label: 'ROLL', color: '#5a4a8a', key: 'S' },
  { id: 'hit', label: 'HIT', color: '#b3261e', key: 'J' },
  { id: 'jump', label: 'JUMP', color: '#1e8449', big: true, key: 'W' },
]

export function result(s) {
  const reached = Math.round(s.p.x / PX_PER_M)
  return {
    outcome: s.escaped ? 'escaped' : 'caught',
    score: reached + s.notes * 5 + s.downed * 10 + (s.escaped && s.seen === 0 ? 100 : 0),
    moneyChange: earned(s),
    headline: s.escaped ? (s.seen === 0 ? `${s.to}, and not one of them saw you!` : `You made it to ${s.to}!`) : 'Caught. The Task Force van door slams.',
    line: `${s.escaped ? '' : `You got ${reached} m of ${Math.round(s.level.goal / PX_PER_M)} m. `}${s.downed} officer${s.downed === 1 ? '' : 's'} down${s.sneaks ? ` (${s.sneaks} from behind)` : ''} · spotted ${s.seen} time${s.seen === 1 ? '' : 's'} · ₦${earned(s).toLocaleString('en-NG')} earned.`,
  }
}

export default {
  id: 'escape', title: (p) => `Escape to ${p.to || 'Under the Bridge'}`, scoreLabel: 'points', start: 'Run!',
  rules: [
    'Move with the stick (a little push creeps, a full push runs) or ◀ ▶ (hold CREEP or Shift to sneak). JUMP, and again in the air to go higher; ROLL under banners and past batons; HIT to strike.',
    'Cars, danfos, awnings and rooftops are platforms. Open gutters are deadly; broken bottles and banners hurt.',
    'The Task Force sees what\'s in front of them, and sees a running man from further away than a creeping one. Once one spots you he whistles, the others nearby come too, and they all rush you faster than you can run: get up where they can\'t climb, roll past, or fight.',
    'Creep up behind an officer who hasn\'t seen you and HIT: he goes down in one blow (a sneak takedown). Otherwise it takes three hits, or land on his head.',
    'Every officer down pays: ₦250 in a fight, ₦300 for a stomp, ₦400 from behind. Watch an ad at the end to double it, or two to triple it.',
    'Lose all your health or fall in a gutter and you start again from the last bus stop.',
  ],
  short: 'Move, jump, roll, hit. Over their heads is safest.',
  stick: true,
  scalesReward: true, // the bounty and the notes already use params.rewardMul
  keys: { ShiftLeft: 'creep', ShiftRight: 'creep', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ArrowDown: 'roll', KeyS: 'roll', KeyJ: 'hit', KeyK: 'hit', KeyF: 'hit' },
  holdIds: ['left', 'right', 'creep'],
  winOutcome: 'escaped',
  create, step, input, draw, hud, buttons, result,
}
