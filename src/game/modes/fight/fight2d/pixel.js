// Pixel-art fighters. The design follows the little "thicc" pixel people the
// art direction is based on (docs/fight-art-direction.md): a big round head
// about half the height, two tall dot eyes, blush under them, a stubby body,
// nub arms and short legs, a dark navy outline round every part and flat
// shading (back limbs one shade darker). On top of that design, each fighter
// wears their own look: skin tone, hair or hat, shirt, trousers, shoes,
// glasses, a chain; JJC's rugged clothes have a patch and slippers.
//
// Every frame is painted once, pixel by pixel, into a tiny canvas when the
// fight starts (an "atlas"); the fight then just picks a frame and draws it
// scaled up with crisp, square pixels. That's very cheap, so it suits 2 GB
// phones. Animation is snappy, a few frames each, like the source pack.
//
// Frame coordinates: sprite pixels from the feet (x forward, y up is
// negative), facing right.

import { normalizeLook } from '../../../characters/look.js'

export const CW = 46 // frame canvas size (sprite pixels)
export const CH = 40
export const AX = 18 // where the feet stand in a frame
export const AY = 36
export const M_PER_PX = 0.065 // one sprite pixel in metres: a fighter is about 21 px, 1.4 m
export const INK = '#0e0d1e'

// ---- colours ----
function rgb(hex) {
  const h = String(hex || '#777').replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16) || 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const css = (c) => `rgb(${c.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(',')})`
// shade: darker and cooler, like the pack's blue-grey shadow tone
const shadeOf = (c, k = 0.66) => [c[0] * k * 0.92, c[1] * k * 0.95, c[2] * k + 34 * (1 - k)]
const lift = (c, k = 0.25) => c.map((v) => v + (255 - v) * k)

// what each body wears on its head (the 3D models show it)
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

// colour slots in a frame
const SKIN = 1, SKIN_S = 2, SHIRT = 3, SHIRT_S = 4, PANTS = 5, PANTS_S = 6, SHOE = 7, SHOE_S = 8
const HAIR = 9, HAIR_S = 10, HAT = 11, HAT_S = 12, DARK = 13, BLUSH = 14, WHITE = 15, GOLD = 16, PATCH = 17, JACKET = 18, SOLE = 19

/** Colours and style from a character look. */
function makeKit(lookInput) {
  const look = normalizeLook(lookInput)
  const style = BODY_STYLE[look.body] || BODY_STYLE.mini_male_f
  const acc = Object.fromEntries((look.accessories || []).map((a) => [a.type, a]))
  const dusty = (c) => (look.rugged ? c.map((v, i) => (v * 0.7 + [150, 125, 95][i] * 0.3) * 0.92) : c)
  const skin = rgb(look.skin)
  const shirt = dusty(rgb(look.shirt))
  const pants = dusty(rgb(look.trousers))
  const shoes = dusty(rgb(look.shoes))
  const hair = style.grey ? rgb('#c9c4bc') : rgb(look.hair || '#161110')
  const hat = acc.cap ? 'cap' : acc.beanie ? 'beanie' : acc.fila ? 'fila' : acc.gele ? 'gele' : acc.bandana ? 'bandana' : style.hat || null
  const hatC = rgb((acc.cap || acc.beanie || acc.fila || acc.gele || acc.bandana)?.color || (style.hat === 'hardhat' ? '#f2b705' : style.hat === 'beret' ? '#3d4b2a' : '#c0392b'))
  const jacket = look.shirt2 ? dusty(rgb(look.shirt2)) : null
  const colors = []
  colors[SKIN] = css(skin)
  colors[SKIN_S] = css(shadeOf(skin, 0.74))
  colors[SHIRT] = css(shirt)
  colors[SHIRT_S] = css(shadeOf(shirt))
  colors[PANTS] = css(pants)
  colors[PANTS_S] = css(shadeOf(pants))
  colors[SHOE] = css(shoes)
  colors[SHOE_S] = css(shadeOf(shoes))
  colors[HAIR] = css(hair)
  colors[HAIR_S] = css(lift(hair, 0.22)) // the shine on hair
  colors[HAT] = css(hatC)
  colors[HAT_S] = css(shadeOf(hatC))
  colors[DARK] = INK
  colors[BLUSH] = css([skin[0] * 0.8 + 60, skin[1] * 0.62, skin[2] * 0.66])
  colors[WHITE] = '#f1feff'
  colors[GOLD] = acc.chain ? css(rgb(acc.chain.color || '#d4af37')) : '#d4af37'
  colors[PATCH] = '#8a6a44'
  colors[JACKET] = jacket ? css(jacket) : css(shadeOf(shirt, 0.8))
  colors[SOLE] = look.rugged ? css(shadeOf(shoes, 0.8)) : '#f1feff'
  return {
    look,
    style,
    hat,
    colors,
    glasses: Boolean(acc.glasses),
    chain: Boolean(acc.chain),
    rugged: Boolean(look.rugged),
    jacket: Boolean(style.jacket && jacket),
    longSleeves: style.sleeves === 'long',
  }
}

