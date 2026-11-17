// Portraits for the dialogue box: a head-and-shoulders picture of each
// speaker, rendered from their own 3D body (outfit colours, hair, hats and
// all) by the game's renderer, the first time they speak. Kept for the rest
// of the visit; the player's is redrawn when their look changes.
//
//   usePortrait(key)                  -> data URL or null (React)
//   requestPortrait(key, look)        -> queue one (PortraitStudio draws it)
//
// Rendering happens in <PortraitStudio> inside the game canvas, so it reuses
// the one WebGL context (phones allow only a few) and costs a few
// milliseconds, once per person.

import { create } from 'zustand'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { ASSET_ROOT } from '../../assets/assetManifest.js'
import { bodyInfo, normalizeLook, paintGeometry } from './look.js'
import { attachAccessories } from './accessories.js'
import { smoothNormals } from './smoothNormals.js'

const SIZE = 128 // pixels; shown at up to 64 CSS px

export const usePortraits = create(() => ({ urls: {}, queue: [] }))

const lookKeyOf = (look) => JSON.stringify(look || {})
const drawnFor = new Map() // key -> look key it was drawn with

/** Ask for a portrait. Cheap to call on every render: repeats are ignored. */
export function requestPortrait(key, look) {
  const lk = lookKeyOf(look)
  if (drawnFor.get(key) === lk) return
  drawnFor.set(key, lk)
  usePortraits.setState((s) => ({ queue: [...s.queue.filter((q) => q.key !== key), { key, look }] }))
}

export function usePortrait(key) {
  return usePortraits((s) => s.urls[key] || null)
}

// ---- the little photo studio ----
const loader = new GLTFLoader()
const bodies = new Map() // file -> Promise<gltf scene>
function loadBody(file) {
  if (!bodies.has(file)) bodies.set(file, loader.loadAsync(`${ASSET_ROOT}/${file}`).then((g) => g.scene))
  return bodies.get(file)
}
/** Free the parsed bodies (call when nobody new has been drawn for a while). */
export function releasePortraitBodies() {
  for (const p of bodies.values())
    p.then((scene) => scene.traverse((o) => o.isMesh && o.geometry.dispose())).catch(() => {})
  bodies.clear()
}

const material = new THREE.MeshLambertMaterial({ vertexColors: true })
let studio = null
function getStudio() {
  if (studio) return studio
  const scene = new THREE.Scene()
  // soft, bright studio light from the front: faces read well at 52 px
  scene.add(new THREE.HemisphereLight('#fff6e5', '#6b5640', 2.4))
  const key = new THREE.DirectionalLight('#ffffff', 2.2)
  key.position.set(-1, 1.6, 3)
  scene.add(key)
  const camera = new THREE.PerspectiveCamera(24, 1, 0.05, 20)
  const target = new THREE.WebGLRenderTarget(SIZE, SIZE)
  target.texture.colorSpace = THREE.SRGBColorSpace // store what the eye sees, like the screen
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  studio = { scene, camera, target, canvas, pixels: new Uint8Array(SIZE * SIZE * 4) }
  return studio
}

/** Draws one portrait with the game's renderer; resolves to a data URL. */
export async function drawPortrait(gl, lookInput) {
  const look = normalizeLook(lookInput)
  const info = bodyInfo(look.body)
  const source = await loadBody(info.file)
  const { scene, camera, target, canvas, pixels } = getStudio()

  const person = cloneSkinned(source)
  const k = 1.75 / info.nativeHeight
  let mesh = null
  person.traverse((c) => {
    if (c.isMesh) {
      c.geometry = smoothNormals(c.geometry).clone()
      c.material = material
      c.frustumCulled = false
      if (c.isSkinnedMesh) mesh = c
    }
  })
  if (mesh) paintGeometry(mesh.geometry, look)
  // hats first, then the size (as Character.jsx does), so they aren't scaled twice
  attachAccessories(person, look.accessories, k, info)
  person.scale.set(k * look.width, k * look.height, k * look.width)
  person.rotation.y = -0.4 // a three-quarter view
  scene.add(person)
  person.updateMatrixWorld(true)

  // frame the head: from the bottom of the neck to the top of the head
  const neck = person.getObjectByName('Neck') || person.getObjectByName('Head')
  const top = new THREE.Box3().setFromObject(person).max.y
  const neckY = neck.getWorldPosition(new THREE.Vector3()).y
  const span = Math.max(0.3, (top - neckY) * 1.3)
  const cy = (neckY + top) / 2 - span * 0.06
  const dist = span / 2 / Math.tan((camera.fov / 2) * (Math.PI / 180))
  camera.position.set(0, cy + span * 0.04, dist)
  camera.lookAt(0, cy, 0)

  const before = gl.getRenderTarget()
  const clear = gl.getClearAlpha()
  gl.setRenderTarget(target)
  gl.setClearColor(0x000000, 0)
  gl.clear()
  gl.render(scene, camera)
  gl.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels)
  gl.setRenderTarget(before)
  gl.setClearAlpha(clear)

  scene.remove(person)
  person.traverse((c) => c.isMesh && c.geometry.dispose())

  // the render target is upside down compared with a canvas
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(SIZE, SIZE)
  for (let y = 0; y < SIZE; y++) img.data.set(pixels.subarray((SIZE - 1 - y) * SIZE * 4, (SIZE - y) * SIZE * 4), y * SIZE * 4)
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}
