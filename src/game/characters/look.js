// Character looks: a few bodies (outfits), many people.
// A "look" is plain data (characters.json for the cast, the save for the player):
//
//   { body: "mini_male_a".."mini_male_g" | "mini_worker" | "mini_soldier" | "mini_raider" |
//           "mini_female_a".."mini_female_f"  (Kenney Mini Characters; older ids map across),
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

// Everyone is a Kenney Mini Character now (scripts/import-kenney-minis.mjs).
// Older looks (saves, story data) name the bodies used before: each maps to
// the closest mini.
export const LEGACY_BODIES = {
  male_casual: 'mini_male_f',
  male_shirt: 'mini_male_e',
  male_longsleeve: 'mini_soldier',
  male_suit: 'mini_male_d',
  female_casual: 'mini_female_a',
  female_dress: 'mini_female_f',
  female_tanktop: 'mini_female_c',
  female_alternative: 'mini_female_e',
  rpg_cleric: 'mini_male_d',
  rpg_monk: 'mini_male_b',
  rpg_ranger: 'mini_soldier',
  rpg_rogue: 'mini_raider',
  rpg_warrior: 'mini_male_c',
  rpg_wizard: 'mini_male_g',
}
export const MALE_BODIES = BODIES.filter((b) => people.bodies[b].sex === 'male')
export const FEMALE_BODIES = BODIES.filter((b) => people.bodies[b].sex === 'female')
/** Is this a woman's body? (any body id, old or new) */
export function isFemale(body = '') {
  const id = LEGACY_BODIES[body] || body
  return people.bodies[id]?.sex === 'female' || id.startsWith('female') || id.includes('_female')
}
export const SKIN_TONES = ['#3d2516', '#4e2f1d', '#5c3a24', '#6e4329', '#7d4c2e', '#8d5524']

export const DEFAULT_LOOK = {
  body: 'mini_male_f',
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
  if (LEGACY_BODIES[l.body]) l.body = LEGACY_BODIES[l.body]
  if (!people.bodies[l.body]) l.body = isFemale(l.body) ? 'mini_female_a' : DEFAULT_LOOK.body
  return l
}

export function bodyInfo(body) {
  return people.bodies[LEGACY_BODIES[body] || body] || people.bodies[DEFAULT_LOOK.body]
}

const EYES_REST = new THREE.Color('#0a0606')
const EYES_RED = new THREE.Color('#c81a1a')
const MOUTH_TINT = new THREE.Color('#5a1414')
const tmp = new THREE.Color()

/** The colour a look gives one body part (slot from peopleIndex.json). */
export function partColor(part, look) {
  switch (part.slot) {
    case 'eyes':
      return tmp.copy(EYES_REST).lerp(EYES_RED, Math.min(1, Math.max(0, look.eyeRed || 0))).clone()
    case 'shirt2':
      return look.shirt2 ? new THREE.Color(look.shirt2) : look.shirt ? new THREE.Color(look.shirt).multiplyScalar(0.7) : new THREE.Color(part.color)
    case 'mouth': {
      // a darker, slightly redder shade of the skin
      const skin = new THREE.Color(look.skin || DEFAULT_LOOK.skin)
      return skin.multiplyScalar(0.45).lerp(MOUTH_TINT, 0.3)
    }
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
  // Kenney Mini Characters keep their palette's soft gradient as a per-corner
  // "shade" (stored / 1.5), so recoloured clothes keep the toy look
  const shade = geometry.attributes.shade || geometry.attributes._shade
  for (let i = 0; i < n; i++) {
    const c = palette[ids ? Math.round(ids.getX(i)) : 0] || palette[0]
    const k = shade ? shade.getX(i) * 1.5 : 1
    color.setXYZ(i, c.r * k, c.g * k, c.b * k)
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
    body: female ? pick(['mini_female_a', 'mini_female_b', 'mini_female_c', 'mini_female_f']) : pick(['mini_male_a', 'mini_male_e', 'mini_male_f', 'mini_worker', 'mini_soldier', 'mini_raider']),
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