// ---- painting into a frame ----
class Layer {
  constructor() {
    this.px = new Uint8Array(CW * CH)
  }
  put(x, y, c) {
    x = Math.round(x) + AX
    y = Math.round(y) + AY
    if (x >= 0 && y >= 0 && x < CW && y < CH) this.px[y * CW + x] = c
  }
  get(x, y) {
    x += AX
    y += AY
    return x >= 0 && y >= 0 && x < CW && y < CH ? this.px[y * CW + x] : 0
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, c)
  }
  /** a limb: a w×w brush along a line */
  line(x0, y0, x1, y1, w, c, from = 0, to = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    const o = Math.floor((w - 1) / 2)
    for (let s = Math.round(n * from); s <= Math.round(n * to); s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / n)
      const y = Math.round(y0 + ((y1 - y0) * s) / n)
      this.rect(x - o, y - o, w, w, c)
    }
  }
}

// the head's shape (12 wide, 8 tall), as [y, x0, x1] rows relative to its top-left
const HEAD_ROWS = [[0, 1, 10], [1, 0, 11], [2, 0, 11], [3, 0, 11], [4, 0, 11], [5, 0, 11], [6, 1, 10], [7, 3, 8]]

function paintHead(L, kit, hx, hy, eyes, mouth) {
  // hx, hy: the head's top-left
  for (const [y, a, b] of HEAD_ROWS) for (let x = a; x <= b; x++) L.put(hx + x, hy + y, SKIN)
  // a touch of shade down the back of the head and under the chin
  for (const y of [2, 3, 4]) L.put(hx, hy + y, SKIN_S)
  for (let x = 3; x <= 8; x++) L.put(hx + x, hy + 7, SKIN_S)
  // eyes: two tall dots, near the front of the face
  const ey = hy + 3
  for (const ex of [hx + 6, hx + 10]) {
    if (eyes === 'shut') {
      L.put(ex - 1, ey + 1, DARK)
      L.put(ex, ey + 1, DARK)
    } else if (eyes === 'x') {
      L.put(ex - 1, ey, DARK)
      L.put(ex, ey + 1, DARK)
      L.put(ex - 1, ey + 1, DARK)
      L.put(ex, ey, DARK)
    } else {
      // a white behind the dark dot, so the eyes read on every skin tone
      L.put(ex - 1, ey, WHITE)
      L.put(ex - 1, ey + 1, WHITE)
      L.put(ex, ey, DARK)
      L.put(ex, ey + 1, DARK)
    }
  }
  // blush
  L.put(hx + 4, hy + 5, BLUSH)
  L.put(hx + 5, hy + 5, BLUSH)
  L.put(hx + 11, hy + 5, BLUSH)
  if (mouth === 'open') {
    L.put(hx + 8, hy + 6, DARK)
    L.put(hx + 9, hy + 6, DARK)
    L.put(hx + 8, hy + 5, DARK)
  } else if (mouth === 'grin') {
    L.put(hx + 7, hy + 5, DARK)
    L.put(hx + 8, hy + 6, DARK)
    L.put(hx + 9, hy + 6, DARK)
    L.put(hx + 10, hy + 5, DARK)
  }
  if (kit.glasses) {
    for (let x = 5; x <= 11; x++) L.put(hx + x, ey, DARK)
    for (const x of [5, 6, 9, 10]) L.put(hx + x, ey + 1, DARK)
    L.put(hx + 1, ey, DARK)
    for (let x = 2; x <= 4; x++) L.put(hx + x, ey, DARK)
  }
  if (kit.style.beard) {
    for (let x = 1; x <= 10; x++) L.put(hx + x, hy + 6, HAIR)
    for (let x = 3; x <= 8; x++) L.put(hx + x, hy + 7, HAIR)
    L.put(hx + 0, hy + 5, HAIR)
  } else if (kit.rugged && !kit.style.female) {
    // stubble
    for (const x of [3, 5, 7]) L.put(hx + x, hy + 7, HAIR)
  }
  paintHair(L, kit, hx, hy)
}

