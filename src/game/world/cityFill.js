// Fills the world so it never looks empty (pure data, no three.js):
//   rows       lines of real building models (world JSON "rows")
//   clutter    street props built from simple shapes: kiosks, umbrellas,
//              drums, yellow kegs, tyres, benches, water tanks, goats...
//   skyline    cheap far-away blocks with painted windows (world JSON "skyline")
// Everything is generated from a seed, so the street is the same every time.
//
// World JSON:
//   "rows":    [{ "from": [x,z], "to": [x,z], "face": 0, "set": "houses", "gap": 1.5, "seed": 3, "solid": true }]
//   "clutter": [{ "rect": [x, z, w, d], "count": 8, "kinds": ["kiosk","umbrella"], "seed": 5, "face": 0 }]
//   "skyline": { "rings": [70, 95], "seed": 9 }
//
//   "gatherings": [{ "at": [x, z], "n": 3, "r": 0.9 }]   small groups of bystanders
//   "walkways":   [{ "from": [x,z], "to": [x,z], "wrap": true, "n": 6 }]  where the crowd walks
//
// Output: { groups, prims, colliders, blocks, lights, shadows, people }

import { getAsset } from '../../assets/assetManifest.js'

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DEG = Math.PI / 180

export const BUILDING_SETS = {
  houses: ['tenementA', 'tenementB', 'tenementC', 'bungalowWide', 'mentorHouse', 'friendHouse', 'shopHouseA', 'shopHouseB', 'storeyHouseA', 'storeyHouseB', 'storeyHouseC', 'storeyHouseD'],
  rich: ['richManHouseB', 'richManHouseC', 'bigManDuplex', 'fixerDuplex', 'chairmanHouse'],
  industrial: ['warehouseB', 'warehouseArched', 'officeSmall', 'workshop', 'warehouseOffice', 'printingPress', 'shopRow'],
  offices: ['partySecretariat', 'officeBlock', 'agencyTower', 'industrialBlock', 'factory'],
  mixed: ['tenementA', 'shopHouseA', 'storeyHouseC', 'officeSmall', 'tenementC', 'shopHouseB', 'warehouseB', 'storeyHouseB', 'friendHouse', 'shopRow'],
}

function rotate(x, z, angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [x * c + z * s, -x * s + z * c]
}

/** One line of buildings. Returns [{ model, item, collider, height }] */
export function buildRow(row) {
  const rng = mulberry32(row.seed ?? 1)
  const set = BUILDING_SETS[row.set] || BUILDING_SETS.houses
  const [x0, z0] = row.from
  const [x1, z1] = row.to
  const len = Math.hypot(x1 - x0, z1 - z0)
  const ux = (x1 - x0) / len
  const uz = (z1 - z0) / len
  const face = row.face ?? 0
  const angle = face * DEG
  const out = []
  let t = 0
  let last = null
  for (let guard = 0; guard < 60; guard++) {
    let model = set[Math.floor(rng() * set.length)]
    if (model === last) model = set[(set.indexOf(model) + 1) % set.length]
    const a = getAsset(model)
    const w = a.size[0]
    if (t + w > len + 0.5) break
    const push = (rng() - 0.5) * (row.jitter ?? 1.2) // in and out of the building line
    // centre of the footprint
    const cx = x0 + ux * (t + w / 2) - uz * push
    const cz = z0 + uz * (t + w / 2) + ux * push
    const [ox, oz] = rotate(a.offset[0], a.offset[2], angle)
    out.push({
      model,
      item: { position: [cx - ox, 0.02, cz - oz], rotation: face, scale: 1 },
      collider: { x: cx, z: cz, hw: (a.size[0] * 0.92) / 2, hd: (a.size[2] * 0.92) / 2, angle },
      height: a.size[1],
    })
    last = model
    t += w + (row.gap ?? 1.5) + rng() * 1.5
  }
  return out
}

// ---------- props from simple shapes ----------
// A prim: { s: 'box' | 'cyl' | 'cone', p: [x, y, z] (centre), d: [w, h, d] (cyl/cone: [radius, height]), c: colour, ry, rx }

const PAINT = ['#2e86c1', '#1e8449', '#d4ac0d', '#c0392b', '#7d3c98', '#d35400', '#148f77', '#e8e2d0']
const CLOTH = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#e67e22', '#ecf0f1', '#9b59b6']
const RUST = ['#7b4a2b', '#8d5a34', '#6e4a36', '#94623d']

