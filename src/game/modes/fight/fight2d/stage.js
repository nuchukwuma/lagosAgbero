// The street behind a 2D fight, painted once when the fight starts (and when
// the screen changes size), then slid sideways as the camera follows the
// fighters. Two painted strips (the backdrop at a slower pace for depth, the
// road at the fighters' pace) plus a crowd drawn live, so they can bounce and
// cheer. Lagos details: painted shopfronts and signboards, water tanks on the
// roofs, power lines, yellow-and-black kerbs. Cartoon style to match the
// fighters: thick dark outlines, bright colours; at night a big moon, stars,
// layered blue silhouettes and street lamps that glow.

const THEMES = {
  dawn: { skyTop: '#7f8fc4', skyBottom: '#f5b98a', sun: '#ffd9a0', haze: 'rgba(245,190,150,0.35)', tint: null, lights: false },
  day: { skyTop: '#5fb2ec', skyBottom: '#cfeaf8', sun: '#fff6d5', haze: 'rgba(220,235,245,0.35)', tint: null, lights: false },
  dusk: { skyTop: '#46406f', skyBottom: '#f08a4b', sun: '#ffb36b', haze: 'rgba(240,140,90,0.3)', tint: 'rgba(70,40,80,0.18)', lights: true },
  night: { skyTop: '#081a36', skyBottom: '#2c6688', sun: '#f6f3de', haze: 'rgba(30,70,110,0.28)', tint: 'rgba(14,34,80,0.34)', lights: true },
}
const WALLS = ['#e8a64e', '#7fcf7f', '#6fa8de', '#f0dfb8', '#e57f7f', '#b3a99c', '#d8b660', '#86d0bc']
const INK = '#120a08' // the outline colour, as on the fighters
const SIGNS = [
  ['MAMA PUT', '#c0392b', '#fff'],
  ['GOD DEY PHARMACY', '#1e8449', '#fff'],
  ['VOTE OWO NLA', '#6c3483', '#fff'],
  ['NO PARKING', '#f4d03f', '#111'],
  ['ADE & SONS', '#1f618d', '#fff'],
  ['BARBING SALOON', '#d35400', '#fff'],
  ['RECHARGE CARD', '#f1c40f', '#111'],
  ['JESUS IS LORD', '#ecf0f1', '#922b21'],
  ['POS / TRANSFER', '#117a65', '#fff'],
  ['BUKKA', '#a04000', '#fff'],
]

function rng(seed) {
  let s = seed % 233280
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}
function shade(color, k) {
  // '#rrggbb' or 'rgb(r,g,b)'
  const n = color[0] === '#' ? parseInt(color.slice(1), 16) : color.match(/\d+/g).reduce((v, x) => (v << 8) | +x, 0)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(Math.max(0, Math.min(255, v * k))))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}
function canvas(w, h, dpr) {
  const c = document.createElement('canvas')
  c.width = Math.ceil(w * dpr)
  c.height = Math.ceil(h * dpr)
  const ctx = c.getContext('2d')
  ctx.scale(dpr, dpr)
  return [c, ctx]
}

/**
 * Paint a stage. W, H: the screen (CSS px); ppm: pixels a metre where the
 * fighters stand; groundY: their feet; pan: how far (metres) the camera can
 * slide either way; light: Light mode (fewer details, a smaller crowd).
 */
