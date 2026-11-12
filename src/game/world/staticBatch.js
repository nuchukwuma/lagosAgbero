// Static batching: every piece of scenery that never moves (roads, buildings,
// poles, parked vehicles...) is merged into a few big meshes, one per material
// per 48 m chunk. A street of ~300 objects becomes ~20 draw calls, and each
// chunk is skipped entirely when it is off screen. This is the main reason the
// game runs on budget phones.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { getAsset, ATLASES } from '../../assets/assetManifest.js'
import { prototypeFor, placementMatrix, atlasTexture } from './models.js'

export const CHUNK = 48
const sharedMaterials = new Map()

/** One Lambert material per pack + atlas variant + weathering (one GPU texture each). */
function sharedMaterial(asset, src) {
  const tweak = asset.tweak || {}
  if (!ATLASES[asset.pack]) return src
  const key = `${asset.pack}|${tweak.atlas || 'base'}|${tweak.weathering || 0}`
  if (!sharedMaterials.has(key)) {
    const fade = 1 - 0.3 * (tweak.weathering || 0)
    sharedMaterials.set(
      key,
      new THREE.MeshLambertMaterial({ map: atlasTexture(asset.pack, tweak.atlas || 'base', src.map), color: new THREE.Color(fade, fade, fade), side: src.side }),
    )
  }
  return sharedMaterials.get(key)
}

function clean(geometry, matrix) {
  const g = new THREE.BufferGeometry()
  const src = geometry
  g.setAttribute('position', src.attributes.position.clone())
  g.setAttribute('normal', src.attributes.normal ? src.attributes.normal.clone() : new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 3), 3))
  g.setAttribute('uv', src.attributes.uv ? src.attributes.uv.clone() : new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2))
  if (src.index) g.setIndex(src.index.clone())
  else g.setIndex([...Array(src.attributes.position.count).keys()])
  g.applyMatrix4(matrix)
  return g
}

/**
 * @param groups  layout groups [{ model, items }]
 * @param gltfs   Map model name -> loaded gltf
 * @returns [{ geometry, material }] ready to draw
 */
export function buildStaticBatches(groups, gltfs) {
  const buckets = new Map() // key -> { material, list }
  const m = new THREE.Matrix4()
  for (const g of groups) {
    const gltf = gltfs.get(g.model)
    if (!gltf) continue
    const proto = prototypeFor(g.model, gltf)
    const asset = getAsset(g.model)
    for (const item of g.items) {
      const cell = `${Math.floor(item.position[0] / CHUNK)},${Math.floor(item.position[2] / CHUNK)}`
      const place = placementMatrix(item)
      for (const part of proto.parts) {
        const material = sharedMaterial(asset, part.material)
        const key = `${material.uuid}|${cell}`
        if (!buckets.has(key)) buckets.set(key, { material, list: [] })
        buckets.get(key).list.push(clean(part.geometry, m.multiplyMatrices(place, part.matrix)))
      }
    }
  }
  const out = []
  for (const { material, list } of buckets.values()) {
    const geometry = mergeGeometries(list, false)
    for (const g of list) g.dispose()
    if (!geometry) continue
    geometry.computeBoundingSphere()
    out.push({ geometry, material })
  }
  return out
}
