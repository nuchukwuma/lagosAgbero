// A 2D fighter, drawn with the canvas: a jointed figure (hips, torso, head,
// two arms, two legs) in the style of a classic side-on fighting game. It's
// built from the character's own look: skin tone, hair, clothes, shoes, hats,
// glasses... Every part has a dark outline and two-tone ("cel") shading, and
// the face has eyes, brows, nose and mouth that change with the moment
// (gritted teeth, a shout, eyes squeezed shut when hit, crosses at a K.O.).
//
// Everything is drawn in metres with y pointing up, facing right; the caller
// sets up the canvas transform (Fight2D.jsx), so it stays sharp at any
// resolution. Poses say where the hips, fists and feet go; the elbows and
// knees are worked out (two-bone IK), so feet stay planted.

import { normalizeLook } from '../../../characters/look.js'

// ---- body sizes (metres, an adult about 1.8 m tall) ----
const B = {
  thigh: 0.44,
  shin: 0.44,
  ankle: 0.07,
  foot: 0.23,
  torso: 0.5,
  neck: 0.075,
  upper: 0.29,
  fore: 0.27,
  fist: 0.058,
  line: 0.016, // outline width
}

// ---- colours ----
function rgb(hex) {
  const h = String(hex || '#777').replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16) || 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const css = ([r, g, b]) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
// shadow tones lean a little cool and purple, like painted cel shading
const dark = (c, k = 0.68) => css([c[0] * k * 0.96, c[1] * k * 0.95, c[2] * k + 10 * (1 - k)])
const light = (c, k = 0.22) => css([c[0] + (255 - c[0]) * k, c[1] + (255 - c[1]) * k, c[2] + (255 - c[2]) * k])
const OUTLINE = '#1a0f0b'

// what each body from the pack wears on its head and arms (the 3D models show it)
const BODY_STYLE = {
  mini_male_a: { hair: 'fade' },
  mini_male_b: { hair: 'bald', beard: true },
  mini_male_c: { hair: 'afro' },
  mini_male_d: { hair: 'short', sleeves: 'long', jacket: true },
  mini_male_e: { hair: 'short', beard: true },
  mini_male_f: { hair: 'curly' },
  mini_male_g: { hair: 'bald', beard: true, grey: true },
  mini_worker: { hair: 'short', hat: 'hardhat' },
  mini_soldier: { hair: 'short', sleeves: 'long', hat: 'beret' },
  mini_raider: { hair: 'dreads' },
  mini_female_a: { hair: 'puffs', female: true },
  mini_female_b: { hair: 'bun', headband: true, female: true },
  mini_female_c: { hair: 'bob', hat: 'cap', female: true },
  mini_female_d: { hair: 'bun', sleeves: 'long', jacket: true, female: true },
  mini_female_e: { hair: 'long', sleeves: 'long', jacket: true, female: true },
  mini_female_f: { hair: 'long', female: true },
}

/** Everything the drawing needs from a look, worked out once per fight. */
export function makeFighter(lookInput) {
  const look = normalizeLook(lookInput)
  const style = BODY_STYLE[look.body] || BODY_STYLE.mini_male_f
  const acc = Object.fromEntries((look.accessories || []).map((a) => [a.type, a]))
  const skin = rgb(look.skin)
  const shirt = rgb(look.shirt)
  const shirt2 = look.shirt2 ? rgb(look.shirt2) : null
  const pants = rgb(look.trousers)
  const shoes = rgb(look.shoes)
  const hair = style.grey ? rgb('#c9c4bc') : rgb(look.hair || '#161110')
  const hat = acc.cap ? 'cap' : acc.beanie ? 'beanie' : acc.fila ? 'fila' : acc.gele ? 'gele' : acc.bandana ? 'bandana' : style.hat || null
  const hatColor = rgb((acc.cap || acc.beanie || acc.fila || acc.gele || acc.bandana)?.color || (style.hat === 'hardhat' ? '#f2b705' : style.hat === 'beret' ? '#3d4b2a' : '#c0392b'))
  return {
    look,
    style,
    female: Boolean(style.female),
    w: Math.max(0.85, Math.min(1.25, look.width || 1)), // build
    h: Math.max(0.9, Math.min(1.1, look.height || 1)),
    c: {
      skin: css(skin),
      skinD: dark(skin, 0.72),
      skinB: dark(skin, 0.86), // far limbs: a touch darker, for depth
      skinL: light(skin, 0.16),
      shirt: css(shirt),
      shirtD: dark(shirt),
      shirtB: dark(shirt, 0.84),
      shirtL: light(shirt, 0.2),
      trim: shirt2 ? css(shirt2) : dark(shirt, 0.55),
      jacket: shirt2 ? css(shirt2) : null,
      jacketD: shirt2 ? dark(shirt2) : null,
      pants: css(pants),
      pantsD: dark(pants),
      pantsB: dark(pants, 0.84),
      shoe: css(shoes),
      shoeD: dark(shoes, 0.6),
      hair: css(hair),
      hairD: dark(hair, 0.6),
      hairL: light(hair, 0.18),
      hat: css(hatColor),
      hatD: dark(hatColor),
      lip: dark(skin, 0.55),
    },
    hat,
    glasses: Boolean(acc.glasses),
    chain: acc.chain ? css(rgb(acc.chain.color || '#d4af37')) : null,
    band: acc.wristband ? css(rgb(acc.wristband.color || '#e0b400')) : null,
  }
}

