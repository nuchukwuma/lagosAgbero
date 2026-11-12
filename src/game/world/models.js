// Loads a manifest model once, applies its "Nigerian look" tweaks once, and
// caches the result. Everything in the world is drawn from these prototypes.
//
// Tweaks (from assetManifest.js):
//   recolor    move UVs from one atlas swatch to another   (danfo yellow)
//   stretch    lengthen the body; wheels move but keep their shape
//   stripe     two thin side stripes (danfo black stripe)
//   hideNodes  remove named parts (kart driver, kart front wheels)
//   weathering 0–1, fades the colours (old, sun-baked look)
//   atlas      use an alternate colour atlas (variation-a/b/c) for variety
//
// All materials become MeshLambertMaterial: much cheaper than the default
// PBR material on budget phones, and it suits the flat Kenney style.

import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { getAsset, ATLASES, ASSET_ROOT } from '../../assets/assetManifest.js'
import { ATLAS_GRID, swatchCell } from './swatches.js'

const protoCache = new Map()
const materialCache = new Map()
const atlasCache = new Map()
const stripeMaterial = new THREE.MeshLambertMaterial({ color: '#141414' })

export function atlasTexture(pack, variant, like) {
  const file = ATLASES[pack]?.[variant]
  if (!file) return like
  const key = `${pack}/${variant}`
  if (!atlasCache.has(key)) {
    const t = new THREE.TextureLoader().load(`${ASSET_ROOT}/${file}`)
    t.flipY = false // glTF convention
    t.colorSpace = THREE.SRGBColorSpace
    if (like) {
      t.magFilter = like.magFilter
      t.minFilter = like.minFilter
      t.wrapS = like.wrapS
      t.wrapT = like.wrapT
    }
    atlasCache.set(key, t)
  }
  return atlasCache.get(key)
}

function lambertFrom(src, { weathering = 0, pack, atlas }) {
  const key = `${src.uuid}|${weathering}|${atlas || ''}`
  if (materialCache.has(key)) return materialCache.get(key)
  const map = atlas ? atlasTexture(pack, atlas, src.map) : src.map
  const fade = 1 - 0.3 * weathering
  const m = new THREE.MeshLambertMaterial({
    map,
    color: (src.color ? src.color.clone() : new THREE.Color('#ffffff')).multiplyScalar(fade),
    transparent: src.transparent,
    opacity: src.opacity,
    alphaTest: src.alphaTest,
    side: src.side,
  })
  m.name = src.name
  materialCache.set(key, m)
  return m
}

function recolorGeometry(geometry, fromCell, toCell) {
  const g = geometry.clone()
  const uv = g.attributes.uv
  if (!uv) return g
  const du = (toCell[0] - fromCell[0]) / ATLAS_GRID.cols
  const dv = (toCell[1] - fromCell[1]) / ATLAS_GRID.rows
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i)
    const v = uv.getY(i)
    const col = Math.min(ATLAS_GRID.cols - 1, Math.floor(u * ATLAS_GRID.cols))
    const row = Math.min(ATLAS_GRID.rows - 1, Math.floor(v * ATLAS_GRID.rows))
    if (col === fromCell[0] && row === fromCell[1]) uv.setXY(i, u + du, v + dv)
  }
  uv.needsUpdate = true
  return g
}

const isWheel = (name) => /wheel/i.test(name || '')

function processModel(asset, scene) {
  const tweak = asset.tweak || {}
  const model = scene.clone(true) // shares geometry + materials with the cache

  for (const name of tweak.hideNodes || []) {
    const node = model.getObjectByName(name)
    node?.parent?.remove(node)
  }

  if (tweak.stretch) {
    const s = new THREE.Vector3(...tweak.stretch)
    for (const child of [...model.children]) {
      if (isWheel(child.name)) child.position.multiply(new THREE.Vector3(s.x, 1, s.z)) // stay on the ground
      else {
        child.position.multiply(s)
        child.scale.multiply(s)
      }
    }
  }

  const fromCell = tweak.recolor && swatchCell(asset.pack, tweak.recolor.from)
  const toCell = tweak.recolor && swatchCell(asset.pack, tweak.recolor.to)
  model.traverse((o) => {
    if (!o.isMesh) return
    if (fromCell) o.geometry = recolorGeometry(o.geometry, fromCell, toCell)
    o.material = Array.isArray(o.material)
      ? o.material.map((m) => lambertFrom(m, { weathering: tweak.weathering, pack: asset.pack, atlas: tweak.atlas }))
      : lambertFrom(o.material, { weathering: tweak.weathering, pack: asset.pack, atlas: tweak.atlas })
    o.castShadow = false
    o.receiveShadow = false
  })

  if (tweak.stripe) {
    model.updateMatrixWorld(true)
    const box = new THREE.Box3()
    model.traverse((o) => {
      if (o.isMesh && !isWheel(o.name) && !isWheel(o.parent?.name)) box.expandByObject(o)
    })
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const geo = new THREE.BoxGeometry(0.01, size.y * 0.07, size.z * 0.7)
    for (const side of [-1, 1]) {
      const stripe = new THREE.Mesh(geo, stripeMaterial)
      stripe.name = 'stripe'
      stripe.position.set(center.x + side * (size.x / 2 + 0.004), box.min.y + size.y * 0.5, center.z)
      model.add(stripe)
    }
  }

  const object = new THREE.Group()
  object.name = asset.name
  model.scale.multiplyScalar(asset.scale)
  if (tweak.yaw) model.rotation.y += (tweak.yaw * Math.PI) / 180
  if (tweak.recenter) {
    object.add(model)
    object.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(model)
    model.position.x -= (box.min.x + box.max.x) / 2
    model.position.z -= (box.min.z + box.max.z) / 2
    model.position.y -= box.min.y
  }
  object.add(model)
  object.updateMatrixWorld(true)

  // flat list of parts for instancing
  const parts = []
  object.traverse((o) => {
    if (o.isMesh) parts.push({ geometry: o.geometry, material: o.material, matrix: o.matrixWorld.clone() })
  })
  return { object, parts, asset }
}

/** The processed prototype for a manifest name, given its loaded glTF. */
export function prototypeFor(name, gltf) {
  if (!protoCache.has(name)) protoCache.set(name, processModel(getAsset(name), gltf.scene))
  return protoCache.get(name)
}

/** React hook: the processed prototype for a manifest name (suspends while loading). */
export function useModelPrototype(name) {
  const asset = getAsset(name)
  const gltf = useGLTF(asset.url)
  return prototypeFor(name, gltf)
}

/** Start downloading models early (e.g. everything the street needs). */
export function preloadModels(names) {
  for (const n of new Set(names)) {
    const a = getAsset(n)
    if (a.available) useGLTF.preload(a.url)
  }
}

const DEG = Math.PI / 180

/** {position, rotation (deg or [x,y,z] deg), scale (number or [x,y,z])} -> Matrix4 */
export function placementMatrix(item) {
  const p = new THREE.Vector3(...(item.position || [0, 0, 0]))
  const r = item.rotation ?? 0
  const e = Array.isArray(r) ? new THREE.Euler(r[0] * DEG, r[1] * DEG, r[2] * DEG) : new THREE.Euler(0, r * DEG, 0)
  const sc = item.scale ?? 1
  const s = Array.isArray(sc) ? new THREE.Vector3(...sc) : new THREE.Vector3(sc, sc, sc)
  return new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(e), s)
}