function paintHair(L, kit, hx, hy) {
  const hair = kit.style.hair
  const cap = (rows = 2, front = 8) => {
    for (let y = 0; y < rows; y++) for (let x = y === 0 ? 1 : 0; x <= Math.min(front + y, y === 0 ? 10 : 11); x++) L.put(hx + x, hy + y, HAIR)
    L.put(hx, hy + rows, HAIR)
    L.put(hx, hy + rows + 1, HAIR)
  }
  if (!kit.hat || kit.hat === 'bandana') {
    if (hair === 'fade' || hair === 'short') cap(2, 8)
    else if (hair === 'curly') {
      cap(2, 8)
      for (const x of [1, 3, 5, 7, 9]) L.put(hx + x, hy - 1, HAIR)
      L.put(hx + 4, hy, HAIR_S)
    } else if (hair === 'afro') {
      for (let y = -3; y < 2; y++) for (let x = -1 + (y < -1 ? 1 : 0); x <= 11 - (y < -1 ? 1 : 0); x++) L.put(hx + x, hy + y, HAIR)
      for (let y = 2; y < 5; y++) L.put(hx - 1, hy + y, HAIR)
      L.put(hx + 3, hy - 2, HAIR_S)
      L.put(hx + 4, hy - 2, HAIR_S)
    } else if (hair === 'dreads') {
      cap(2, 8)
      for (const x of [-1, -2]) for (let y = 2; y < 9 - Math.abs(x); y++) L.put(hx + x, hy + y, HAIR)
      L.put(hx, hy + 5, HAIR)
    } else if (hair === 'long' || hair === 'bob') {
      cap(2, 9)
      const end = hair === 'long' ? 11 : 7
      for (let y = 2; y < end; y++) for (let x = -2; x <= 0; x++) L.put(hx + x, hy + y, HAIR)
    } else if (hair === 'puffs') {
      cap(2, 8)
      for (const px of [0, 6]) L.rect(hx + px, hy - 3, 3, 3, HAIR)
    } else if (hair === 'bun') {
      cap(2, 8)
      L.rect(hx - 1, hy - 3, 3, 3, HAIR)
    } else if (hair === 'bald') {
      L.put(hx + 4, hy + 1, WHITE) // a shine
    }
    if (hair !== 'bald' && hair !== 'afro') L.put(hx + 5, hy, HAIR_S)
  }
  if (kit.style.headband && !kit.hat) for (let x = 0; x <= 11; x++) L.put(hx + x, hy + 2, SHIRT_S)
  const hat = kit.hat
  if (!hat) return
  if (hat === 'cap') {
    for (let y = -2; y < 2; y++) for (let x = y < -1 ? 1 : 0; x <= (y < -1 ? 9 : 10); x++) L.put(hx + x, hy + y, HAT)
    for (let x = 9; x <= 14; x++) L.put(hx + x, hy + 1, HAT_S) // the peak
  } else if (hat === 'beanie') {
    for (let y = -3; y < 3; y++) for (let x = y < -2 ? 2 : 0; x <= (y < -2 ? 9 : 11); x++) L.put(hx + x, hy + y, y >= 1 ? HAT_S : HAT)
  } else if (hat === 'beret') {
    for (let y = -2; y < 1; y++) for (let x = -1; x <= 9; x++) L.put(hx + x, hy + y, HAT)
    L.put(hx + 4, hy - 3, HAT)
  } else if (hat === 'hardhat') {
    for (let y = -3; y < 1; y++) for (let x = y < -2 ? 2 : 0; x <= (y < -2 ? 9 : 11); x++) L.put(hx + x, hy + y, HAT)
    for (let x = -2; x <= 13; x++) L.put(hx + x, hy + 1, HAT_S)
  } else if (hat === 'fila') {
    for (let y = -4; y < 2; y++) for (let x = 0; x <= 10 - Math.max(0, -y - 1); x++) L.put(hx + x, hy + y, HAT)
    for (let x = 0; x <= 10; x++) L.put(hx + x, hy + 1, HAT_S)
  } else if (hat === 'bandana') {
    for (let y = -1; y < 2; y++) for (let x = 0; x <= 11; x++) L.put(hx + x, hy + y, HAT)
    L.put(hx - 1, hy + 2, HAT)
    L.put(hx - 2, hy + 3, HAT)
    L.put(hx - 1, hy + 3, HAT_S)
  } else if (hat === 'gele') {
    for (let y = -6; y < 2; y++) for (let x = -2 + Math.max(0, -y - 4); x <= 13 - Math.max(0, -y - 3); x++) L.put(hx + x, hy + y, (x + y) % 4 === 0 ? HAT_S : HAT)
  }
}

