// 2D people from Eris Esra's character template (16x32, front and side views:
// idle, walk, run, jump, attack, interact), painted for each character: skin on
// the head and hands, hair (or their cap), shirt, trousers and shoes, by where
// each pixel sits on the body. Used by the 2D mini-games, the platformer and
// the dialogue portraits (with expressions drawn onto the template's face).
// Atlas: public/assets/eris/ (scripts/build-eris-atlas.py).
import meta from './eris.json'
import { ASSET_ROOT } from '../../assets/assetManifest.js'
import { isFemale } from './look.js'

export const ERIS = meta
const F = meta.frame // 32
// the template's colours
const LIGHT = [250, 243, 232]
const SHADE = [185, 179, 161]
const INKC = [47, 37, 34]
const MOUTH = [231, 213, 198]
const BLUSH = [209, 157, 167]

let img = null
let faceImg = null
const sheets = new Map()
const faces = new Map()
function load(src) {
  const i = new Image()
  i.src = src
  return i
}
export function erisImages() {
  if (!img && typeof Image !== 'undefined') {
    img = load(`${ASSET_ROOT}/eris/eris.png`)
    faceImg = load(`${ASSET_ROOT}/eris/faces.png`)
  }
  return { img, faceImg }
}
const ready = (i) => i && i.complete && i.naturalWidth > 0

const hex = (h, fb = '#777777') => {
  const s = /^#([0-9a-f]{6})$/i.test(h || '') ? h : fb
  return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]
}
const mul = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))))
const same = (d, i, c) => d[i] === c[0] && d[i + 1] === c[1] && d[i + 2] === c[2]

/** What a look wears on its head: hair, or a cap / beanie / bandana colour. */
function headwear(look) {
  const acc = (look?.accessories || []).find((a) => ['cap', 'beanie', 'bandana', 'beret', 'hat', 'gele'].includes(a.type))
  return acc ? { type: acc.type, color: hex(acc.color, '#222222') } : null
}

/**
 * Paint one 32x32 frame (image data, in place) for a look. Regions are rows
 * counted from the top of the figure: head (with ears) 0-10, neck 11,
 * torso and arms 12-19, legs 20-23, feet below.
 */
function paintFrame(d, W, fx, fy, look) {
  let top = -1
  for (let y = fy; y < fy + F && top < 0; y++) for (let x = fx; x < fx + F; x++) if (d[(y * W + x) * 4 + 3]) {
    top = y
    break
  }
  if (top < 0) return
  const skin = hex(look?.skin, '#5c3a24')
  const shirt = hex(look?.shirt, '#d8d2c4')
  const trousers = hex(look?.trousers, '#2c3e50')
  const shoes = hex(look?.shoes, '#1a1a1a')
  const hair = hex(look?.hair, '#161110')
  const hat = headwear(look)
  const woman = isFemale(look?.body)
  for (let y = fy; y < fy + F; y++) {
    const r = y - top
    for (let x = fx; x < fx + F; x++) {
      const i = (y * W + x) * 4
      if (!d[i + 3]) continue
      const light = same(d, i, LIGHT)
      const shade = same(d, i, SHADE)
      const mouth = same(d, i, MOUTH)
      const blush = same(d, i, BLUSH)
      if (!light && !shade && !mouth && !blush) continue // the outline and the eyes stay
      let c
      if (r <= 11) {
        // the head: hair or a hat on the crown (women's hair longer, down the sides)
        const crown = r <= (hat ? (hat.type === 'bandana' ? 2 : 3) : woman ? 3 : 2)
        const sides = !hat && woman && r <= 8 && (x - fx < 12 || x - fx > 19)
        if (crown || sides) c = hat ? hat.color : hair
        else c = mouth ? mul(skin, 0.8) : blush ? mul(skin, 1.12) : shade ? mul(skin, 0.78) : skin
      } else if (r <= 19) c = shade ? mul(shirt, 0.72) : shirt
      else if (r <= 23) c = shade ? mul(trousers, 0.75) : trousers
      else c = shoes
      d[i] = c[0]
      d[i + 1] = c[1]
      d[i + 2] = c[2]
    }
  }
}

/** The whole template atlas painted for a look (a canvas), or null while the image loads. */
export function erisSheet(look) {
  const { img: im } = erisImages()
  if (!ready(im)) return null
  const key = JSON.stringify([look?.skin, look?.shirt, look?.trousers, look?.shoes, look?.hair, look?.body, headwear(look)])
  if (sheets.has(key)) return sheets.get(key)
  const c = document.createElement('canvas')
  c.width = im.naturalWidth
  c.height = im.naturalHeight
  const g = c.getContext('2d')
  g.drawImage(im, 0, 0)
  const data = g.getImageData(0, 0, c.width, c.height)
  for (let fy = 0; fy < c.height; fy += F) for (let fx = 0; fx < c.width; fx += F) paintFrame(data.data, c.width, fx, fy, look)
  g.putImageData(data, 0, 0)
  sheets.set(key, c)
  if (sheets.size > 80) sheets.delete(sheets.keys().next().value)
  return c
}

