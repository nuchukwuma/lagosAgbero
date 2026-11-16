// Builds merged, vertex-coloured geometry from lists of simple shapes
// ("prims" from cityFill.js). One mesh per 48 m chunk, one shared material.
//   prim: { s: 'box' | 'cyl' | 'cone', p: [x, y, z], d: size, c: colour, ry, rx, rz, flat }
//   or a baked nature model (trees, bushes, rocks from src/assets/natureMeshes.json):
//         { s: 'mesh', m: 'tree2', p: [x, y, z], k: scale, ry, c: leaf colour, c2: trunk / rock colour }
//
// Built to stay small on 2 GB phones:
//   - every chunk is written straight into one pre-sized buffer (no temporary
//     geometry per shape, so building a world doesn't spike memory);
//   - no normals: the material shades each face flat on the GPU, which is the
//     low-poly look anyway, and saves 12 bytes per corner;
//   - colours are 1 byte per channel instead of 4;
//   - corners shared between triangles are stored once.
// About 15 bytes per corner instead of 36.

import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import NATURE from '../../assets/natureMeshes.json'

export const PRIM_MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })

// ---- base shapes: positions + triangle list, shared corners, built once ----
// part (nature only): 1 for leaves, 0 for trunk / rock, per corner
const bases = new Map()

function primitiveBase(geometry) {
  geometry.deleteAttribute('normal')
  geometry.deleteAttribute('uv')
  const g = mergeVertices(geometry)
  geometry.dispose()
  return { pos: g.attributes.position.array, idx: g.index.array, part: null, h: 1 }
}

function natureBase(name) {
  const src = NATURE[name]
  if (!src) throw new Error(`Unknown nature model "${name}"`)
  // join corners with the same position and part
  const key = new Map()
  const pos = []
  const part = []
  const idx = []
  for (let i = 0; i < src.v.length / 3; i++) {
    const p = src.part[Math.floor(i / 3)] === 'l' ? 1 : 0
    const k = `${src.v[i * 3]},${src.v[i * 3 + 1]},${src.v[i * 3 + 2]},${p}`
    let at = key.get(k)
    if (at === undefined) {
      at = pos.length / 3
      key.set(k, at)
      pos.push(src.v[i * 3] / 100, src.v[i * 3 + 1] / 100, src.v[i * 3 + 2] / 100)
      part.push(p)
    }
    idx.push(at)
  }
  return { pos: Float32Array.from(pos), idx: Uint32Array.from(idx), part: Uint8Array.from(part), h: src.h }
}

function baseFor(prim) {
  const id = prim.s === 'mesh' ? `mesh:${prim.m}` : prim.s
  if (!bases.has(id)) {
    if (prim.s === 'mesh') bases.set(id, natureBase(prim.m))
    else if (prim.s === 'box') bases.set(id, primitiveBase(new THREE.BoxGeometry(1, 1, 1)))
    else if (prim.s === 'cyl') bases.set(id, primitiveBase(new THREE.CylinderGeometry(1, 1, 1, 10)))
    else if (prim.s === 'cone') bases.set(id, primitiveBase(new THREE.ConeGeometry(1, 1, 10)))
    else throw new Error(`Unknown prim shape "${prim.s}"`)
  }
  return bases.get(id)
}

// ---- writing one prim into the chunk buffers ----
const m = new THREE.Matrix4()
const q = new THREE.Quaternion()
const e = new THREE.Euler()
const v = new THREE.Vector3()
const sc = new THREE.Vector3()
const colour = new THREE.Color()
const colour2 = new THREE.Color()

const byte = (x) => (x >= 1 ? 255 : x <= 0 ? 0 : Math.round(x * 255))

function writePrim(prim, base, out, vAt, iAt) {
  if (prim.s === 'mesh') {
    const k = prim.k || 1
    sc.set(k, k, k)
    e.set(0, prim.ry || 0, 0, 'YXZ')
  } else {
    if (prim.s === 'box') sc.set(prim.d[0], prim.d[1], prim.d[2])
    else sc.set(prim.d[0], prim.d[1], prim.d[0])
    e.set(prim.rx || 0, prim.ry || 0, prim.rz || 0, 'YXZ')
  }
  m.compose(v.set(prim.p[0], prim.p[1], prim.p[2]), q.setFromEuler(e), sc)
  const el = m.elements

  const isMesh = prim.s === 'mesh'
  if (isMesh) {
    colour.set(prim.c || '#4f8a34') // leaves
    colour2.set(prim.c2 || '#5a4030') // trunk, rock
  } else colour.set(prim.c)

  const src = base.pos
  const n = src.length / 3
  for (let i = 0; i < n; i++) {
    const x = src[i * 3]
    const y = src[i * 3 + 1]
    const z = src[i * 3 + 2]
    const o = (vAt + i) * 3
    const wx = el[0] * x + el[4] * y + el[8] * z + el[12]
    const wy = el[1] * x + el[5] * y + el[9] * z + el[13]
    const wz = el[2] * x + el[6] * y + el[10] * z + el[14]
    out.pos[o] = wx
    out.pos[o + 1] = wy
    out.pos[o + 2] = wz
    let c = colour
    let shade
    if (isMesh) {
      const leaf = base.part[i] === 1
      c = leaf ? colour : colour2
      // leaves catch more light towards the top of the crown; trunks darken at the foot
      shade = leaf ? 0.78 + 0.3 * Math.min(1, Math.max(0, y / base.h)) : 0.7 + 0.3 * Math.min(1, y / 0.9)
    } else {
      // a little darker near the ground (cheap "contact shadow")
      shade = prim.flat ? 1 : 0.74 + 0.26 * Math.min(1, Math.max(0, wy / 0.9))
    }
    out.col[o] = byte(c.r * shade)
    out.col[o + 1] = byte(c.g * shade)
    out.col[o + 2] = byte(c.b * shade)
  }
  const idx = base.idx
  for (let i = 0; i < idx.length; i++) out.idx[iAt + i] = idx[i] + vAt
}

/** One prim on its own (tests and tools). */
export function primToGeometry(prim) {
  return mergePrims([prim], 0)[0]
}

/** prims -> [BufferGeometry] merged per chunk (chunk = 0 merges everything). */
export function mergePrims(prims, chunk = 48) {
  const buckets = new Map()
  for (const p of prims) {
    const key = chunk ? `${Math.floor(p.p[0] / chunk)},${Math.floor(p.p[2] / chunk)}` : 'all'
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(p)
  }
  const out = []
  for (const list of buckets.values()) {
    // pass 1: how big is this chunk?
    let verts = 0
    let indices = 0
    for (const p of list) {
      const b = baseFor(p)
      verts += b.pos.length / 3
      indices += b.idx.length
    }
    if (!verts) continue
    // pass 2: write everything straight into its final place
    const buf = { pos: new Float32Array(verts * 3), col: new Uint8Array(verts * 3), idx: verts > 65535 ? new Uint32Array(indices) : new Uint16Array(indices) }
    let vAt = 0
    let iAt = 0
    for (const p of list) {
      const b = baseFor(p)
      writePrim(p, b, buf, vAt, iAt)
      vAt += b.pos.length / 3
      iAt += b.idx.length
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(buf.pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(buf.col, 3, true))
    g.setIndex(new THREE.BufferAttribute(buf.idx, 1))
    g.computeBoundingSphere()
    out.push(g)
  }
  return out
}
