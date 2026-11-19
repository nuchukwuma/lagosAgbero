// Pixel-art backdrops for 2D fights, matched to where the fight happens: the
// world you're in (Iyana-Wahala, the village, the campus) and the nearest
// place in it (the bus stop, under the bridge, the market, the square, the
// farm, the hostels...). Same pixel size and outline as the fighters.
//
// Layers slide at their own pace as the camera follows the fighters:
//   sky      colour bands, sun or moon, stars, clouds (fixed)
//   far      skyline or hills
//   mid      the buildings and things of the place
//   people   a few passers-by on the far side, walking, standing, cheering,
//            animated with the same pixel frames as the fighters
//   ground   road, red earth or paving, where the fighters stand
// Each layer is painted once at pixel size into a small canvas and drawn
// scaled up with crisp pixels, so a frame costs a handful of image copies.

import { makePixelFighter, M_PER_PX, CW, CH, AX, AY } from './pixel.js'
import { pixelText, textWidth } from './pixelFont.js'
import { randomLook } from '../../../characters/look.js'

const OUT = '#1a1630' // outline for scenery: a touch softer than the fighters'

const SKIES = {
  day: { bands: ['#4aa3df', '#62b3e6', '#82c4ec', '#a6d6f2', '#c7e7f7'], sun: '#fff6c8', stars: false, clouds: '#ffffff', tint: null, lit: 0 },
  dawn: { bands: ['#5d6aa6', '#8a80b2', '#c495ad', '#e9aca0', '#f8cb9e'], sun: '#fff0c0', stars: false, clouds: '#ffe3dc', tint: 'rgba(90,60,120,0.18)', lit: 0.3 },
  dusk: { bands: ['#2e2a5a', '#53407a', '#8e5383', '#cc6878', '#f29a5e'], sun: '#ffc27a', stars: false, clouds: '#f4a9a0', tint: 'rgba(70,30,90,0.3)', lit: 0.6 },
  night: { bands: ['#0a1330', '#101d42', '#172a55', '#1f3868', '#29477b'], sun: '#f4f1dc', stars: true, clouds: null, tint: 'rgba(8,16,52,0.5)', lit: 0.8 },
}
const WALLS = ['#e8a64e', '#8fcf7f', '#79a8de', '#efdcb4', '#e58a7f', '#c2b5a4', '#dcbf68', '#8fd0be']
const SIGNS = [
  ['MAMA PUT', '#c0392b', '#ffffff'],
  ['PHARMACY', '#1e8449', '#ffffff'],
  ['BUKKA', '#a04000', '#ffffff'],
  ['POS', '#117a65', '#ffffff'],
  ['RECHARGE', '#f1c40f', '#1a1630'],
  ['BARBER', '#d35400', '#ffffff'],
  ['VOTE OWO', '#6c3483', '#ffffff'],
]

// which backdrop each spot of each world uses
const PLACES = {
  iyanaWahala: { underBridge: 'bridge', market: 'market', adaShop: 'market', mamaPut: 'market', teaTable: 'market', southStreet: 'street', richStreet: 'street', _: 'busStop' },
  nkwoAgu: { farm: 'farm', palmwine: 'farm', church: 'church', shrine: 'shrine', emekaHome: 'compound', chinweHouse: 'compound', ikeHouse: 'compound', _: 'square' },
  royalCrest: { hostel: 'hostel', cafeteria: 'hostel', backGate: 'hostel', field: 'field', carPark: 'field', _: 'quad' },
}
const WORLD_KIND = { iyanaWahala: 'lagos', nkwoAgu: 'village', royalCrest: 'campus' }

/** The backdrop for a fight in this world near this spot. */
export function backdropFor(world, spot) {
  const kind = WORLD_KIND[world] || 'lagos'
  const places = PLACES[world] || PLACES.iyanaWahala
  return { kind, place: places[spot] || places._ }
}

function rng(seed) {
  let s = Math.abs(seed) % 233280
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}
function strip(w, h) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  return [c, c.getContext('2d')]
}
function hexShade(hex, k) {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(Math.max(0, Math.min(255, v * k))))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