// ---- poses ----
// hip: [x, y] pelvis · lean: torso forward lean · head: head tilt (+ = chin
// down) · fF/fB: front/back fist, from that shoulder · footF/footB: [x, y]
// ankle-to-ground targets · rot: whole body turn about the hips (+ = falling
// back) · turn: 1 facing, -1 back turned (the spin) · face: eyes/mouth
export const POSES = {
  stance: { hip: [0, 0.84], lean: 0.14, head: -0.1, fF: [0.24, 0.1], fB: [0.13, 0.03], footF: [0.3, 0], footB: [-0.3, 0], rot: 0, turn: 1, eyes: 'open', mouth: 'shut' },
  jabLoad: { hip: [-0.04, 0.82], lean: 0.06, head: -0.06, fF: [0.1, 0.06], fB: [0.12, 0.04], footF: [0.3, 0], footB: [-0.32, 0], rot: 0, turn: 1, eyes: 'open', mouth: 'grit' },
  jab: { dx: 0.32, hip: [0.16, 0.81], lean: 0.34, head: -0.12, fF: [0.64, 0.06], fB: [0.06, 0.02], footF: [0.46, 0], footB: [-0.28, 0], rot: 0, turn: 1, eyes: 'open', mouth: 'shout' },
  kickLoad: { dx: 0.15, hip: [-0.06, 0.88], lean: -0.08, head: -0.04, fF: [0.2, 0.12], fB: [0.1, 0.05], footF: [0.24, 0.56], footB: [-0.1, 0], rot: 0, turn: 1, eyes: 'open', mouth: 'grit' },
  kick: { dx: 0.5, hip: [-0.02, 0.93], lean: -0.44, head: 0.18, fF: [0.06, -0.08], fB: [-0.24, -0.12], footF: [1.06, 0.82], footB: [-0.12, 0], rot: 0, turn: 1, eyes: 'open', mouth: 'shout' },
  spinLoad: { dx: 0.1, hip: [-0.08, 0.74], lean: 0.32, head: 0.05, fF: [0.12, 0.0], fB: [0.12, -0.04], footF: [0.34, 0], footB: [-0.3, 0], rot: 0, turn: 1, eyes: 'open', mouth: 'grit' },
  spin: { dx: 0.55, hip: [0.05, 1.0], lean: -0.62, head: 0.25, fF: [0.0, -0.12], fB: [-0.3, 0.05], footF: [1.02, 1.12], footB: [-0.08, 0.1], rot: 0, turn: 1, eyes: 'open', mouth: 'shout' },
  block: { hip: [-0.05, 0.8], lean: -0.04, head: 0.14, fF: [0.16, 0.22], fB: [0.21, 0.11], footF: [0.28, 0], footB: [-0.34, 0], rot: 0, turn: 1, eyes: 'open', mouth: 'grit' },
  dodge: { hip: [-0.32, 0.7], lean: -0.46, head: -0.15, fF: [0.2, 0.14], fB: [0.1, 0.08], footF: [0.22, 0], footB: [-0.46, 0], rot: 0, turn: 1, eyes: 'open', mouth: 'shut' },
  hit: { hip: [-0.15, 0.8], lean: -0.48, head: -0.55, fF: [0.26, 0.26], fB: [-0.26, -0.04], footF: [0.24, 0], footB: [-0.4, 0], rot: 0, turn: 1, eyes: 'shut', mouth: 'open' },
  fall: { hip: [-0.45, 0.45], lean: -0.6, head: -0.6, fF: [0.3, 0.3], fB: [-0.1, 0.3], footF: [0.5, 0.25], footB: [0.1, 0.1], rot: 0.7, turn: 1, eyes: 'x', mouth: 'open' },
  down: { hip: [-0.62, 0.15], lean: 0, head: -0.25, fF: [0.18, -0.25], fB: [-0.12, -0.3], footF: [0.18, -0.86], footB: [-0.02, -0.86], rot: 1.5, turn: 1, eyes: 'x', mouth: 'open', lying: true },
  win: { hip: [0, 0.92], lean: -0.04, head: -0.18, fF: [0.16, -0.3], fB: [0.04, 0.6], footF: [0.24, 0], footB: [-0.26, 0], rot: 0, turn: 1, eyes: 'open', mouth: 'grin' },
}

const lerp = (a, b, t) => a + (b - a) * t
const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
const ease = (t) => t * t * (3 - 2 * t)
/** A pose part-way between two others. */
export function mix(a, b, t) {
  t = Math.max(0, Math.min(1, t))
  return {
    hip: lerp2(a.hip, b.hip, t),
    lean: lerp(a.lean, b.lean, t),
    head: lerp(a.head, b.head, t),
    fF: lerp2(a.fF, b.fF, t),
    fB: lerp2(a.fB, b.fB, t),
    footF: lerp2(a.footF, b.footF, t),
    footB: lerp2(a.footB, b.footB, t),
    rot: lerp(a.rot, b.rot, t),
    turn: lerp(a.turn, b.turn, t),
    dx: lerp(a.dx || 0, b.dx || 0, t),
    eyes: t < 0.5 ? a.eyes : b.eyes,
    mouth: t < 0.5 ? a.mouth : b.mouth,
    lying: t < 0.5 ? a.lying : b.lying,
  }
}

/**
 * The pose for this moment, from the fight's state (fightLogic.js).
 * f: fighter · over: 'won'|'lost'|null · winner: is this the winner ·
 * t: seconds of the fight (idle bob, walk cycle) · overT: seconds since the end
 */