/**
 * Paint one frame. f: { b: body offset, hd: head offset, aF/aB: hands,
 * lF/lB: feet, kF/kB: knees (optional), eyes, mouth, flip }
 */
function paintFrame(kit, f) {
  const back = new Layer()
  const body = new Layer()
  const front = new Layer()
  const [bx, by] = f.b || [0, 0]
  const [hdx, hdy] = f.hd || [0, 0]
  const shF = [3 + bx, -9 + by]
  const shB = [-3 + bx, -9 + by]
  const hipF = [1 + bx, -5 + by]
  const hipB = [-2 + bx, -5 + by]
  const aF = [f.aF[0] + bx, f.aF[1] + by]
  const aB = [f.aB[0] + bx, f.aB[1] + by]
  const sleeve = (L, s, h, base, shade, isBack) => {
    // the skin arm, then the sleeve over the top part, then the fist
    L.line(s[0], s[1], h[0], h[1], 2, isBack ? SKIN_S : SKIN)
    L.line(s[0], s[1], h[0], h[1], 2, isBack ? shade : base, 0, kit.longSleeves ? 0.75 : 0.35)
    L.rect(h[0] - 1, h[1] - 1, 3, 3, isBack ? SKIN_S : SKIN) // fist
  }
  const leg = (L, hip, foot, knee, isBack) => {
    const pants = isBack ? PANTS_S : PANTS
    if (knee) {
      L.line(hip[0], hip[1], knee[0], knee[1], 2, pants)
      L.line(knee[0], knee[1], foot[0], foot[1], 2, pants)
    } else L.line(hip[0], hip[1], foot[0], foot[1] - 1, 2, pants)
    // the foot: a little shoe pointing forward (or a slipper on a bare foot)
    const fx = foot[0]
    const fy = foot[1]
    if (kit.rugged) {
      L.rect(fx, fy - 1, 3, 1, isBack ? SKIN_S : SKIN)
      L.rect(fx, fy, 3, 1, isBack ? SHOE_S : SHOE)
    } else {
      L.rect(fx, fy - 1, 3, 1, isBack ? SHOE_S : SHOE)
      L.rect(fx, fy, 3, 1, isBack ? SHOE_S : SOLE)
    }
  }
  // back arm and leg, one shade darker
  sleeve(back, shB, aB, SHIRT, SHIRT_S, true)
  leg(back, hipB, f.lB, f.kB, true)
  // the body: trousers seat, shirt, shading at the neck
  body.rect(-3 + bx, -6 + by, 7, 2, PANTS)
  body.rect(-3 + bx, -11 + by, 7, 6, kit.jacket ? JACKET : SHIRT)
  if (kit.jacket) body.rect(1 + bx, -11 + by, 2, 6, SHIRT)
  body.rect(-3 + bx, -11 + by, 1, 6, SHIRT_S)
  for (let x = -2; x <= 2; x++) body.put(x + bx, -11 + by, SHIRT_S) // the shadow under the chin
  if (kit.chain) for (let x = 0; x <= 3; x++) body.put(x + bx, -10 + by, GOLD)
  if (kit.rugged) {
    body.put(1 + bx, -8 + by, SHIRT_S)
    body.put(-1 + bx, -7 + by, SHIRT_S)
  }
  leg(body, hipF, f.lF, f.kF, false)
  if (kit.rugged) body.put(Math.round((hipF[0] + f.lF[0]) / 2), Math.round((hipF[1] + f.lF[1]) / 2) - 1, PATCH)
  // the head: 12×8, its top-left
  paintHead(body, kit, -5 + bx + hdx, -19 + by + hdy, f.eyes || 'open', f.mouth)
  // the front arm, over everything
  sleeve(front, shF, aF, SHIRT, SHIRT_S, false)
  return [back, body, front]
}

