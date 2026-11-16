// Static batching: every piece of scenery that never moves (roads, buildings,
// poles, parked vehicles...) is merged into a few big meshes, one per material
// per 48 m chunk. A street of ~300 objects becomes ~20 draw calls, and each
// chunk is skipped entirely when it is off screen. This is the main reason the
// game runs on budget phones.
//
// Memory (2 GB phones): each chunk is written straight into one pre-sized
// buffer, without a temporary copy per object. No normals are stored: the
// materials shade each face flat on the GPU (the models are flat-shaded
// low-poly anyway), and the baked colours are 1 byte per channel.

import * as THREE from 'three'
import { getAsset, ATLASES } from '../../assets/assetManifest.js'
import { prototypeFor, placementMatrix, atlasTexture } from './models.js'

export const CHUNK = 48
const sharedMaterials = new Map()

/** One Lambert material per pack + atlas variant + weathering (one GPU texture each). */
function sharedMaterial(asset, src) {
  const tweak = asset.tweak || {}
  if (!ATLASES[asset.pack]) {
    // the model's own material, made to shade flat and use the baked colours
    const key = `own|${src.uuid}`
    if (!sharedMaterials.has(key)) {
      const own = src.clone()
      own.flatShading = true
      own.vertexColors = true
      sharedMaterials.set(key, own)
    }
    return sharedMaterials.get(key)
  }
  const key = `${asset.pack}|${tweak.atlas || 'base'}|${tweak.weathering || 0}`
  if (!sharedMaterials.has(key)) {
    const fade = 1 - 0.3 * (tweak.weathering || 0)
    sharedMaterials.set(
      key,
      new THREE.MeshLambertMaterial({ map: atlasTexture(asset.pack, tweak.atlas || 'base', src.map), color: new THREE.Color(fade, fade, fade), side: src.side, vertexColors: true, flatShading: true }),
    )
  }
  return sharedMaterials.get(key)
}

// Baked into vertex colours (free at runtime):
//  - a darker band where walls meet the ground (cheap ambient occlusion),
//    so buildings sit on the street instead of floating on it
//  - a small per-object tint, so the same house model repeated down a street
//    doesn't look copy-pasted
const aoAt = (y) => 0.62 + 0.38 * Math.min(1, Math.max(0, y / 2.2))
const byte = (x) => (x >= 1 ? 255 : x <= 0 ? 0 : Math.round(x * 255))

function tintFor(item, category) {
  if (category === 'road' || category === 'street') return [1, 1, 1]
  // stable pseudo-random from the position
  const h = Math.abs(Math.sin(item.position[0] * 12.9898 + item.position[2] * 78.233) * 43758.5453) % 1
  const h2 = Math.abs(Math.sin(item.position[0] * 39.3468 + item.position[2] * 11.135) * 24634.6345) % 1
  const bright = 0.88 + h * 0.16
  const warm = (h2 - 0.5) * 0.08
  return [bright * (1 + warm), bright, bright * (1 - warm)]
}

// one object part, written into the chunk buffers at vAt / iAt
function writePart(src, matrix, ao, tint, out, vAt, iAt) {
  const pos = src.attributes.position
  const uv = src.attributes.uv
  const el = matrix.elements
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const wy = el[1] * x + el[5] * y + el[9] * z + el[13]
    const o = (vAt + i) * 3
    out.pos[o] = el[0] * x + el[4] * y + el[8] * z + el[12]
    out.pos[o + 1] = wy
    out.pos[o + 2] = el[2] * x + el[6] * y + el[10] * z + el[14]
    // world y comes from the placement, so the AO band follows the ground
    const k = ao ? aoAt(wy) : 1
    out.col[o] = byte(k * tint[0])
    out.col[o + 1] = byte(k * tint[1])
    out.col[o + 2] = byte(k * tint[2])
    if (uv) {
      out.uv[(vAt + i) * 2] = uv.getX(i)
      out.uv[(vAt + i) * 2 + 1] = uv.getY(i)
    }
  }
  if (src.index) {
    const idx = src.index.array
    for (let i = 0; i < idx.length; i++) out.idx[iAt + i] = idx[i] + vAt
  } else for (let i = 0; i < pos.count; i++) out.idx[iAt + i] = vAt + i
}

/**
 * @param groups  layout groups [{ model, items }]
 * @param gltfs   Map model name -> loaded gltf
 * @returns [{ geometry, material }] ready to draw
 */
export function buildStaticBatches(groups, gltfs) {
  // pass 1: sort every object part into its chunk (by material) and count
  const buckets = new Map() // key -> { material, parts: [{ src, matrix, ao, tint }], verts, indices }
  for (const g of groups) {
    const gltf = gltfs.get(g.model)
    if (!gltf) continue
    const proto = prototypeFor(g.model, gltf)
    const asset = getAsset(g.model)
    for (const item of g.items) {
      const cell = `${Math.floor(item.position[0] / CHUNK)},${Math.floor(item.position[2] / CHUNK)}`
      const place = placementMatrix(item)
      const tint = tintFor(item, asset.category)
      for (const part of proto.parts) {
        const material = sharedMaterial(asset, part.material)
        const key = `${material.uuid}|${cell}`
        if (!buckets.has(key)) buckets.set(key, { material, parts: [], verts: 0, indices: 0 })
        const b = buckets.get(key)
        const src = part.geometry
        b.parts.push({ src, matrix: new THREE.Matrix4().multiplyMatrices(place, part.matrix), ao: asset.category !== 'road', tint })
        b.verts += src.attributes.position.count
        b.indices += src.index ? src.index.count : src.attributes.position.count
      }
    }
  }
  // pass 2: one buffer per chunk, written in place
  const out = []
  for (const { material, parts, verts, indices } of buckets.values()) {
    if (!verts) continue
    const buf = { pos: new Float32Array(verts * 3), col: new Uint8Array(verts * 3), uv: new Float32Array(verts * 2), idx: verts > 65535 ? new Uint32Array(indices) : new Uint16Array(indices) }
    let vAt = 0
    let iAt = 0
    for (const p of parts) {
      writePart(p.src, p.matrix, p.ao, p.tint, buf, vAt, iAt)
      vAt += p.src.attributes.position.count
      iAt += p.src.index ? p.src.index.count : p.src.attributes.position.count
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(buf.pos, 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(buf.uv, 2))
    geometry.setAttribute('color', new THREE.BufferAttribute(buf.col, 3, true))
    geometry.setIndex(new THREE.BufferAttribute(buf.idx, 1))
    geometry.computeBoundingSphere()
    out.push({ geometry, material })
  }
  return out
}