/**
 * Draw a frame with the feet at (x, y). anim: idle | walk | run | jump | attack |
 * interact; facing: 'side' or 'front'; dir 1 faces right, -1 left (side view);
 * k = screen pixels per template pixel; rotate (radians) turns it about its middle
 * (rolls, falls); alpha fades it.
 */
export function drawEris(ctx, look, anim, f, x, y, k, { facing = 'side', dir = 1, rotate = 0, alpha = 1, squash = 1 } = {}) {
  const sheet = erisSheet(look)
  const A = meta.anims[`${anim}_${facing}`] || meta.anims[`idle_${facing}`]
  if (!sheet || !A) return false
  const fi = ((Math.floor(f) % A.frames) + A.frames) % A.frames
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.imageSmoothingEnabled = false
  ctx.translate(Math.round(x), Math.round(y))
  if (rotate) {
    ctx.translate(0, -12 * k)
    ctx.rotate(rotate)
    ctx.translate(0, 12 * k)
  }
  // the template's side view faces right; flip for left
  ctx.scale(dir * k, k * squash)
  ctx.drawImage(sheet, fi * F, A.y, F, F, -F / 2, -F, F, F)
  ctx.restore()
  return true
}

// ---------------------------------------------------------------- faces
// The template's face is neutral; expressions are drawn on: brows (row 8),
// eyes (rows 10-12), mouth (row 16), tears and sweat. 20 x 23 pixels.
export const EXPRESSIONS = ['neutral', 'happy', 'laughing', 'sad', 'angry', 'surprised', 'scared', 'serious', 'nervous']

const EYE_L = [5, 6, 7]
const EYE_R = [12, 13, 14]
function setPx(d, w, x, y, c) {
  const i = (y * w + x) * 4
  d[i] = c[0]
  d[i + 1] = c[1]
  d[i + 2] = c[2]
  d[i + 3] = 255
}
function expression(d, w, ex, skin) {
  const ink = INKC
  const dark = [42, 38, 38]
  const clearRow = (y, x0, x1) => {
    for (let x = x0; x <= x1; x++) setPx(d, w, x, y, skin)
  }
  const brows = (left, right) => {
    clearRow(7, 3, 16)
    clearRow(8, 3, 16)
    clearRow(9, 3, 16)
    left.forEach(([x, y]) => setPx(d, w, x, y, dark))
    right.forEach(([x, y]) => setPx(d, w, x, y, dark))
  }
  const mouth = (pts, fill) => {
    clearRow(15, 6, 13)
    clearRow(16, 6, 13)
    clearRow(17, 6, 13)
    pts.forEach(([x, y]) => setPx(d, w, x, y, ink))
    ;(fill || []).forEach(([x, y]) => setPx(d, w, x, y, [120, 40, 40]))
  }
  const closedEyes = () => {
    for (const y of [10, 11, 12]) {
      clearRow(y, 4, 8)
      clearRow(y, 11, 15)
    }
    ;[[5, 11], [6, 10], [7, 11], [12, 11], [13, 10], [14, 11]].forEach(([x, y]) => setPx(d, w, x, y, dark))
  }
  const line = (x0, x1, y) => Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, y])
  switch (ex) {
    case 'happy':
      brows(line(4, 8, 7), line(11, 15, 7))
      mouth([[7, 15], [8, 16], [9, 16], [10, 16], [11, 16], [12, 15]])
      break
    case 'laughing':
      brows(line(4, 8, 7), line(11, 15, 7))
      closedEyes()
      mouth([[7, 15], [8, 15], [9, 15], [10, 15], [11, 15], [12, 15], [7, 16], [12, 16], [8, 17], [9, 17], [10, 17], [11, 17]], [[8, 16], [9, 16], [10, 16], [11, 16]])
      break
    case 'sad':
      brows([[4, 9], [5, 9], [6, 8], [7, 8], [8, 7]], [[11, 7], [12, 8], [13, 8], [14, 9], [15, 9]])
      mouth([[7, 17], [8, 16], [9, 16], [10, 16], [11, 16], [12, 17]])
      setPx(d, w, 5, 13, [120, 180, 255])
      setPx(d, w, 5, 14, [120, 180, 255])
      break
    case 'angry':
      brows([[4, 7], [5, 7], [6, 8], [7, 8], [8, 9]], [[11, 9], [12, 8], [13, 8], [14, 7], [15, 7]])
      mouth([[7, 17], [8, 16], [9, 16], [10, 16], [11, 16], [12, 17]])
      break
    case 'surprised':
      brows(line(4, 8, 6), line(11, 15, 6))
      mouth([[9, 15], [10, 15], [8, 16], [11, 16], [9, 17], [10, 17]], [[9, 16], [10, 16]])
      break
    case 'scared':
      brows([[4, 8], [5, 8], [6, 7], [7, 7], [8, 6]], [[11, 6], [12, 7], [13, 7], [14, 8], [15, 8]])
      mouth([[7, 16], [8, 15], [9, 16], [10, 15], [11, 16], [12, 15]])
      setPx(d, w, 16, 7, [140, 200, 255])
      setPx(d, w, 16, 8, [140, 200, 255])
      break
    case 'serious':
      brows(line(4, 8, 8), line(11, 15, 8))
      mouth(line(7, 12, 16))
      break
    case 'nervous':
      brows([[4, 8], [5, 8], [6, 7], [7, 7], [8, 7]], [[11, 7], [12, 7], [13, 7], [14, 8], [15, 8]])
      mouth([[7, 16], [8, 16], [9, 15], [10, 16], [11, 16], [12, 15]])
      setPx(d, w, 16, 8, [140, 200, 255])
      break
    default:
      break // the template's own neutral face
  }
  void EYE_L
  void EYE_R
}