/** Outline each layer, then stack them into a canvas (an outline under each layer's colours). */
function renderFrame(kit, f) {
  const c = document.createElement('canvas')
  c.width = CW
  c.height = CH
  const g = c.getContext('2d')
  const img = g.createImageData(CW, CH)
  const d = img.data
  const rgbOf = kit.colors.map((s) => (!s ? null : s[0] === '#' ? rgb(s) : s.match(/\d+/g).map(Number)))
  const ink = rgb(INK)
  const set = (i, col) => {
    d[i * 4] = col[0]
    d[i * 4 + 1] = col[1]
    d[i * 4 + 2] = col[2]
    d[i * 4 + 3] = 255
  }
  for (const L of paintFrame(kit, f)) {
    const p = L.px
    for (let y = 0; y < CH; y++)
      for (let x = 0; x < CW; x++) {
        const i = y * CW + x
        if (p[i]) continue
        if ((x > 0 && p[i - 1]) || (x < CW - 1 && p[i + 1]) || (y > 0 && p[i - CW]) || (y < CH - 1 && p[i + CW])) set(i, ink)
      }
    for (let i = 0; i < p.length; i++) if (p[i]) set(i, rgbOf[p[i]])
  }
  g.putImageData(img, 0, 0)
  if (!f.flip) return c
  // the spin: the same frame seen from behind (mirrored about the feet)
  const m = document.createElement('canvas')
  m.width = CW
  m.height = CH
  const mg = m.getContext('2d')
  mg.translate(AX * 2 + 1, 0)
  mg.scale(-1, 1)
  mg.drawImage(c, 0, 0)
  return m
}

