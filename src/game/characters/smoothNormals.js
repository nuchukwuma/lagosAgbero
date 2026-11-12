// Low-poly people look "geometrical" because every triangle has its own flat
// normal. This blends the normals of vertices that sit at the same position,
// unless the faces meet at a sharp angle (a real edge, like a shoe sole).
// The mesh itself is unchanged; it only shades more softly.

import * as THREE from 'three'

const a = new THREE.Vector3()
const b = new THREE.Vector3()

export function smoothNormals(geometry, creaseDegrees = 72) {
  if (geometry.userData.smoothed) return geometry
  geometry.userData.smoothed = true
  const pos = geometry.attributes.position
  const nor = geometry.attributes.normal
  if (!pos || !nor) return geometry
  const cos = Math.cos((creaseDegrees * Math.PI) / 180)
  const groups = new Map()
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 100)},${Math.round(pos.getY(i) * 100)},${Math.round(pos.getZ(i) * 100)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(i)
  }
  const original = nor.array.slice()
  const out = nor.array
  for (const list of groups.values()) {
    if (list.length < 2) continue
    for (const i of list) {
      a.set(original[i * 3], original[i * 3 + 1], original[i * 3 + 2])
      let x = 0
      let y = 0
      let z = 0
      for (const j of list) {
        b.set(original[j * 3], original[j * 3 + 1], original[j * 3 + 2])
        if (a.dot(b) < cos) continue
        x += b.x
        y += b.y
        z += b.z
      }
      const len = Math.hypot(x, y, z) || 1
      out[i * 3] = x / len
      out[i * 3 + 1] = y / len
      out[i * 3 + 2] = z / len
    }
  }
  nor.needsUpdate = true
  return geometry
}
