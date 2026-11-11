// Imports the Kenney packs from the "agberolife" zip into public/assets/.
//
// Usage:
//   npm run assets:import -- path/to/agberolife.zip
//   npm run assets:import -- path/to/folder-with-the-kenney-zips
//
// What it keeps (everything else is skipped on purpose):
//   - city/car packs: Models/GLB format/*.glb, the shared Textures/colormap.png
//     the GLBs point at, and the alternate colour atlases (variation-*.png)
//   - characters: characterMedium.fbx, the 3 animation FBX files, the 4 skins
//   - each pack's License.txt
// The old 3d-road-tiles pack is glTF-only and city-kit-roads already has every
// road piece we need, so it is skipped.
//
// It also writes src/assets/assetIndex.json: every file, its size in bytes
// and (for GLB) its bounding box in the model's own units. It is bundled into
// the game, so placeholder boxes keep the right size even if a model file is
// missing or fails to download.

import fs from 'node:fs'
import path from 'node:path'
import { unzipSync } from 'fflate'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const OUT = path.join(ROOT, 'public', 'assets')

// zip-name fragment -> target folder under public/assets
const PACKS = [
  { match: 'car-kit', dir: 'car-kit', kind: 'city' },
  { match: 'city-kit-roads', dir: 'city-kit-roads', kind: 'city' },
  { match: 'city-kit-industrial', dir: 'city-kit-industrial', kind: 'city' },
  { match: 'city-kit-suburban', dir: 'city-kit-suburban', kind: 'city' },
  { match: 'animated-characters-retro', dir: 'characters', kind: 'characters' },
  { match: '3d-road-tiles', dir: null, kind: 'skip', reason: 'glTF-only legacy pack; city-kit-roads covers every road piece' },
]

function readPackZips(input) {
  const stat = fs.statSync(input)
  const zips = {}
  if (stat.isDirectory()) {
    for (const f of fs.readdirSync(input)) {
      if (f.toLowerCase().endsWith('.zip')) zips[f] = new Uint8Array(fs.readFileSync(path.join(input, f)))
    }
    return zips
  }
  const outer = unzipSync(new Uint8Array(fs.readFileSync(input)))
  const inner = Object.keys(outer).filter((k) => k.toLowerCase().endsWith('.zip'))
  if (inner.length === 0) {
    // The zip IS a single pack.
    zips[path.basename(input)] = new Uint8Array(fs.readFileSync(input))
  } else {
    for (const k of inner) zips[path.basename(k)] = outer[k]
  }
  return zips
}

function pickCityFiles(entries) {
  const out = {}
  for (const [p, data] of Object.entries(entries)) {
    if (p.endsWith('/')) continue
    const glb = p.match(/Models\/GLB format\/([^/]+\.glb)$/)
    if (glb) out[glb[1]] = data
    if (/Models\/GLB format\/Textures\/colormap\.png$/.test(p)) out['Textures/colormap.png'] = data
    const variation = p.match(/Models\/Textures\/(variation-[a-z]\.png)$/)
    if (variation) out[`Textures/${variation[1]}`] = data
    if (/(^|\/)License\.txt$/.test(p)) out['License.txt'] = data
  }
  return out
}

function pickCharacterFiles(entries) {
  const out = {}
  for (const [p, data] of Object.entries(entries)) {
    if (p.endsWith('/')) continue
    if (/Model\/characterMedium\.fbx$/.test(p)) out['characterMedium.fbx'] = data
    const anim = p.match(/Animations\/([^/]+\.fbx)$/)
    if (anim) out[`anims/${anim[1]}`] = data
    const skin = p.match(/Skins\/([^/]+\.png)$/)
    if (skin) out[`skins/${skin[1]}`] = data
    if (/(^|\/)License\.txt$/.test(p)) out['License.txt'] = data
  }
  return out
}

// ---- tiny GLB bounding-box reader (no three.js needed in Node) ----
function mat4FromNode(n) {
  if (n.matrix) return n.matrix.slice()
  const [tx, ty, tz] = n.translation || [0, 0, 0]
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1]
  const [sx, sy, sz] = n.scale || [1, 1, 1]
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z
  return [
    (1 - 2 * (yy + zz)) * sx, 2 * (xy + wz) * sx, 2 * (xz - wy) * sx, 0,
    2 * (xy - wz) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + wx) * sy, 0,
    2 * (xz + wy) * sz, 2 * (yz - wx) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ]
}
function mul(a, b) {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
  return o
}
function apply(m, [x, y, z]) {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]
}
function glbBounds(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const jsonLen = dv.getUint32(12, true)
  const gltf = JSON.parse(new TextDecoder().decode(buf.subarray(20, 20 + jsonLen)))
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const visit = (idx, parent) => {
    const node = gltf.nodes[idx]
    const m = mul(parent, mat4FromNode(node))
    if (node.mesh !== undefined) {
      for (const prim of gltf.meshes[node.mesh].primitives) {
        const acc = gltf.accessors[prim.attributes.POSITION]
        if (!acc.min) continue
        for (let i = 0; i < 8; i++) {
          const corner = [i & 1 ? acc.max[0] : acc.min[0], i & 2 ? acc.max[1] : acc.min[1], i & 4 ? acc.max[2] : acc.min[2]]
          const p = apply(m, corner)
          for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], p[a]); max[a] = Math.max(max[a], p[a]) }
        }
      }
    }
    for (const c of node.children || []) visit(c, m)
  }
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  const scene = gltf.scenes[gltf.scene || 0]
  for (const n of scene.nodes) visit(n, I)
  const r = (v) => Math.round(v * 1000) / 1000
  return { min: min.map(r), max: max.map(r), size: max.map((v, i) => r(v - min[i])) }
}

function main() {
  const input = process.argv[2]
  if (!input || !fs.existsSync(input)) {
    console.error('Usage: npm run assets:import -- path/to/agberolife.zip')
    process.exit(1)
  }
  const zips = readPackZips(input)
  const index = { packs: {}, skipped: [] }

  for (const [zipName, data] of Object.entries(zips)) {
    const pack = PACKS.find((p) => zipName.includes(p.match))
    if (!pack) { index.skipped.push({ zip: zipName, reason: 'unknown pack' }); continue }
    if (pack.kind === 'skip') { index.skipped.push({ zip: zipName, reason: pack.reason }); continue }

    const entries = unzipSync(data)
    const files = pack.kind === 'characters' ? pickCharacterFiles(entries) : pickCityFiles(entries)
    const target = path.join(OUT, pack.dir)
    fs.rmSync(target, { recursive: true, force: true })

    const listing = {}
    for (const [rel, bytes] of Object.entries(files)) {
      const dest = path.join(target, rel)
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.writeFileSync(dest, bytes)
      const info = { bytes: bytes.length }
      if (rel.endsWith('.glb')) info.bounds = glbBounds(bytes)
      listing[rel] = info
    }
    index.packs[pack.dir] = listing
    const total = Object.values(listing).reduce((s, f) => s + f.bytes, 0)
    console.log(`${pack.dir.padEnd(22)} ${String(Object.keys(listing).length).padStart(4)} files  ${(total / 1024 / 1024).toFixed(2)} MB`)
  }
  for (const s of index.skipped) console.log(`skipped ${s.zip}: ${s.reason}`)

  fs.writeFileSync(path.join(ROOT, 'src', 'assets', 'assetIndex.json'), JSON.stringify(index, null, 1) + '\n')
  console.log('Wrote src/assets/assetIndex.json')
}

main()