// ---- the frames ----
const walk = Array.from({ length: 6 }, (_, k) => {
  const a = (k / 6) * Math.PI * 2
  const fF = Math.round(1 + Math.cos(a) * 3)
  const fB = Math.round(-2 - Math.cos(a) * 3)
  return { b: [0, k % 3 === 0 ? 0 : 1], aF: [7, -10], aB: [4, -8], lF: [fF, Math.sin(a) > 0.3 ? -2 : -1], lB: [fB, Math.sin(a) < -0.3 ? -2 : -1] }
})
export const FRAMES = {
  idle: [
    { b: [0, 0], aF: [7, -10], aB: [4, -8], lF: [3, -1], lB: [-4, -1] },
    { b: [0, 0], aF: [7, -10], aB: [4, -8], lF: [3, -1], lB: [-4, -1] },
    { b: [0, 1], aF: [7, -9], aB: [4, -7], lF: [3, -1], lB: [-4, -1] },
    { b: [0, 1], aF: [7, -9], aB: [4, -7], lF: [3, -1], lB: [-4, -1] },
  ],
  walk,
  punch: [
    { b: [-1, 0], aF: [2, -8], aB: [5, -10], lF: [3, -1], lB: [-4, -1] },
    { dx: 6, b: [2, 0], hd: [1, 0], aF: [12, -10], aB: [4, -8], lF: [5, -1], lB: [-3, -1], mouth: 'open' },
    { dx: 1, b: [1, 0], aF: [9, -10], aB: [4, -8], lF: [4, -1], lB: [-4, -1] },
  ],
  kick: [
    { b: [-1, -1], aF: [5, -11], aB: [-4, -10], lF: [3, -5], kF: [5, -7], lB: [-2, -1] },
    { dx: 8, b: [-2, 0], hd: [-1, 0], aF: [3, -12], aB: [-6, -10], lF: [12, -8], lB: [-3, -1], mouth: 'open' },
    { dx: 1, b: [-1, 0], aF: [6, -10], aB: [2, -9], lF: [6, -3], kF: [5, -5], lB: [-3, -1] },
  ],
  special: [
    { b: [0, 2], aF: [6, -7], aB: [3, -6], lF: [4, -1], lB: [-4, -1] },
    { b: [0, -1], aF: [5, -10], aB: [-5, -10], lF: [2, -1], lB: [-3, -3], flip: true },
    { dx: 9, b: [-2, -1], hd: [-1, 0], aF: [-1, -13], aB: [-7, -9], lF: [11, -14], kF: [6, -9], lB: [-3, -1], mouth: 'open' },
    { dx: 2, b: [-1, 0], aF: [6, -10], aB: [3, -8], lF: [5, -2], lB: [-3, -1] },
  ],
  air: [
    { b: [0, 0], aF: [6, -12], aB: [-5, -11], lF: [3, -4], kF: [4, -6], lB: [-2, -3] },
    { dx: 6, b: [0, 0], hd: [-1, 0], aF: [2, -12], aB: [-6, -11], lF: [12, -5], lB: [-4, -6], kB: [-1, -5], mouth: 'open' },
  ],
  jumpUp: [{ b: [0, 0], aF: [6, -13], aB: [-5, -12], lF: [3, -3], kF: [4, -5], lB: [-2, -2] }],
  jumpDown: [{ b: [0, 0], aF: [8, -9], aB: [-6, -9], lF: [3, -1], lB: [-3, -2] }],
  block: [{ b: [-1, 1], aF: [5, -14], aB: [4, -12], lF: [3, -1], lB: [-4, -1], eyes: 'shut' }],
  duck: [{ b: [0, 3], aF: [6, -7], aB: [3, -6], lF: [4, -1], lB: [-4, -1] }],
  dodge: [{ b: [-3, 1], hd: [-1, 0], aF: [4, -9], aB: [2, -8], lF: [2, -1], lB: [-6, -1] }],
  hit: [{ b: [-2, 0], hd: [-2, 1], aF: [2, -14], aB: [-6, -12], lF: [2, -1], lB: [-5, -1], eyes: 'shut', mouth: 'open' }],
  ko: [{ b: [-2, 0], hd: [-2, 1], aF: [6, -13], aB: [-7, -12], lF: [3, -1], lB: [-5, -1], eyes: 'x', mouth: 'open' }],
  win: [
    { b: [0, 0], aF: [4, -16], aB: [-4, -15], lF: [3, -1], lB: [-4, -1], mouth: 'grin' },
    { b: [0, -1], aF: [5, -17], aB: [-4, -16], lF: [3, -1], lB: [-4, -1], mouth: 'grin' },
  ],
  cheer: [
    { b: [0, 1], aF: [5, -9], aB: [-4, -9], lF: [3, -1], lB: [-3, -1], mouth: 'grin' },
    { b: [0, 0], aF: [4, -16], aB: [-4, -16], lF: [3, -1], lB: [-3, -1], mouth: 'open' },
  ],
  // dance battle moves: two frames each, swapped on the half beat
  dance_shaku: [
    { b: [0, 1], aF: [6, -6], aB: [3, -5], lF: [4, -3], kF: [5, -6], lB: [-3, -1], mouth: 'grin' },
    { b: [1, 0], aF: [-2, -6], aB: [-5, -7], lF: [3, -1], lB: [-3, -3], kB: [-2, -6], mouth: 'grin' },
  ],
  dance_zanku: [
    { b: [-1, 0], aF: [5, -12], aB: [-5, -9], lF: [9, -3], lB: [-3, -1], mouth: 'open' },
    { b: [1, 0], aF: [3, -9], aB: [-6, -12], lF: [2, -1], lB: [-8, -3], mouth: 'open' },
  ],
  dance_gwara: [
    { b: [0, 0], aF: [5, -16], aB: [-6, -8], lF: [5, -1], lB: [-3, -1], mouth: 'grin' },
    { b: [0, 1], aF: [6, -8], aB: [-4, -16], lF: [3, -1], lB: [-5, -1], mouth: 'grin' },
  ],
  dance_shoki: [
    { b: [0, 3], hd: [1, 0], aF: [5, -8], aB: [2, -7], lF: [4, -1], lB: [-4, -1], mouth: 'grin' },
    { b: [0, 1], hd: [-1, 0], aF: [6, -10], aB: [3, -9], lF: [4, -1], lB: [-4, -1], mouth: 'grin' },
  ],
  dance_azonto: [
    { b: [0, 0], aF: [9, -12], aB: [2, -8], lF: [4, -1], lB: [-3, -1], mouth: 'open' },
    { b: [0, 1], aF: [4, -6], aB: [8, -11], lF: [3, -1], lB: [-4, -1], mouth: 'open' },
  ],
  stand: [
    { b: [0, 0], aF: [3, -6], aB: [-3, -6], lF: [2, -1], lB: [-2, -1] },
    { b: [0, 1], aF: [3, -5], aB: [-3, -5], lF: [2, -1], lB: [-2, -1] },
  ],
  stroll: Array.from({ length: 4 }, (_, k) => ({ b: [0, k % 2], aF: [k < 2 ? 4 : 1, -6], aB: [k < 2 ? -2 : -4, -6], lF: [k < 2 ? 3 : 0, -1], lB: [k < 2 ? -2 : 1, -1] })),
}