export function poseFor(f, MOVES, { over, winner, t, overT, stunMax }) {
  const P = POSES
  if (over) {
    if (winner) {
      const p = mix(P.stance, P.win, overT / 0.35)
      p.hip = [p.hip[0], p.hip[1] + Math.abs(Math.sin(overT * 7)) * 0.05 * Math.min(1, overT)]
      return p
    }
    if (overT < 0.3) return mix(P.hit, P.fall, overT / 0.3)
    const land = Math.min(1, (overT - 0.3) / 0.22)
    const p = mix(P.fall, P.down, ease(land))
    if (land >= 1) p.hip = [p.hip[0], p.hip[1] + Math.max(0, Math.sin((overT - 0.52) * 14) * 0.05 * Math.exp(-(overT - 0.52) * 6))] // a little bounce
    return p
  }
  if (f.stunT > 0) return mix(P.stance, P.hit, Math.min(1, (f.stunT / stunMax) * 1.6))
  if (f.action) {
    const m = MOVES[f.action.type]
    const a = f.action.t
    const [load, strike] = f.action.type === 'kick' ? [P.kickLoad, P.kick] : f.action.type === 'special' ? [P.spinLoad, P.spin] : [P.jabLoad, P.jab]
    let p
    if (a < m.startup * 0.55) p = mix(P.stance, load, ease(a / (m.startup * 0.55)))
    else if (a < m.startup) p = mix(load, strike, ease((a - m.startup * 0.55) / (m.startup * 0.45)))
    else if (a < m.startup + m.active) p = mix(strike, strike, 0)
    else p = mix(strike, P.stance, ease((a - m.startup - m.active) / m.recover))
    if (f.action.type === 'special' && a < m.startup) {
      // the spin: the body turns its back for an instant before the heel comes round
      const k = Math.max(0, (a - m.startup * 0.35) / (m.startup * 0.65))
      p.turn = Math.cos(Math.min(1, k) * Math.PI * 2)
    }
    return p
  }
  if (f.dodgeT > 0) return mix(P.stance, P.dodge, 1)
  if (f.blocking) return mix(P.stance, P.block, 1)
  const p = mix(P.stance, P.stance, 0)
  if (f.moving) {
    // shuffle step: feet slide in turn, hips bob
    const ph = t * 11
    p.footF = [0.3 + Math.sin(ph) * 0.11, Math.max(0, Math.cos(ph)) * 0.07]
    p.footB = [-0.3 + Math.sin(ph + Math.PI) * 0.11, Math.max(0, Math.cos(ph + Math.PI)) * 0.07]
    p.hip = [p.hip[0], p.hip[1] - Math.abs(Math.sin(ph)) * 0.03]
  } else {
    // the fighting-game bounce: knees flex, fists ride with it
    const b = Math.sin(t * 6.2)
    p.hip = [p.hip[0], p.hip[1] - 0.025 + b * 0.022]
    p.fF = [p.fF[0], p.fF[1] + b * 0.012]
    p.fB = [p.fB[0], p.fB[1] + b * 0.01]
  }
  return p
}

// ---- skeleton ----
/** Two-bone IK: from root r towards target t with bone lengths a, b; bend +1 = the joint goes counter-clockwise of r→t. */
function ik(r, t, a, b, bend) {
  let dx = t[0] - r[0]
  let dy = t[1] - r[1]
  let d = Math.hypot(dx, dy) || 1e-4
  const reach = a + b - 1e-4
  if (d > reach) {
    dx *= reach / d
    dy *= reach / d
    d = reach
  }
  d = Math.max(d, Math.abs(a - b) + 1e-3)
  const base = Math.atan2(dy, dx)
  const cos = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d)))
  const ang = base + bend * Math.acos(cos)
  const j = [r[0] + Math.cos(ang) * a, r[1] + Math.sin(ang) * a]
  const e = [r[0] + dx, r[1] + dy]
  return [j, e]
}

function skeleton(pose, fx) {
  const h = fx.h
  const L = (v) => v * h
  const hip = [pose.hip[0], pose.hip[1] * h]
  const ax = Math.sin(pose.lean)
  const ay = Math.cos(pose.lean)
  const sh = [hip[0] + ax * L(B.torso), hip[1] + ay * L(B.torso)]
  const neck = [sh[0] + ax * L(B.neck) * 0.6, sh[1] + ay * L(B.neck) * 0.6]
  const hl = pose.lean - pose.head
  const headC = [neck[0] + Math.sin(hl) * L(0.13), neck[1] + Math.cos(hl) * L(0.13)]
  const shB = [sh[0] - 0.05, sh[1] - 0.01]
  const shF = [sh[0] + 0.015, sh[1] - 0.015]
  const arm = (s, f) => ik(s, [s[0] + f[0] * h, s[1] + f[1] * h], L(B.upper), L(B.fore), -1)
  const [elbB, fistB] = arm(shB, pose.fB)
  const [elbF, fistF] = arm(shF, pose.fF)
  const hipB = [hip[0] - 0.04, hip[1] - 0.02]
  const hipF = [hip[0] + 0.03, hip[1] - 0.02]
  const leg = (hp, ft) => ik(hp, [ft[0], ft[1] + L(B.ankle)], L(B.thigh), L(B.shin), 1)
  const [kneeB, ankB] = leg(hipB, pose.footB)
  const [kneeF, ankF] = leg(hipF, pose.footF)
  return { hip, sh, neck, headC, headAng: hl, lean: pose.lean, shB, shF, elbB, fistB, elbF, fistF, hipB, hipF, kneeB, ankB, kneeF, ankF }
}

// ---- drawing helpers (y up, metres) ----
function capsule(ctx, a, b, ra, rb) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
  ctx.moveTo(a[0] + Math.cos(ang + Math.PI / 2) * ra, a[1] + Math.sin(ang + Math.PI / 2) * ra)
  ctx.arc(a[0], a[1], ra, ang + Math.PI / 2, ang + Math.PI * 1.5)
  ctx.arc(b[0], b[1], rb, ang - Math.PI / 2, ang + Math.PI / 2)
  ctx.closePath()
}

/** A limb (list of segments) with one outline round the whole thing, then shaded fills. */
function limb(ctx, segs, fill, shade, light = null) {
  ctx.beginPath()
  for (const [a, b, ra, rb] of segs) capsule(ctx, a, b, ra + B.line, rb + B.line)
  ctx.fillStyle = OUTLINE
  ctx.fill()
  ctx.beginPath()
  for (const [a, b, ra, rb] of segs) capsule(ctx, a, b, ra, rb)
  ctx.fillStyle = shade
  ctx.fill()
  // the lit side: the same shape, a little smaller, pushed towards the light (up and forward)
  ctx.beginPath()
  for (const [a, b, ra, rb] of segs) capsule(ctx, [a[0] + ra * 0.22, a[1] + ra * 0.3], [b[0] + rb * 0.22, b[1] + rb * 0.3], ra * 0.78, rb * 0.78)
  ctx.fillStyle = fill
  ctx.fill()
  if (light) {
    ctx.beginPath()
    for (const [a, b, ra, rb] of segs) capsule(ctx, [a[0] + ra * 0.45, a[1] + ra * 0.5], [b[0] + rb * 0.45, b[1] + rb * 0.5], ra * 0.28, rb * 0.28)
    ctx.fillStyle = light
    ctx.fill()
  }
}