/** A portrait (data URL) of a look with an expression, scaled up crisp. Null while the image loads. */
export function erisFace(look, ex = 'neutral', scale = 4) {
  const { faceImg: fim } = erisImages()
  if (!ready(fim)) return null
  const key = JSON.stringify([look?.skin, look?.hair, look?.shirt, look?.body, headwear(look), ex, scale])
  if (faces.has(key)) return faces.get(key)
  const { w, h } = meta.faces
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  g.drawImage(fim, w * 1, 0, w, h, 0, 0, w, h) // the neutral face
  const data = g.getImageData(0, 0, w, h)
  const d = data.data
  const skin = hex(look?.skin, '#5c3a24')
  const hair = hex(look?.hair, '#161110')
  const hat = headwear(look)
  const shirt = hex(look?.shirt, '#d8d2c4')
  const woman = isFemale(look?.body)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (!d[i + 3]) continue
      const light = same(d, i, LIGHT)
      const shade = same(d, i, SHADE)
      const mouth = same(d, i, MOUTH)
      const blush = same(d, i, BLUSH)
      if (!light && !shade && !mouth && !blush && !same(d, i, [188, 144, 120])) continue
      let col
      if (y >= 19) col = shade ? mul(shirt, 0.75) : shirt // the shoulders: their shirt
      else if (y <= (hat ? 3 : woman ? 4 : 3) || (!hat && woman && y <= 12 && (x <= 3 || x >= 16))) col = hat ? hat.color : hair
      else col = mouth ? mul(skin, 1.2) : blush ? mul(skin, 1.15) : shade ? mul(skin, 0.75) : same(d, i, [188, 144, 120]) ? mul(skin, 0.6) : skin
      d[i] = col[0]
      d[i + 1] = col[1]
      d[i + 2] = col[2]
    }
  expression(d, w, ex, skin)
  g.putImageData(data, 0, 0)
  const out = document.createElement('canvas')
  out.width = w * scale
  out.height = h * scale
  const og = out.getContext('2d')
  og.imageSmoothingEnabled = false
  og.drawImage(c, 0, 0, out.width, out.height)
  const url = out.toDataURL()
  faces.set(key, url)
  if (faces.size > 200) faces.delete(faces.keys().next().value)
  return url
}

// a line written in capitals with an exclamation mark
function shouted(text) {
  const s = String(text)
  const caps = s.replace(/[^A-Za-z]/g, '')
  return caps.length >= 6 && caps === caps.toUpperCase() && s.includes('!')
}

/** Which expression fits a line: the beat's mood, or what the text says the speaker is doing. */
export function expressionFor(mood, text = '') {
  const m = (mood || '').toLowerCase()
  if (m) {
    if (/laugh/.test(m)) return 'laughing'
    if (/happy|glad|pleased|proud/.test(m)) return 'happy'
    if (/angry|furious|annoyed/.test(m)) return 'angry'
    if (/sad|tired/.test(m)) return 'sad'
    if (/nervous|anxious|worried/.test(m)) return 'nervous'
    if (/scared|afraid|fear/.test(m)) return 'scared'
    if (/surpris|shock/.test(m)) return 'surprised'
    if (/serious|cold|calm/.test(m)) return 'serious'
  }
  const t = String(text).toLowerCase()
  if (/\b(laughs?|laughing|grins?)\b/.test(t)) return 'laughing'
  if (/\b(smiles?|smiling|congratulations)\b|\behen!|\bcorrect!/.test(t)) return 'happy'
  if (/\b(cries|crying|tears|sobs?)\b/.test(t)) return 'sad'
  if (/\b(shouts?|furious|slams|thief|kisses (his|her) teeth)\b/.test(t) || /!!|[A-Z]{5,}!/.test(String(text)) || shouted(text)) return 'angry'
  if (/\b(shaking|afraid|scared|whispers?|trembl)/.test(t)) return 'scared'
  if (/\?!|\bwhat\?|\bah-ah\b|\bhaba\b/.test(t)) return 'surprised'
  if (/\b(quietly|very still|long time|long pause)\b/.test(t)) return 'serious'
  return 'neutral'
}