/** A fighter (or a passer-by): its frames, painted once. */
export function makePixelFighter(look) {
  const kit = makeKit(look)
  const frames = {}
  for (const [name, list] of Object.entries(FRAMES)) frames[name] = list.map((f) => ({ ...f, canvas: renderFrame(kit, f) }))
  return { kit, frames, flash: new Map() }
}

/** A white silhouette of a frame, for the flash when a blow lands. */
export function flashOf(fighter, frame) {
  return tintOf(fighter, frame, '#ffffff')
}

/** A one-colour silhouette of a frame (flash, aura), made once and kept. */
export function tintOf(fighter, frame, color) {
  let byColor = fighter.flash.get(frame)
  if (!byColor) fighter.flash.set(frame, (byColor = new Map()))
  let c = byColor.get(color)
  if (!c) {
    c = document.createElement('canvas')
    c.width = CW
    c.height = CH
    const g = c.getContext('2d')
    g.drawImage(frame.canvas, 0, 0)
    g.globalCompositeOperation = 'source-in'
    g.fillStyle = color
    g.fillRect(0, 0, CW, CH)
    byColor.set(color, c)
  }
  return c
}

/**
 * Which frame to show, from the fight's state (fightLogic.js).
 * Returns { frame, rot } (rot: the whole sprite tipped over, for falls).
 */
