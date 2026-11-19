// The place behind a 2D fight: a Lagos waterfront, painted like a mobile
// cartoon game. Layers slide at their own pace as the camera follows the
// fighters (far ones slower), so there's depth:
//   sky      gradient, stars, a big moon with a halo (or the sun)
//   far      hills of rooftops, the Third Mainland Bridge with car lights
//   mid      stilt houses and palms in mist, windows glowing
//   near     wooden water-tank towers, a zinc shack with a lit signboard,
//            street lamps that glow
//   floor    the wooden jetty the fighters stand on, posts down into the
//            lagoon, water with ripples and lamp reflections
//   front    dark reeds in the bottom corners (drawn over the fighters' feet
//            line, never over the fighters)
// Everything except the crowd, the lamp glow and the water shimmer is
// painted once into a few strips when the fight starts.

const INK = '#120a08' // the outline colour, as on the fighters

const THEMES = {
  night: {
    sky: ['#06142c', '#103660', '#2a6f8f'],
    stars: true,
    moon: '#f6f3de',
    far: '#1d4a72',
    mid: '#153a5f',
    mist: 'rgba(110,170,205,0.22)',
    window: '#ffd86b',
    lit: 0.75,
    wood: ['#6a5a50', '#4a3e38', '#2e2622'],
    deck: ['#7a604a', '#5a4434', '#3a2a20'],
    water: ['#1f5f80', '#0c2c4a'],
    glint: 'rgba(170,220,255,0.55)',
    tint: 'rgba(20,50,100,0.28)',
    lamps: true,
    reeds: '#06101e',
  },
  dusk: {
    sky: ['#2b2550', '#7a4a7a', '#f2925e'],
    stars: false,
    moon: '#ffd08a',
    far: '#6a4f78',
    mid: '#4e3b63',
    mist: 'rgba(255,170,140,0.2)',
    window: '#ffcf70',
    lit: 0.5,
    wood: ['#8a6550', '#664836', '#3f2c22'],
    deck: ['#9a7050', '#704f38', '#43301f'],
    water: ['#b47a78', '#3a3058'],
    glint: 'rgba(255,210,170,0.55)',
    tint: 'rgba(80,40,90,0.15)',
    lamps: true,
    reeds: '#1d1424',
  },
  dawn: {
    sky: ['#55659f', '#c49ab2', '#f8cba0'],
    stars: false,
    moon: '#fff1c8',
    far: '#8c8cb2',
    mid: '#6c6a98',
    mist: 'rgba(255,220,220,0.28)',
    window: '#ffd98a',
    lit: 0.25,
    wood: ['#9a7860', '#755744', '#4a3628'],
    deck: ['#ae8664', '#83624a', '#55402e'],
    water: ['#c8a0ac', '#56679a'],
    glint: 'rgba(255,240,230,0.6)',
    tint: null,
    lamps: false,
    reeds: '#2a2438',
  },
  day: {
    sky: ['#2f86da', '#7cc0ef', '#d4edf9'],
    stars: false,
    moon: '#fff8d8',
    far: '#9cb8d0',
    mid: '#7f9fba',
    mist: 'rgba(255,255,255,0.3)',
    window: '#33475a',
    lit: 0,
    wood: ['#b08462', '#87634a', '#5a412f'],
    deck: ['#c09468', '#93704e', '#634830'],
    water: ['#4fb0d8', '#1f6f9c'],
    glint: 'rgba(255,255,255,0.75)',
    tint: null,
    lamps: false,
    reeds: '#1f3a28',
  },
}
const SIGNS = [
  ['MAMA PUT', '#c0392b', '#fff'],
  ['GOD DEY PHARMACY', '#1e8449', '#fff'],
  ['VOTE OWO NLA', '#6c3483', '#fff'],
  ['RECHARGE CARD', '#f1c40f', '#111'],
  ['BARBING SALOON', '#d35400', '#fff'],
  ['POS / TRANSFER', '#117a65', '#fff'],
  ['FISH & BOLE', '#a04000', '#fff'],
]
const FANS = ['#e8a64e', '#7fcf7f', '#6fa8de', '#f0dfb8', '#e57f7f', '#d8b660', '#86d0bc']