const along = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

function shoe(ctx, ank, knee, fx, back, grounded) {
  // flat on the ground when standing; pointed along the shin when kicking
  const shinAng = Math.atan2(ank[1] - knee[1], ank[0] - knee[0])
  const ang = grounded ? 0 : shinAng + Math.PI / 2 - 0.25
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  const P = (x, y) => [ank[0] + x * c - y * s, ank[1] + x * s + y * c]
  const pts = [P(-0.07, 0.03), P(-0.075, -0.055), P(0.2, -0.065), P(0.215, -0.02), P(0.12, 0.035), P(0.02, 0.05)]
  const path = () => {
    ctx.beginPath()
    ctx.moveTo(...pts[0])
    ctx.lineTo(...pts[1])
    ctx.lineTo(...pts[2])
    ctx.quadraticCurveTo(...P(0.235, -0.06), ...pts[3])
    ctx.quadraticCurveTo(...P(0.2, 0.03), ...pts[4])
    ctx.lineTo(...pts[5])
    ctx.closePath()
  }
  path()
  ctx.lineWidth = B.line * 2
  ctx.strokeStyle = OUTLINE
  ctx.stroke()
  ctx.fillStyle = back ? fx.c.shoeD : fx.c.shoe
  ctx.fill()
  // sole
  ctx.beginPath()
  ctx.moveTo(...P(-0.072, -0.04))
  ctx.lineTo(...P(0.205, -0.05))
  ctx.lineWidth = 0.022
  ctx.strokeStyle = back ? '#9a948a' : '#e9e3d6'
  ctx.stroke()
}

function fist(ctx, p, elb, r, fx, back) {
  ctx.beginPath()
  ctx.arc(p[0], p[1], r + B.line, 0, Math.PI * 2)
  ctx.fillStyle = OUTLINE
  ctx.fill()
  ctx.beginPath()
  ctx.arc(p[0], p[1], r, 0, Math.PI * 2)
  ctx.fillStyle = back ? fx.c.skinB : fx.c.skin
  ctx.fill()
  // knuckles: two little creases facing away from the elbow
  const ang = Math.atan2(p[1] - elb[1], p[0] - elb[0])
  ctx.lineWidth = 0.008
  ctx.strokeStyle = fx.c.skinD
  for (const o of [-0.35, 0.35]) {
    ctx.beginPath()
    ctx.arc(p[0], p[1], r * 0.62, ang + o - 0.25, ang + o + 0.25)
    ctx.stroke()
  }
  if (fx.band) {
    const w = along(elb, p, 0.78)
    ctx.beginPath()
    capsule(ctx, along(elb, p, 0.7), w, 0.042, 0.042)
    ctx.fillStyle = fx.band
    ctx.fill()
  }
}

function arm(ctx, sk, fx, back) {
  const [sh, elb, fs] = back ? [sk.shB, sk.elbB, sk.fistB] : [sk.shF, sk.elbF, sk.fistF]
  const w = fx.w
  const skin = back ? fx.c.skinB : fx.c.skin
  const long = fx.style.sleeves === 'long'
  const sleeve = fx.style.jacket && fx.c.jacket ? fx.c.jacket : back ? fx.c.shirtB : fx.c.shirt
  const sleeveD = fx.style.jacket && fx.c.jacketD ? fx.c.jacketD : fx.c.shirtD
  // bare arm first, then the sleeve over it
  limb(ctx, [[sh, elb, 0.052 * w, 0.044 * w], [elb, fs, 0.044 * w, 0.038 * w]], skin, fx.c.skinD, back ? null : fx.c.skinL)
  if (long) limb(ctx, [[sh, elb, 0.062 * w, 0.054 * w], [elb, along(elb, fs, 0.82), 0.054 * w, 0.048 * w]], sleeve, sleeveD)
  else limb(ctx, [[sh, along(sh, elb, 0.62), 0.064 * w, 0.056 * w]], sleeve, sleeveD)
  fist(ctx, fs, elb, B.fist * w, fx, back)
}

function leg(ctx, sk, fx, back, pose) {
  const [hp, kn, an] = back ? [sk.hipB, sk.kneeB, sk.ankB] : [sk.hipF, sk.kneeF, sk.ankF]
  const w = fx.w
  limb(ctx, [[hp, kn, 0.085 * w, 0.064 * w], [kn, an, 0.064 * w, 0.05 * w]], back ? fx.c.pantsB : fx.c.pants, fx.c.pantsD)
  const grounded = (back ? pose.footB : pose.footF)[1] < 0.05 && !pose.lying
  shoe(ctx, an, kn, fx, back, grounded)
}

