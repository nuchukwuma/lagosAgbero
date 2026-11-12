// Accessories built from simple shapes and attached to bones, so they move
// with the animation. Sizes are in metres relative to the bone, in the
// character's own directions (+Y up, +Z forward). Measured on our bodies
// (1.75 m tall): head bone at 1.53 m, top of head 0.23 m above it, head
// 0.21 m wide and 0.25 m deep, face at z = +0.105.
//
// Types: cap, fila, beanie, bandana, gele, glasses, chain, scarf, wristband
// Cult colours later = scarf / wristband / bandana in the cult's colours.

import * as THREE from 'three'

const materialCache = new Map()
function m(color) {
  if (!materialCache.has(color)) materialCache.set(color, new THREE.MeshLambertMaterial({ color }))
  return materialCache.get(color)
}

const BUILDERS = {
  cap: ({ color = '#c0392b' }) => {
    const g = new THREE.Group()
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), m(color))
    dome.scale.set(1, 0.65, 1.08)
    dome.position.set(0, 0.17, -0.015)
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.012, 0.11), m(color))
    brim.position.set(0, 0.175, 0.11)
    g.add(dome, brim)
    return { bone: 'Head', object: g }
  },
  fila: ({ color = '#7a4fd9' }) => {
    // Yoruba cap, worn tilted
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.122, 0.11, 12), m(color))
    body.position.set(0.01, 0.215, -0.02)
    body.rotation.z = 0.22
    return { bone: 'Head', object: body }
  },
  beanie: ({ color = '#2c3e50' }) => {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.128, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), m(color))
    dome.scale.set(1, 0.8, 1.08)
    dome.position.set(0, 0.15, -0.02)
    return { bone: 'Head', object: dome }
  },
  bandana: ({ color = '#e0b400' }) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.018, 6, 18), m(color))
    band.rotation.x = Math.PI / 2
    band.scale.set(1, 1.18, 1)
    band.position.set(0, 0.14, -0.02)
    return { bone: 'Head', object: band }
  },
  gele: ({ color = '#e67e22' }) => {
    // Nigerian head-tie: a big folded wrap
    const g = new THREE.Group()
    const wrap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), m(color))
    wrap.scale.set(1.25, 0.7, 1.05)
    wrap.position.set(0, 0.2, -0.03)
    const fold = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 6), m(color))
    fold.position.set(0.1, 0.27, -0.02)
    fold.rotation.z = -0.9
    g.add(wrap, fold)
    return { bone: 'Head', object: g }
  },
  glasses: ({ color = '#111111' }) => {
    const g = new THREE.Group()
    const lens = new THREE.BoxGeometry(0.062, 0.03, 0.01)
    for (const x of [-0.04, 0.04]) {
      const l = new THREE.Mesh(lens, m(color))
      l.position.set(x, 0.085, 0.112)
      g.add(l)
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.008, 0.008), m(color))
    bridge.position.set(0, 0.09, 0.112)
    g.add(bridge)
    return { bone: 'Head', object: g }
  },
  chain: ({ color = '#d4af37' }) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.007, 5, 16), m(color))
    ring.rotation.x = Math.PI / 2.5
    ring.position.set(0, -0.05, 0.03)
    return { bone: 'Neck', object: ring }
  },
  scarf: ({ color = '#e0b400' }) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.026, 6, 14), m(color))
    ring.rotation.x = Math.PI / 2
    ring.position.set(0, -0.01, 0)
    return { bone: 'Neck', object: ring }
  },
  wristband: ({ color = '#e0b400', side = 'L' }) => {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.04, 10), m(color))
    return { bone: `Palm${side}`, object: band, alongBone: true }
  },
}

export const ACCESSORY_TYPES = Object.keys(BUILDERS)

/**
 * Attach accessories to a freshly cloned (rest-pose) character.
 * `root` is the model, `rootScale` the scale its parent group applies.
 */
export function attachAccessories(root, accessories, rootScale) {
  root.updateMatrixWorld(true)
  const rootQuat = root.getWorldQuaternion(new THREE.Quaternion())
  for (const acc of accessories || []) {
    const build = BUILDERS[acc.type]
    if (!build) continue
    const { bone: boneName, object, alongBone } = build(acc)
    const bone = root.getObjectByName(boneName)
    if (!bone) continue
    const holder = new THREE.Group()
    holder.name = `acc-${acc.type}`
    // undo the bone's own scale and rotation so the accessory is built in
    // plain metres, facing the character's forward
    const boneScale = bone.getWorldScale(new THREE.Vector3()).x
    holder.scale.setScalar(1 / (boneScale * rootScale))
    if (!alongBone) holder.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rootQuat))
    holder.add(object)
    bone.add(holder)
  }
}
