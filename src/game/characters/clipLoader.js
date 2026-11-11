// Loads the retargeted Mixamo clips (small JSON files) and turns them into
// three.js AnimationClips that play on any character built from the Kenney body.
// Files are fetched only when first needed, and cached.

import * as THREE from 'three'
import { ASSET_ROOT, CHARACTER } from '../../assets/assetManifest.js'

const cache = new Map()

function buildClip(name, data) {
  const { fps, bones, quaternions, hipsPosition, duration } = data
  const frameCount = hipsPosition.length / 3
  const times = new Float32Array(frameCount)
  for (let i = 0; i < frameCount; i++) times[i] = Math.min(i / fps, duration)

  const tracks = bones.map((bone, i) => new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, quaternions[i]))
  tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, hipsPosition))
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
    .then((data) => buildClip(name, data))
    .catch((err) => {
      cache.delete(name) // allow a retry later
      throw err
    })
  cache.set(name, promise)
  return promise
}

/** Load several clips at once (e.g. all fight moves before a fight starts). */
export function loadClips(names) {
  return Promise.all(names.map(loadClip))
}

export function clipInfo(name) {
  return CHARACTER.clips[name] || null
}

export const CLIP_NAMES = Object.keys(CHARACTER.clips)