// ---- little pixel painters (g: a canvas at one unit per pixel) ----
function painter(g, lights) {
  const R = (x, y, w, h, c) => {
    g.fillStyle = c
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  }
  const box = (x, y, w, h, fill) => {
    R(x, y, w, h, OUT)
    R(x + 1, y + 1, w - 2, h - 2, fill)
  }
  const circ = (cx, cy, r, c) => {
    g.fillStyle = c
    for (let y = -r; y <= r; y++) {
      const w = Math.round(Math.sqrt(r * r - y * y))
      g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1)
    }
  }
  // a window: dark glass now; at dusk and night some glow (painted after the tint)
  const win = (x, y, w, h, r) => {
    box(x, y, w, h, '#2b3c52')
    R(x + 1, y + 1, 1, h - 2, '#4d6680')
    if (r < lights.lit) lights.list.push([x + 1, y + 1, w - 2, h - 2])
  }
  const sign = (x, y, text, bg, fg) => {
    const w = textWidth(text) + 4
    box(x, y, w, 9, bg)
    pixelText(g, text, x + 2, y + 2, fg)
    lights.signs.push([x, y, w, 9])
    return w
  }
  return { R, box, circ, win, sign }
}

/**
 * Paint a stage. W, H: the screen (CSS px). PX: screen pixels per sprite
 * pixel. groundY: where the fighters' feet are. pan: metres the camera can
 * slide either way. world/place: from backdropFor().
 */
