// Character looks: one body mesh, many people.
// A "look" is plain data (stored in characters.json for NPCs, and in the save
// for the player):
//
//   { base: "male" | "female",
//     skin: "#7d4c2e", hair: "#141010", shirt: "#c0392b", trousers: "#2c3e50", shoes: "#222",
//     height: 1.0, width: 1.0,
//     accessories: [ { type: "cap", color: "#..." }, { type: "glasses" }, ... ] }
//
// makeSkinTexture() repaints the Kenney skin image in a <canvas>:
//   - skin-coloured pixels anywhere get the new skin tone (keeping shading)
//   - non-skin pixels inside the shirt / trousers / shoes / hair areas get tinted
// Results are cached, so 20 NPCs with the same look share one texture.

import * as THREE from 'three'

export const SKIN_TONES = ['#5e3a24', '#6e4329', '#7d4c2e', '#8d5524', '#a0623a', '#b5764a']

export const DEFAULT_LOOK = {
  base: 'male',
  skin: '#7d4c2e',
  hair: '#241914',
  shirt: '#d8d2c4',
  trousers: '#2c3e50',
  shoes: '#2a2a2a',
  height: 1,
  width: 1,
  eyeRed: 0, // 0..1 — the energy meter shows in the eyes (more red = more energy)
  accessories: [],
}

// Areas of the 256x256 Kenney skin image (x, y, w, h).
const REGIONS = {
  male: {
    hair: [[0, 0, 160, 120]],
    shirt: [[0, 120, 152, 136]],
    trousers: [[152, 192, 104, 64]],
    shoes: [[160, 32, 48, 96]],
  },
  female: {
    hair: [[0, 0, 160, 120]],
    shirt: [[32, 120, 96, 136]],
    trousers: [[152, 192, 104, 40]],
    shoes: [[160, 32, 48, 96]],
  },
}

// Eye whites in the 256x256 skin image (both bases).
const EYES = [54, 34, 52, 28]

const textureCache = new Map()

export function normalizeLook(look = {}) {
  return { ...DEFAULT_LOOK, ...look, accessories: look.accessories || [] }
}

// Parse "#rrggbb" directly. (new THREE.Color(hex) converts to linear colour
// space, which would make every tint far too dark on the canvas.)
function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Skin pixels in the Kenney textures: warm hue, some saturation, not dark.
function isSkin(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const v = max / 255
  const s = max === 0 ? 0 : (max - min) / max
  if (v < 0.42 || s < 0.15 || s > 0.75) return false
  if (max !== r) return false
  const hue = ((g - b) / (max - min || 1)) * 60
  return hue > 8 && hue < 45
}

const luminance = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b

function inRegion(regions, x, y) {
  return regions.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh)
}

/** Paints a new texture from the base skin image for this look. */
export function makeSkinTexture(baseImage, lookInput, key) {
  const look = normalizeLook(lookInput)
  const red = Math.round(Math.min(1, Math.max(0, look.eyeRed)) * 4) / 4 // 5 steps keeps the cache small
  const cacheKey = key || JSON.stringify([look.base, look.skin, look.hair, look.shirt, look.trousers, look.shoes, red])
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)

  const w = baseImage.width
  const h = baseImage.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(baseImage, 0, 0)
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const sx = w / 256
  const regions = REGIONS[look.base] || REGIONS.male
  const skin = hexToRgb(look.skin)
  const tints = { hair: hexToRgb(look.hair), shirt: hexToRgb(look.shirt), trousers: hexToRgb(look.trousers), shoes: hexToRgb(look.shoes) }

  // average skin brightness, so shading is kept relative to it
  let sum = 0
  let count = 0
  for (let i = 0; i < d.length; i += 4) {
    if (isSkin(d[i], d[i + 1], d[i + 2])) {
      sum += luminance(d[i], d[i + 1], d[i + 2])
      count++
    }
  }
  const skinAvg = count ? sum / count : 180

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const r = d[i]
      const g = d[i + 1]
      const b = d[i + 2]
      const lum = luminance(r, g, b)
      const px = x / sx
      const py = y / sx
      let target = null
      let k = 1
      if (red > 0 && inRegion([EYES], px, py) && lum > 165 && Math.max(r, g, b) - Math.min(r, g, b) < 70) {
        // bloodshot eye whites
        d[i] = Math.min(255, r * (1 - red * 0.15) + 60 * red)
        d[i + 1] = g * (1 - red * 0.7)
        d[i + 2] = b * (1 - red * 0.7)
        continue
      }
      if (isSkin(r, g, b)) {
        target = skin
        k = lum / skinAvg
      } else if (inRegion(regions.shirt, px, py)) {
        target = tints.shirt
        k = lum / 215 // the shirt is near-white
      } else if (inRegion(regions.trousers, px, py)) {
        target = tints.trousers
        k = lum / (look.base === 'female' ? 120 : 110)
      } else if (inRegion(regions.shoes, px, py)) {
        target = tints.shoes
        k = lum / 220
      } else if (inRegion(regions.hair, px, py) && lum < 120) {
        target = tints.hair
        k = 0.6 + lum / 160
      }
      if (target) {
        d[i] = Math.min(255, target[0] * k)
        d[i + 1] = Math.min(255, target[1] * k)
        d[i + 2] = Math.min(255, target[2] * k)
      }
    }
  }
  ctx.putImageData(img, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  textureCache.set(cacheKey, texture)
  return texture
}

/** A random-but-repeatable look for background NPCs. */
export function randomLook(seed, base) {
  let s = seed * 9301 + 49297
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
  const shirts = ['#c0392b', '#2f8f5b', '#2c5aa0', '#e0b400', '#8e44ad', '#e67e22', '#ecf0f1', '#1abc9c', '#7f8c8d', '#d35400']
  const trousers = ['#2c3e50', '#1a1a1a', '#5d4037', '#34495e', '#6d6d6d', '#3e2723']
  return normalizeLook({
    base: base || (rnd() < 0.3 ? 'female' : 'male'),
    skin: pick(SKIN_TONES),
    hair: '#241914',
    shirt: pick(shirts),
    trousers: pick(trousers),
    shoes: pick(['#2a2a2a', '#5d4037', '#ecf0f1']),
    height: 0.94 + rnd() * 0.12,
    width: 0.95 + rnd() * 0.12,
    accessories: rnd() < 0.3 ? [{ type: 'cap', color: pick(shirts) }] : [],
  })
}