// the torso as a shape in its own frame: u along the spine, v forward
function torso(ctx, sk, fx) {
  const { hip, lean } = sk
  const ax = Math.sin(lean)
  const ay = Math.cos(lean)
  const P = (v, u) => [hip[0] + ax * u + ay * v, hip[1] + ay * u - ax * v]
  const T = B.torso * fx.h
  const w = fx.w
  const f = fx.female
  const shape = [
    [-0.13 * w, 0.0], // back of the waist
    [0.12 * w, 0.0], // front of the waist
    [(f ? 0.15 : 0.15) * w, T * 0.55], // belly / chest
    [(f ? 0.15 : 0.14) * w, T * 0.85], // chest
    [0.08 * w, T * 1.02], // collar front
    [-0.1 * w, T * 1.02], // shoulder top
    [-0.15 * w, T * 0.78], // back of the shoulders
    [-0.13 * w, T * 0.35], // small of the back
  ]
  const path = (grow = 0) => {
    ctx.beginPath()
    const pts = shape.map(([v, u], i) => P(v + Math.sign(v || 1) * grow, u + (i >= 4 && i <= 5 ? grow : i <= 1 ? -grow : 0)))
    ctx.moveTo(...pts[0])
    ctx.lineTo(...pts[1])
    ctx.quadraticCurveTo(...P(0.16 * w, T * 0.25), ...pts[2])
    ctx.quadraticCurveTo(...P(0.17 * w, T * 0.72), ...pts[3])
    ctx.quadraticCurveTo(...P(0.13 * w, T * 1.0), ...pts[4])
    ctx.lineTo(...pts[5])
    ctx.quadraticCurveTo(...P(-0.17 * w, T * 0.98), ...pts[6])
    ctx.quadraticCurveTo(...P(-0.16 * w, T * 0.55), ...pts[7])
    ctx.closePath()
  }
  path()
  ctx.lineWidth = B.line * 2
  ctx.strokeStyle = OUTLINE
  ctx.stroke()
  ctx.fillStyle = fx.c.shirtD
  ctx.fill()
  // the lit front of the shirt
  ctx.save()
  path()
  ctx.clip()
  ctx.beginPath()
  ctx.moveTo(...P(-0.04 * w, -0.05))
  ctx.lineTo(...P(0.3 * w, -0.05))
  ctx.lineTo(...P(0.3 * w, T * 1.1))
  ctx.lineTo(...P(-0.08 * w, T * 1.1))
  ctx.quadraticCurveTo(...P(-0.01 * w, T * 0.5), ...P(-0.04 * w, -0.05))
  ctx.fillStyle = fx.c.shirt
  ctx.fill()
  // a jacket or waistcoat over it (shirt2)
  if (fx.style.jacket && fx.c.jacket) {
    ctx.beginPath()
    ctx.moveTo(...P(-0.3 * w, -0.05))
    ctx.lineTo(...P(0.06 * w, -0.05))
    ctx.lineTo(...P(0.13 * w, T * 0.55))
    ctx.lineTo(...P(0.03 * w, T * 1.05))
    ctx.lineTo(...P(-0.3 * w, T * 1.05))
    ctx.closePath()
    ctx.fillStyle = fx.c.jacket
    ctx.fill()
    ctx.lineWidth = 0.01
    ctx.strokeStyle = fx.c.jacketD
    ctx.stroke()
  } else {
    // a shirt seam and buttons down the front
    ctx.lineWidth = 0.008
    ctx.strokeStyle = fx.c.shirtD
    ctx.beginPath()
    ctx.moveTo(...P(0.1 * w, T * 0.05))
    ctx.lineTo(...P(0.1 * w, T * 0.92))
    ctx.stroke()
    ctx.fillStyle = fx.c.trim
    for (const u of [0.25, 0.48, 0.71]) {
      ctx.beginPath()
      ctx.arc(...P(0.115 * w, T * u), 0.011, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // folds where the shirt bunches at the back
  ctx.lineWidth = 0.009
  ctx.strokeStyle = fx.c.shirtD
  ctx.beginPath()
  ctx.moveTo(...P(-0.11 * w, T * 0.2))
  ctx.quadraticCurveTo(...P(-0.04 * w, T * 0.28), ...P(-0.02 * w, T * 0.18))
  ctx.stroke()
  ctx.restore()
  // collar
  ctx.beginPath()
  ctx.moveTo(...P(-0.06 * w, T * 1.0))
  ctx.lineTo(...P(0.03 * w, T * 0.9))
  ctx.lineTo(...P(0.09 * w, T * 1.0))
  ctx.lineWidth = 0.022
  ctx.strokeStyle = fx.c.trim
  ctx.stroke()
  if (fx.chain) {
    ctx.beginPath()
    ctx.moveTo(...P(-0.05 * w, T * 1.0))
    ctx.quadraticCurveTo(...P(0.06 * w, T * 0.74), ...P(0.1 * w, T * 0.98))
    ctx.lineWidth = 0.014
    ctx.strokeStyle = fx.chain
    ctx.stroke()
  }
  // trousers: the waistband and seat
  ctx.beginPath()
  capsule(ctx, P(-0.035 * w, 0.02), P(0.035 * w, 0.02), 0.13 * w + B.line, 0.12 * w + B.line)
  ctx.fillStyle = OUTLINE
  ctx.fill()
  ctx.beginPath()
  capsule(ctx, P(-0.035 * w, 0.02), P(0.035 * w, 0.02), 0.13 * w, 0.12 * w)
  ctx.fillStyle = fx.c.pants
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(...P(-0.13 * w, 0.06))
  ctx.lineTo(...P(0.12 * w, 0.06))
  ctx.lineWidth = 0.028
  ctx.strokeStyle = fx.c.pantsD // belt
  ctx.stroke()
}

// ---- the head ----
function head(ctx, sk, fx, pose) {
  const s = fx.h
  const c = sk.headC
  const ang = sk.headAng
  // neck
  limb(ctx, [[sk.sh, [c[0] - Math.sin(ang) * 0.05, c[1] - Math.cos(ang) * 0.05], 0.05 * fx.w, 0.048]], fx.c.skin, fx.c.skinD)
  ctx.save()
  ctx.translate(c[0], c[1])
  ctx.rotate(-ang)
  ctx.scale(s, s)
  const st = fx.style
  // hair that hangs behind the head goes first
  if (st.hair === 'long' || st.hair === 'dreads') {
    ctx.beginPath()
    if (st.hair === 'long') {
      ctx.moveTo(-0.02, 0.1)
      ctx.quadraticCurveTo(-0.16, 0.06, -0.15, -0.2)
      ctx.quadraticCurveTo(-0.08, -0.26, -0.02, -0.16)
      ctx.closePath()
    } else {
      for (const [x, l] of [[-0.09, 0.2], [-0.06, 0.26], [-0.03, 0.22], [-0.1, 0.15]]) capsule(ctx, [x, 0.04], [x - 0.04, 0.04 - l], 0.022, 0.018)
    }
    ctx.lineWidth = B.line * 2
    ctx.strokeStyle = OUTLINE
    ctx.stroke()
    ctx.fillStyle = fx.c.hair
    ctx.fill()
  }
  // the head, side-on and turned a little towards us
  const headPath = () => {
    ctx.beginPath()
    ctx.moveTo(-0.01, 0.13)
    ctx.quadraticCurveTo(0.09, 0.13, 0.105, 0.05) // forehead
    ctx.quadraticCurveTo(0.11, 0.02, 0.118, 0.005) // brow
    ctx.quadraticCurveTo(0.145, -0.03, 0.124, -0.045) // nose
    ctx.lineTo(0.112, -0.05)
    ctx.quadraticCurveTo(0.118, -0.068, 0.108, -0.082) // lips
    ctx.quadraticCurveTo(0.105, -0.115, 0.075, -0.122) // chin
    ctx.quadraticCurveTo(0.02, -0.128, -0.04, -0.085) // jaw
    ctx.quadraticCurveTo(-0.1, -0.05, -0.105, 0.02) // back of the head
    ctx.quadraticCurveTo(-0.1, 0.13, -0.01, 0.13)
    ctx.closePath()
  }
  headPath()
  ctx.lineWidth = B.line * 2
  ctx.strokeStyle = OUTLINE
  ctx.stroke()
  ctx.fillStyle = fx.c.skinD
  ctx.fill()
  ctx.save()
  headPath()
  ctx.clip()
  ctx.beginPath()
  ctx.ellipse(0.04, 0.0, 0.11, 0.15, 0, 0, Math.PI * 2)
  ctx.fillStyle = fx.c.skin
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(0.075, 0.045, 0.03, 0.04, 0.3, 0, Math.PI * 2) // forehead shine
  ctx.fillStyle = fx.c.skinL
  ctx.fill()
  ctx.restore()
  // ear
  ctx.beginPath()
  ctx.ellipse(-0.03, -0.005, 0.022, 0.032, 0.15, 0, Math.PI * 2)
  ctx.lineWidth = B.line * 1.4
  ctx.strokeStyle = OUTLINE
  ctx.stroke()
  ctx.fillStyle = fx.c.skin
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-0.028, -0.005, 0.011, 0.5, 4.5)
  ctx.lineWidth = 0.007
  ctx.strokeStyle = fx.c.skinD
  ctx.stroke()
  face(ctx, fx, pose)
  hairAndHat(ctx, fx)
  ctx.restore()
}

function face(ctx, fx, pose) {
  // eye
  const ex = 0.07
  const ey = 0.022
  ctx.lineCap = 'round'
  if (pose.eyes === 'shut') {
    ctx.beginPath()
    ctx.moveTo(ex - 0.022, ey + 0.012)
    ctx.lineTo(ex + 0.004, ey)
    ctx.lineTo(ex - 0.022, ey - 0.012)
    ctx.lineWidth = 0.011
    ctx.strokeStyle = OUTLINE
    ctx.stroke()
  } else if (pose.eyes === 'x') {
    ctx.beginPath()
    ctx.moveTo(ex - 0.018, ey + 0.015)
    ctx.lineTo(ex + 0.012, ey - 0.015)
    ctx.moveTo(ex - 0.018, ey - 0.015)
    ctx.lineTo(ex + 0.012, ey + 0.015)
    ctx.lineWidth = 0.01
    ctx.strokeStyle = OUTLINE
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(ex - 0.024, ey + 0.002)
    ctx.quadraticCurveTo(ex - 0.004, ey + 0.022, ex + 0.02, ey + 0.004)
    ctx.quadraticCurveTo(ex - 0.002, ey - 0.014, ex - 0.024, ey + 0.002)
    ctx.fillStyle = '#f7f1e6'
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(ex + 0.006, ey + 0.004, 0.0085, 0.0115, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#2a160c'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(ex + 0.009, ey + 0.009, 0.0032, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    // upper lid
    ctx.beginPath()
    ctx.moveTo(ex - 0.026, ey + 0.003)
    ctx.quadraticCurveTo(ex - 0.004, ey + 0.024, ex + 0.022, ey + 0.006)
    ctx.lineWidth = 0.0085
    ctx.strokeStyle = OUTLINE
    ctx.stroke()
    if (fx.female) {
      ctx.beginPath()
      ctx.moveTo(ex + 0.018, ey + 0.009)
      ctx.lineTo(ex + 0.03, ey + 0.016)
      ctx.lineWidth = 0.006
      ctx.stroke()
    }
  }
  // brow: low and angled down to the nose (fighting face)
  ctx.beginPath()
  ctx.moveTo(ex - 0.03, ey + 0.035)
  ctx.quadraticCurveTo(ex, ey + 0.04, ex + 0.03, ey + (pose.eyes === 'shut' ? 0.03 : 0.02))
  ctx.lineWidth = fx.female ? 0.009 : 0.014
  ctx.strokeStyle = fx.style.grey ? '#8d8880' : OUTLINE
  ctx.stroke()
  // nostril
  ctx.beginPath()
  ctx.arc(0.116, -0.036, 0.007, 3.4, 5.8)
  ctx.lineWidth = 0.006
  ctx.strokeStyle = fx.c.skinD
  ctx.stroke()
  // mouth
  const m = pose.mouth
  if (m === 'shout' || m === 'open') {
    ctx.beginPath()
    ctx.ellipse(0.095, -0.07, 0.02, m === 'shout' ? 0.018 : 0.013, 0.15, 0, Math.PI * 2)
    ctx.fillStyle = '#3a0d0d'
    ctx.fill()
    ctx.lineWidth = 0.007
    ctx.strokeStyle = OUTLINE
    ctx.stroke()
    ctx.beginPath()
    ctx.rect(0.082, -0.062, 0.026, 0.006) // top teeth
    ctx.fillStyle = '#f4efe4'
    ctx.fill()
  } else if (m === 'grit') {
    ctx.beginPath()
    ctx.rect(0.078, -0.076, 0.03, 0.013)
    ctx.fillStyle = '#f4efe4'
    ctx.fill()
    ctx.lineWidth = 0.006
    ctx.strokeStyle = OUTLINE
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0.078, -0.0695)
    ctx.lineTo(0.108, -0.0695)
    ctx.stroke()
  } else if (m === 'grin') {
    ctx.beginPath()
    ctx.moveTo(0.072, -0.064)
    ctx.quadraticCurveTo(0.095, -0.09, 0.112, -0.062)
    ctx.closePath()
    ctx.fillStyle = '#f4efe4'
    ctx.fill()
    ctx.lineWidth = 0.007
    ctx.strokeStyle = OUTLINE
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(0.075, -0.072)
    ctx.quadraticCurveTo(0.092, -0.068, 0.108, -0.072)
    ctx.lineWidth = 0.008
    ctx.strokeStyle = fx.c.lip
    ctx.stroke()
  }
  if (fx.glasses) {
    ctx.beginPath()
    ctx.moveTo(ex - 0.03, ey + 0.012)
    ctx.lineTo(ex + 0.032, ey + 0.012)
    ctx.lineTo(ex + 0.028, ey - 0.016)
    ctx.lineTo(ex - 0.026, ey - 0.016)
    ctx.closePath()
    ctx.fillStyle = 'rgba(20,20,26,0.85)'
    ctx.fill()
    ctx.lineWidth = 0.008
    ctx.strokeStyle = OUTLINE
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(ex - 0.03, ey + 0.008)
    ctx.lineTo(-0.035, ey + 0.004)
    ctx.stroke()
  }
  if (fx.style.beard) {
    ctx.beginPath()
    ctx.moveTo(-0.03, -0.02)
    ctx.quadraticCurveTo(-0.02, -0.1, 0.03, -0.122)
    ctx.quadraticCurveTo(0.09, -0.135, 0.108, -0.09)
    ctx.quadraticCurveTo(0.08, -0.095, 0.072, -0.085)
    ctx.quadraticCurveTo(0.03, -0.08, 0.0, -0.03)
    ctx.closePath()
    ctx.fillStyle = fx.c.hair
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(0.074, -0.056)
    ctx.quadraticCurveTo(0.095, -0.05, 0.114, -0.057) // moustache
    ctx.lineWidth = 0.012
    ctx.strokeStyle = fx.c.hair
    ctx.stroke()
  }
  ctx.lineCap = 'butt'
}

function hairAndHat(ctx, fx) {
  const st = fx.style
  const hair = st.hair
  const fillOutline = (fill) => {
    ctx.lineWidth = B.line * 2
    ctx.strokeStyle = OUTLINE
    ctx.stroke()
    ctx.fillStyle = fill
    ctx.fill()
  }
  // the hair cap that every style except bald shares
  if (hair !== 'bald' && fx.hat !== 'gele') {
    ctx.beginPath()
    if (hair === 'afro') {
      ctx.moveTo(0.1, 0.06)
      ctx.bezierCurveTo(0.14, 0.23, -0.1, 0.27, -0.14, 0.12)
      ctx.bezierCurveTo(-0.19, 0.02, -0.12, -0.06, -0.06, -0.04)
      ctx.quadraticCurveTo(-0.02, 0.05, 0.1, 0.06)
    } else if (hair === 'puffs') {
      ctx.arc(-0.08, 0.13, 0.065, 0, Math.PI * 2)
      ctx.moveTo(0.06, 0.16)
      ctx.arc(0.02, 0.16, 0.055, 0, Math.PI * 2)
      ctx.moveTo(0.1, 0.06)
      ctx.quadraticCurveTo(0.06, 0.15, -0.03, 0.14)
      ctx.quadraticCurveTo(-0.12, 0.12, -0.11, 0.0)
      ctx.quadraticCurveTo(-0.04, 0.03, 0.1, 0.06)
    } else if (hair === 'bun') {
      ctx.arc(-0.07, 0.14, 0.05, 0, Math.PI * 2)
      ctx.moveTo(0.1, 0.06)
      ctx.quadraticCurveTo(0.08, 0.15, -0.02, 0.145)
      ctx.quadraticCurveTo(-0.12, 0.13, -0.11, 0.0)
      ctx.quadraticCurveTo(-0.03, 0.04, 0.1, 0.06)
    } else if (hair === 'bob' || hair === 'long') {
      ctx.moveTo(0.1, 0.07)
      ctx.quadraticCurveTo(0.09, 0.17, -0.03, 0.16)
      ctx.quadraticCurveTo(-0.15, 0.13, -0.13, -0.08)
      ctx.lineTo(-0.06, -0.07)
      ctx.quadraticCurveTo(-0.07, 0.03, 0.1, 0.07)
    } else {
      // short, curly, fade, dreads (the roots)
      const top = hair === 'fade' ? 0.15 : hair === 'curly' ? 0.165 : 0.152
      ctx.moveTo(0.102, 0.06)
      ctx.quadraticCurveTo(0.09, top, -0.02, top)
      ctx.quadraticCurveTo(-0.12, top - 0.01, -0.112, 0.01)
      ctx.quadraticCurveTo(-0.08, -0.01, -0.06, 0.03)
      ctx.quadraticCurveTo(0.0, 0.08, 0.102, 0.06)
    }
    fillOutline(fx.c.hair)
    // texture: curls / shine
    ctx.fillStyle = fx.c.hairL
    if (hair === 'afro' || hair === 'curly' || hair === 'puffs') {
      for (const [x, y] of [[-0.06, 0.15], [0.0, 0.17], [-0.1, 0.08], [0.05, 0.12]]) {
        ctx.beginPath()
        ctx.arc(x, y + (hair === 'curly' ? -0.02 : 0), 0.012, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      ctx.beginPath()
      ctx.ellipse(0.0, 0.13, 0.04, 0.012, 0.1, 0, Math.PI * 2)
      ctx.fill()
    }
    if (hair === 'fade') {
      ctx.beginPath()
      ctx.moveTo(-0.1, 0.04)
      ctx.quadraticCurveTo(-0.04, 0.07, 0.06, 0.07)
      ctx.lineWidth = 0.02
      ctx.strokeStyle = fx.c.skinD
      ctx.globalAlpha = 0.55
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  } else if (hair === 'bald' && !fx.hat) {
    ctx.beginPath()
    ctx.ellipse(0.01, 0.11, 0.045, 0.014, 0.15, 0, Math.PI * 2)
    ctx.fillStyle = fx.c.skinL
    ctx.fill()
  }
  if (st.headband && !fx.hat) {
    ctx.beginPath()
    ctx.moveTo(0.1, 0.075)
    ctx.quadraticCurveTo(-0.01, 0.11, -0.115, 0.06)
    ctx.lineWidth = 0.026
    ctx.strokeStyle = fx.c.trim
    ctx.stroke()
  }
  // hats
  const hat = fx.hat
  if (!hat) return
  ctx.beginPath()
  if (hat === 'cap' || hat === 'hardhat') {
    ctx.moveTo(0.11, 0.08)
    ctx.quadraticCurveTo(0.1, 0.2, -0.02, 0.19)
    ctx.quadraticCurveTo(-0.13, 0.18, -0.12, 0.07)
    ctx.closePath()
    fillOutline(fx.c.hat)
    ctx.beginPath() // brim
    if (hat === 'cap') {
      ctx.moveTo(0.06, 0.085)
      ctx.quadraticCurveTo(0.17, 0.1, 0.2, 0.07)
      ctx.lineTo(0.08, 0.07)
    } else {
      ctx.moveTo(-0.15, 0.07)
      ctx.lineTo(0.16, 0.08)
      ctx.lineTo(0.15, 0.06)
      ctx.lineTo(-0.15, 0.05)
    }
    ctx.closePath()
    fillOutline(fx.c.hatD)
  } else if (hat === 'beanie' || hat === 'beret') {
    if (hat === 'beret') {
      ctx.moveTo(0.1, 0.09)
      ctx.quadraticCurveTo(0.12, 0.2, -0.04, 0.2)
      ctx.quadraticCurveTo(-0.17, 0.18, -0.12, 0.08)
    } else {
      ctx.moveTo(0.105, 0.07)
      ctx.quadraticCurveTo(0.1, 0.22, -0.02, 0.21)
      ctx.quadraticCurveTo(-0.13, 0.2, -0.12, 0.05)
    }
    ctx.closePath()
    fillOutline(fx.c.hat)
    ctx.beginPath()
    ctx.moveTo(0.105, 0.075)
    ctx.quadraticCurveTo(0.0, 0.11, -0.12, 0.07)
    ctx.lineWidth = 0.03
    ctx.strokeStyle = fx.c.hatD
    ctx.stroke()
  } else if (hat === 'fila') {
    ctx.moveTo(0.1, 0.07)
    ctx.lineTo(0.06, 0.2)
    ctx.quadraticCurveTo(-0.06, 0.25, -0.16, 0.16)
    ctx.lineTo(-0.11, 0.05)
    ctx.closePath()
    fillOutline(fx.c.hat)
  } else if (hat === 'bandana') {
    ctx.moveTo(0.105, 0.065)
    ctx.quadraticCurveTo(0.09, 0.17, -0.02, 0.165)
    ctx.quadraticCurveTo(-0.12, 0.155, -0.115, 0.03)
    ctx.quadraticCurveTo(-0.03, 0.09, 0.105, 0.065)
    fillOutline(fx.c.hat)
    ctx.beginPath() // the knot's tails
    ctx.moveTo(-0.11, 0.06)
    ctx.lineTo(-0.19, 0.0)
    ctx.lineTo(-0.16, 0.08)
    ctx.closePath()
    fillOutline(fx.c.hat)
  } else if (hat === 'gele') {
    ctx.moveTo(0.11, 0.06)
    ctx.bezierCurveTo(0.2, 0.2, 0.0, 0.32, -0.1, 0.22)
    ctx.bezierCurveTo(-0.22, 0.18, -0.18, 0.02, -0.11, 0.0)
    ctx.quadraticCurveTo(0.0, 0.06, 0.11, 0.06)
    fillOutline(fx.c.hat)
    ctx.beginPath()
    ctx.moveTo(0.06, 0.12)
    ctx.quadraticCurveTo(0.0, 0.22, -0.1, 0.18)
    ctx.lineWidth = 0.01
    ctx.strokeStyle = fx.c.hatD
    ctx.stroke()
  }
}

/** Draws one fighter. The canvas is already set up: metres, y up, at the fighter's feet, facing right. */
export function drawFighter(ctx, fx, pose, { alpha = 1 } = {}) {
  const sk = skeleton(pose, fx)
  ctx.save()
  if (alpha < 1) ctx.globalAlpha = alpha
  if (pose.dx) ctx.translate(pose.dx, 0) // the lunge
  // the whole-body turn (falls) about the hips, and the spin (squash to a side view)
  ctx.translate(sk.hip[0], sk.hip[1])
  if (pose.rot) ctx.rotate(pose.rot)
  if (pose.turn !== 1) ctx.scale(Math.sign(pose.turn) * Math.max(0.12, Math.abs(pose.turn)), 1)
  ctx.translate(-sk.hip[0], -sk.hip[1])
  // back to front: far arm and leg, body, near leg, head, near arm
  arm(ctx, sk, fx, true)
  leg(ctx, sk, fx, true, pose)
  torso(ctx, sk, fx)
  leg(ctx, sk, fx, false, pose)
  head(ctx, sk, fx, pose)
  arm(ctx, sk, fx, false)
  ctx.restore()
  return sk
}

/** Where the front fist and front foot are (for hit sparks), in the fighter's own frame. */
export function reachPoints(fx, pose) {
  const sk = skeleton(pose, fx)
  const d = pose.dx || 0
  const at = (p) => [p[0] + d, p[1]]
  return { fist: at(sk.fistF), foot: at(sk.ankF), head: at(sk.headC), chest: [sk.sh[0] + d, sk.sh[1] - 0.15] }
}
