// Loads the retargeted Mixamo clips (small JSON files) and turns them into
// three.js AnimationClips for our characters. Files are fetched only when
// first needed, and cached.

import * as THREE from 'three'
import { ASSET_ROOT, CHARACTER } from '../../assets/assetManifest.js'

const cache = new Map() // name -> Promise<AnimationClip>
const ready = new Map() // name -> AnimationClip (once loaded)

function buildClip(name, data) {
  const { fps, bones, quaternions, hipsPosition, duration, hipBone = 'Hips', positions = {} } = data
  const frameCount = hipsPosition.length / 3
  const times = new Float32Array(frameCount)
  for (let i = 0; i < frameCount; i++) times[i] = Math.min(i / fps, duration)

  const tracks = bones.map((bone, i) => new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, quaternions[i]))
  tracks.push(new THREE.VectorKeyframeTrack(`${hipBone}.position`, times, hipsPosition))
  // bones that follow others (feet in our rig) carry their own positions
  for (const [bone, values] of Object.entries(positions)) tracks.push(new THREE.VectorKeyframeTrack(`${bone}.position`, times, values))
  return new THREE.AnimationClip(name, duration, tracks)
}

/** Load one clip by game name, e.g. loadClip('punch'). */
export function loadClip(name) {
  if (cache.has(name)) return cache.get(name)
  const info = CHARACTER.clips[name]
  if (!info) return Promise.reject(new Error(`Unknown animation clip "${name}"`))
  const promise = fetch(`${ASSET_ROOT}/${info.file}`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${info.file}`)
      return r.json()
    })
    .then((data) => {
      const clip = buildClip(name, data)
      ready.set(name, clip)
      return clip
    })
    .catch((err) => {
      cache.delete(name) // allow a retry later
      throw err
    })
  cache.set(name, promise)
  return promise
}

/** For React Suspense: returns the clip, or suspends until it has loaded. */
export function readClip(name) {
  if (ready.has(name)) return ready.get(name)
  throw loadClip(name)
}

/** Load several clips at once (e.g. all fight moves before a fight starts). */
export function loadClips(names) {
  return Promise.all(names.map(loadClip))
}

export function clipInfo(name) {
  return CHARACTER.clips[name] || null
}

export const CLIP_NAMES = Object.keys(CHARACTER.clips)
