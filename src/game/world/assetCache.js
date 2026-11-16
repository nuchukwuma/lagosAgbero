// Shared decoded images for the 3D models.
//
// The Kenney models (about 60 per world) all point at the same four
// colormap.png files, but three.js decodes the image again for every model
// that asks: 49 copies, about 49 MB, in the first street alone. Turning on
// three's loader cache makes them share one decoded copy per file.
//
// The same cache would also keep every downloaded model file (the raw .glb
// bytes) forever, though the game only needs them while parsing. trimCache()
// drops everything except the decoded images; the loading screen calls it
// when a world has finished loading.

import * as THREE from 'three'

THREE.Cache.enabled = true

const isImage = (v) =>
  (typeof ImageBitmap !== 'undefined' && v instanceof ImageBitmap) ||
  (typeof HTMLImageElement !== 'undefined' && v instanceof HTMLImageElement) ||
  (v && typeof v.then === 'function') // an image still decoding

export function trimCache() {
  for (const key of Object.keys(THREE.Cache.files)) if (!isImage(THREE.Cache.files[key])) THREE.Cache.remove(key)
}