export function makeStage({ W, H, ppm, groundY, pan, time = 'day', dpr = 1, light = false, seed = 7 }) {
  const theme = THEMES[time] || THEMES.day
  const backY = groundY - Math.max(18, 0.9 * ppm) // where the pavement meets the shops
  const BACK = 0.45 // the backdrop moves at this pace (further away)
  const backW = W + 2 * pan * ppm * BACK + 4
  const floorW = W + 2 * pan * ppm + 4
  const r = rng(seed)
  const bppm = ppm * 0.45 // the scale of the backdrop

  // ---- backdrop: sky, far towers, shops ----
  // drawn smaller than the fighters (further away), so the sky shows above
  const [back, b] = canvas(backW, backY + 2, dpr)
  const sky = b.createLinearGradient(0, 0, 0, backY)
  sky.addColorStop(0, theme.skyTop)
  sky.addColorStop(1, theme.skyBottom)
  b.fillStyle = sky
  b.fillRect(0, 0, backW, backY + 2)
  // sun or moon, low over the rooftops; at night a big moon with a halo, and stars
  const night = time === 'night'
  const mx = backW * 0.62
  const my = backY * (time === 'day' ? 0.18 : night ? 0.58 : 0.42) // (below the health bars)
  const mr = Math.max(14, H * (night ? 0.085 : 0.05))
  if (night) {
    for (let i = 0; i < (light ? 40 : 90); i++) {
      b.fillStyle = `rgba(255,255,240,${0.3 + r() * 0.6})`
      const sr = r() < 0.15 ? 1.6 : 0.9
      b.beginPath()
      b.arc(r() * backW, r() * backY * 0.7, sr, 0, Math.PI * 2)
      b.fill()
    }
    const halo = b.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 3.2)
    halo.addColorStop(0, 'rgba(220,240,255,0.35)')
    halo.addColorStop(1, 'rgba(220,240,255,0)')
    b.fillStyle = halo
    b.fillRect(mx - mr * 3.2, my - mr * 3.2, mr * 6.4, mr * 6.4)
  }
  b.fillStyle = theme.sun
  b.globalAlpha = night ? 1 : 0.9
  b.beginPath()
  b.arc(mx, my, mr, 0, Math.PI * 2)
  b.fill()
  b.globalAlpha = 1
  if (night) {
    // craters
    b.fillStyle = 'rgba(170,175,160,0.45)'
    for (const [cx, cy, cr] of [[-0.35, -0.2, 0.22], [0.25, 0.1, 0.16], [-0.05, 0.42, 0.12], [0.38, -0.38, 0.1], [-0.42, 0.3, 0.08]]) {
      b.beginPath()
      b.arc(mx + cx * mr, my + cy * mr, cr * mr, 0, Math.PI * 2)
      b.fill()
    }
  }
  // clouds
  b.fillStyle = time === 'night' ? 'rgba(120,160,200,0.18)' : 'rgba(255,255,255,0.7)'
  for (let i = 0; i < (light ? 3 : 6); i++) {
    const x = r() * backW
    const y = backY * (0.08 + r() * 0.3)
    const s = 18 + r() * 30
    for (const [dx, dy, k] of [[0, 0, 1], [s * 0.9, 4, 0.8], [-s * 0.8, 5, 0.7], [s * 0.3, -s * 0.35, 0.75]]) {
      b.beginPath()
      b.ellipse(x + dx, y + dy, s * k, s * k * 0.6, 0, 0, Math.PI * 2)
      b.fill()
    }
  }
  // far towers (the island skyline), hazy
  const farBase = backY - bppm * 1.2
  const farColor = time === 'night' ? '#133052' : time === 'dusk' ? '#5b4a6e' : '#8fa6bd'
  b.fillStyle = farColor
  for (let x = 0; x < backW; ) {
    const w = 30 + r() * 60
    // a gap in the skyline where the moon (or sun) hangs
    const h = Math.abs(x + w / 2 - mx) < mr * 2.4 ? bppm * 0.8 : bppm * (3 + r() * 6)
    b.fillRect(x, farBase - h, w, h + bppm * 1.2)
    if (theme.lights) {
      b.fillStyle = 'rgba(255,220,140,0.55)'
      for (let wy = farBase - h + 8; wy < farBase - 6; wy += 10) for (let wx = x + 5; wx < x + w - 5; wx += 9) if (r() < 0.35) b.fillRect(wx, wy, 3, 4)
      b.fillStyle = farColor
    }
    x += w + r() * 20
  }
  // a nearer row of rooftops, palm trees and a church tower, one flat colour
  const midColor = time === 'night' ? '#1b4166' : time === 'dusk' ? '#4a3a5e' : '#7c96ad'
  b.fillStyle = midColor
  for (let x2 = 0; x2 < backW; ) {
    const w = bppm * (1.4 + r() * 2)
    if (Math.abs(x2 + w / 2 - mx) < mr * 2) {
      x2 += w // open sky under the moon
      continue
    }
    const h = bppm * (2.2 + r() * 1.6)
    const top = backY - bppm * 1.0 - h
    b.beginPath()
    b.moveTo(x2, top + h)
    b.lineTo(x2, top + bppm * 0.4)
    b.lineTo(x2 + w / 2, top)
    b.lineTo(x2 + w, top + bppm * 0.4)
    b.lineTo(x2 + w, top + h)
    b.fill()
    if (theme.lights && r() < 0.7) {
      b.fillStyle = 'rgba(255,214,120,0.75)'
      b.fillRect(x2 + w * 0.3, top + bppm * 0.8, bppm * 0.22, bppm * 0.3)
      b.fillStyle = midColor
    }
    if (r() < 0.3) {
      // a palm: a bent trunk and a burst of fronds
      const px = x2 + w + bppm * 0.2
      const pt = top - bppm * 0.8
      b.lineWidth = Math.max(2, bppm * 0.07)
      b.strokeStyle = midColor
      b.beginPath()
      b.moveTo(px, backY - bppm)
      b.quadraticCurveTo(px + bppm * 0.3, pt + bppm, px + bppm * 0.15, pt)
      b.stroke()
      for (let k = 0; k < 6; k++) {
        const a = Math.PI + (k / 5) * Math.PI
        b.beginPath()
        b.ellipse(px + bppm * 0.15 + Math.cos(a) * bppm * 0.35, pt + Math.sin(a) * bppm * 0.15 + bppm * 0.08, bppm * 0.4, bppm * 0.07, a + Math.PI / 2 + 1.5, 0, Math.PI * 2)
        b.fill()
      }
    }
    if (r() < 0.12) {
      // a church tower with its cross
      const tw = bppm * 0.7
      b.fillRect(x2 + w * 0.2, top - bppm * 1.6, tw, bppm * 1.7)
      b.beginPath()
      b.moveTo(x2 + w * 0.2 - 4, top - bppm * 1.6)
      b.lineTo(x2 + w * 0.2 + tw / 2, top - bppm * 2.3)
      b.lineTo(x2 + w * 0.2 + tw + 4, top - bppm * 1.6)
      b.fill()
      b.fillRect(x2 + w * 0.2 + tw / 2 - 1.5, top - bppm * 2.65, 3, bppm * 0.4)
      b.fillRect(x2 + w * 0.2 + tw / 2 - bppm * 0.12, top - bppm * 2.55, bppm * 0.24, 3)
    }
    x2 += w + bppm * (0.1 + r() * 0.8)
  }
  b.fillStyle = theme.haze
  b.fillRect(0, 0, backW, backY)

  // shops and houses along the street
  let x = -20
  const poles = []
  while (x < backW + 20) {
    const w = bppm * (2.6 + r() * 2.2)
    const storeys = r() < 0.55 ? 1 : r() < 0.8 ? 2 : 3
    const h = bppm * (1.0 + storeys * 1.25)
    const wall = time === 'night' ? shade(WALLS[Math.floor(r() * WALLS.length)], 0.62) : WALLS[Math.floor(r() * WALLS.length)]
    if (Math.abs(x + w / 2 - mx) < mr * 1.8 && time !== 'day') {
      // an empty lot under the moon: a low wall with the famous warning on it
      const lh = bppm * 1.1
      b.fillStyle = shade('#d8cbb0', time === 'night' ? 0.6 : 0.85)
      b.fillRect(x, backY - lh, w, lh)
      b.lineWidth = Math.max(2, bppm * 0.04)
      b.strokeStyle = INK
      b.strokeRect(x, backY - lh, w, lh)
      b.fillStyle = '#b3261e'
      b.font = `900 ${Math.round(lh * 0.24)}px system-ui, sans-serif`
      b.textAlign = 'center'
      b.textBaseline = 'middle'
      b.fillText('THIS LAND IS', x + w / 2, backY - lh * 0.66, w * 0.9)
      b.fillText('NOT FOR SALE', x + w / 2, backY - lh * 0.34, w * 0.9)
      x += w + bppm * 0.3
      continue
    }
    const top = backY - h
    b.lineWidth = Math.max(2, bppm * 0.03)
    b.strokeStyle = INK
    // wall, with its shadowed side
    b.fillStyle = wall
    b.fillRect(x, top, w, h)
    b.fillStyle = shade(wall, 0.78)
    b.fillRect(x + w * 0.86, top, w * 0.14, h)
    // stains and weathering streaks
    b.fillStyle = 'rgba(60,40,20,0.12)'
    for (let i = 0; i < 3; i++) b.fillRect(x + r() * w * 0.8, top + h * 0.2, 3 + r() * 5, h * (0.2 + r() * 0.4))
    b.strokeRect(x, top, w, h)
    // roof: zinc (corrugated, rusty) or a parapet with a water tank
    if (r() < 0.5) {
      b.fillStyle = r() < 0.5 ? '#8d8f93' : '#9c5b34'
      b.beginPath()
      b.moveTo(x - 6, top)
      b.lineTo(x + w * 0.5, top - bppm * 0.7)
      b.lineTo(x + w + 6, top)
      b.closePath()
      b.fill()
      b.stroke()
      b.strokeStyle = 'rgba(0,0,0,0.25)'
      b.lineWidth = 1
      for (let i = 1; i < 10; i++) {
        b.beginPath()
        b.moveTo(x + (w * i) / 10, top)
        b.lineTo(x + w * 0.5, top - bppm * 0.7)
        b.stroke()
      }
    } else {
      b.fillStyle = shade(wall, 0.9)
      b.fillRect(x - 3, top - 6, w + 6, 8)
      b.strokeRect(x - 3, top - 6, w + 6, 8)
      if (r() < 0.7) {
        // the black plastic water tank every roof has
        const tx = x + w * (0.2 + r() * 0.5)
        const tw = bppm * 0.55
        b.fillStyle = '#1d1d1f'
        b.fillRect(tx, top - 6 - tw * 1.05, tw, tw * 1.05)
        b.beginPath()
        b.ellipse(tx + tw / 2, top - 6 - tw * 1.05, tw / 2, tw * 0.15, 0, 0, Math.PI * 2)
        b.fill()
        b.fillStyle = 'rgba(255,255,255,0.12)'
        b.fillRect(tx + tw * 0.15, top - 6 - tw * 0.95, tw * 0.12, tw * 0.8)
      }
    }
    // windows (louvres) on the upper floors, lit at night
    b.lineWidth = Math.max(1.5, bppm * 0.022)
    b.strokeStyle = INK
    for (let f = 1; f < storeys + 1; f++) {
      const wy = top + h - bppm * (1.0 + f * 1.25) + bppm * 0.35
      if (wy < top + 4) continue
      for (let wx = x + w * 0.12; wx < x + w * 0.8; wx += bppm * 1.0) {
        const ww = bppm * 0.6
        const wh = bppm * 0.6
        const lit = theme.lights && r() < 0.5
        b.fillStyle = lit ? '#ffd27a' : '#3b4a56'
        b.fillRect(wx, wy, ww, wh)
        b.strokeRect(wx, wy, ww, wh)
        b.strokeStyle = lit ? 'rgba(120,80,20,0.5)' : 'rgba(200,210,220,0.5)'
        for (let l = 1; l < 5; l++) {
          b.beginPath()
          b.moveTo(wx + 2, wy + (wh * l) / 5)
          b.lineTo(wx + ww - 2, wy + (wh * l) / 5)
          b.stroke()
        }
        b.strokeStyle = INK
      }
    }
    // the shop at street level: an opening, a striped awning, a signboard
    const shopY = backY - bppm * 1.0
    b.fillStyle = '#2b2420'
    b.fillRect(x + w * 0.15, shopY, w * 0.5, bppm * 1.0)
    b.fillStyle = '#5a4636'
    for (let i = 0; i < 4; i++) b.fillRect(x + w * 0.18 + i * w * 0.11, shopY + bppm * 0.5, w * 0.08, bppm * 0.25) // goods on shelves
    const stripe = ['#c0392b', '#2471a3', '#229954', '#d4ac0d'][Math.floor(r() * 4)]
    for (let i = 0; i < 6; i++) {
      b.fillStyle = i % 2 ? '#f4f1ea' : stripe
      b.beginPath()
      b.moveTo(x + w * 0.1 + (i * w * 0.6) / 6, shopY - 2)
      b.lineTo(x + w * 0.1 + ((i + 1) * w * 0.6) / 6, shopY - 2)
      b.lineTo(x + w * 0.1 + ((i + 1) * w * 0.6) / 6 + 4, shopY + bppm * 0.22)
      b.lineTo(x + w * 0.1 + (i * w * 0.6) / 6 + 4, shopY + bppm * 0.22)
      b.closePath()
      b.fill()
    }
    const [text, bg, fg] = SIGNS[Math.floor(r() * SIGNS.length)]
    const sw = Math.min(w * 0.8, bppm * 2.4)
    const sh = bppm * 0.42
    const sy = shopY - sh - bppm * 0.12
    b.fillStyle = bg
    b.fillRect(x + w * 0.1, sy, sw, sh)
    b.strokeRect(x + w * 0.1, sy, sw, sh)
    b.fillStyle = fg
    b.font = `900 ${Math.round(sh * 0.55)}px system-ui, sans-serif`
    b.textAlign = 'center'
    b.textBaseline = 'middle'
    b.fillText(text, x + w * 0.1 + sw / 2, sy + sh / 2 + 1, sw * 0.9)
    poles.push(x + w + bppm * 0.2)
    x += w + bppm * (0.2 + r() * 0.5)
  }
  // power poles and the sagging wires between them
  const poleTop = backY - bppm * 4.6
  b.strokeStyle = '#3b2c22'
  b.lineWidth = Math.max(3, bppm * 0.09)
  const used = poles.filter((_, i) => i % 2 === 0)
  for (const px of used) {
    b.beginPath()
    b.moveTo(px, backY)
    b.lineTo(px, poleTop)
    b.moveTo(px - bppm * 0.4, poleTop + 6)
    b.lineTo(px + bppm * 0.4, poleTop + 6)
    b.stroke()
  }
  b.lineWidth = 1.2
  b.strokeStyle = 'rgba(20,15,10,0.8)'
  for (let i = 0; i + 1 < used.length; i++) {
    for (const off of [-0.35, 0, 0.35]) {
      b.beginPath()
      b.moveTo(used[i] + bppm * off, poleTop + 6)
      b.quadraticCurveTo((used[i] + used[i + 1]) / 2, poleTop + bppm * 0.8, used[i + 1] + bppm * off, poleTop + 6)
      b.stroke()
    }
  }
  if (theme.tint) {
    b.fillStyle = theme.tint
    b.fillRect(0, 0, backW, backY + 2)
  }

  // ---- the road the fighters stand on ----
  const floorH = H - backY
  const [floor, f] = canvas(floorW, floorH, dpr)
  const kerbY = Math.max(10, ppm * 0.3)
  // pavement slabs
  f.fillStyle = time === 'night' ? '#55555e' : '#b9b0a2'
  f.fillRect(0, 0, floorW, kerbY)
  f.strokeStyle = 'rgba(0,0,0,0.18)'
  f.lineWidth = 1
  for (let px = 0; px < floorW; px += ppm * 0.8) {
    f.beginPath()
    f.moveTo(px, 0)
    f.lineTo(px - 6, kerbY)
    f.stroke()
  }
  // the kerb, painted yellow and black
  const kh = Math.max(5, ppm * 0.1)
  for (let px = 0, i = 0; px < floorW; px += ppm * 0.45, i++) {
    f.fillStyle = i % 2 ? '#1c1c1c' : '#e8c21a'
    f.fillRect(px, kerbY, ppm * 0.45 + 1, kh)
  }
  // asphalt, darker towards the viewer, with patches, cracks and a faded line
  const road = f.createLinearGradient(0, kerbY + kh, 0, floorH)
  road.addColorStop(0, time === 'night' ? '#2c2d33' : '#5b5a58')
  road.addColorStop(1, time === 'night' ? '#1c1d22' : '#3f3e3c')
  f.fillStyle = road
  f.fillRect(0, kerbY + kh, floorW, floorH)
  for (let i = 0; i < floorW / 9; i++) {
    f.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)'
    f.fillRect(r() * floorW, kerbY + kh + r() * floorH, 2 + r() * 4, 1 + r() * 2)
  }
  f.strokeStyle = 'rgba(0,0,0,0.35)'
  f.lineWidth = 1.2
  for (let i = 0; i < 8; i++) {
    let cx = r() * floorW
    let cy = kerbY + kh + r() * floorH * 0.8
    f.beginPath()
    f.moveTo(cx, cy)
    for (let k = 0; k < 4; k++) f.lineTo((cx += (r() - 0.3) * 18), (cy += (r() - 0.5) * 8))
    f.stroke()
  }
  const lineY = groundY - backY + ppm * 0.55
  f.fillStyle = 'rgba(235,230,215,0.55)'
  for (let px = 0; px < floorW; px += ppm * 1.6) f.fillRect(px, lineY, ppm * 0.9, Math.max(2, ppm * 0.04))
  if (theme.tint) {
    f.fillStyle = theme.tint
    f.fillRect(0, 0, floorW, floorH)
  }

  // ---- the crowd: drawn live so they can bounce and cheer ----
  const people = []
  const count = light ? 8 : 15
  const crowdW = W + 2 * pan * ppm * 0.75
  for (let i = 0; i < count; i++) {
    people.push({
      x: (crowdW * (i + 0.2 + r() * 0.6)) / count,
      h: ppm * (0.95 + r() * 0.22), // further back than the fighters: smaller
      shirt: WALLS[Math.floor(r() * WALLS.length)],
      skin: ['#3d2516', '#4e2f1d', '#5c3a24', '#6e4329'][Math.floor(r() * 4)],
      phase: r() * 6,
      hat: r() < 0.3,
    })
  }

  // street lamps along the back of the pavement: posts drawn live at the
  // fighters' pace, the glow a sprite painted once
  const lit = theme.lights
  const lampH = Math.min(ppm * 2.7, (backY + kerbY * 0.6) * 0.72)
  const lamps = []
  for (let lx = ppm * (1 + r() * 2); lx < floorW; lx += ppm * (5.5 + r() * 2.5)) lamps.push(lx)
  const glowR = ppm * 1.6
  const [glow, gl] = canvas(glowR * 2, glowR * 2, 1)
  const gg = gl.createRadialGradient(glowR, glowR, 0, glowR, glowR, glowR)
  gg.addColorStop(0, 'rgba(255,240,150,0.85)')
  gg.addColorStop(0.18, 'rgba(255,225,110,0.45)')
  gg.addColorStop(1, 'rgba(255,210,90,0)')
  gl.fillStyle = gg
  gl.fillRect(0, 0, glowR * 2, glowR * 2)
  function drawLamps(ctx, x0) {
    const lw = Math.max(3, ppm * 0.08)
    for (const lx of lamps) {
      const x = x0 + lx
      if (x < -glowR || x > W + glowR) continue
      const foot = backY + kerbY * 0.6
      const top = foot - lampH
      if (lit && !light) {
        // a pool of light on the pavement (not in Light mode: big soft fills cost the most)
        ctx.globalAlpha = 0.45
        ctx.drawImage(glow, x - glowR, foot - glowR * 0.35, glowR * 2, glowR * 0.7)
        ctx.globalAlpha = 1
      }
      ctx.lineCap = 'round'
      ctx.strokeStyle = INK
      ctx.lineWidth = lw + 4
      ctx.beginPath()
      ctx.moveTo(x, foot)
      ctx.lineTo(x, top)
      ctx.stroke()
      ctx.strokeStyle = '#2f3f4c'
      ctx.lineWidth = lw
      ctx.stroke()
      ctx.lineCap = 'butt'
      ctx.fillStyle = '#2f3f4c'
      ctx.strokeStyle = INK
      ctx.lineWidth = 2
      // the base and the lantern
      ctx.fillRect(x - lw, foot - ppm * 0.25, lw * 2, ppm * 0.25)
      ctx.strokeRect(x - lw, foot - ppm * 0.25, lw * 2, ppm * 0.25)
      const lh = ppm * 0.42
      ctx.beginPath()
      ctx.moveTo(x - ppm * 0.16, top)
      ctx.lineTo(x + ppm * 0.16, top)
      ctx.lineTo(x + ppm * 0.11, top - lh)
      ctx.lineTo(x - ppm * 0.11, top - lh)
      ctx.closePath()
      ctx.fillStyle = lit ? '#fff3a0' : '#c9d6dd'
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x - ppm * 0.18, top - lh)
      ctx.lineTo(x, top - lh - ppm * 0.16)
      ctx.lineTo(x + ppm * 0.18, top - lh)
      ctx.closePath()
      ctx.fillStyle = '#2f3f4c'
      ctx.fill()
      ctx.stroke()
      const hr = glowR * (light ? 0.6 : 0.95) // the halo round the lamp
      if (lit) ctx.drawImage(glow, x - hr, top - lh / 2 - hr, hr * 2, hr * 2)
    }
  }

  return {
    backY,
    /** Draw the stage for the camera at camX (metres, the fighters' midpoint). cheer: 0..1 */
    draw(ctx, camX, t, cheer) {
      // sky above and road below the painted strips (seen when the camera eases out)
      ctx.fillStyle = theme.skyTop
      ctx.fillRect(-W, -H, W * 3, backY + H + 2)
      ctx.fillStyle = time === 'night' ? '#1c1d22' : '#3f3e3c'
      ctx.fillRect(-W, backY, W * 3, H * 2)
      ctx.drawImage(back, -(camX * BACK * ppm) - (backW - W) / 2, 0, backW, backY + 2)
      // the crowd on the pavement, at their own pace
      const cx = -(camX * 0.75 * ppm) - (crowdW - W) / 2
      for (const p of people) {
        const bob = Math.abs(Math.sin(t * (3 + cheer * 6) + p.phase)) * (2 + cheer * 7)
        drawFan(ctx, cx + p.x, backY + kerbY * 0.75 - bob, p, cheer > 0.35 && Math.sin(p.phase * 7) > -0.3)
      }
      ctx.drawImage(floor, -(camX * ppm) - (floorW - W) / 2, backY, floorW, floorH)
      drawLamps(ctx, -(camX * ppm) - (floorW - W) / 2)
    },
  }
}