// leaf greens for the baked trees and bushes (dry-season to rainy-season)
const LEAF = ['#3f7a2e', '#4f8a34', '#5c9438', '#6a9a3a', '#47803a']

export const PROPS = {
  kiosk(rng) {
    const paint = PAINT[Math.floor(rng() * PAINT.length)]
    const roof = RUST[Math.floor(rng() * RUST.length)]
    return {
      solid: [1.2, 1.2],
      shadow: 2.1,
      light: [0, 1.5, 1.25],
      prims: [
        { s: 'box', p: [0, 1.0, 0], d: [2.2, 2.0, 2.2], c: paint },
        { s: 'box', p: [0, 2.07, 0.15], d: [2.7, 0.08, 2.9], c: roof, rx: 0.08 },
        { s: 'box', p: [0, 1.25, 1.11], d: [1.5, 0.9, 0.04], c: '#1c1712' }, // serving hatch
        { s: 'box', p: [0, 0.78, 1.3], d: [1.7, 0.06, 0.4], c: '#8b5a2b' }, // counter
        { s: 'box', p: [0, 1.86, 1.12], d: [2.0, 0.26, 0.04], c: '#f6ecd2' }, // name board
        { s: 'box', p: [-0.5, 0.93, 1.3], d: [0.18, 0.24, 0.18], c: CLOTH[Math.floor(rng() * CLOTH.length)] },
        { s: 'box', p: [0.1, 0.9, 1.32], d: [0.22, 0.18, 0.16], c: CLOTH[Math.floor(rng() * CLOTH.length)] },
        { s: 'box', p: [0.55, 0.95, 1.28], d: [0.14, 0.28, 0.14], c: CLOTH[Math.floor(rng() * CLOTH.length)] },
      ],
    }
  },
  umbrella(rng) {
    const cloth = CLOTH[Math.floor(rng() * CLOTH.length)]
    const goods = [0, 1, 2, 3].map((i) => ({ s: 'box', p: [-0.42 + i * 0.28, 0.83 + (i % 2) * 0.03, (rng() - 0.5) * 0.25], d: [0.2, 0.16 + rng() * 0.1, 0.2], c: CLOTH[Math.floor(rng() * CLOTH.length)] }))
    return {
      solid: [0.7, 0.45],
      shadow: 1.4,
      prims: [
        { s: 'cyl', p: [0.75, 1.15, 0], d: [0.035, 2.3], c: '#5d4037' },
        { s: 'cone', p: [0.75, 2.35, 0], d: [1.45, 0.5], c: cloth },
        { s: 'box', p: [0, 0.72, 0], d: [1.3, 0.06, 0.7], c: '#8b5a2b' },
        { s: 'box', p: [-0.55, 0.35, 0.25], d: [0.06, 0.7, 0.06], c: '#5d4037' },
        { s: 'box', p: [0.55, 0.35, 0.25], d: [0.06, 0.7, 0.06], c: '#5d4037' },
        { s: 'box', p: [-0.55, 0.35, -0.25], d: [0.06, 0.7, 0.06], c: '#5d4037' },
        { s: 'box', p: [0.55, 0.35, -0.25], d: [0.06, 0.7, 0.06], c: '#5d4037' },
        { s: 'box', p: [0, 0.22, -0.7], d: [0.36, 0.44, 0.36], c: '#3d6fb0' }, // seller's stool
        ...goods,
      ],
    }
  },
  drums(rng) {
    const n = 2 + Math.floor(rng() * 2)
    return {
      solid: [0.6, 0.4],
      prims: Array.from({ length: n }, (_, i) => ({ s: 'cyl', p: [i * 0.66 - (n - 1) * 0.33, 0.45, (rng() - 0.5) * 0.3], d: [0.29, 0.9], c: rng() < 0.5 ? '#2c5aa0' : RUST[Math.floor(rng() * RUST.length)] })),
    }
  },
  kegs(rng) {
    const prims = []
    for (let i = 0; i < 7; i++) {
      const col = i % 4
      const row = Math.floor(i / 4)
      prims.push({ s: 'box', p: [col * 0.3 - 0.45, 0.2 + (i === 6 ? 0.4 : 0), row * 0.32 - 0.16], d: [0.24, 0.4, 0.26], c: rng() < 0.85 ? '#f2c300' : '#e8e2d0', ry: (rng() - 0.5) * 0.3 })
      prims.push({ s: 'cyl', p: [col * 0.3 - 0.45, 0.43 + (i === 6 ? 0.4 : 0), row * 0.32 - 0.16], d: [0.04, 0.06], c: '#c0392b' })
    }
    return { prims }
  },
  crates(rng) {
    const prims = []
    for (let i = 0; i < 4; i++) prims.push({ s: 'box', p: [(i % 2) * 0.62 - 0.3, 0.26 + Math.floor(i / 2) * 0.52, (rng() - 0.5) * 0.12], d: [0.58, 0.5, 0.5], c: i % 3 ? '#b07a3f' : '#c98d4b', ry: (rng() - 0.5) * 0.25 })
    return { solid: [0.6, 0.3], prims }
  },
  tyres(rng) {
    const n = 3 + Math.floor(rng() * 3)
    return { prims: Array.from({ length: n }, (_, i) => ({ s: 'cyl', p: [(rng() - 0.5) * 0.08, 0.11 + i * 0.22, (rng() - 0.5) * 0.08], d: [0.36, 0.2], c: i % 2 ? '#1f1f1f' : '#2b2b2b' })) }
  },
  bench() {
    return {
      prims: [
        { s: 'box', p: [0, 0.45, 0], d: [1.8, 0.06, 0.34], c: '#8b5a2b' },
        { s: 'box', p: [-0.75, 0.22, 0], d: [0.08, 0.44, 0.3], c: '#5d4037' },
        { s: 'box', p: [0.75, 0.22, 0], d: [0.08, 0.44, 0.3], c: '#5d4037' },
      ],
    }
  },
  refuse(rng) {
    const prims = [{ s: 'cone', p: [0, 0.3, 0], d: [1.1, 0.6], c: '#4a4136' }]
    for (let i = 0; i < 7; i++) prims.push({ s: 'box', p: [(rng() - 0.5) * 1.6, 0.08 + rng() * 0.3, (rng() - 0.5) * 1.4], d: [0.2 + rng() * 0.25, 0.12 + rng() * 0.16, 0.2 + rng() * 0.2], c: ['#ecf0f1', '#2c3e50', '#27ae60', '#e74c3c', '#f1c40f', '#3498db'][Math.floor(rng() * 6)], ry: rng() * 3 })
    return { prims }
  },
  generator() {
    return {
      prims: [
        { s: 'box', p: [0, 0.3, 0], d: [0.7, 0.45, 0.45], c: '#c0392b' },
        { s: 'box', p: [0, 0.57, 0], d: [0.5, 0.1, 0.36], c: '#2b2b2b' },
        { s: 'box', p: [-0.38, 0.3, 0.26], d: [0.04, 0.6, 0.04], c: '#2b2b2b' },
        { s: 'box', p: [0.38, 0.3, 0.26], d: [0.04, 0.6, 0.04], c: '#2b2b2b' },
        { s: 'box', p: [-0.38, 0.3, -0.26], d: [0.04, 0.6, 0.04], c: '#2b2b2b' },
        { s: 'box', p: [0.38, 0.3, -0.26], d: [0.04, 0.6, 0.04], c: '#2b2b2b' },
        { s: 'cyl', p: [0.42, 0.42, 0], d: [0.05, 0.3], c: '#555555' },
      ],
    }
  },
  waterTank() {
    const legs = [-0.5, 0.5].flatMap((x) => [-0.5, 0.5].map((z) => ({ s: 'box', p: [x, 1.2, z], d: [0.08, 2.4, 0.08], c: '#4a4a4a' })))
    return {
      solid: [0.6, 0.6],
      shadow: 3.6,
      prims: [...legs, { s: 'box', p: [0, 2.42, 0], d: [1.3, 0.06, 1.3], c: '#6b6b6b' }, { s: 'cyl', p: [0, 3.15, 0], d: [0.62, 1.4], c: '#151515' }, { s: 'cyl', p: [0, 3.9, 0], d: [0.2, 0.1], c: '#151515' }],
    }
  },
  wheelbarrow() {
    return {
      prims: [
        { s: 'box', p: [0, 0.42, 0], d: [0.6, 0.26, 0.9], c: '#1e8449', rx: -0.12 },
        { s: 'cyl', p: [0, 0.19, 0.6], d: [0.19, 0.08], c: '#1f1f1f', rz: Math.PI / 2 },
        { s: 'box', p: [-0.26, 0.4, -0.75], d: [0.04, 0.04, 0.7], c: '#5d4037' },
        { s: 'box', p: [0.26, 0.4, -0.75], d: [0.04, 0.04, 0.7], c: '#5d4037' },
      ],
    }
  },
  goat(rng) {
    const c = rng() < 0.5 ? '#e8e2d0' : rng() < 0.5 ? '#6e4a36' : '#2b2b2b'
    return {
      prims: [
        { s: 'box', p: [0, 0.45, 0], d: [0.3, 0.3, 0.68], c },
        { s: 'box', p: [0, 0.66, 0.42], d: [0.2, 0.22, 0.28], c },
        { s: 'box', p: [-0.07, 0.82, 0.38], d: [0.03, 0.12, 0.03], c: '#3a3a3a' },
        { s: 'box', p: [0.07, 0.82, 0.38], d: [0.03, 0.12, 0.03], c: '#3a3a3a' },
        ...[-0.1, 0.1].flatMap((x) => [-0.26, 0.26].map((z) => ({ s: 'box', p: [x, 0.15, z], d: [0.06, 0.3, 0.06], c }))),
      ],
    }
  },
  clothesline(rng) {
    const prims = [
      { s: 'box', p: [-1.6, 0.95, 0], d: [0.06, 1.9, 0.06], c: '#5d4037' },
      { s: 'box', p: [1.6, 0.95, 0], d: [0.06, 1.9, 0.06], c: '#5d4037' },
      { s: 'box', p: [0, 1.82, 0], d: [3.2, 0.015, 0.015], c: '#222222' },
    ]
    for (let i = 0; i < 5; i++) prims.push({ s: 'box', p: [-1.2 + i * 0.6, 1.5 - (i % 2) * 0.08, 0], d: [0.42, 0.6 + (i % 2) * 0.16, 0.02], c: CLOTH[Math.floor(rng() * CLOTH.length)] })
    return { prims }
  },
  signboard(rng) {
    return {
      prims: [
        { s: 'box', p: [0, 0.9, 0], d: [0.06, 1.8, 0.06], c: '#4a4a4a' },
        { s: 'box', p: [0, 2.0, 0], d: [1.3, 0.7, 0.05], c: PAINT[Math.floor(rng() * PAINT.length)] },
        { s: 'box', p: [0, 2.0, 0.03], d: [1.1, 0.14, 0.01], c: '#ffffff' },
      ],
    }
  },
  // --- from the nature pack (baked meshes: see scripts/import-nature.mjs) ---
  tree(rng) {
    const m = ['tree1', 'tree2', 'tree3', 'tree4', 'tree1', 'tree3'][Math.floor(rng() * 6)]
    const k = (m === 'tree4' ? 0.85 : 1.15) + rng() * 0.5
    return { solid: [0.3, 0.3], shadow: 3, prims: [{ s: 'mesh', m, p: [0, 0, 0], k, ry: rng() * 6.28, c: LEAF[Math.floor(rng() * LEAF.length)], c2: rng() < 0.5 ? '#5a4030' : '#6b4a33' }] }
  },
  bush(rng) {
    const m = ['bush1', 'bush2', 'bush3'][Math.floor(rng() * 3)]
    return { prims: [{ s: 'mesh', m, p: [0, 0, 0], k: 0.8 + rng() * 0.6, ry: rng() * 6.28, c: LEAF[Math.floor(rng() * LEAF.length)], c2: '#4d3829' }] }
  },
  rock(rng) {
    const m = ['rock1', 'rock2', 'rock3'][Math.floor(rng() * 3)]
    const k = 0.35 + rng() * 0.45
    return { solid: [0.5 * k + 0.2, 0.5 * k + 0.2], prims: [{ s: 'mesh', m, p: [0, 0, 0], k, ry: rng() * 6.28, c2: rng() < 0.5 ? '#7d7468' : '#8a8378' }] }
  },
  grassTuft(rng) {
    // one clump, scaled up (a clump is 172 triangles: three per tuft was too heavy for budget phones)
    return { prims: [{ s: 'mesh', m: 'grass1', p: [0, 0, 0], k: 2.4 + rng() * 1.6, ry: rng() * 6.28, c: rng() < 0.5 ? '#6f9a3c' : '#84a544' }] }
  },
  palmTree(rng) {
    const h = 6 + rng() * 4
    const lean = (rng() - 0.5) * 0.18
    const prims = []
    for (let i = 0; i < 6; i++) prims.push({ s: 'cyl', p: [lean * i * 1.6, (i + 0.5) * (h / 6), 0], d: [0.22 - i * 0.012, h / 6 + 0.05], c: i % 2 ? '#6e5640' : '#5e4a37', rz: -lean })
    const top = [lean * 6 * 1.6, h, 0]
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      prims.push({ s: 'box', p: [top[0] + Math.sin(a) * 1.1, top[1] - 0.25, top[2] + Math.cos(a) * 1.1], d: [0.35, 0.05, 2.4], c: i % 2 ? '#3f7a2a' : '#4d8f30', ry: a, rx: 0.42 })
    }
    prims.push({ s: 'cone', p: [top[0], h + 0.1, top[2]], d: [0.4, 0.6], c: '#c0392b' })
    return { solid: [0.3, 0.3], shadow: h * 0.6, prims }
  },
  yamBarn(rng) {
    const prims = []
    for (const x of [-1.2, 0, 1.2]) prims.push({ s: 'box', p: [x, 1.1, 0], d: [0.12, 2.2, 0.12], c: '#6b4a2b' })
    for (const y of [0.5, 1.1, 1.7]) prims.push({ s: 'box', p: [0, y, 0], d: [2.6, 0.06, 0.08], c: '#6b4a2b' })
    for (let i = 0; i < 18; i++) prims.push({ s: 'box', p: [-1.15 + (i % 6) * 0.46, 0.65 + Math.floor(i / 6) * 0.6, 0.12], d: [0.18, 0.42, 0.18], c: rng() < 0.5 ? '#8a6a4a' : '#7a5a3c', rz: (rng() - 0.5) * 0.4 })
    return { solid: [1.4, 0.4], shadow: 2.2, prims }
  },
  shrine() {
    return {
      solid: [1.4, 1.4],
      shadow: 2.6,
      prims: [
        { s: 'box', p: [0, 0.9, 0], d: [2.2, 1.8, 2.2], c: '#8a5a3a' },
        { s: 'cone', p: [0, 2.3, 0], d: [2.0, 1.3], c: '#b89a5a' },
        { s: 'box', p: [0, 0.8, 1.12], d: [0.8, 1.4, 0.04], c: '#1c1712' },
        { s: 'box', p: [-0.9, 1.6, 1.13], d: [0.5, 0.3, 0.02], c: '#c0392b' },
        { s: 'box', p: [0.9, 1.6, 1.13], d: [0.5, 0.3, 0.02], c: '#ecf0f1' },
        { s: 'cyl', p: [-1.6, 0.35, 1.2], d: [0.22, 0.7], c: '#5d4037' },
        { s: 'cyl', p: [1.6, 0.25, 1.4], d: [0.3, 0.5], c: '#7a5a3c' },
      ],
    }
  },
  maize(rng) {
    const prims = []
    for (let r = 0; r < 3; r++)
      for (let i = 0; i < 7; i++) {
        const h = 1.3 + rng() * 0.6
        prims.push({ s: 'cone', p: [-1.8 + i * 0.6, h / 2, -0.9 + r * 0.9], d: [0.18, h], c: rng() < 0.5 ? '#5f8a2e' : '#7a9a35', flat: true })
      }
    return { prims }
  },
  goalPost() {
    return {
      prims: [
        { s: 'box', p: [-2.4, 1.2, 0], d: [0.12, 2.4, 0.12], c: '#f2f2f2' },
        { s: 'box', p: [2.4, 1.2, 0], d: [0.12, 2.4, 0.12], c: '#f2f2f2' },
        { s: 'box', p: [0, 2.4, 0], d: [4.9, 0.12, 0.12], c: '#f2f2f2' },
      ],
    }
  },
  noticeBoard(rng) {
    const prims = [
      { s: 'box', p: [-1.0, 1.0, 0], d: [0.1, 2.0, 0.1], c: '#5d4037' },
      { s: 'box', p: [1.0, 1.0, 0], d: [0.1, 2.0, 0.1], c: '#5d4037' },
      { s: 'box', p: [0, 1.5, 0], d: [2.2, 1.0, 0.08], c: '#7a5a3c' },
    ]
    for (let i = 0; i < 6; i++) prims.push({ s: 'box', p: [-0.8 + (i % 3) * 0.8, 1.3 + Math.floor(i / 3) * 0.42, 0.05], d: [0.55, 0.35, 0.01], c: ['#ecf0f1', '#f1c40f', '#fadbd8', '#d6eaf8'][Math.floor(rng() * 4)], rz: (rng() - 0.5) * 0.15 })
    return { solid: [1.1, 0.2], prims }
  },
  gatehouse() {
    return {
      solid: [1.6, 1.4],
      shadow: 2.8,
      light: [0, 2.2, 1.5],
      prims: [
        { s: 'box', p: [0, 1.3, 0], d: [3.0, 2.6, 2.6], c: '#e8e2d0' },
        { s: 'box', p: [0, 2.7, 0], d: [3.4, 0.2, 3.0], c: '#1e6b43' },
        { s: 'box', p: [0, 1.5, 1.31], d: [1.6, 0.9, 0.02], c: '#2f3b46' },
        { s: 'box', p: [2.4, 1.0, 1.6], d: [3.0, 0.12, 0.12], c: '#d63a2a' },
        { s: 'box', p: [1.0, 0.5, 1.6], d: [0.18, 1.0, 0.18], c: '#f2f2f2' },
      ],
    }
  },
  okada(rng) {
    const c = ['#c0392b', '#2c5aa0', '#1e8449', '#111111'][Math.floor(rng() * 4)]
    return {
      solid: [0.35, 0.95],
      prims: [
        { s: 'cyl', p: [0, 0.3, 0.62], d: [0.3, 0.1], c: '#1b1b1b', rz: Math.PI / 2 },
        { s: 'cyl', p: [0, 0.3, -0.62], d: [0.3, 0.1], c: '#1b1b1b', rz: Math.PI / 2 },
        { s: 'box', p: [0, 0.62, 0.1], d: [0.24, 0.26, 0.5], c },
        { s: 'box', p: [0, 0.78, -0.3], d: [0.26, 0.08, 0.62], c: '#151515' },
        { s: 'box', p: [0, 0.55, -0.1], d: [0.12, 0.3, 0.9], c: '#3a3a3a' },
        { s: 'box', p: [0, 0.75, 0.52], d: [0.06, 0.6, 0.06], c: '#777777', rx: -0.35 },
        { s: 'box', p: [0, 1.02, 0.42], d: [0.6, 0.04, 0.04], c: '#222222' },
        { s: 'box', p: [0, 0.9, 0.56], d: [0.12, 0.12, 0.08], c: '#f6ecd2' },
      ],
    }
  },
}

