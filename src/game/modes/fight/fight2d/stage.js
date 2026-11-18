// The street behind a 2D fight, painted once when the fight starts (and when
// the screen changes size), then slid sideways as the camera follows the
// fighters. Two painted strips (the backdrop at a slower pace for depth, the
// road at the fighters' pace) plus a crowd drawn live, so they can bounce and
// cheer. Lagos details: painted shopfronts and signboards, water tanks on the
// roofs, power lines, yellow-and-black kerbs.

const THEMES = {
  dawn: { skyTop: '#7f8fc4', skyBottom: '#f5b98a', sun: '#ffd9a0', haze: 'rgba(245,190,150,0.35)', tint: null, lights: false },
  day: { skyTop: '#5fb2ec', skyBottom: '#cfeaf8', sun: '#fff6d5', haze: 'rgba(220,235,245,0.35)', tint: null, lights: false },
  dusk: { skyTop: '#46406f', skyBottom: '#f08a4b', sun: '#ffb36b', haze: 'rgba(240,140,90,0.3)', tint: 'rgba(70,40,80,0.18)', lights: true },
  night: { skyTop: '#0d1330', skyBottom: '#2b2f55', sun: '#f3f0dc', haze: 'rgba(40,50,90,0.35)', tint: 'rgba(15,20,55,0.42)', lights: true },
}
const WALLS = ['#d9a35b', '#8fbf8f', '#7fa7c9', '#e8dcc0', '#d98c8c', '#a8a29a', '#c9b27c', '#9fc4b8']
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
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16)
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

  // ---- backdrop: sky, far towers, shops ----
  const [back, b] = canvas(backW, backY + 2, dpr)
  const sky = b.createLinearGradient(0, 0, 0, backY)
  sky.addColorStop(0, theme.skyTop)
  sky.addColorStop(1, theme.skyBottom)
  b.fillStyle = sky
  b.fillRect(0, 0, backW, backY + 2)
  // sun or moon, low over the rooftops
  b.fillStyle = theme.sun
  b.globalAlpha = 0.9
  b.beginPath()
  b.arc(backW * 0.72, backY * (time === 'day' ? 0.18 : 0.42), Math.max(14, H * 0.05), 0, Math.PI * 2)
  b.fill()
  b.globalAlpha = 1
  // clouds
  b.fillStyle = time === 'night' ? 'rgba(120,130,170,0.25)' : 'rgba(255,255,255,0.7)'
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
  const farBase = backY - ppm * 1.2
  b.fillStyle = time === 'night' ? '#1c2244' : time === 'dusk' ? '#5b4a6e' : '#8fa6bd'
  for (let x = 0; x < backW; ) {
    const w = 30 + r() * 60
    const h = ppm * (3 + r() * 6)
    b.fillRect(x, farBase - h, w, h + ppm * 1.2)
    if (theme.lights) {
      b.fillStyle = 'rgba(255,220,140,0.55)'
      for (let wy = farBase - h + 8; wy < farBase - 6; wy += 10) for (let wx = x + 5; wx < x + w - 5; wx += 9) if (r() < 0.35) b.fillRect(wx, wy, 3, 4)
      b.fillStyle = time === 'night' ? '#1c2244' : '#5b4a6e'
    }
    x += w + r() * 20
  }
  b.fillStyle = theme.haze
  b.fillRect(0, 0, backW, backY)

  // shops and houses along the street
  let x = -20
  const poles = []
  while (x < backW + 20) {
    const w = ppm * (2.6 + r() * 2.2)
    const storeys = r() < 0.55 ? 2 : r() < 0.6 ? 1 : 3
    const h = ppm * (1.0 + storeys * 1.25)
    const wall = WALLS[Math.floor(r() * WALLS.length)]
    const top = backY - h
    b.lineWidth = 1.5
    b.strokeStyle = '#2a1d14'
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
      b.lineTo(x + w * 0.5, top - ppm * 0.7)
      b.lineTo(x + w + 6, top)
      b.closePath()
      b.fill()
      b.stroke()
      b.strokeStyle = 'rgba(0,0,0,0.25)'
      b.lineWidth = 1
      for (let i = 1; i < 10; i++) {
        b.beginPath()
        b.moveTo(x + (w * i) / 10, top)
        b.lineTo(x + w * 0.5, top - ppm * 0.7)
        b.stroke()
      }
    } else {
      b.fillStyle = shade(wall, 0.9)
      b.fillRect(x - 3, top - 6, w + 6, 8)
      b.strokeRect(x - 3, top - 6, w + 6, 8)
      if (r() < 0.7) {
        // the black plastic water tank every roof has
        const tx = x + w * (0.2 + r() * 0.5)
        const tw = ppm * 0.55
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
    b.lineWidth = 1.2
    b.strokeStyle = '#2a1d14'
    for (let f = 1; f < storeys + 1; f++) {
      const wy = top + h - ppm * (1.0 + f * 1.25) + ppm * 0.35
      if (wy < top + 4) continue
      for (let wx = x + w * 0.12; wx < x + w * 0.8; wx += ppm * 1.0) {
        const ww = ppm * 0.6
        const wh = ppm * 0.6
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
        b.strokeStyle = '#2a1d14'
      }
    }
    // the shop at street level: an opening, a striped awning, a signboard
    const shopY = backY - ppm * 1.0
    b.fillStyle = '#2b2420'
    b.fillRect(x + w * 0.15, shopY, w * 0.5, ppm * 1.0)
    b.fillStyle = '#5a4636'
    for (let i = 0; i < 4; i++) b.fillRect(x + w * 0.18 + i * w * 0.11, shopY + ppm * 0.5, w * 0.08, ppm * 0.25) // goods on shelves
    const stripe = ['#c0392b', '#2471a3', '#229954', '#d4ac0d'][Math.floor(r() * 4)]
    for (let i = 0; i < 6; i++) {
      b.fillStyle = i % 2 ? '#f4f1ea' : stripe
      b.beginPath()
      b.moveTo(x + w * 0.1 + (i * w * 0.6) / 6, shopY - 2)
      b.lineTo(x + w * 0.1 + ((i + 1) * w * 0.6) / 6, shopY - 2)
      b.lineTo(x + w * 0.1 + ((i + 1) * w * 0.6) / 6 + 4, shopY + ppm * 0.22)
      b.lineTo(x + w * 0.1 + (i * w * 0.6) / 6 + 4, shopY + ppm * 0.22)
      b.closePath()
      b.fill()
    }
    const [text, bg, fg] = SIGNS[Math.floor(r() * SIGNS.length)]
    const sw = Math.min(w * 0.8, ppm * 2.4)
    const sh = ppm * 0.42
    const sy = shopY - sh - ppm * 0.12
    b.fillStyle = bg
    b.fillRect(x + w * 0.1, sy, sw, sh)
    b.strokeRect(x + w * 0.1, sy, sw, sh)
    b.fillStyle = fg
    b.font = `900 ${Math.round(sh * 0.55)}px system-ui, sans-serif`
    b.textAlign = 'center'
    b.textBaseline = 'middle'
    b.fillText(text, x + w * 0.1 + sw / 2, sy + sh / 2 + 1, sw * 0.9)
    poles.push(x + w + ppm * 0.2)
    x += w + ppm * (0.2 + r() * 0.5)
  }
  // power poles and the sagging wires between them
  const poleTop = backY - ppm * 4.6
  b.strokeStyle = '#3b2c22'
  b.lineWidth = Math.max(3, ppm * 0.09)
  const used = poles.filter((_, i) => i % 2 === 0)
  for (const px of used) {
    b.beginPath()
    b.moveTo(px, backY)
    b.lineTo(px, poleTop)
    b.moveTo(px - ppm * 0.4, poleTop + 6)
    b.lineTo(px + ppm * 0.4, poleTop + 6)
    b.stroke()
  }
  b.lineWidth = 1.2
  b.strokeStyle = 'rgba(20,15,10,0.8)'
  for (let i = 0; i + 1 < used.length; i++) {
    for (const off of [-0.35, 0, 0.35]) {
      b.beginPath()
      b.moveTo(used[i] + ppm * off, poleTop + 6)
      b.quadraticCurveTo((used[i] + used[i + 1]) / 2, poleTop + ppm * 0.8, used[i + 1] + ppm * off, poleTop + 6)
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
    },
  }
}

function drawFan(ctx, x, feet, p, armsUp) {
  const h = p.h
  const head = h * 0.13
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#1e140e'
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
  ctx.fillStyle = p.skin
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#1e140e'
  ctx.beginPath()
  ctx.arc(x, feet - h * 0.84 - head, head, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  if (p.hat) {
    ctx.fillStyle = '#c0392b'
    ctx.beginPath()
    ctx.arc(x, feet - h * 0.84 - head * 1.15, head * 0.95, Math.PI, 0)
    ctx.fill()
  }
}
