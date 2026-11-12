// Builds merged, vertex-coloured geometry from lists of simple shapes
// ("prims" from cityFill.js). One mesh per 48 m chunk, one shared material.
//   prim: { s: 'box' | 'cyl' | 'cone', p: [x, y, z], d: size, c: colour, ry, rx, rz }
//   or a baked nature model (trees, bushes, rocks from src/assets/natureMeshes.json):
//         { s: 'mesh', m: 'tree2', p: [x, y, z], k: scale, ry, c: leaf colour, c2: trunk / rock colour }

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import NATURE from '../../assets/natureMeshes.json'

export const PRIM_MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true })

const BASE = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cone: new THREE.ConeGeometry(1, 1, 10),
}
for (const g of Object.values(BASE)) g.deleteAttribute('uv')

// Baked models: flat-shaded triangles in metres, built once per model.
const meshBase = new Map()
function natureBase(name) {
  if (meshBase.has(name)) return meshBase.get(name)
  const src = NATURE[name]
  if (!src) throw new Error(`Unknown nature model "${name}"`)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(src.v, (n) => n / 100), 3))
  g.computeVertexNormals() // no shared corners, so every face is flat
  g.setIndex([...Array(src.v.length / 3).keys()]) // the other shapes are indexed; merging needs all the same
  const base = { g, part: src.part, h: src.h }
  meshBase.set(name, base)
  return base
}

const colour2 = new THREE.Color()
function meshToGeometry(prim) {
  const base = natureBase(prim.m)
  const g = base.g.clone()
  const k = prim.k || 1
  e.set(0, prim.ry || 0, 0, 'YXZ')
  m.compose(v.set(prim.p[0], prim.p[1], prim.p[2]), q.setFromEuler(e), sc.set(k, k, k))
  g.applyMatrix4(m)
  colour.set(prim.c || '#4f8a34') // leaves
  colour2.set(prim.c2 || '#5a4030') // trunk, rock
  const pos = base.g.attributes.position
  const col = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const leaf = base.part[Math.floor(i / 3)] === 'l'
    const c = leaf ? colour : colour2
    // leaves catch more light towards the top of the crown; trunks darken at the foot
    const up = Math.min(1, Math.max(0, pos.getY(i) / base.h))
    const shade = leaf ? 0.78 + 0.3 * up : 0.7 + 0.3 * Math.min(1, pos.getY(i) / 0.9)
    col[i * 3] = Math.min(1, c.r * shade)
    col[i * 3 + 1] = Math.min(1, c.g * shade)
    col[i * 3 + 2] = Math.min(1, c.b * shade)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

const colour = new THREE.Color()
const m = new THREE.Matrix4()
const q = new THREE.Quaternion()
const e = new THREE.Euler()
const v = new THREE.Vector3()
const sc = new THREE.Vector3()

export function primToGeometry(prim) {
  if (prim.s === 'mesh') return meshToGeometry(prim)
  const g = BASE[prim.s].clone()
  if (prim.s === 'box') sc.set(prim.d[0], prim.d[1], prim.d[2])
  else sc.set(prim.d[0], prim.d[1], prim.d[0])
  e.set(prim.rx || 0, prim.ry || 0, prim.rz || 0, 'YXZ')
  m.compose(v.set(prim.p[0], prim.p[1], prim.p[2]), q.setFromEuler(e), sc)
  g.applyMatrix4(m)
  // colour, a little darker near the ground (cheap "contact shadow")
  colour.set(prim.c)
  const pos = g.attributes.position
  const col = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const k = prim.flat ? 1 : 0.74 + 0.26 * Math.min(1, Math.max(0, pos.getY(i) / 0.9))
    col[i * 3] = colour.r * k
    col[i * 3 + 1] = colour.g * k
    col[i * 3 + 2] = colour.b * k
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

/** prims -> [BufferGeometry] merged per chunk (chunk = 0 merges everything). */
export function mergePrims(prims, chunk = 48) {
  const buckets = new Map()
  for (const p of prims) {
    const key = chunk ? `${Math.floor(p.p[0] / chunk)},${Math.floor(p.p[2] / chunk)}` : 'all'
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(primToGeometry(p))
  }
  const out = []
  for (const list of buckets.values()) {
    const g = mergeGeometries(list, false)
    for (const x of list) x.dispose()
    if (g) {
      g.computeBoundingSphere()
      out.push(g)
    }
  }
  return out
}
