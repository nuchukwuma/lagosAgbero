// Makes a low-detail version of each character body for the background crowd.
//
//   npm run assets:crowd
//
// For every body in public/assets/characters/people it runs an edge-collapse
// simplifier and writes public/assets/characters/crowd-lod.json:
//   { "<body>": { "keep": [original vertex index, ...], "index": [triangle indices into keep] } }
// The game bakes animation frames from the full skinned mesh, then keeps only
// these vertices, so a crowd member costs ~700 triangles instead of ~2,000.

import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const DIR = path.join(ROOT, 'public/assets/characters/people')
const OUT = path.join(ROOT, 'public/assets/characters/crowd-lod.json')
const KEEP_RATIO = Number(process.argv[2] || 0.36)

const TYPES = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }
const SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }

function readGlb(file) {
  const buf = fs.readFileSync(file)
  const jsonLen = buf.readUInt32LE(12)
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'))
  const bin = buf.subarray(20 + jsonLen + 8)
  const accessor = (i) => {
    const a = json.accessors[i]
    const view = json.bufferViews[a.bufferView]
    const T = TYPES[a.componentType]
    const n = a.count * SIZES[a.type]
    const start = (view.byteOffset || 0) + (a.byteOffset || 0)
    const stride = view.byteStride || 0
    if (!stride || stride === T.BYTES_PER_ELEMENT * SIZES[a.type]) return new T(bin.buffer.slice(bin.byteOffset + start, bin.byteOffset + start + n * T.BYTES_PER_ELEMENT))
    const out = new T(n)
    const dv = new DataView(bin.buffer, bin.byteOffset + start)
    for (let k = 0; k < a.count; k++) for (let c = 0; c < SIZES[a.type]; c++) out[k * SIZES[a.type] + c] = T === Float32Array ? dv.getFloat32(k * stride + c * 4, true) : dv.getUint16(k * stride + c * 2, true)
    return out
  }
  const prim = json.meshes[0].primitives[0]
  return { position: accessor(prim.attributes.POSITION), index: accessor(prim.indices) }
}

const result = {}
for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.glb')).sort()) {
  const body = file.replace('.glb', '')
  const { position, index } = readGlb(path.join(DIR, file))
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(position, 3))
  g.setIndex(new THREE.BufferAttribute(index, 1))
  // first original vertex at each position
  const first = new Map()
  for (let i = 0; i < position.length / 3; i++) {
    const key = `${position[i * 3]},${position[i * 3 + 1]},${position[i * 3 + 2]}`
    if (!first.has(key)) first.set(key, i)
  }
  const unique = first.size
  const simplified = new SimplifyModifier().modify(g, Math.floor(unique * (1 - KEEP_RATIO)))
  const p = simplified.attributes.position
  const keep = []
  for (let i = 0; i < p.count; i++) {
    const orig = first.get(`${p.getX(i)},${p.getY(i)},${p.getZ(i)}`)
    if (orig === undefined) throw new Error(`${body}: simplified vertex ${i} not found in the original`)
    keep.push(orig)
  }
  const idx = simplified.index ? [...simplified.index.array] : [...Array(p.count).keys()]
  result[body] = { keep, index: idx }
  console.log(`${body}: ${index.length / 3} -> ${idx.length / 3} triangles (${keep.length} vertices)`)
}
fs.writeFileSync(OUT, JSON.stringify(result))
console.log(`Wrote ${path.relative(ROOT, OUT)} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`)