export function frameFor(fighter, f, MOVES, { over, winner, t, overT }) {
  const F = fighter.frames
  const n = (k, len) => ((k % len) + len) % len // never a negative index
  const pick = (list, fps) => list[n(Math.floor(t * fps), list.length)]
  if (over) {
    if (winner) return { frame: pick(F.win, 4), rot: 0 }
    if (overT < 0.25) return { frame: F.ko[0], rot: 0 }
    if (overT < 0.5) return { frame: F.ko[0], rot: -Math.PI / 4 }
    return { frame: F.ko[0], rot: -Math.PI / 2, lying: true }
  }
  if (f.stunT > 0) return { frame: F.hit[0], rot: 0 }
  const a = f.action
  if (a) {
    const m = MOVES[a.type]
    if (a.type === 'air') return { frame: a.t < m.startup ? F.air[0] : F.air[1], rot: 0 }
    if (a.type === 'special') {
      const i = a.t < m.startup * 0.35 ? 0 : a.t < m.startup * 0.7 ? 1 : a.t < m.startup + m.active ? 2 : 3
      return { frame: F.special[i], rot: 0 }
    }
    const list = a.type === 'kick' ? F.kick : F.punch
    const i = a.t < m.startup * 0.6 ? 0 : a.t < m.startup + m.active ? 1 : 2
    return { frame: list[i], rot: 0 }
  }
  if (f.y > 0 || f.vy > 0) return { frame: f.vy > 0 ? F.jumpUp[0] : F.jumpDown[0], rot: 0 }
  if (f.dodgeT > 0) return { frame: F.dodge[0], rot: 0 }
  if (f.blocking) return { frame: F.block[0], rot: 0 }
  if (f.crouching) return { frame: F.duck[0], rot: 0 }
  if (f.moving) return { frame: pick(F.walk, 11), rot: 0 }
  return { frame: pick(F.idle, 6), rot: 0 }
}

/** Where a frame's fist and foot are, in metres from the feet (for the swoosh trails). */
export function reachOf(frame) {
  const [bx, by] = frame.b || [0, 0]
  const d = frame.dx || 0
  return {
    fist: [(frame.aF[0] + bx + d) * M_PER_PX, -(frame.aF[1] + by) * M_PER_PX],
    foot: [(frame.lF[0] + 1 + d) * M_PER_PX, -frame.lF[1] * M_PER_PX],
  }
}

/** The fighter's head and shoulders, for the square portrait by the health bar. */
export function drawPixelPortrait(ctx, fighter, size, { facing = 1, mood = 'fine' } = {}) {
  const f = mood === 'out' ? fighter.frames.ko[0] : mood === 'hurt' ? fighter.frames.hit[0] : fighter.frames.idle[0]
  // the head sits in rows AY-21 .. AY-8 (with outline), x AX-8 .. AX+8
  const sx = AX - 8 + (f.b?.[0] || 0)
  const sy = AY - 22
  const s = 16
  ctx.save()
  ctx.imageSmoothingEnabled = false
  if (facing < 0) {
    ctx.translate(size, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(f.canvas, sx, sy, s, s, 0, 0, size, size)
  ctx.restore()
}
