// Builds the interior furniture as small low-poly GLB files, in the flat-colour
// Kenney style of the rest of the city: public/assets/furniture/<name>.glb,
// and records each one's bounds in src/assets/assetIndex.json (pack
// "furniture", 1 unit = 1 metre).
//
//   node scripts/build-furniture.mjs
//
// Every piece is a few boxes and cylinders, merged into one mesh per colour,
// so a furnished room costs a handful of draw calls.
import fs from 'fs'
import path from 'path'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// GLTFExporter wants a browser's FileReader for the binary buffer
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b
      this.onloadend?.()
    })
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(b).toString('base64')}`
      this.onloadend?.()
    })
  }
}

const OUT = 'public/assets/furniture'
const INDEX = 'src/assets/assetIndex.json'

// ---------------------------------------------------------------- a tiny modelling kit
function piece() {
  const parts = new Map() // colour -> [geometry]
  const api = {
    /** A box: centre x,y,z; size w,h,d; colour; rotation about y (degrees). */
    box(x, y, z, w, h, d, color, rotY = 0) {
      const g = new THREE.BoxGeometry(w, h, d)
      if (rotY) g.rotateY((rotY * Math.PI) / 180)
      g.translate(x, y, z)
      add(color, g)
      return api
    },
    /** A cylinder standing up: centre x,y,z; radius; height. */
    cyl(x, y, z, r, h, color, seg = 10, rTop = r) {
      const g = new THREE.CylinderGeometry(rTop, r, h, seg)
      g.translate(x, y, z)
      add(color, g)
      return api
    },
    /** A cylinder lying along x (rolls, pipes). */
    cylX(x, y, z, r, len, color, seg = 10) {
      const g = new THREE.CylinderGeometry(r, r, len, seg)
      g.rotateZ(Math.PI / 2)
      g.translate(x, y, z)
      add(color, g)
      return api
    },
    sphere(x, y, z, r, color, seg = 8) {
      const g = new THREE.SphereGeometry(r, seg, Math.max(4, seg / 2))
      g.translate(x, y, z)
      add(color, g)
      return api
    },
    /** Four legs under a top of size w x d at height h. */
    legs(w, d, h, t, color, inset = 0.06) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) api.box(sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset), t, h, t, color)
      return api
    },
    build(name) {
      const group = new THREE.Group()
      group.name = name
      for (const [color, geos] of parts) {
        const geo = mergeGeometries(geos.map((g) => g.toNonIndexed()))
        geo.computeVertexNormals()
        const emissive = color.startsWith('!') // "!#33ff66": a light that glows
        const hex = emissive ? color.slice(1) : color
        const mat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85, metalness: 0, flatShading: true, emissive: emissive ? hex : '#000000', emissiveIntensity: emissive ? 0.9 : 0 })
        mat.name = hex
        const mesh = new THREE.Mesh(geo, mat)
        mesh.name = `${name}-${hex.slice(1)}`
        group.add(mesh)
      }
      return group
    },
  }
  function add(color, g) {
    if (!parts.has(color)) parts.set(color, [])
    parts.get(color).push(g)
  }
  return api
}

// ---------------------------------------------------------------- the pieces
const WOOD = '#8a5a35'
const WOOD_D = '#5e3b22'
const WOOD_L = '#b9895a'
const METAL = '#5b6470'
const STEEL = '#9aa3ad'
const BLACK = '#22232a'
const WHITE = '#e9e6df'
const GOLD = '#d8a93b'

export const FURNITURE = {
  sofa: () =>
    piece()
      .box(0, 0.22, 0, 2.0, 0.26, 0.86, '#6d2a2a') // base
      .box(0, 0.42, 0.06, 1.66, 0.14, 0.7, '#8a3636') // seat cushions
      .box(0, 0.62, -0.34, 1.96, 0.54, 0.2, '#6d2a2a') // back
      .box(-0.92, 0.48, 0.02, 0.18, 0.36, 0.82, '#6d2a2a')
      .box(0.92, 0.48, 0.02, 0.18, 0.36, 0.82, '#6d2a2a')
      .box(-0.45, 0.62, -0.18, 0.5, 0.3, 0.12, GOLD) // throw pillows
      .box(0.45, 0.62, -0.18, 0.5, 0.3, 0.12, GOLD)
      .legs(1.9, 0.76, 0.09, 0.06, WOOD_D),
  armchair: () =>
    piece()
      .box(0, 0.22, 0, 0.9, 0.26, 0.86, '#6d2a2a')
      .box(0, 0.42, 0.06, 0.6, 0.14, 0.7, '#8a3636')
      .box(0, 0.62, -0.34, 0.88, 0.54, 0.2, '#6d2a2a')
      .box(-0.38, 0.48, 0.02, 0.14, 0.36, 0.82, '#6d2a2a')
      .box(0.38, 0.48, 0.02, 0.14, 0.36, 0.82, '#6d2a2a')
      .legs(0.82, 0.76, 0.09, 0.06, WOOD_D),
  bed: () =>
    piece()
      .box(0, 0.2, 0, 1.6, 0.3, 2.0, WOOD) // frame
      .box(0, 0.42, 0.02, 1.5, 0.16, 1.9, WHITE) // mattress
      .box(0, 0.52, 0.35, 1.52, 0.06, 1.2, '#2f6f9a') // wrapper-print blanket
      .box(-0.38, 0.56, -0.72, 0.6, 0.12, 0.34, WHITE)
      .box(0.38, 0.56, -0.72, 0.6, 0.12, 0.34, WHITE)
      .box(0, 0.75, -1.0, 1.66, 0.9, 0.1, WOOD_D), // headboard
  bunkBed: () =>
    piece()
      .box(0, 0.35, 0, 0.95, 0.12, 2.0, METAL)
      .box(0, 0.45, 0, 0.88, 0.12, 1.92, '#3c7bb0')
      .box(0, 1.45, 0, 0.95, 0.12, 2.0, METAL)
      .box(0, 1.55, 0, 0.88, 0.12, 1.92, '#b0553c')
      .legs(0.95, 2.0, 1.9, 0.06, METAL, 0.03)
      .box(0.5, 1.0, 0.7, 0.04, 1.0, 0.04, STEEL)
      .box(0.5, 1.0, 0.9, 0.04, 1.0, 0.04, STEEL),
  desk: () =>
    piece()
      .box(0, 0.74, 0, 1.4, 0.05, 0.7, WOOD_L)
      .legs(1.4, 0.7, 0.72, 0.05, WOOD_D)
      .box(0.45, 0.5, 0, 0.42, 0.44, 0.62, WOOD), // drawers
  officeChair: () =>
    piece()
      .cyl(0, 0.05, 0, 0.3, 0.06, BLACK, 5)
      .cyl(0, 0.25, 0, 0.04, 0.4, STEEL, 6)
      .box(0, 0.48, 0, 0.5, 0.08, 0.48, BLACK)
      .box(0, 0.8, -0.22, 0.48, 0.56, 0.07, BLACK),
  chair: () =>
    piece()
      .box(0, 0.45, 0, 0.44, 0.05, 0.44, WOOD)
      .legs(0.44, 0.44, 0.44, 0.04, WOOD_D, 0.03)
      .box(0, 0.75, -0.2, 0.44, 0.55, 0.04, WOOD),
  diningTable: () =>
    piece()
      .box(0, 0.75, 0, 1.8, 0.06, 0.95, WOOD)
      .legs(1.8, 0.95, 0.73, 0.07, WOOD_D)
      .box(0, 0.79, 0, 0.6, 0.02, 0.35, '#c9a13b'), // a runner
  coffeeTable: () =>
    piece()
      .box(0, 0.42, 0, 1.1, 0.05, 0.6, '#3a2a1e')
      .box(0, 0.12, 0, 1.0, 0.03, 0.5, '#3a2a1e')
      .legs(1.1, 0.6, 0.4, 0.05, GOLD),
  tvStand: () =>
    piece()
      .box(0, 0.25, 0, 1.6, 0.5, 0.45, WOOD_D)
      .box(0, 1.05, -0.05, 1.4, 0.8, 0.06, BLACK) // the screen
      .box(0, 1.05, -0.01, 1.32, 0.72, 0.01, '!#1d3f6e')
      .box(0, 0.6, -0.05, 0.3, 0.2, 0.15, BLACK),
  wardrobe: () =>
    piece()
      .box(0, 1.0, 0, 1.2, 2.0, 0.6, WOOD)
      .box(0, 1.0, 0.305, 0.02, 1.9, 0.01, WOOD_D)
      .box(-0.06, 1.0, 0.31, 0.03, 0.18, 0.03, GOLD)
      .box(0.06, 1.0, 0.31, 0.03, 0.18, 0.03, GOLD),
  fridge: () =>
    piece()
      .box(0, 0.9, 0, 0.7, 1.8, 0.7, WHITE)
      .box(0, 1.25, 0.355, 0.66, 0.01, 0.01, '#b8b4aa')
      .box(0.28, 1.0, 0.37, 0.04, 0.5, 0.04, STEEL),
  kitchenCounter: () =>
    piece()
      .box(0, 0.45, 0, 2.0, 0.9, 0.6, '#d9d3c4')
      .box(0, 0.92, 0, 2.04, 0.04, 0.64, '#40403f')
      .box(-0.5, 0.95, 0, 0.5, 0.04, 0.4, STEEL) // the sink
      .cyl(0.55, 0.98, 0, 0.12, 0.06, BLACK) // a gas ring
      .cyl(0.25, 0.98, 0, 0.12, 0.06, BLACK),
  safe: () =>
    piece()
      .box(0, 0.45, 0, 0.7, 0.9, 0.6, '#2e3238')
      .box(0, 0.45, 0.31, 0.6, 0.8, 0.02, '#3b4048')
      .cylX(0, 0.55, 0.33, 0.09, 0.04, GOLD, 12)
      .box(0.2, 0.35, 0.34, 0.04, 0.16, 0.04, STEEL),
  serverRack: () => {
    const p = piece().box(0, 1.0, 0, 0.6, 2.0, 1.0, '#1c1f24')
    for (let i = 0; i < 9; i++) {
      const y = 0.25 + i * 0.19
      p.box(0, y, 0.505, 0.54, 0.14, 0.01, '#2b3038')
      p.box(-0.2, y, 0.512, 0.04, 0.03, 0.01, i % 3 === 0 ? '!#ff4d4d' : '!#3cff8a')
      p.box(-0.12, y, 0.512, 0.04, 0.03, 0.01, '!#3cff8a')
    }
    return p
  },
  shrineAltar: () =>
    piece()
      .box(0, 0.4, 0, 1.6, 0.8, 0.8, '#6b3a22') // mud altar
      .box(0, 0.81, 0, 1.7, 0.03, 0.9, '#b3201f') // red cloth
      .box(0, 0.6, 0.41, 1.4, 0.4, 0.01, WHITE) // white band
      .cyl(-0.55, 0.95, 0, 0.16, 0.24, '#c49a5a', 10, 0.1) // calabashes
      .cyl(0.55, 0.95, 0, 0.16, 0.24, '#c49a5a', 10, 0.1)
      .box(0, 1.1, -0.2, 0.34, 0.5, 0.1, '#3a2414') // a carved mask
      .box(-0.08, 1.18, -0.14, 0.06, 0.04, 0.01, WHITE)
      .box(0.08, 1.18, -0.14, 0.06, 0.04, 0.01, WHITE)
      .cyl(-0.3, 0.92, 0.25, 0.03, 0.18, WHITE, 6) // candles
      .cyl(0.3, 0.92, 0.25, 0.03, 0.18, WHITE, 6)
      .sphere(-0.3, 1.04, 0.25, 0.03, '!#ffb347', 6)
      .sphere(0.3, 1.04, 0.25, 0.03, '!#ffb347', 6),
  regalia: () =>
    piece() // the stash on the altar: a red beret, beads, a carved staff
      .cyl(0, 0.06, 0, 0.16, 0.08, '#b3201f', 10, 0.18)
      .cyl(0.35, 0.5, 0, 0.03, 1.0, WOOD_D, 6)
      .sphere(0.35, 1.02, 0, 0.06, GOLD, 8)
      .cylX(-0.2, 0.03, 0.2, 0.03, 0.3, '#e0c060', 6),
  shrinePole: () =>
    piece()
      .cyl(0, 1.1, 0, 0.12, 2.2, '#4a2e18', 8)
      .box(0, 1.6, 0, 0.3, 0.35, 0.3, '#3a2414')
      .box(0, 1.3, 0, 0.32, 0.12, 0.32, '#b3201f'),
  crates: () =>
    piece() // market crates, stacked
      .box(-0.35, 0.25, 0, 0.6, 0.5, 0.6, WOOD_L)
      .box(0.32, 0.25, 0.05, 0.6, 0.5, 0.6, WOOD, 8)
      .box(-0.3, 0.75, 0.02, 0.6, 0.5, 0.6, WOOD, -6)
      .box(-0.35, 0.25, 0.305, 0.62, 0.06, 0.01, WOOD_D)
      .box(0.32, 0.25, 0.355, 0.62, 0.06, 0.01, WOOD_D),
  cartons: () =>
    piece() // electronics cartons, taped
      .box(-0.3, 0.3, 0, 0.55, 0.6, 0.45, '#b8925f')
      .box(0.3, 0.3, 0, 0.55, 0.6, 0.45, '#c49e6a')
      .box(0, 0.85, 0, 0.6, 0.5, 0.45, '#b8925f')
      .box(-0.3, 0.6, 0, 0.56, 0.04, 0.1, '#e5d9b6')
      .box(0, 1.1, 0, 0.61, 0.04, 0.1, '#e5d9b6')
      .box(0.3, 0.35, 0.23, 0.3, 0.2, 0.01, '#2a5fa0'),
  cashStack: () => {
    const p = piece()
    for (let i = 0; i < 6; i++) p.box((i % 3) * 0.17 - 0.17, 0.035 + Math.floor(i / 3) * 0.07, 0, 0.16, 0.07, 0.08, '#4f8f4a').box((i % 3) * 0.17 - 0.17, 0.035 + Math.floor(i / 3) * 0.07, 0, 0.05, 0.072, 0.082, '#e9e6df')
    return p
  },
  laptop: () =>
    piece()
      .box(0, 0.01, 0, 0.36, 0.02, 0.25, '#3b3f46')
      .box(0, 0.13, -0.12, 0.36, 0.24, 0.015, '#3b3f46', 0)
      .box(0, 0.13, -0.11, 0.33, 0.21, 0.005, '!#5b8fd6'),
  hardDrive: () =>
    piece()
      .box(0, 0.025, 0, 0.14, 0.05, 0.2, '#262a30')
      .box(0.04, 0.051, 0.06, 0.03, 0.002, 0.01, '!#3cff8a'),
  rug: () => piece().box(0, 0.008, 0, 2.4, 0.015, 1.7, '#7a2e3a').box(0, 0.017, 0, 2.0, 0.004, 1.3, '#c9a13b').box(0, 0.02, 0, 1.6, 0.004, 0.9, '#7a2e3a'),
  plant: () =>
    piece()
      .cyl(0, 0.2, 0, 0.18, 0.4, '#a0522d', 8, 0.22)
      .sphere(0, 0.65, 0, 0.3, '#2f7a3b', 7)
      .sphere(0.12, 0.85, 0.05, 0.2, '#3d9149', 7),
  lectureDesk: () =>
    piece()
      .box(0, 0.74, 0, 1.6, 0.05, 0.5, WOOD_L)
      .box(0, 0.45, 0, 1.6, 0.05, 0.45, WOOD)
      .legs(1.6, 0.5, 0.72, 0.05, METAL, 0.04)
      .box(0, 0.45, -0.45, 1.6, 0.05, 0.3, WOOD_L) // the bench behind
      .legs(1.6, 0.3, 0.43, 0.04, METAL, 0.04),
  filingCabinet: () =>
    piece()
      .box(0, 0.65, 0, 0.5, 1.3, 0.6, '#7d8792')
      .box(0, 0.32, 0.305, 0.4, 0.01, 0.01, BLACK)
      .box(0, 0.75, 0.305, 0.4, 0.01, 0.01, BLACK)
      .box(0, 1.1, 0.305, 0.4, 0.01, 0.01, BLACK),
}

// ---------------------------------------------------------------- export
async function toGlb(object) {
  const exporter = new GLTFExporter()
  return new Promise((resolve, reject) => exporter.parse(object, (r) => resolve(Buffer.from(r)), reject, { binary: true }))
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'))
  const pack = {}
  for (const [name, make] of Object.entries(FURNITURE)) {
    const obj = make().build(name)
    const glb = await toGlb(obj)
    const file = `${name}.glb`
    fs.writeFileSync(path.join(OUT, file), glb)
    const box = new THREE.Box3().setFromObject(obj)
    const r = (v) => Math.round(v * 1000) / 1000
    pack[file] = { bytes: glb.length, bounds: { min: box.min.toArray().map(r), max: box.max.toArray().map(r), size: box.getSize(new THREE.Vector3()).toArray().map(r) } }
    console.log(`${file.padEnd(20)} ${(glb.length / 1024).toFixed(1).padStart(6)} KB  ${pack[file].bounds.size.join(' x ')} m`)
  }
  index.packs.furniture = pack
  fs.writeFileSync(INDEX, `${JSON.stringify(index, null, 1)}\n`)
}

main()
