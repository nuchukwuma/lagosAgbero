// Makes the .glb model files smaller, without changing how anything looks.
//   node scripts/slim-models.mjs          (run again after importing models)
//
//   - drops TANGENT data where nothing uses it (no normal map)
//   - stores normals as 1 byte per axis instead of 4 (KHR_mesh_quantization,
//     which three.js reads natively)
//   - stores skin weights as 1 byte each instead of 4, and bone numbers as
//     1 byte instead of 2 when there are fewer than 256 bones
//   - positions stay full precision (people are skinned; rounding them is
//     where artefacts would show)
//
// Smaller files download faster, and the same small types stay small in
// memory and on the graphics card. Safe to run more than once: anything
// already slim is left alone.

import fs from 'node:fs'
import path from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, KHRMeshQuantization } from '@gltf-transform/extensions'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const DIR = path.join(ROOT, 'public/assets')

function* glbFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* glbFiles(p)
    else if (e.name.endsWith('.glb')) yield p
  }
}

function slimNormals(acc) {
  const src = acc.getArray()
  if (!(src instanceof Float32Array)) return false
  const out = new Int8Array(src.length)
  for (let i = 0; i < src.length; i += 3) {
    const len = Math.hypot(src[i], src[i + 1], src[i + 2]) || 1
    for (let k = 0; k < 3; k++) out[i + k] = Math.round((src[i + k] / len) * 127)
  }
  acc.setArray(out).setNormalized(true)
  return true
}

function slimWeights(acc) {
  const src = acc.getArray()
  if (!(src instanceof Float32Array)) return false
  const out = new Uint8Array(src.length)
  for (let i = 0; i < src.length; i += 4) {
    const sum = src[i] + src[i + 1] + src[i + 2] + src[i + 3] || 1
    let total = 0
    let big = i
    for (let k = 0; k < 4; k++) {
      out[i + k] = Math.round((src[i + k] / sum) * 255)
      total += out[i + k]
      if (src[i + k] > src[big]) big = i + k
    }
    out[big] += 255 - total // the four always add up to exactly 1
  }
  acc.setArray(out).setNormalized(true)
  return true
}

function slimJoints(acc) {
  const src = acc.getArray()
  if (src instanceof Uint8Array) return false
  let max = 0
  for (const j of src) max = Math.max(max, j)
  if (max > 255) return false
  acc.setArray(Uint8Array.from(src))
  return true
}

// The Kenney models share one texture file next to them ("Textures/colormap.png").
// Writing a .glb normally copies every texture inside it, so keep the link
// to the shared file instead: write the JSON ourselves and pack the GLB.
async function writeGlb(doc) {
  const textures = doc.getRoot().listTextures()
  const links = textures.map((t) => (t.getURI() && !t.getURI().startsWith('data:') ? t.getURI() : null))
  textures.forEach((t, i) => links[i] && t.setImage(null))
  const { json, resources } = await io.writeJSON(doc, { format: 'GLB' })
  json.images?.forEach((img, i) => {
    if (!links[i]) return
    delete img.bufferView
    img.uri = links[i]
  })
  const pad = (n) => (4 - (n % 4)) % 4
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json))
  const jsonChunk = new Uint8Array(jsonBytes.length + pad(jsonBytes.length)).fill(0x20)
  jsonChunk.set(jsonBytes)
  const bin = resources['@glb.bin'] || new Uint8Array(0)
  const binChunk = new Uint8Array(bin.length + pad(bin.length))
  binChunk.set(bin)
  const total = 12 + 8 + jsonChunk.length + (bin.length ? 8 + binChunk.length : 0)
  const out = new Uint8Array(total)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, 0x46546c67, true) // "glTF"
  dv.setUint32(4, 2, true)
  dv.setUint32(8, total, true)
  dv.setUint32(12, jsonChunk.length, true)
  dv.setUint32(16, 0x4e4f534a, true) // "JSON"
  out.set(jsonChunk, 20)
  if (bin.length) {
    const at = 20 + jsonChunk.length
    dv.setUint32(at, binChunk.length, true)
    dv.setUint32(at + 4, 0x004e4942, true) // "BIN"
    out.set(binChunk, at + 8)
  }
  return out
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
let before = 0
let after = 0
let changedFiles = 0
for (const file of glbFiles(DIR)) {
  const size = fs.statSync(file).size
  before += size
  const doc = await io.read(file)
  const done = new Set()
  let changed = false
  let quantized = false
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const tangent = prim.getAttribute('TANGENT')
      if (tangent && !prim.getMaterial()?.getNormalTexture()) {
        prim.setAttribute('TANGENT', null)
        if (!tangent.listParents().some((p) => p !== doc.getRoot())) tangent.dispose()
        changed = true
      }
      const jobs = [
        ['NORMAL', slimNormals],
        ['WEIGHTS_0', slimWeights],
        ['JOINTS_0', slimJoints],
      ]
      for (const [name, slim] of jobs) {
        const acc = prim.getAttribute(name)
        if (!acc || done.has(acc)) continue
        done.add(acc)
        if (slim(acc)) {
          changed = true
          if (name === 'NORMAL') quantized = true
        }
      }
    }
  }
  if (quantized || doc.getRoot().listExtensionsUsed().some((e) => e.extensionName === 'KHR_mesh_quantization')) doc.createExtension(KHRMeshQuantization).setRequired(true)
  if (!changed) {
    after += size
    continue
  }
  const bytes = await writeGlb(doc)
  fs.writeFileSync(file, bytes)
  after += bytes.length
  changedFiles++
  console.log(`  ${path.relative(DIR, file).padEnd(48)} ${String(Math.round(size / 1024)).padStart(5)} KB -> ${String(Math.round(bytes.length / 1024)).padStart(5)} KB`)
}
console.log(`\n${changedFiles} files slimmed: ${(before / 1048576).toFixed(2)} MB -> ${(after / 1048576).toFixed(2)} MB`)
