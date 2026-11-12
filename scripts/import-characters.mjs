// Imports the people (Men / Women packs) and the bus into public/assets.
//
// Usage:
//   npm run assets:characters -- source-assets/quaternius/men.zip source-assets/quaternius/women.zip source-assets/quaternius/vehicles.zip
//   (zips, folders or single .fbx files)
//
// For every low-poly body (the "Smooth_" versions are 4x heavier and skipped):
//   1. tags each vertex with the part it belongs to (Skin, Hair, Shirt...)
//      so the game can colour each part per person;
//   2. merges the ~150 material pieces into ONE mesh (one draw call per
//      person instead of ~150, which matters a lot on budget phones);
//   3. drops the built-in animations (we use our retargeted Mixamo clips);
//   4. writes a small .glb and records its parts in src/assets/peopleIndex.json.
// The bus (Low Poly Vehicles pack) is coloured like a Lagos molue and saved too.

import fs from 'node:fs'
import path from 'node:path'
import { unzipSync } from 'fflate'
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const OUT = path.join(ROOT, 'public/assets/characters/people')
const OUT_VEH = path.join(ROOT, 'public/assets/vehicles-extra')
const INDEX = path.join(ROOT, 'src/assets/peopleIndex.json')

const BODIES = {
  'Male_Casual.fbx': 'male_casual',
  'Male_Shirt.fbx': 'male_shirt',
  'Male_LongSleeve.fbx': 'male_longsleeve',
  'Male_Suit.fbx': 'male_suit',
  'Female_Casual.fbx': 'female_casual',
  'Female_Dress.fbx': 'female_dress',
  'Female_TankTop.fbx': 'female_tanktop',
  'Female_Alternative.fbx': 'female_alternative',
}

// Which look colour drives each material (see src/game/characters/look.js).
const SLOT = {
  Skin: 'skin', Eyes: 'eyes', Hair: 'hair', Hair2: 'hair', HairBase: 'hair', Eyebrows: 'hair',
  Shirt: 'shirt', Dress: 'shirt', Jacket: 'shirt', Shirt2: 'shirt2', LightJacket: 'shirt2',
  Pants: 'trousers', Socks: 'socks', Shoes: 'shoes', TieTexture: 'accent', Details: 'accent',
}

// Node has no FileReader; GLTFExporter needs one for binary output.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b
      this.onloadend?.()
    })
  }
}
console.warn = () => {}

async function collect(inputs) {
  const files = {}
  const add = (name, bytes) => (files[path.basename(name)] = new Uint8Array(bytes))
  for (const input of inputs) {
    if (fs.statSync(input).isDirectory()) {
      for (const f of fs.readdirSync(input, { recursive: true })) if (String(f).toLowerCase().endsWith('.fbx')) add(f, fs.readFileSync(path.join(input, f)))
    } else if (input.toLowerCase().endsWith('.zip')) {
      for (const [n, b] of Object.entries(unzipSync(new Uint8Array(fs.readFileSync(input))))) if (n.toLowerCase().endsWith('.fbx')) add(n, b)
    } else add(input, fs.readFileSync(input))
  }
  return files
}

const parse = (bytes) => new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')

async function toGlb(object) {
  const glb = await new GLTFExporter().parseAsync(object, { binary: true, onlyVisible: true })
  return Buffer.from(glb)
}

async function convertBody(bytes) {
  const o = parse(bytes)
  o.animations = []
  let mesh = null
  o.traverse((c) => {
    if (c.isSkinnedMesh && !mesh) mesh = c
  })
  const mats = [].concat(mesh.material)
  const parts = mats.map((m) => ({ name: m.name, slot: SLOT[m.name] || 'accent', color: `#${m.color.getHexString()}` }))
  let g = mesh.geometry
  const matid = new Float32Array(g.attributes.position.count)
  for (const gr of g.groups) for (let i = gr.start; i < gr.start + gr.count; i++) matid[i] = gr.materialIndex
  g.setAttribute('matid', new THREE.BufferAttribute(matid, 1))
  g.clearGroups()
  g = mergeVertices(g, 1e-4)
  mesh.geometry = g
  mesh.material = new THREE.MeshStandardMaterial({ name: 'person' })
  o.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(o)
  return { glb: await toGlb(o), parts, nativeHeight: box.max.y - box.min.y, verts: g.attributes.position.count }
}

const BUS_COLORS = { Top: '#f2c300', Bottom: '#f2c300', Windows: '#2b3a4a', Details: '#141414', Bumper: '#6d6d6d', Lights: '#fff3c4', Material: '#2a2a2a' }

async function convertBus(bytes) {
  const o = parse(bytes)
  o.animations = []
  o.traverse((c) => {
    if (!c.isMesh) return
    const conv = (m) => new THREE.MeshStandardMaterial({ name: m.name, color: BUS_COLORS[m.name] || '#cccccc', roughness: 1, metalness: 0 })
    c.material = Array.isArray(c.material) ? c.material.map(conv) : conv(c.material)
  })
  o.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(o)
  return { glb: await toGlb(o), size: box.getSize(new THREE.Vector3()).toArray(), min: box.min.toArray(), max: box.max.toArray() }
}

async function main() {
  const inputs = process.argv.slice(2)
  if (!inputs.length) {
    console.error('Usage: npm run assets:characters -- men.zip women.zip vehicles.zip')
    process.exit(1)
  }
  const files = await collect(inputs)
  fs.mkdirSync(OUT, { recursive: true })
  const index = { bodies: {}, extras: {} }
  for (const [src, id] of Object.entries(BODIES)) {
    if (!files[src]) {
      console.log(`  - ${id.padEnd(20)} SKIPPED (${src} not found)`)
      continue
    }
    const r = await convertBody(files[src])
    fs.writeFileSync(path.join(OUT, `${id}.glb`), r.glb)
    index.bodies[id] = { file: `characters/people/${id}.glb`, source: src, parts: r.parts, nativeHeight: Number(r.nativeHeight.toFixed(2)) }
    console.log(`  ✓ ${id.padEnd(20)} ${String(Math.round(r.glb.length / 1024)).padStart(4)} KB  ${r.verts} verts  parts: ${r.parts.map((p) => p.name).join(', ')}`)
  }
  if (files['Bus.fbx']) {
    fs.mkdirSync(OUT_VEH, { recursive: true })
    const r = await convertBus(files['Bus.fbx'])
    fs.writeFileSync(path.join(OUT_VEH, 'bus.glb'), r.glb)
    const r2 = (a) => a.map((v) => Number(v.toFixed(2)))
    index.extras.bus = { file: 'vehicles-extra/bus.glb', source: 'Bus.fbx', bounds: { min: r2(r.min), max: r2(r.max), size: r2(r.size) } }
    console.log(`  ✓ bus                  ${Math.round(r.glb.length / 1024)} KB  size ${r.size.map((v) => v.toFixed(0)).join('x')}`)
  }
  fs.writeFileSync(INDEX, JSON.stringify(index, null, 1) + '\n')
  console.log('Wrote src/assets/peopleIndex.json')
}

main()