export function makePixelStage({ W, H, PX, groundY, pan, time = 'day', kind = 'lagos', place = 'busStop', light = false, seed = 7 }) {
  const sky = SKIES[time] || SKIES.day
  const r = rng(seed)
  const Wu = Math.ceil(W / PX) + 2
  const Hu = Math.ceil(H / PX) + 2
  const groundU = Math.round(groundY / PX)
  const backU = groundU - 8 // the far side of the street, where people walk
  const panU = pan / M_PER_PX
  const span = (k) => Math.ceil(Wu + 2 * panU * k) + 4
  const FAR = 0.22
  const MID = 0.55

  // ---- sky (fixed) ----
  const [skyC, s] = strip(Wu, backU)
  const bandH = Math.ceil(backU / sky.bands.length)
  sky.bands.forEach((c, i) => {
    s.fillStyle = c
    s.fillRect(0, i * bandH, Wu, bandH + 1)
  })
  // dithered seams between the bands, the classic pixel-art gradient
  for (let i = 1; i < sky.bands.length; i++)
    for (let x = 0; x < Wu; x += 2) {
      s.fillStyle = sky.bands[i]
      s.fillRect(x + (i % 2), i * bandH - 1, 1, 1)
      s.fillStyle = sky.bands[i - 1]
      s.fillRect(x + 1 - (i % 2), i * bandH, 1, 1)
    }
  if (sky.stars) {
    for (let i = 0; i < Wu * 0.35; i++) {
      s.fillStyle = r() < 0.2 ? '#ffffff' : '#9fb3d9'
      s.fillRect(Math.floor(r() * Wu), Math.floor(r() * backU * 0.6), 1, 1)
    }
  }
  const sp = painter(s, { lit: 0, list: [], signs: [] })
  const sunX = Math.round(Wu * 0.68)
  const sunY = Math.round(Math.max(Hu * 0.24, 14))
  if (time === 'night') {
    sp.circ(sunX, sunY, 7, '#3a4f80')
    sp.circ(sunX, sunY, 6, sky.sun)
    sp.R(sunX - 3, sunY - 2, 2, 2, '#cfcdb8')
    sp.R(sunX + 2, sunY + 1, 2, 2, '#cfcdb8')
    sp.R(sunX - 1, sunY + 3, 1, 1, '#cfcdb8')
  } else {
    sp.circ(sunX, sunY, 8, hexShade(sky.sun.length === 7 ? sky.sun : '#ffffff', 0.97))
    sp.circ(sunX, sunY, 6, sky.sun)
  }
  if (sky.clouds) {
    for (let i = 0; i < 5; i++) {
      const cx = Math.round(r() * Wu)
      const cy = Math.round(4 + r() * backU * 0.35)
      for (const [dx, dy, rr] of [[0, 0, 4], [5, 1, 3], [-5, 1, 3], [2, -2, 3]]) sp.circ(cx + dx, cy + dy, rr, sky.clouds)
      sp.R(cx - 8, cy + 3, 17, 1, hexShade(sky.clouds, 0.9))
    }
  }

  // ---- far: skyline or hills ----
  const farW = span(FAR)
  const [farC, f] = strip(farW, backU)
  const farLights = { lit: sky.lit, list: [], signs: [] }
  const fp = painter(f, farLights)
  const farCol = time === 'night' ? '#1c2c52' : time === 'dusk' ? '#5a4870' : time === 'dawn' ? '#8a86ae' : '#9cb6cc'
  const hillCol = time === 'night' ? '#18304a' : time === 'dusk' ? '#4a4a5e' : '#6fa06a'
  if (kind === 'lagos') {
    for (let x = 0; x < farW; ) {
      const w = 6 + Math.floor(r() * 10)
      const h = 10 + Math.floor(r() * 22)
      fp.R(x, backU - 8 - h, w, h + 8, farCol)
      for (let wy = backU - 6 - h; wy < backU - 8; wy += 3) for (let wx = x + 1; wx < x + w - 1; wx += 2) if (r() < sky.lit * 0.5) fp.R(wx, wy, 1, 1, '#ffd77a')
      x += w + Math.floor(r() * 3)
    }
  } else {
    // rolling hills with palms (village) or trees and a water tower (campus)
    f.fillStyle = hillCol
    for (let x = 0; x < farW; x++) {
      const h = 10 + Math.round(Math.sin(x * 0.05 + seed) * 4 + Math.sin(x * 0.13) * 2)
      f.fillRect(x, backU - 6 - h, 1, h + 6)
    }
    for (let x = Math.floor(r() * 20); x < farW; x += 14 + Math.floor(r() * 20)) {
      const by = backU - 14
      if (kind === 'village') {
        fp.R(x, by - 12, 1, 12, hexShade(hillCol, 0.7))
        for (const [dx, dy] of [[-3, 0], [-2, -1], [2, -1], [3, 0], [-1, -1], [1, -1]]) fp.R(x + dx, by - 12 + dy, 2, 1, hexShade(hillCol, 0.7))
      } else fp.circ(x, by - 5, 4, hexShade(hillCol, 0.75))
    }
    if (kind === 'campus') {
      const tx = Math.round(farW * 0.3)
      fp.R(tx, backU - 30, 2, 18, hexShade(hillCol, 0.6))
      fp.R(tx + 6, backU - 30, 2, 18, hexShade(hillCol, 0.6))
      fp.R(tx - 2, backU - 38, 12, 8, hexShade(hillCol, 0.6))
    }
  }

  // ---- mid: the place itself ----
  const midW = span(MID)
  const [midC, m] = strip(midW, groundU)
  const lights = { lit: sky.lit, list: [], signs: [] }
  const p = painter(m, lights)
  const base = backU // things stand on the far pavement
  const poles = []

  const building = (x, w, storeys) => {
    const wall = WALLS[Math.floor(r() * WALLS.length)]
    const h = 8 + storeys * 9
    const top = base - h
    p.box(x, top, w, h + 1, wall)
    p.R(x + w - 3, top + 1, 2, h - 1, hexShade(wall, 0.82))
    for (let fl = 0; fl < storeys; fl++) for (let wx = x + 3; wx < x + w - 6; wx += 7) p.win(wx, top + 3 + fl * 9, 4, 5, r())
    // roof: a zinc slope or a flat top with a black water tank
    if (r() < 0.5) {
      for (let k = 0; k < 4; k++) p.R(x - 1 + k * 2, top - k - 1, w + 2 - k * 4, 1, k % 2 ? '#8d8f93' : '#6e5a4e')
    } else if (r() < 0.8) {
      const tx = x + 2 + Math.floor(r() * (w - 9))
      p.box(tx, top - 6, 6, 6, '#232327')
      p.R(tx + 1, top - 5, 1, 4, '#3d3d44')
    }
    // the shop below: an opening, a striped awning, a sign
    const sx = x + 2
    const sw = w - 4
    p.R(sx, base - 7, sw, 7, '#2b2420')
    const stripe = ['#c0392b', '#2471a3', '#229954', '#d4ac0d'][Math.floor(r() * 4)]
    for (let k = 0; k < sw; k++) p.R(sx + k, base - 9, 1, 2, Math.floor(k / 2) % 2 ? '#f4f1ea' : stripe)
    const [text, bg, fg] = SIGNS[Math.floor(r() * SIGNS.length)]
    if (textWidth(text) + 4 <= w) p.sign(x + Math.floor((w - textWidth(text) - 4) / 2), base - 19 - (storeys > 1 ? 0 : 0), text, bg, fg)
    poles.push(x + w + 1)
  }
  const danfo = (x) => {
    const y = base - 13
    p.box(x, y, 30, 11, '#f2c21b')
    p.R(x + 1, y + 6, 28, 1, '#1a1630')
    p.R(x + 1, y + 8, 28, 1, '#1a1630')
    for (let k = 0; k < 6; k++) p.box(x + 2 + k * 4, y + 1, 4, 4, '#9fd3e8')
    p.box(x + 26, y + 1, 3, 5, '#9fd3e8')
    for (const wx of [x + 4, x + 22]) {
      p.circ(wx + 2, base - 1, 2, OUT)
      p.R(wx + 1, base - 2, 2, 2, '#777a80')
    }
  }
  const shelter = (x) => {
    p.R(x, base - 16, 2, 16, OUT)
    p.R(x + 28, base - 16, 2, 16, OUT)
    p.box(x - 2, base - 18, 34, 3, '#2e7d4f')
    p.box(x + 4, base - 6, 22, 2, '#8a6a44')
    p.sign(x + 1, base - 29, 'IYANA-WAHALA', '#1f4f8a', '#ffffff')
  }
  const stall = (x) => {
    const col = ['#e74c3c', '#2e86de', '#27ae60', '#f39c12'][Math.floor(r() * 4)]
    // the umbrella
    for (let k = 0; k < 6; k++) p.R(x + 6 - k * 2, base - 20 + k, 4 + k * 4, 1, k % 2 ? hexShade(col, 0.85) : col)
    p.R(x + 7, base - 14, 1, 14, OUT)
    // the table and the goods
    p.box(x - 1, base - 6, 18, 2, '#8a6a44')
    p.R(x, base - 4, 1, 4, OUT)
    p.R(x + 15, base - 4, 1, 4, OUT)
    const good = ['#d63c2f', '#f2c21b', '#3f9a3a', '#e67e22'][Math.floor(r() * 4)]
    for (const gx of [1, 6, 11]) {
      p.R(x + gx, base - 8, 4, 2, good)
      p.R(x + gx + 1, base - 9, 2, 1, good)
    }
  }
  const tree = (x, h = 18) => {
    p.box(x - 1, base - h, 3, h, '#6b4a2e')
    const leaf = time === 'night' ? '#2e6b3a' : '#3f9a3a'
    p.circ(x, base - h - 4, 8, OUT)
    p.circ(x, base - h - 4, 7, leaf)
    p.circ(x - 3, base - h - 6, 3, hexShade(leaf.length === 7 ? leaf : '#3f9a3a', 1.2))
  }
  const palm = (x) => {
    for (let k = 0; k < 22; k++) p.R(x + Math.round(Math.sin(k / 7) * 2), base - k, 2, 1, '#7a5a3a')
    const tx = x + Math.round(Math.sin(22 / 7) * 2)
    const leaf = '#3f9a3a'
    for (const [dx, dy] of [[-8, 2], [-5, 0], [-2, -1], [2, -1], [5, 0], [8, 2], [-6, 3], [6, 3]]) p.R(tx + Math.min(0, dx), base - 23 + dy, Math.abs(dx) + 1, 1, leaf)
  }
  const mudHouse = (x, w = 24) => {
    const h = 13
    p.box(x, base - h, w, h + 1, '#b5703f')
    p.R(x + 1, base - h + 1, w - 2, 1, '#9a5a30')
    for (let k = 0; k < 4; k++) p.R(x - 2 + k, base - h - 1 - k, w + 4 - k * 2, 1, k % 2 ? '#8d8f93' : '#7a6458')
    p.box(x + w - 9, base - 9, 6, 9, '#4a2e1c')
    p.win(x + 3, base - 9, 5, 4, r())
  }
  const hut = (x) => {
    p.box(x, base - 10, 16, 11, '#b5703f')
    for (let k = 0; k < 8; k++) p.R(x - 2 + k, base - 11 - k, 20 - k * 2, 1, k % 2 ? '#c9a24a' : '#b08a3a')
    p.box(x + 5, base - 7, 5, 7, '#3a2414')
  }
  const church = (x) => {
    p.box(x, base - 22, 34, 23, '#efe6d2')
    p.box(x + 12, base - 38, 10, 17, '#efe6d2')
    p.R(x + 16, base - 46, 2, 8, OUT)
    p.R(x + 13, base - 43, 8, 2, OUT)
    for (let k = 0; k < 4; k++) p.R(x - 2 + k, base - 23 - k, 38 - k * 2, 1, '#a33a2a')
    p.box(x + 14, base - 12, 6, 12, '#5a3a22')
    p.win(x + 4, base - 15, 4, 7, r())
    p.win(x + 26, base - 15, 4, 7, r())
    p.win(x + 15, base - 34, 4, 5, r())
  }
  const shrine = (x) => {
    for (const k of [0, 22]) p.box(x + k, base - 18, 3, 18, '#5a3a22')
    for (let k = 0; k < 5; k++) p.R(x - 2 + k, base - 19 - k, 29 - k * 2, 1, '#6b5a3a')
    p.box(x + 4, base - 12, 17, 12, '#3a2414')
    for (const k of [6, 10, 14, 18]) p.R(x + k, base - 12, 2, 6, '#c0392b')
    p.R(x + 11, base - 4, 3, 4, '#f4f1ea')
  }
  const faculty = (x, w = 54) => {
    const h = 30
    p.box(x, base - h, w, h + 1, '#efe2c4')
    p.box(x - 2, base - h - 3, w + 4, 4, '#b5402f')
    for (let k = x + 4; k < x + w - 3; k += 8) p.box(k, base - h + 8, 3, h - 8, '#fbf3e0')
    for (let k = x + 7; k < x + w - 6; k += 8) p.win(k, base - h + 10, 3, 6, r())
    p.box(x + w / 2 - 4, base - 9, 8, 9, '#5a3a22')
    p.R(x + 2, base - 1, w - 4, 1, '#bdb2a0')
    p.sign(x + Math.floor((w - textWidth('ROYAL CREST') - 4) / 2), base - h + 1, 'ROYAL CREST', '#1f3a6b', '#f1c40f')
  }
  const hostel = (x, w = 46) => {
    const h = 34
    p.box(x, base - h, w, h + 1, '#d9c9a8')
    for (let fl = 0; fl < 3; fl++) {
      const fy = base - h + 3 + fl * 10
      for (let k = x + 3; k < x + w - 5; k += 7) p.win(k, fy, 4, 5, r())
      p.R(x + 1, fy + 6, w - 2, 1, OUT) // the balcony rail
      // washing on the line
      for (let k = x + 2; k < x + w - 3; k += 3) if (r() < 0.5) p.R(k, fy + 7, 2, 2, WALLS[Math.floor(r() * WALLS.length)])
    }
    p.box(x + w / 2 - 3, base - 8, 7, 8, '#5a3a22')
  }
  const goal = (x) => {
    p.R(x, base - 14, 1, 14, '#f4f1ea')
    p.R(x + 24, base - 14, 1, 14, '#f4f1ea')
    p.R(x, base - 14, 25, 1, '#f4f1ea')
    for (let k = 2; k < 24; k += 3) p.R(x + k, base - 13, 1, 13, 'rgba(244,241,234,0.35)')
  }
  const stand = (x) => {
    for (let k = 0; k < 4; k++) p.box(x + k * 3, base - 4 - k * 4, 30 - k * 6, 4 + k * 4, k % 2 ? '#2e86de' : '#2471a3')
  }
  const lamp = (x) => {
    p.R(x, base - 26, 1, 26, OUT)
    p.box(x - 2, base - 30, 5, 4, time === 'night' || time === 'dusk' ? '#fff3a0' : '#c9d6dd')
    if (time === 'night' || time === 'dusk') lights.list.push([x - 1, base - 29, 3, 2])
  }
  const wall = (x, w) => {
    p.box(x, base - 7, w, 8, '#c9b08a')
    for (let k = x + 1; k < x + w - 1; k += 5) p.R(k, base - 6, 1, 6, '#b39a74')
  }
  const bridgeDeck = () => {
    const top = Math.max(2, base - 32) // low enough to show under the health bars
    p.R(0, top, midW, 10, '#8b8d92')
    p.R(0, top + 10, midW, 3, '#55585e')
    p.R(0, top + 13, midW, 2, '#3a3c41')
    p.R(0, top - 2, midW, 2, '#a5a7ab')
    for (let x = 6; x < midW; x += 46) {
      p.box(x, top + 15, 10, base - top - 15, '#7d8086')
      p.R(x + 7, top + 16, 2, base - top - 17, '#686b71')
      // graffiti and hand-painted words along the face of the deck
      if (r() < 0.7) pixelText(m, ['NO PISS HERE', 'JESUS IS LORD', 'OBI', 'GOD WIN', 'POST NO BILL'][Math.floor(r() * 5)], x + 14, top + 3, ['#e74c3c', '#f1c40f', '#ffffff', '#5fd0ff'][Math.floor(r() * 4)])
    }
  }

  // compose the place, left to right
  const fill = (fn) => {
    for (let x = -4; x < midW; ) x = fn(x)
  }
  if (kind === 'lagos') {
    if (place === 'bridge') {
      fill((x) => {
        if (r() < 0.45) stall(x + 4)
        return x + 26 + Math.floor(r() * 12)
      })
      bridgeDeck()
    } else if (place === 'market') {
      fill((x) => {
        if (r() < 0.3) {
          building(x, 22 + Math.floor(r() * 8), 1)
          return x + 34
        }
        stall(x + 2)
        return x + 22 + Math.floor(r() * 4)
      })
    } else if (place === 'street') {
      fill((x) => {
        const w = 24 + Math.floor(r() * 10)
        building(x, w, 1 + Math.floor(r() * 3))
        return x + w + 1 + Math.floor(r() * 3)
      })
    } else {
      fill((x) => {
        const k = r()
        if (k < 0.25) {
          shelter(x + 4)
          return x + 42
        }
        if (k < 0.45) {
          danfo(x + 2)
          return x + 38
        }
        const w = 24 + Math.floor(r() * 10)
        building(x, w, 1 + Math.floor(r() * 2))
        return x + w + 2
      })
    }
  } else if (kind === 'village') {
    fill((x) => {
      const k = r()
      if (place === 'church' && k < 0.3) {
        church(x + 2)
        return x + 44
      }
      if (place === 'shrine' && k < 0.35) {
        shrine(x + 2)
        return x + 34
      }
      if (place === 'farm') {
        if (k < 0.3) hut(x + 2)
        else palm(x + 8)
        return x + 22 + Math.floor(r() * 10)
      }
      if (place === 'square' && k < 0.25) {
        tree(x + 10, 20)
        p.box(x + 2, base - 4, 18, 2, '#8a6a44')
        return x + 30
      }
      if (k < 0.6) {
        mudHouse(x + 2, 22 + Math.floor(r() * 6))
        return x + 32
      }
      if (place === 'compound' && k < 0.8) {
        wall(x, 26)
        return x + 28
      }
      palm(x + 6)
      return x + 16
    })
  } else {
    fill((x) => {
      const k = r()
      if (place === 'field') {
        if (k < 0.3) {
          goal(x + 4)
          return x + 36
        }
        if (k < 0.55) {
          stand(x + 2)
          return x + 36
        }
        if (k < 0.7) lamp(x + 6)
        else tree(x + 8)
        return x + 20
      }
      if (place === 'hostel' && k < 0.55) {
        hostel(x + 2)
        return x + 52
      }
      if (k < 0.45) {
        faculty(x + 2)
        return x + 60
      }
      if (k < 0.7) tree(x + 8)
      else lamp(x + 6)
      return x + 18
    })
  }
  // power lines between the poles in Lagos
  if (kind === 'lagos' && place !== 'bridge') {
    const used = poles.filter((_, i) => i % 2 === 0)
    for (const x of used) {
      p.R(x, base - 40, 1, 40, '#4a3a30')
      p.R(x - 3, base - 39, 7, 1, '#4a3a30')
    }
    m.fillStyle = 'rgba(20,16,30,0.75)'
    for (let i = 0; i + 1 < used.length; i++) {
      const a = used[i]
      const b = used[i + 1]
      for (let x = a; x <= b; x++) {
        const k = (x - a) / (b - a || 1)
        m.fillRect(x, base - 39 + Math.round(Math.sin(k * Math.PI) * 4), 1, 1)
      }
    }
  }
  // dusk and night: everything darkens, then windows, signs and lamps glow
  if (sky.tint) {
    for (const [c, g] of [[midC, m], [farC, f]]) {
      g.globalCompositeOperation = 'source-atop'
      g.fillStyle = sky.tint
      g.fillRect(0, 0, c.width, c.height)
      g.globalCompositeOperation = 'source-over'
    }
    for (const [L, g] of [[lights, m], [farLights, f]]) {
      g.fillStyle = '#ffd77a'
      for (const [x, y, w, h] of L.list) g.fillRect(x, y, w, h)
    }
    // signboards stay readable: lift them back up a little
    m.globalAlpha = 0.5
    for (const [x, y, w, h] of lights.signs) m.drawImage(midC, x, y, w, h, x, y, w, h)
    m.globalAlpha = 1
  }

  // ---- ground ----
  const gW = span(1)
  const gH = Hu - backU
  const [grC, gr] = strip(gW, gH)
  const gp = painter(gr, { lit: 0, list: [], signs: [] })
  const dark = time === 'night' ? 0.55 : time === 'dusk' ? 0.75 : time === 'dawn' ? 0.88 : 1
  const col = (hex) => hexShade(hex, dark)
  if (kind === 'lagos') {
    gp.R(0, 0, gW, 5, col('#b9b0a2')) // the far pavement
    for (let x = 0; x < gW; x += 9) gp.R(x, 0, 1, 5, col('#9a9184'))
    for (let x = 0, i = 0; x < gW; x += 4, i++) gp.R(x, 5, 4, 2, i % 2 ? '#1c1c1c' : col('#e8c21a')) // kerb
    gp.R(0, 7, gW, gH, col('#56565a')) // asphalt
    for (let i = 0; i < gW * 0.4; i++) gp.R(Math.floor(r() * gW), 7 + Math.floor(r() * gH), 1 + Math.floor(r() * 2), 1, r() < 0.5 ? col('#6a6a6e') : col('#47474b'))
    const laneY = groundU - backU + 6
    for (let x = 0; x < gW; x += 14) gp.R(x, laneY, 7, 1, col('#d9d4c4'))
  } else if (kind === 'village') {
    gp.R(0, 0, gW, gH, col('#b8693a'))
    for (let x = 0; x < gW; x += 3) if (r() < 0.6) gp.R(x, 0, 1, 1 + Math.floor(r() * 2), col('#4f8a3a')) // grass along the back
    for (let i = 0; i < gW * 0.5; i++) gp.R(Math.floor(r() * gW), 2 + Math.floor(r() * gH), 1, 1, r() < 0.5 ? col('#a05a30') : col('#cc7d4a'))
    if (place === 'farm') for (let x = 2; x < gW; x += 8) gp.R(x, 1, 5, 2, col('#8f4e28')) // yam mounds
  } else {
    gp.R(0, 0, gW, 4, col(place === 'field' ? '#4f9a3a' : '#5fa84a')) // lawn
    for (let x = 0; x < gW; x += 2) if (r() < 0.4) gp.R(x, 0, 1, 1, col('#7bc25f'))
    gp.R(0, 4, gW, gH, col(place === 'field' ? '#b8553a' : '#c9c3b6')) // paving (or the running track)
    if (place === 'field') for (const y of [8, 14]) gp.R(0, y, gW, 1, col('#f4f1ea'))
    else {
      for (let x = 0; x < gW; x += 6) gp.R(x, 4, 1, gH, col('#b3ad9f'))
      for (let y = 9; y < gH; y += 6) gp.R(0, y, gW, 1, col('#b3ad9f'))
    }
  }

  // ---- people on the far side, animated with the fighters' own frames ----
  const PXs = Math.max(1, Math.round(PX * 0.5)) // further away: smaller
  const people = []
  const count = light ? 3 : 6
  for (let i = 0; i < count; i++) {
    const role = i % 3 === 0 ? 'walker' : i % 3 === 1 ? 'fan' : r() < 0.5 ? 'walker' : 'fan'
    people.push({
      sprite: makePixelFighter(randomLook(seed * 7 + i * 13, r() < 0.5 ? 'male' : 'female')),
      role,
      x: (r() - 0.5) * (W / PX + panU) * 1.2, // in units, from the middle
      dir: r() < 0.5 ? -1 : 1,
      speed: 6 + r() * 6, // units a second
      phase: r() * 10,
    })
  }
  const spanPeople = (W / PX + panU * 2) * 1.2
  // push them back into the scene: the same haze or night as the buildings
  const haze = sky.tint || 'rgba(150,170,200,0.3)'
  for (const q of people)
    for (const list of Object.values(q.sprite.frames))
      for (const fr of list) {
        const g = fr.canvas.getContext('2d')
        g.globalCompositeOperation = 'source-atop'
        g.fillStyle = haze
        g.fillRect(0, 0, CW, CH)
      }

  const off = (k, w) => Math.round(-(w * PX - W) / 2)
  return {
    PX,
    /** Draw the backdrop for the camera at camX (metres). cheer: 0..1 */
    draw(ctx, camX, t, cheer) {
      ctx.imageSmoothingEnabled = false
      const cu = camX / M_PER_PX // camera in units
      ctx.drawImage(skyC, 0, 0, skyC.width * PX, skyC.height * PX)
      ctx.drawImage(farC, off(FAR, farW) - Math.round(cu * FAR) * PX, 0, farW * PX, backU * PX)
      ctx.drawImage(midC, off(MID, midW) - Math.round(cu * MID) * PX, 0, midW * PX, groundU * PX)
      ctx.drawImage(grC, off(1, gW) - Math.round(cu) * PX, backU * PX, gW * PX, gH * PX)
      // people walk along the far pavement; fans bounce, and cheer when it gets loud
      const peopleY = (backU + 3) * PX
      for (const q of people) {
        let x = q.x
        let frame
        let face = q.dir
        if (q.role === 'walker') {
          x = ((((q.x + q.dir * q.speed * t) % spanPeople) + spanPeople * 1.5) % spanPeople) - spanPeople / 2
          frame = q.sprite.frames.stroll[Math.floor((t + q.phase) * 8) % 4]
        } else {
          face = q.x < cu ? 1 : -1 // fans face the fight
          const list = cheer > 0.4 ? q.sprite.frames.cheer : q.sprite.frames.stand
          frame = list[Math.floor((t + q.phase) * (cheer > 0.4 ? 6 : 2)) % list.length]
        }
        const sx = Math.round(W / 2 + (x - cu * 0.85) * PX)
        if (sx < -CW * PXs || sx > W + CW * PXs) continue
        ctx.save()
        ctx.translate(sx, peopleY)
        ctx.scale(face * PXs, PXs)
        ctx.drawImage(frame.canvas, -AX, -AY - 1, CW, CH)
        ctx.restore()
      }
    },
    /** Anything in front of the fighters (nothing yet). */
    drawFront() {},
  }
}
