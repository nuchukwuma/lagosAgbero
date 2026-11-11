// Accessories built from simple shapes and attached to bones, so they move
// with the animation. Sizes are in metres, relative to the bone, in the
// character's own directions (+Y up, +Z forward), measured on the Kenney body:
// head from 1.13 m to 1.75 m, 0.68 m wide, 0.49 m deep; head bone at 1.25 m.
//
// Types: cap, fila, beanie, bandana, glasses, chain, scarf, wristband
// Cult gear later = scarf/wristband/bandana in cult colours.

import * as THREE from 'three'

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra })
const materialCache = new Map()
function m(color) {
  if (!materialCache.has(color)) materialCache.set(color, mat(color))
  return materialCache.get(color)
}

const BUILDERS = {
  cap: ({ color = '#c0392b' }) => {
    const g = new THREE.Group()
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m(color))
    dome.scale.set(1, 0.55, 0.8)
    dome.position.set(0, 0.36, 0)
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.26), m(color))
    brim.position.set(0, 0.37, 0.3)
    g.add(dome, brim)
    return { bone: 'Head', object: g }
  },
  fila: ({ color = '#7a4fd9' }) => {
    // Yoruba cap, worn tilted
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.28, 14), m(color))
    body.position.set(0, 0.5, -0.02)
    body.rotation.z = 0.25
    g.add(body)
    return { bone: 'Head', object: g }
  },
  beanie: ({ color = '#2c3e50' }) => {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.37, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m(color))
    dome.scale.set(1, 0.7, 0.8)
    dome.position.set(0, 0.3, 0)
    return { bone: 'Head', object: dome }
  },
  bandana: ({ color = '#e0b400' }) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 6, 20), m(color))
    band.rotation.x = Math.PI / 2
    band.scale.set(1, 0.74, 1)
    band.position.set(0, 0.32, 0)
    return { bone: 'Head', object: band }
  },
  glasses: ({ color = '#111111' }) => {
    const g = new THREE.Group()
    const lens = new THREE.BoxGeometry(0.16, 0.08, 0.02)
    const left = new THREE.Mesh(lens, m(color))
    const right = new THREE.Mesh(lens, m(color))
    left.position.set(-0.11, 0.17, 0.25)
    right.position.set(0.11, 0.17, 0.25)
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), m(color))
    bridge.position.set(0, 0.19, 0.25)
    g.add(left, right, bridge)
    return { bone: 'Head', object: g }
  },
  chain: ({ color = '#d4af37' }) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 6, 18), m(color))
    ring.rotation.x = Math.PI / 2.4
    ring.position.set(0, -0.06, 0.06)
    return { bone: 'Neck', object: ring }
  },
  scarf: ({ color = '#e0b400' }) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 6, 16), m(color))
    ring.rotation.x = Math.PI / 2
    ring.position.set(0, 0.0, 0.0)
    return { bone: 'Neck', object: ring }
  },
  wristband: ({ color = '#e0b400', side = 'Left' }) => {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 10), m(color))
    return { bone: `${side}Hand`, object: band, alongBone: true }
  },
}

export const ACCESSORY_TYPES = Object.keys(BUILDERS)

/**
 * Attach accessories to a freshly cloned (rest-pose) character.
 * `root` is the FBX object, `rootScale` the scale its parent group applies.
 */
export function attachAccessories(root, accessories, rootScale) {
  root.updateMatrixWorld(true)
  const rootQuatInv = root.getWorldQuaternion(new THREE.Quaternion()).invert()
  const holders = []
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
    if (!alongBone) {
      const boneQuat = bone.getWorldQuaternion(new THREE.Quaternion())
      holder.quaternion.copy(boneQuat.invert().multiply(rootQuatInv.clone().invert()))
    }
    holder.add(object)
    bone.add(holder)
    holders.push(holder)
  }
  return holders
}