function transformPrims(prims, x, z, yaw) {
  return prims.map((q) => {
    const [px, pz] = rotate(q.p[0], q.p[2], yaw)
    return { ...q, p: [x + px, q.p[1], z + pz], ry: (q.ry || 0) + yaw }
  })
}

function hitsBox(x, z, r, c) {
  const [lx, lz] = rotate(x - c.x, z - c.z, -c.angle)
  return Math.abs(lx) < c.hw + r && Math.abs(lz) < c.hd + r
}

/**
 * @param json      world layout JSON
 * @param existing  colliders already in the world (hand-placed things)
 * @param reserved  [[x, z], ...] places the story uses (NPC marks, spots)
 */
export function generateFill(json, existing = [], reserved = []) {
  const groupsByModel = new Map()
  const colliders = []
  const shadows = [] // { x, z, hw, hd, angle, h }
  const prims = []
  const lights = []
  const blocks = []

  // ---- rows of buildings ----
  for (const row of json.rows || []) {
    for (const b of buildRow(row)) {
      if (!groupsByModel.has(b.model)) groupsByModel.set(b.model, [])
      groupsByModel.get(b.model).push(b.item)
      shadows.push({ ...b.collider, h: b.height })
      if (row.solid) colliders.push(b.collider)
    }
  }

  // ---- hand-placed shape props: "placed": [{ "kind": "shrine", "at": [x, z, rotDeg], "seed": 1 }] ----
  for (const pl of json.placed || []) {
    const make = PROPS[pl.kind]
    if (!make) continue
    const [x, z, rot = 0] = pl.at
    const yaw = rot * DEG
    const prop = make(mulberry32(pl.seed ?? Math.round(x * 31 + z * 17)))
    prims.push(...transformPrims(prop.prims, x, z, yaw))
    if (prop.solid) colliders.push({ x, z, hw: prop.solid[0], hd: prop.solid[1], angle: yaw })
    if (prop.shadow) shadows.push({ x, z, hw: prop.solid ? prop.solid[0] : 0.5, hd: prop.solid ? prop.solid[1] : 0.5, angle: yaw, h: prop.shadow })
    if (prop.light) {
      const [lx, lz] = rotate(prop.light[0], prop.light[2], yaw)
      lights.push({ x: x + lx, y: prop.light[1], z: z + lz })
    }
  }

  // ---- street clutter ----
  const blocked = [...existing, ...colliders]
  const taken = [] // circles of props already placed
  const noGo = (json.noClutter || []).map(([x, z, w, d]) => ({ x: x + w / 2, z: z + d / 2, hw: w / 2, hd: d / 2, angle: 0 }))
  for (const zone of json.clutter || []) {
    const rng = mulberry32(zone.seed ?? 7)
    const [zx, zz, zw, zd] = zone.rect
    let placed = 0
    for (let attempt = 0; attempt < zone.count * 12 && placed < zone.count; attempt++) {
      const kind = zone.kinds[Math.floor(rng() * zone.kinds.length)]
      const make = PROPS[kind]
      if (!make) continue
      const x = zx + rng() * zw
      const z = zz + rng() * zd
      const yaw = ((zone.face ?? 0) + (zone.spin ?? 25) * (rng() - 0.5) * 2) * DEG
      const prop = make(rng)
      const r = prop.solid ? Math.max(prop.solid[0], prop.solid[1]) + 0.5 : 0.9
      if (blocked.some((c) => hitsBox(x, z, r, c)) || noGo.some((c) => hitsBox(x, z, r, c))) continue
      if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + r)) continue
      if (reserved.some(([rx, rz, rr = 1.6]) => Math.hypot(rx - x, rz - z) < r + rr)) continue
      taken.push({ x, z, r })
      prims.push(...transformPrims(prop.prims, x, z, yaw))
      if (prop.solid) colliders.push({ x, z, hw: prop.solid[0], hd: prop.solid[1], angle: yaw })
      if (prop.shadow) shadows.push({ x, z, hw: prop.solid ? prop.solid[0] : 0.5, hd: prop.solid ? prop.solid[1] : 0.5, angle: yaw, h: prop.shadow })
      if (prop.light) {
        const [lx, lz] = rotate(prop.light[0], prop.light[2], yaw)
        lights.push({ x: x + lx, y: prop.light[1], z: z + lz })
      }
      placed++
    }
  }

  // ---- background people standing around (drawn cheaply by Crowd.jsx) ----
  // a customer at most kiosks, plus small groups at the world JSON "gatherings"
  const people = []
  {
    const rng = mulberry32(json.crowdSeed ?? 23)
    const free = (x, z) => !blocked.some((c) => hitsBox(x, z, 0.35, c)) && !colliders.some((c) => hitsBox(x, z, 0.35, c)) && !reserved.some(([rx, rz, rr = 1.6]) => Math.hypot(rx - x, rz - z) < Math.min(rr, 1.2)) && !people.some((q) => Math.hypot(q.x - x, q.z - z) < 0.7)
    for (const l of lights) {
      if (rng() < 0.25) continue
      const x = l.x + (rng() - 0.5) * 0.8
      const z = l.z + (l.z < 0 ? 0.7 : -0.7)
      if (free(x, z)) people.push({ x, z, yaw: l.z < 0 ? Math.PI : 0, pose: rng() < 0.5 ? 'talk' : 'idle', v: Math.floor(rng() * 6) })
    }
    for (const g of json.gatherings || []) {
      const n = g.n ?? 3
      const a0 = rng() * 6.28
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * 6.28
        const x = g.at[0] + Math.sin(a) * (g.r ?? 0.9)
        const z = g.at[1] + Math.cos(a) * (g.r ?? 0.9)
        if (free(x, z)) people.push({ x, z, yaw: a + Math.PI + (rng() - 0.5) * 0.5, pose: i % 2 ? 'talk' : 'idle', v: Math.floor(rng() * 6) })
      }
    }
    for (const q of people) colliders.push({ x: q.x, z: q.z, hw: 0.28, hd: 0.28, angle: 0 })
  }

  // ---- far skyline: plain blocks with painted windows ----
  const sky = json.skyline
  if (sky) {
    const rng = mulberry32(sky.seed ?? 11)
    const b = json.bounds
    const cx = (b.minX + b.maxX) / 2
    const cz = (b.minZ + b.maxZ) / 2
    sky.rings.forEach((ring, ri) => {
      // a rounded rectangle around the play area, `ring` metres beyond it
      const hx = (b.maxX - b.minX) / 2 + ring
      const hz = (b.maxZ - b.minZ) / 2 + ring
      const perimeter = 4 * (hx + hz)
      const step = 15 + ri * 4
      for (let d = 0; d < perimeter; d += step * (0.8 + rng() * 0.5)) {
        let x
        let z
        let rot = 0
        if (d < 2 * hx) { x = -hx + d; z = -hz; rot = 0 }
        else if (d < 2 * hx + 2 * hz) { x = hx; z = -hz + (d - 2 * hx); rot = 90 }
        else if (d < 4 * hx + 2 * hz) { x = hx - (d - 2 * hx - 2 * hz); z = hz; rot = 0 }
        else { x = -hx; z = hz - (d - 4 * hx - 2 * hz); rot = 90 }
        // leave the road corridors open so the main road runs to the horizon
        if (Math.abs(cz + z) < 9 && Math.abs(x) > hx - 1) continue
        const w = 9 + rng() * 9
        const dep = 8 + rng() * 6
        const h = (ri === 0 ? 8 : 14) + rng() * (ri === 0 ? 10 : 22)
        const bx = cx + x + (rng() - 0.5) * 6
        const bz = cz + z + (rng() - 0.5) * 8
        if (shadows.some((c) => hitsBox(bx, bz, Math.max(w, dep) / 2 + 1, c))) continue // a real building stands here
        blocks.push({ x: bx, z: bz, w, d: dep, h, rot, style: Math.floor(rng() * 6) })
      }
    })
  }

  // ---- tree line: a ring of palms and bush around a village ----
  const tl = json.treeline
  if (tl) {
    const rng = mulberry32(tl.seed ?? 5)
    const b = json.bounds
    tl.rings.forEach((ring) => {
      const hx = (b.maxX - b.minX) / 2 + ring
      const hz = (b.maxZ - b.minZ) / 2 + ring
      const cx = (b.minX + b.maxX) / 2
      const cz = (b.minZ + b.maxZ) / 2
      const perimeter = 4 * (hx + hz)
      for (let d = 0; d < perimeter; d += 3 + rng() * 4) {
        let x
        let z
        if (d < 2 * hx) { x = -hx + d; z = -hz }
        else if (d < 2 * hx + 2 * hz) { x = hx; z = -hz + (d - 2 * hx) }
        else if (d < 4 * hx + 2 * hz) { x = hx - (d - 2 * hx - 2 * hz); z = hz }
        else { x = -hx; z = hz - (d - 4 * hx - 2 * hz) }
        if (Math.abs(cz + z) < 7) continue // the road runs through
        const px = cx + x + (rng() - 0.5) * 8
        const pz = cz + z + (rng() - 0.5) * 8
        const roll = rng()
        if (roll < 0.4) prims.push(...transformPrims(PROPS.palmTree(rng).prims, px, pz, rng() * 6.28))
        else if (roll < 0.62) {
          // bush trees, bigger than the ones inside the village so the edge reads as forest
          // (only the two lightest models: there are a lot of these)
          const tree = PROPS.tree(rng).prims.map((q) => ({ ...q, m: rng() < 0.5 ? 'tree1' : 'tree3', k: 1.7 + rng() * 0.7 }))
          prims.push(...transformPrims(tree, px, pz, 0))
        } else {
          // undergrowth: one big shrub
          const shrub = PROPS.bush(rng).prims.map((q) => ({ ...q, m: rng() < 0.5 ? 'bush1' : 'bush3', k: 2.2 + rng() * 1.2 }))
          prims.push(...transformPrims(shrub, px, pz, 0))
        }
      }
    })
  }

  const groups = [...groupsByModel.entries()].map(([model, items]) => ({ kind: 'building', model, items, solid: false, wires: null }))
  return { groups, prims, colliders, blocks, lights, shadows, people }
}
