// The RPG-pack bodies (rpg_*) wear our skeleton, but their legs are about
// half as long. The clips move the hips and feet by absolute amounts made for
// our longer legs, so for these bodies we shrink that movement around their
// own rest positions (numbers from scripts/import-rpg-characters.mjs).
//
//   const fix = rigFixer(object, bodyInfo(body).rig)   // null for normal bodies
//   fix?.before(); mixer.update(dt); fix?.after()

import * as THREE from 'three'

const BONES = ['Body', 'FootL', 'FootR']

export function rigFixer(object, rig) {
  if (!rig) return null
  const bones = []
  for (const name of BONES) {
    const bone = object.getObjectByName(name)
    if (bone && rig.from[name] && rig.to[name]) bones.push([bone, new THREE.Vector3(...rig.from[name]), new THREE.Vector3(...rig.to[name])])
  }
  return {
    // a clip that doesn't move a bone leaves it here, which maps to their rest position
    before() {
      for (const [bone, from] of bones) bone.position.copy(from)
    },
    after() {
      for (const [bone, from, to] of bones) bone.position.sub(from).multiplyScalar(rig.k).add(to)
    },
  }
}
