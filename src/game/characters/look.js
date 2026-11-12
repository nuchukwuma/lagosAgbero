// Character looks: a few bodies (outfits), many people.
// A "look" is plain data (characters.json for the cast, the save for the player):
//
//   { body: "male_casual" | "male_shirt" | "male_longsleeve" | "male_suit" |
//           "female_casual" | "female_dress" | "female_tanktop" | "female_alternative",
//     skin, hair, shirt, shirt2, trousers, shoes, socks, accent: "#rrggbb",
//     height: 1.0, width: 1.0, eyeRed: 0..1,
//     accessories: [ { type: "cap", color: "#..." }, { type: "glasses" }, ... ] }
//
// Every body part (Skin, Hair, Shirt...) was tagged when the model was
// imported, so colouring a person just writes vertex colours: no textures,
// and everybody shares one material (one draw call each).
// Older saves used { base: "male" }; that still works (casual outfit).

import * as THREE from 'three'
import people from '../../assets/peopleIndex.json'

export const BODIES = Object.keys(people.bodies)
export const SKIN_TONES = ['#3d2516', '#4e2f1d', '#5c3a24', '#6e4329', '#7d4c2e', '#8d5524']

export const DEFAULT_LOOK = {
  body: 'male_casual',
  skin: '#5c3a24',
  hair: '#161110',
  shirt: '#d8d2c4',
  trousers: '#2c3e50',
  shoes: '#1e1e1e',
  height: 1,
  width: 1,
  eyeRed: 0, // the energy meter shows in the eyes: more red = more energy
  accessories: [],
}

export function normalizeLook(look = {}) {
  const l = { ...DEFAULT_LOOK, ...look, accessories: look.accessories || [] }
  if (!look.body && look.base) l.body = `${look.base}_${look.outfit || 'casual'}`
  if (!people.bodies[l.body]) l.body = l.body?.startsWith('female') ? 'female_casual' : 'male_casual'
  return l
}

export function bodyInfo(body) {
  return people.bodies[body] || people.bodies.male_casual
}

const EYES_REST = new THREE.Color('#0a0606')
const EYES_RED = new THREE.Color('#c81a1a')
const tmp = new THREE.Color()

/** The colour a look gives one body part (slot from peopleIndex.json). */
export function partColor(part, look) {
  switch (part.slot) {
    case 'eyes':
      return tmp.copy(EYES_REST).lerp(EYES_RED, Math.min(1, Math.max(0, look.eyeRed || 0))).clone()
    case 'shirt2':
      return look.shirt2 ? new THREE.Color(look.shirt2) : look.shirt ? new THREE.Color(look.shirt).multiplyScalar(0.7) : new THREE.Color(part.color)
    case 'socks':
      return new THREE.Color(look.socks || look.trousers || part.color)
    default:
      return new THREE.Color(look[part.slot] || part.color)
  }
}

/** Writes the look's colours into a geometry that has a `matid` attribute. */
export function paintGeometry(geometry, lookInput) {
  const look = normalizeLook(lookInput)
  const parts = bodyInfo(look.body).parts
  const ids = geometry.attributes.matid || geometry.attributes._matid
  const n = geometry.attributes.position.count
  let color = geometry.attributes.color
  if (!color) {
    color = new THREE.BufferAttribute(new Float32Array(n * 3), 3)
    geometry.setAttribute('color', color)
  }
  const palette = parts.map((p) => partColor(p, look)) // THREE.Color is linear, as vertex colours expect
  for (let i = 0; i < n; i++) {
    const c = palette[ids ? Math.round(ids.getX(i)) : 0] || palette[0]
    color.setXYZ(i, c.r, c.g, c.b)
  }
  color.needsUpdate = true
}

/** A random-but-repeatable look for background people. */
export function randomLook(seed, sex) {
  let s = seed * 9301 + 49297
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
  const female = sex ? sex === 'female' : rnd() < 0.35
  const shirts = ['#c0392b', '#2f8f5b', '#2c5aa0', '#e0b400', '#8e44ad', '#e67e22', '#ecf0f1', '#1abc9c', '#7f8c8d', '#d35400']
  const trousers = ['#2c3e50', '#1a1a1a', '#5d4037', '#34495e', '#6d6d6d', '#3e2723']
  return normalizeLook({
    body: female ? pick(['female_casual', 'female_dress', 'female_tanktop']) : pick(['male_casual', 'male_shirt', 'male_longsleeve']),
    skin: pick(SKIN_TONES),
    hair: '#161110',
    shirt: pick(shirts),
    trousers: pick(trousers),
    shoes: pick(['#1e1e1e', '#5d4037', '#ecf0f1']),
    height: 0.95 + rnd() * 0.1,
    width: 0.95 + rnd() * 0.12,
    accessories: rnd() < 0.25 ? [{ type: female ? 'gele' : 'cap', color: pick(shirts) }] : [],
  })
}

/** Cult colours: a Tortoise wears yellow and brown (cult.json "colours"). */
export function withAllegiance(look = {}, flags = {}) {
  if (!flags.tortoise || flags.leftTortoises || flags.hidesColours) return look
  const acc = (look.accessories || []).filter((a) => a.type !== 'scarf')
  return { ...look, trousers: '#5d4325', accessories: [...acc, { type: 'scarf', color: '#e0b400' }] }
}
