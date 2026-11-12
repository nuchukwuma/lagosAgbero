// Small textures painted on a <canvas> at start-up (no image downloads):
// earth, pavers, building facades with windows, soft blobs.

import * as THREE from 'three'

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvas(size) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return [c, c.getContext('2d')]
}

function finish(c, { repeat = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 2
  return t
}

const cache = new Map()
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key)
}

/** Grainy ground: light value noise + pebbles. Multiplied with the mesh colour. */
export function earthTexture() {
  return once('earth', () => {
    const [c, g] = canvas(256)
    const r = rng(5)
    g.fillStyle = '#f2f2f2'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 2600; i++) {
      const v = 200 + Math.floor(r() * 55)
      g.fillStyle = `rgba(${v},${v - 6},${v - 14},${0.25 + r() * 0.5})`
      g.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3)
    }
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(120,96,70,${0.15 + r() * 0.2})`
      g.beginPath()
      g.arc(r() * 256, r() * 256, 1 + r() * 2.5, 0, 7)
      g.fill()
    }
    // faint tyre tracks
    g.strokeStyle = 'rgba(110,85,60,0.12)'
    g.lineWidth = 5
    for (let i = 0; i < 3; i++) {
      g.beginPath()
      g.moveTo(0, 40 + i * 80)
      g.bezierCurveTo(80, 20 + i * 80, 170, 70 + i * 80, 256, 40 + i * 80)
      g.stroke()
    }
    return finish(c)
  })
}

/** Interlocking pavers / cracked concrete slabs. */
export function paverTexture() {
  return once('paver', () => {
    const [c, g] = canvas(256)
    const r = rng(8)
    g.fillStyle = '#d9d6d0'
    g.fillRect(0, 0, 256, 256)
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const v = 232 + Math.floor(r() * 23)
        g.fillStyle = `rgb(${v},${v},${v - 3})`
        g.fillRect(x * 32 + (y % 2) * 16 - 16, y * 32, 31, 31)
        g.fillRect(x * 32 + (y % 2) * 16 - 16 + 256, y * 32, 31, 31)
      }
    g.strokeStyle = 'rgba(60,55,50,0.22)'
    g.lineWidth = 1.2
    for (let i = 0; i < 5; i++) {
      g.beginPath()
      let x = r() * 256
      let y = r() * 256
      g.moveTo(x, y)
      for (let k = 0; k < 5; k++) {
        x += (r() - 0.5) * 50
        y += (r() - 0.5) * 50
        g.lineTo(x, y)
      }
      g.stroke()
    }
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(70,60,50,${0.06 + r() * 0.1})`
      g.beginPath()
      g.arc(r() * 256, r() * 256, 6 + r() * 16, 0, 7)
      g.fill()
    }
    return finish(c)
  })
}

/** Facade tile for far buildings: 4 x 4 windows. Returns { map, lights }. */
export function facadeTextures() {
  return once('facade', () => {
    const [c, g] = canvas(256)
    const [c2, g2] = canvas(256)
    const r = rng(12)
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, 256, 256)
    g2.fillStyle = '#000000'
    g2.fillRect(0, 0, 256, 256)
    // rain streaks and dirt
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(90,80,70,${0.03 + r() * 0.06})`
      g.fillRect(r() * 256, r() * 256, 2 + r() * 5, 20 + r() * 70)
    }
    for (let row = 0; row < 4; row++) {
      // floor band / balcony edge
      g.fillStyle = 'rgba(0,0,0,0.16)'
      g.fillRect(0, row * 64 + 58, 256, 6)
      for (let col = 0; col < 4; col++) {
        const x = col * 64 + 14
        const y = row * 64 + 12
        g.fillStyle = '#cfcfcf'
        g.fillRect(x - 3, y - 3, 42, 40)
        g.fillStyle = ['#37424f', '#2f3b46', '#43505c'][Math.floor(r() * 3)]
        g.fillRect(x, y, 36, 34)
        g.fillStyle = 'rgba(255,255,255,0.18)'
        g.fillRect(x, y, 36, 2)
        g.fillRect(x + 17, y, 2, 34)
        if (r() < 0.35) {
          // air conditioner
          g.fillStyle = '#8c8c8c'
          g.fillRect(x + 20, y + 36, 16, 9)
        }
        if (r() < 0.25) {
          // washing on the balcony
          g.fillStyle = ['#c0392b', '#2e86c1', '#f1c40f'][Math.floor(r() * 3)]
          g.fillRect(x + 2, y + 37, 12, 12)
        }
        if (r() < 0.4) {
          g2.fillStyle = ['#ffd27a', '#ffe7b0', '#cfe3ff'][Math.floor(r() * 3)]
          g2.fillRect(x, y, 36, 34)
        }
      }
    }
    return { map: finish(c), lights: finish(c2) }
  })
}

/** Soft round blob (white, alpha falls off): shadows and glows. */
export function blobTexture() {
  return once('blob', () => {
    const [c, g] = canvas(64)
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.55, 'rgba(255,255,255,0.55)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    return finish(c, { repeat: false, srgb: false })
  })
}
