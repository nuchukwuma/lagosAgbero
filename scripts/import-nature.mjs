// Imports low-poly nature models (trees, bushes, rocks, grass) for the
// scenery. Usage:
//   npm run assets:nature -- path/to/nature-pack.zip      (or a folder / .fbx files)
//
// The scenery is built from merged, vertex-coloured shapes (see
// src/game/world/primGeometry.js), so these models are not shipped as
// .glb files. Each one is baked into a small list of triangles in
// src/assets/natureMeshes.json:
//   v     triangle corners in centimetres (x, y, z, x, y, z, ...), y up,
//         the trunk standing on the origin
//   part  one letter per triangle: l = leaves, t = trunk, r = rock
//   h     height in metres
// The game colours the parts itself (leaf greens vary per tree).

import fs from 'node:fs'
import path from 'node:path'
import { unzipSync } from 'fflate'
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const OUT = path.join(ROOT, 'src/assets/natureMeshes.json')

// file -> game name (Grass2/3 are near-copies of Grass1 and are skipped)
const MODELS = {
  'Tree1.fbx': 'tree1', 'Tree2.fbx': 'tree2', 'Tree3.fbx': 'tree3', 'Tree4.fbx': 'tree4',
  'Bush1.fbx': 'bush1', 'Bush2.fbx': 'bush2', 'Bush3.fbx': 'bush3',
  'Rock1.fbx': 'rock1', 'Rock2.fbx': 'rock2', 'Rock3.fbx': 'rock3',
  'Grass3.fbx': 'grass1',
}
const PART = { Leaves: 'l', Tree: 't', Rock: 'r' }

console.warn = () => {}

function collect(inputs) {
  const files = {}
  for (const input of inputs) {
    if (fs.statSync(input).isDirectory()) {
      for (const f of fs.readdirSync(input, { recursive: true })) if (String(f).toLowerCase().endsWith('.fbx')) files[path.basename(String(f))] = new Uint8Array(fs.readFileSync(path.join(input, String(f))))
    } else if (input.toLowerCase().endsWith('.zip')) {
      for (const [n, b] of Object.entries(unzipSync(new Uint8Array(fs.readFileSync(input))))) if (n.toLowerCase().endsWith('.fbx')) files[path.basename(n)] = b
    } else files[path.basename(input)] = new Uint8Array(fs.readFileSync(input))
  }
  return files
}

function bake(bytes) {
  const o = new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  o.updateMatrixWorld(true)
  const tris = [] // { part, pts: [Vector3 x3] }
  o.traverse((c) => {
    if (!c.isMesh) return
    const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry
    const pos = g.attributes.position
    const mats = [].concat(c.material)
    const groups = g.groups.length ? g.groups : [{ start: 0, count: pos.count, materialIndex: 0 }]
    for (const grp of groups) {
      const part = PART[mats[grp.materialIndex]?.name] || 't'
      for (let i = grp.start; i < grp.start + grp.count; i += 3) {
        tris.push({ part, pts: [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(pos, i + k).applyMatrix4(c.matrixWorld)) })
      }
    }
  })
  // stand it on the origin: centre on the lowest tenth (the trunk foot, or the whole rock)
  const all = tris.flatMap((t) => t.pts)
  const minY = Math.min(...all.map((p) => p.y))
  const maxY = Math.max(...all.map((p) => p.y))
  const foot = all.filter((p) => p.y < minY + (maxY - minY) * 0.1)
  const cx = foot.reduce((s, p) => s + p.x, 0) / foot.length
  const cz = foot.reduce((s, p) => s + p.z, 0) / foot.length
  const v = []
  for (const t of tris) for (const p of t.pts) v.push(Math.round(p.x - cx), Math.round(p.y), Math.round(p.z - cz))
  return { v, part: tris.map((t) => t.part).join(''), h: Number((maxY / 100).toFixed(2)) }
}

const inputs = process.argv.slice(2)
if (!inputs.length) {
  console.error('Usage: npm run assets:nature -- path/to/nature-pack.zip')
  process.exit(1)
}
const files = collect(inputs)
const out = {}
for (const [file, name] of Object.entries(MODELS)) {
  if (!files[file]) { console.log(`  - ${name.padEnd(7)} SKIPPED: ${file} not found`); continue }
  out[name] = bake(files[file])
  console.log(`  ✓ ${name.padEnd(7)} ${String(out[name].part.length).padStart(4)} triangles, ${out[name].h} m tall`)
}
fs.writeFileSync(OUT, JSON.stringify(out) + '\n')
console.log(`Wrote ${path.relative(ROOT, OUT)} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`)