function drawFan(ctx, x, feet, p, armsUp) {
  const h = p.h * 0.9
  const head = h * 0.19 // cartoon heads, like the fighters
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  // body
  ctx.fillStyle = p.shirt
  ctx.beginPath()
  ctx.moveTo(x - h * 0.13, feet - h * 0.42)
  ctx.lineTo(x + h * 0.13, feet - h * 0.42)
  ctx.lineTo(x + h * 0.15, feet - h * 0.78)
  ctx.quadraticCurveTo(x, feet - h * 0.84, x - h * 0.15, feet - h * 0.78)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  // legs and feet, standing on the pavement
  ctx.fillStyle = '#2c3e50'
  ctx.fillRect(x - h * 0.12, feet - h * 0.43, h * 0.11, h * 0.43)
  ctx.fillRect(x + h * 0.01, feet - h * 0.43, h * 0.11, h * 0.43)
  ctx.strokeRect(x - h * 0.12, feet - h * 0.43, h * 0.24, h * 0.43)
  ctx.fillStyle = '#1e140e'
  ctx.fillRect(x - h * 0.14, feet - h * 0.04, h * 0.13, h * 0.05)
  ctx.fillRect(x + h * 0.01, feet - h * 0.04, h * 0.13, h * 0.05)
  // arms: up and waving when the crowd is loud
  ctx.strokeStyle = p.skin
  ctx.lineWidth = h * 0.06
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (armsUp) {
    ctx.moveTo(x - h * 0.13, feet - h * 0.74)
    ctx.lineTo(x - h * 0.22, feet - h * 1.02)
    ctx.moveTo(x + h * 0.13, feet - h * 0.74)
    ctx.lineTo(x + h * 0.24, feet - h * 1.0)
  } else {
    ctx.moveTo(x - h * 0.14, feet - h * 0.74)
    ctx.lineTo(x - h * 0.17, feet - h * 0.5)
    ctx.moveTo(x + h * 0.14, feet - h * 0.74)
    ctx.lineTo(x + h * 0.17, feet - h * 0.5)
  }
  ctx.stroke()
  ctx.lineCap = 'butt'
  // head
  const hy = feet - h * 0.8 - head
  ctx.fillStyle = p.skin
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  ctx.beginPath()
  ctx.arc(x, hy, head, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // two big eyes, facing the fight
  ctx.fillStyle = '#fbf8f0'
  for (const ex of [-0.38, 0.32]) {
    ctx.beginPath()
    ctx.ellipse(x + ex * head, hy - head * 0.05, head * 0.22, head * 0.3, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = INK
  for (const ex of [-0.38, 0.32]) {
    ctx.beginPath()
    ctx.arc(x + ex * head, hy - head * 0.02, head * 0.12, 0, Math.PI * 2)
    ctx.fill()
  }
  if (armsUp) {
    // shouting
    ctx.beginPath()
    ctx.ellipse(x, hy + head * 0.45, head * 0.2, head * 0.16, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#4a0f12'
    ctx.fill()
  }
  if (p.hat) {
    ctx.fillStyle = '#c0392b'
    ctx.beginPath()
    ctx.arc(x, hy - head * 0.2, head * 0.98, Math.PI, 0)
    ctx.fill()
    ctx.stroke()
  }
}
