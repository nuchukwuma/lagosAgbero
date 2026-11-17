// The simplified bodies (public/assets/characters/crowd-lod.json, made by
// scripts/make-crowd-lod.mjs): for each body, which of its corners to keep
// and the triangles between them, about a third of the full count.
// The background crowd is built from them, and story people switch to them
// when they are far from the camera.

import * as THREE from 'three'
import { ASSET_ROOT } from '../../assets/assetManifest.js'

let data = null // the parsed file, once loaded
let loading = null
const indexCache = new Map() // body -> BufferAttribute (shared by everyone wearing that body)

/** Loads the file once; resolves to { body: { keep, index } } ({} if it can't be read). */
export function loadBodyLods() {
  if (!loading)
    loading = fetch(`${ASSET_ROOT}/characters/crowd-lod.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((d) => (data = d))
  return loading
}

/**
 * A triangle list for the full body's own corners that draws the simplified
 * body: swap it in as the geometry's index. Null until the file has loaded
 * (it starts loading on the first call).
 */
export function lodIndexFor(body) {
  if (!data) {
    loadBodyLods()
    return null
  }
  if (!indexCache.has(body)) {
    const lod = data[body]
    let attr = null
    if (lod) {
      const out = new Uint16Array(lod.index.length)
      for (let i = 0; i < out.length; i++) out[i] = lod.keep[lod.index[i]]
      attr = new THREE.BufferAttribute(out, 1)
    }
    indexCache.set(body, attr)
  }
  return indexCache.get(body)
}