function rng(seed) {
  let s = seed % 233280
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}
function canvas(w, h, dpr) {
  const c = document.createElement('canvas')
  c.width = Math.ceil(w * dpr)
  c.height = Math.ceil(h * dpr)
  const ctx = c.getContext('2d')
  ctx.scale(dpr, dpr)
  return [c, ctx]
}
const vgrad = (g, y0, y1, stops) => {
  const gr = g.createLinearGradient(0, y0, 0, y1)
  stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c))
  return gr
}

/**
 * Paint a stage. W, H: the screen (CSS px); ppm: pixels a metre where the
 * fighters stand; groundY: their feet; pan: how far (metres) the camera can
 * slide either way; light: Light mode (fewer details, smaller strips).
 */
export function makeStage({ W, H, ppm, groundY, pan, time = 'day', dpr = 1, light = false, seed = 7 }) {
  const th = THEMES[time] || THEMES.day
  const night = time === 'night'
  if (light) dpr = Math.min(dpr, 1) // the strips are big: keep them small on budget phones
  const r = rng(seed)
  const backY = groundY - Math.max(14, 0.5 * ppm) // the back edge of the jetty
  const deckFront = groundY + Math.max(6, 0.14 * ppm) // its front edge
  const beamH = Math.max(7, 0.2 * ppm)
  // further away, smaller: the scale of each layer
  const fppm = ppm * 0.32
  const nppm = ppm * 0.55
  const waterY = deckFront + beamH
  const span = (k) => W + 2 * pan * ppm * k + 4
  const FAR = 0.18
  const NEAR = 0.6
  const nearW = span(NEAR)
  // Light mode: the far and near layers share one strip (one big copy a frame instead of two)
  const farW = light ? nearW : span(FAR)
  const floorW = span(1)

  // ---- sky and far layers, one strip ----
  const [far, f] = canvas(farW, backY + 2, dpr)
  f.fillStyle = vgrad(f, 0, backY, th.sky)
  f.fillRect(0, 0, farW, backY + 2)
  if (th.stars) {
    for (let i = 0; i < (light ? 50 : 110); i++) {
      f.fillStyle = `rgba(255,255,240,${0.25 + r() * 0.65})`
      f.beginPath()
      f.arc(r() * farW, r() * backY * 0.75, r() < 0.12 ? 1.7 : 0.9, 0, Math.PI * 2)
      f.fill()
    }
  }
  // puffy cartoon clouds by day
  if (!night) {
    for (let i = 0; i < (light ? 4 : 8); i++) {
      const cx = r() * farW
      const cy = backY * (0.1 + r() * 0.45)
      const cs = 16 + r() * 26
      f.fillStyle = time === 'day' ? 'rgba(255,255,255,0.85)' : 'rgba(255,225,215,0.55)'
      for (const [dx, dy, k] of [[0, 0, 1], [cs * 0.95, cs * 0.15, 0.75], [-cs * 0.9, cs * 0.2, 0.7], [cs * 0.35, -cs * 0.45, 0.8], [-cs * 0.4, -cs * 0.3, 0.65]]) {
        f.beginPath()
        f.arc(cx + dx, cy + dy, cs * k, 0, Math.PI * 2)
        f.fill()
      }
    }
  }
  // the moon (or the sun), with a soft halo
  const mx = farW / 2
  const my = Math.max(H * 0.3, backY * 0.42)
  const mr = Math.max(16, H * (night ? 0.09 : 0.06))
  const halo = f.createRadialGradient(mx, my, mr * 0.7, mx, my, mr * (night ? 3.4 : 2.4))
  halo.addColorStop(0, night ? 'rgba(220,240,255,0.42)' : 'rgba(255,240,200,0.5)')
  halo.addColorStop(1, 'rgba(255,255,255,0)')
  f.fillStyle = halo
  f.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8)
  const moon = f.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr)
  moon.addColorStop(0, '#ffffff')
  moon.addColorStop(1, th.moon)
  f.fillStyle = moon
  f.beginPath()
  f.arc(mx, my, mr, 0, Math.PI * 2)
  f.fill()
  if (night) {
    f.fillStyle = 'rgba(160,165,150,0.42)'
    for (const [cx, cy, cr] of [[-0.35, -0.2, 0.22], [0.25, 0.12, 0.17], [-0.05, 0.45, 0.12], [0.4, -0.4, 0.1], [-0.45, 0.3, 0.08], [0.05, -0.05, 0.06]]) {
      f.beginPath()
      f.arc(mx + cx * mr, my + cy * mr, cr * mr, 0, Math.PI * 2)
      f.fill()
    }
  }
  // far hills of rooftops
  const farTop = backY - fppm * 1.6
  f.fillStyle = th.far
  f.beginPath()
  f.moveTo(0, backY)
  for (let x = 0; x <= farW; x += 12) {
    const y = farTop - Math.sin(x * 0.006 + seed) * fppm * 0.35 - Math.sin(x * 0.017) * fppm * 0.15 - (r() < 0.25 ? fppm * 0.2 : 0)
    f.lineTo(x, y)
  }
  f.lineTo(farW, backY)
  f.fill()
  if (th.lit) {
    f.fillStyle = th.window
    for (let i = 0; i < farW / 18; i++) if (r() < th.lit * 0.6) f.fillRect(r() * farW, farTop + r() * fppm * 0.6, 2, 2)
  }
  // the long bridge across the lagoon, its lights and a few car lights
  const bridgeY = farTop - fppm * 0.25
  f.fillStyle = th.far
  f.fillRect(0, bridgeY, farW, Math.max(3, fppm * 0.06))
  for (let x = 6; x < farW; x += fppm * 0.9) f.fillRect(x, bridgeY, Math.max(2, fppm * 0.04), farTop - bridgeY + fppm * 0.2)
  if (th.lamps) {
    for (let x = 0; x < farW; x += fppm * 0.45) {
      f.fillStyle = r() < 0.5 ? 'rgba(255,230,150,0.9)' : r() < 0.5 ? 'rgba(255,90,70,0.9)' : 'rgba(255,255,255,0.8)'
      f.fillRect(x + r() * 10, bridgeY - 2, 2.5, 2)
    }
  }
  // the mid layer: stilt houses and palms in the mist
  f.fillStyle = th.mist
  f.fillRect(0, farTop - fppm * 0.4, farW, backY)
  const midBase = backY
  for (let x = -10; x < farW; ) {
    const w = fppm * (0.9 + r() * 1.3)
    const h = fppm * (1.0 + r() * 0.8)
    const top = midBase - fppm * 0.45 - h
    f.fillStyle = th.mid
    // stilts, body, a pointed zinc roof
    for (let k = 0; k < 4; k++) f.fillRect(x + (w * k) / 3 - 1, midBase - fppm * 0.5, 2, fppm * 0.5)
    f.fillRect(x, top, w, h)
    f.beginPath()
    f.moveTo(x - 6, top)
    f.lineTo(x + w / 2, top - fppm * 0.45)
    f.lineTo(x + w + 6, top)
    f.fill()
    if (th.lit && r() < 0.85) {
      // a glowing window
      f.save()
      f.shadowColor = th.window
      f.shadowBlur = fppm * 0.25
      f.fillStyle = th.window
      const ww = fppm * 0.22
      f.fillRect(x + w * (0.2 + r() * 0.45), top + h * 0.3, ww, ww * 1.2)
      f.restore()
    } else if (!th.lit) {
      f.fillStyle = th.window
      f.fillRect(x + w * 0.35, top + h * 0.3, fppm * 0.22, fppm * 0.26)
    }
    if (r() < 0.35) {
      // a palm
      const px = x + w + fppm * 0.25
      const pt = top - fppm * 0.9
      f.lineWidth = Math.max(2, fppm * 0.06)
      f.strokeStyle = th.mid
      f.beginPath()
      f.moveTo(px, midBase)
      f.quadraticCurveTo(px + fppm * 0.3, pt + fppm, px + fppm * 0.15, pt)
      f.stroke()
      f.fillStyle = th.mid
      for (let k = 0; k < 7; k++) {
        const a = Math.PI + (k / 6) * Math.PI
        f.beginPath()
        f.ellipse(px + fppm * 0.15 + Math.cos(a) * fppm * 0.33, pt + Math.sin(a) * fppm * 0.14 + fppm * 0.08, fppm * 0.38, fppm * 0.065, a + Math.PI / 2 + 1.5, 0, Math.PI * 2)
        f.fill()
      }
    }
    x += w + fppm * (0.15 + r() * 0.9)
  }
  // mist rising off the water at the foot of the houses
  f.fillStyle = vgrad(f, backY - fppm * 0.9, backY, ['rgba(0,0,0,0)', th.mist, th.mist])
  f.fillRect(0, backY - fppm * 0.9, farW, fppm * 0.9 + 2)

  // ---- near layer: water-tank towers, a shack with a signboard ----
  const [near, n] = light ? [far, f] : canvas(nearW, backY + 2, dpr)
  const lw = Math.max(2, nppm * 0.028)
  n.lineJoin = 'round'
  const wood = (y0, y1) => vgrad(n, y0, y1, th.wood)
  const plankBox = (x, y, w, h, color) => {
    n.fillStyle = color
    n.fillRect(x, y, w, h)
    n.strokeStyle = INK
    n.lineWidth = lw
    n.strokeRect(x, y, w, h)
  }
  for (let x = nppm * (0.5 + r()); x < nearW; ) {
    // keep the middle open, so the moon shows between the towers
    // (nothing here is wider than about 3.4 of its metres)
    if (x < nearW / 2 + mr * 2 && x + nppm * 3.4 > nearW / 2 - mr * 2) {
      x = nearW / 2 + mr * 2
      continue
    }
    const kind = r()
    if (kind < 0.45) {
      // a water-tank tower: four legs, cross-bracing, a platform, the black tank
      const tw = nppm * (1.0 + r() * 0.3)
      const legH = nppm * (2.0 + r() * 0.8)
      const top = backY - legH
      const leg = Math.max(4, nppm * 0.09)
      for (const lx of [x, x + tw - leg]) plankBox(lx, top, leg, legH, wood(top, backY))
      n.strokeStyle = th.wood[1]
      n.lineWidth = Math.max(3, nppm * 0.055)
      for (let k = 0; k < 2; k++) {
        const y0 = top + (legH * k) / 2 + nppm * 0.15
        const y1 = top + (legH * (k + 1)) / 2
        n.beginPath()
        n.moveTo(x + leg, y0)
        n.lineTo(x + tw - leg, y1)
        n.moveTo(x + tw - leg, y0)
        n.lineTo(x + leg, y1)
        n.stroke()
      }
      plankBox(x - nppm * 0.12, top - nppm * 0.14, tw + nppm * 0.24, nppm * 0.16, th.wood[0])
      const tankW = tw * 0.82
      const tankH = nppm * 0.95
      const tx = x + (tw - tankW) / 2
      const ty = top - nppm * 0.14 - tankH
      n.fillStyle = vgrad(n, ty, ty + tankH, ['#3a3d44', '#1b1c20'])
      n.beginPath()
      n.roundRect(tx, ty, tankW, tankH, nppm * 0.12)
      n.fill()
      n.lineWidth = lw
      n.strokeStyle = INK
      n.stroke()
      n.fillStyle = 'rgba(255,255,255,0.14)'
      n.fillRect(tx + tankW * 0.15, ty + tankH * 0.12, tankW * 0.1, tankH * 0.7)
      n.strokeStyle = 'rgba(0,0,0,0.4)'
      for (const k of [0.33, 0.66]) {
        n.beginPath()
        n.moveTo(tx, ty + tankH * k)
        n.lineTo(tx + tankW, ty + tankH * k)
        n.stroke()
      }
      x += tw + nppm * (1.6 + r() * 1.8)
    } else {
      // a plank shack on stilts with a zinc roof and a signboard
      const sw = nppm * (2.0 + r() * 1.0)
      const sh = nppm * (1.5 + r() * 0.5)
      const top = backY - nppm * 0.35 - sh
      for (let k = 0; k < 3; k++) plankBox(x + ((sw - nppm * 0.08) * k) / 2, backY - nppm * 0.4, nppm * 0.08, nppm * 0.4, th.wood[2])
      n.fillStyle = wood(top, top + sh)
      n.fillRect(x, top, sw, sh)
      n.strokeStyle = 'rgba(0,0,0,0.35)'
      n.lineWidth = 1
      for (let px = x + nppm * 0.22; px < x + sw; px += nppm * 0.22) {
        n.beginPath()
        n.moveTo(px, top)
        n.lineTo(px, top + sh)
        n.stroke()
      }
      n.strokeStyle = INK
      n.lineWidth = lw
      n.strokeRect(x, top, sw, sh)
      // a doorway and a window, warm inside at night
      const door = th.lit ? '#f2b84a' : '#2a201a'
      n.fillStyle = door
      n.fillRect(x + sw * 0.62, top + sh * 0.35, sw * 0.2, sh * 0.65)
      n.strokeRect(x + sw * 0.62, top + sh * 0.35, sw * 0.2, sh * 0.65)
      n.fillStyle = th.lit ? th.window : '#33475a'
      n.fillRect(x + sw * 0.15, top + sh * 0.4, sw * 0.24, sh * 0.25)
      n.strokeRect(x + sw * 0.15, top + sh * 0.4, sw * 0.24, sh * 0.25)
      // the zinc roof, rusty
      n.fillStyle = vgrad(n, top - nppm * 0.55, top, ['#8f9296', '#6b5546'])
      n.beginPath()
      n.moveTo(x - nppm * 0.2, top + 2)
      n.lineTo(x + sw * 0.5, top - nppm * 0.55)
      n.lineTo(x + sw + nppm * 0.2, top + 2)
      n.closePath()
      n.fill()
      n.stroke()
      // the signboard on the roof edge, lit at night
      const [text, bg, fg] = SIGNS[Math.floor(r() * SIGNS.length)]
      const bw = Math.min(sw * 0.95, nppm * 2.2)
      const bh = nppm * 0.36
      const bx = x + (sw - bw) / 2
      const by = top - bh * 0.4
      n.save()
      if (th.lit) {
        n.shadowColor = bg
        n.shadowBlur = nppm * 0.3
      }
      n.fillStyle = bg
      n.fillRect(bx, by, bw, bh)
      n.restore()
      n.strokeStyle = INK
      n.strokeRect(bx, by, bw, bh)
      n.fillStyle = fg
      n.font = `900 ${Math.round(bh * 0.55)}px system-ui, sans-serif`
      n.textAlign = 'center'
      n.textBaseline = 'middle'
      n.fillText(text, bx + bw / 2, by + bh / 2 + 1, bw * 0.9)
      x += sw + nppm * (1.4 + r() * 1.6)
    }
  }
  if (th.tint) {
    n.fillStyle = th.tint
    n.fillRect(0, 0, nearW, backY + 2)
  }

  // ---- the jetty and the lagoon (at the fighters' pace) ----
  const floorH = H - backY
  const [floor, g] = canvas(floorW, floorH, dpr)
  const dTop = 0
  const dFront = deckFront - backY
  // deck planks, seen from above at a slant: lighter at the front
  g.fillStyle = vgrad(g, dTop, dFront, [th.deck[2], th.deck[1], th.deck[0]])
  g.fillRect(0, dTop, floorW, dFront)
  g.strokeStyle = 'rgba(0,0,0,0.35)'
  g.lineWidth = 1.2
  const rows = 3
  for (let k = 1; k < rows; k++) {
    const y = dTop + (dFront * k) / rows
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(floorW, y)
    g.stroke()
  }
  for (let k = 0; k < rows; k++) {
    // plank ends, staggered row by row, and nail heads
    const y0 = dTop + (dFront * k) / rows
    const step = ppm * (1.1 + k * 0.15)
    for (let x = (k % 2) * step * 0.5; x < floorW; x += step) {
      g.beginPath()
      g.moveTo(x, y0)
      g.lineTo(x, y0 + dFront / rows)
      g.stroke()
      g.fillStyle = 'rgba(0,0,0,0.45)'
      g.fillRect(x + 3, y0 + 3, 2, 2)
    }
  }
  g.fillStyle = 'rgba(255,255,255,0.07)'
  for (let i = 0; i < floorW / 14; i++) g.fillRect(r() * floorW, r() * dFront, 6 + r() * 14, 1) // grain
  // the front beam
  g.fillStyle = vgrad(g, dFront, dFront + beamH, [th.wood[1], th.wood[2]])
  g.fillRect(0, dFront, floorW, beamH)
  g.strokeStyle = INK
  g.lineWidth = lw
  g.beginPath()
  g.moveTo(0, dFront)
  g.lineTo(floorW, dFront)
  g.moveTo(0, dFront + beamH)
  g.lineTo(floorW, dFront + beamH)
  g.stroke()
  // the lagoon
  const wTop = dFront + beamH
  g.fillStyle = vgrad(g, wTop, floorH, th.water)
  g.fillRect(0, wTop, floorW, floorH - wTop)
  // posts down into the water, with their reflections
  for (let x = ppm * 0.4; x < floorW; x += ppm * 1.8) {
    const pw = Math.max(5, ppm * 0.13)
    g.fillStyle = vgrad(g, wTop, floorH, [th.wood[1], th.wood[2]])
    g.fillRect(x, wTop - 1, pw, Math.min(floorH - wTop, ppm * 0.55))
    g.strokeStyle = INK
    g.strokeRect(x, wTop - 1, pw, Math.min(floorH - wTop, ppm * 0.55))
    g.fillStyle = 'rgba(0,0,0,0.25)'
    g.fillRect(x, wTop + ppm * 0.55, pw, ppm * 0.4)
  }
  // a canoe moored at the jetty
  const cx0 = floorW * (0.3 + r() * 0.4)
  const cy0 = wTop + Math.min(ppm * 0.42, (floorH - wTop) * 0.45)
  g.fillStyle = vgrad(g, cy0 - ppm * 0.15, cy0 + ppm * 0.15, [th.wood[0], th.wood[2]])
  g.beginPath()
  g.moveTo(cx0 - ppm * 1.3, cy0 - ppm * 0.12)
  g.quadraticCurveTo(cx0, cy0 + ppm * 0.32, cx0 + ppm * 1.3, cy0 - ppm * 0.12)
  g.lineTo(cx0 + ppm * 1.1, cy0 - ppm * 0.05)
  g.lineTo(cx0 - ppm * 1.1, cy0 - ppm * 0.05)
  g.closePath()
  g.fill()
  g.stroke()
  // the waterline glint along the beam
  g.strokeStyle = th.glint
  g.lineWidth = Math.max(2, ppm * 0.03)
  g.beginPath()
  for (let x = 0; x <= floorW; x += 8) g.lineTo(x, wTop + 3 + Math.sin(x * 0.05) * 2)
  g.stroke()
  if (th.tint) {
    g.fillStyle = th.tint
    g.fillRect(0, 0, floorW, floorH)
  }

  // ---- live parts: lamps, crowd, shimmer, reeds ----
  const lampH = Math.min(ppm * 2.6, backY * 0.78)
  const lamps = []
  for (let lx = ppm * (1.2 + r() * 2); lx < floorW; lx += ppm * (6 + r() * 2.5)) lamps.push(lx)
  const glowR = ppm * 1.6
  const [glow, gl] = canvas(glowR * 2, glowR * 2, 1)
  const gg = gl.createRadialGradient(glowR, glowR, 0, glowR, glowR, glowR)
  gg.addColorStop(0, 'rgba(255,245,170,0.95)')
  gg.addColorStop(0.16, 'rgba(255,228,120,0.5)')
  gg.addColorStop(1, 'rgba(255,210,90,0)')
  gl.fillStyle = gg
  gl.fillRect(0, 0, glowR * 2, glowR * 2)

  function drawLamps(ctx, x0) {
    const pw = Math.max(3, ppm * 0.08)
    for (const lx of lamps) {
      const x = x0 + lx
      if (x < -glowR || x > W + glowR) continue
      const foot = backY + 2
      const top = foot - lampH
      ctx.lineCap = 'round'
      ctx.strokeStyle = INK
      ctx.lineWidth = pw + 4
      ctx.beginPath()
      ctx.moveTo(x, foot)
      ctx.lineTo(x, top)
      ctx.stroke()
      ctx.strokeStyle = '#2f3f4c'
      ctx.lineWidth = pw
      ctx.stroke()
      ctx.lineCap = 'butt'
      const lh = ppm * 0.42
      ctx.lineWidth = 2
      ctx.strokeStyle = INK
      ctx.beginPath()
      ctx.moveTo(x - ppm * 0.16, top)
      ctx.lineTo(x + ppm * 0.16, top)
      ctx.lineTo(x + ppm * 0.11, top - lh)
      ctx.lineTo(x - ppm * 0.11, top - lh)
      ctx.closePath()
      ctx.fillStyle = th.lamps ? '#fff3a0' : '#c9d6dd'
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x - ppm * 0.19, top - lh)
      ctx.lineTo(x, top - lh - ppm * 0.17)
      ctx.lineTo(x + ppm * 0.19, top - lh)
      ctx.closePath()
      ctx.fillStyle = '#2f3f4c'
      ctx.fill()
      ctx.stroke()
      if (th.lamps) {
        const hr = glowR * (light ? 0.6 : 0.95)
        ctx.drawImage(glow, x - hr, top - lh / 2 - hr, hr * 2, hr * 2)
      }
    }
  }
  // the lamps' reflections in the water, and a slow shimmer
  function drawWater(ctx, x0, t) {
    const wTopS = waterY
    if (wTopS >= H) return
    if (th.lamps) {
      ctx.fillStyle = 'rgba(255,225,130,0.32)'
      for (const lx of lamps) {
        const x = x0 + lx
        if (x < -20 || x > W + 20) continue
        for (let k = 0; k < 5; k++) {
          const y = wTopS + 6 + k * Math.max(5, ppm * 0.09)
          if (y > H) break
          const wob = Math.sin(t * 2 + k * 1.7) * ppm * 0.05
          ctx.fillRect(x - ppm * (0.18 - k * 0.025) + wob, y, ppm * (0.36 - k * 0.05), 2)
        }
      }
    }
    if (light) return
    ctx.fillStyle = th.glint
    for (let k = 0; k < 7; k++) {
      const y = wTopS + ((k + 0.5) / 7) * (H - wTopS)
      const x = ((((k * 173 + t * (12 + k * 3)) % (W + 80)) + W + 80) % (W + 80)) - 40
      ctx.globalAlpha = 0.5
      ctx.fillRect(x, y, ppm * (0.3 + (k % 3) * 0.15), 1.5)
    }
    ctx.globalAlpha = 1
  }

  // the crowd on the jetty behind the fighters: drawn live so they can bounce and cheer
  const people = []
  const count = light ? 6 : 10
  const crowdW = W + 2 * pan * ppm * 0.85
  for (let i = 0; i < count; i++) {
    people.push({
      x: (crowdW * (i + 0.2 + r() * 0.6)) / count,
      h: ppm * (0.62 + r() * 0.14), // at the far end of the jetty: smaller
      shirt: FANS[Math.floor(r() * FANS.length)],
      skin: ['#3d2516', '#4e2f1d', '#5c3a24', '#6e4329'][Math.floor(r() * 4)],
      phase: r() * 6,
      hat: r() < 0.3,
    })
  }

  // reeds in the bottom corners, over the water
  function drawReeds(ctx, x0, t) {
    if (waterY >= H - 4) return
    ctx.fillStyle = th.reeds
    for (const side of [0, 1]) {
      const bx = side ? W + 10 : -10
      for (let k = 0; k < (light ? 6 : 11); k++) {
        const x = bx + (side ? -1 : 1) * (k * ppm * 0.09 + ((x0 * 0.2) % (ppm * 0.09)))
        const h = (H - waterY) * (0.6 + ((k * 37) % 10) / 14)
        const sway = Math.sin(t * 1.3 + k) * ppm * 0.04
        ctx.beginPath()
        ctx.moveTo(x - ppm * 0.04, H)
        ctx.quadraticCurveTo(x + sway * 0.5, H - h * 0.5, x + sway + (side ? -1 : 1) * ppm * 0.05, H - h)
        ctx.quadraticCurveTo(x + sway * 0.5 + ppm * 0.03, H - h * 0.5, x + ppm * 0.04, H)
        ctx.fill()
      }
    }
  }

  return {
    backY,
    /** Draw the stage behind the fighters, for the camera at camX (metres). cheer: 0..1 */
    draw(ctx, camX, t, cheer) {
      // sky above and lagoon below the strips (seen when the camera eases out)
      ctx.fillStyle = th.sky[0]
      ctx.fillRect(-W, -H, W * 3, backY + H + 2)
      ctx.fillStyle = th.water[1]
      ctx.fillRect(-W, backY, W * 3, H * 2)
      if (near !== far) ctx.drawImage(far, -(camX * FAR * ppm) - (farW - W) / 2, 0, farW, backY + 2)
      ctx.drawImage(near, -(camX * NEAR * ppm) - (nearW - W) / 2, 0, nearW, backY + 2)
      const x0 = -(camX * ppm) - (floorW - W) / 2
      drawLamps(ctx, x0)
      const cx = -(camX * 0.85 * ppm) - (crowdW - W) / 2
      for (const p of people) {
        const bob = Math.abs(Math.sin(t * (3 + cheer * 6) + p.phase)) * (2 + cheer * 7)
        drawFan(ctx, cx + p.x, backY + 3 - bob, p, cheer > 0.35 && Math.sin(p.phase * 7) > -0.3, night)
      }
      ctx.drawImage(floor, x0, backY, floorW, floorH)
      drawWater(ctx, x0, t)
    },
    /** Draw what stands in front of the fighters (reeds at the bottom corners). */
    drawFront(ctx, camX, t) {
      drawReeds(ctx, camX * ppm, t)
    },
  }
}

// a fan in the crowd: a little cartoon person (backlit and darker at night)
function drawFan(ctx, x, feet, p, armsUp, night) {
  const h = p.h * 0.9
  const head = h * 0.19 // cartoon heads, like the fighters
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  // body
  ctx.fillStyle = night ? shadeCss(p.shirt, 0.55) : p.shirt
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

function shadeCss(hex, k) {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}
