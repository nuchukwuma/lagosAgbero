// The game's look: bright, cartoon ("toon") shading and outlined, big-headed
// people, in the spirit of cosy stylised mobile games. Everything that sets
// the style lives here, so it can be tuned (or undone) in one place.
//
// 1. Cartoon shading, everywhere at once: every lit material in the game is a
//    Lambert material, so we change how Lambert takes the sun. Instead of a
//    smooth fade from light to dark, a surface is in full light, half light or
//    shade, with a soft edge between the bands. The sky's soft fill light stays
//    smooth, so shade never goes flat black. Same cost as before.
// 2. Outlines on people (Character.jsx): a slightly bigger copy of the body,
//    drawn inside out in a dark colour, that bends with the skeleton. One extra
//    draw per person, only for people near the camera.
// 3. Bigger heads on the everyday bodies (the RPG-pack bodies already have
//    them): the head bone is scaled up, so animations, hats and faces follow.

import * as THREE from 'three'

// ---- 1. cartoon shading ----
export const TOON = {
  // where the light bands start (how directly a surface faces the sun) and how
  // bright each band is
  shadeEdge: 0.18,
  lightEdge: 0.55,
  half: 0.6,
  softness: 0.06,
}

const TOON_DIRECT = `
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	// cartoon bands (src/game/world/style.js)
	dotNL = smoothstep( ${TOON.shadeEdge.toFixed(3)}, ${(TOON.shadeEdge + TOON.softness).toFixed(3)}, dotNL ) * ${TOON.half.toFixed(3)}
	      + smoothstep( ${TOON.lightEdge.toFixed(3)}, ${(TOON.lightEdge + TOON.softness).toFixed(3)}, dotNL ) * ${(1 - TOON.half).toFixed(3)};
	vec3 irradiance = dotNL * directLight.color;`

const original = THREE.ShaderChunk.lights_lambert_pars_fragment
const smoothLine = /\tfloat dotNL = saturate\( dot\( geometryNormal, directLight\.direction \) \);\n\tvec3 irradiance = dotNL \* directLight\.color;/
if (smoothLine.test(original)) THREE.ShaderChunk.lights_lambert_pars_fragment = original.replace(smoothLine, TOON_DIRECT)
else console.warn('[style] three.js Lambert shader changed: cartoon shading is off')

// ---- 2. outlines on people ----
export const OUTLINE = {
  color: '#1d130c',
  width: 0.006, // fraction of the body's height
  maxDistance: 26, // metres from the camera; further away it's too thin to see
  lightDistance: 0, // Light mode (budget phones): metres; 0 = no outlines
}

/**
 * Smooth normals for the outline, one per position: with the body's own
 * normals, every hard edge would split the outline open (spikes and gaps).
 * Stored on the geometry as "outlineNormal" (once per body, then cloned).
 */
export function addOutlineNormals(geometry) {
  if (geometry.attributes.outlineNormal) return geometry
  const pos = geometry.attributes.position
  const nor = geometry.attributes.normal
  const sums = new Map()
  const keyOf = (i) => `${Math.round(pos.getX(i) * 100)},${Math.round(pos.getY(i) * 100)},${Math.round(pos.getZ(i) * 100)}`
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    const k = keyOf(i)
    if (!sums.has(k)) sums.set(k, new THREE.Vector3())
    sums.get(k).add(v.set(nor.getX(i), nor.getY(i), nor.getZ(i)))
  }
  const out = new Int8Array(pos.count * 3) // like the body's own normals: one byte per axis
  for (let i = 0; i < pos.count; i++) {
    const n = sums.get(keyOf(i)).normalize()
    out[i * 3] = Math.round(n.x * 127)
    out[i * 3 + 1] = Math.round(n.y * 127)
    out[i * 3 + 2] = Math.round(n.z * 127)
  }
  geometry.setAttribute('outlineNormal', new THREE.BufferAttribute(out, 3, true))
  return geometry
}

const outlineMaterials = new Map() // thickness -> material
/** The dark, inside-out material that draws a person's outline. */
export function outlineMaterial(thickness) {
  const key = thickness.toFixed(2)
  if (!outlineMaterials.has(key)) {
    const m = new THREE.MeshBasicMaterial({ color: OUTLINE.color, side: THREE.BackSide })
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 outlineNormal;')
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = outlineNormal;')
        .replace('#include <skinning_vertex>', `#include <skinning_vertex>\n\ttransformed += normalize( objectNormal ) * ${key};`)
    }
    m.customProgramCacheKey = () => `outline-${key}`
    outlineMaterials.set(key, m)
  }
  return outlineMaterials.get(key)
}

/** Adds the outline to a person's body mesh; returns the outline mesh. */
export function addOutline(mesh, nativeHeight) {
  const outline = new THREE.SkinnedMesh(mesh.geometry, outlineMaterial(nativeHeight * OUTLINE.width))
  outline.frustumCulled = false
  outline.bind(mesh.skeleton, mesh.bindMatrix)
  outline.name = 'outline'
  mesh.parent.add(outline)
  return outline
}

// ---- 3. bigger heads ----
export const BIG_HEAD = 1.35 // the Men / Women pack bodies

/** Scale up the head of an everyday body (call after attaching hats). */
export function applyHeadSize(object, info) {
  if (info.rig || info.clipSet) return // RPG-pack and Mini Characters bodies are already big-headed
  const head = object.getObjectByName('Head')
  if (head) head.scale.setScalar(BIG_HEAD)
}
