// assetManifest.js — the ONLY place that knows real file names.
// Game code asks for `danfo`, `taskForceVan`, `richManHouse`... and never for
// "van.glb". To swap a model, change one line here.
//
// Units: 1 world unit = 1 metre. The Kenney packs use different units, so
// every pack has a scale factor (PACK_SCALE). Sizes in comments are metres
// AFTER scaling.
//
// `tweak` describes how code changes a model so it looks Nigerian. Applied by
// src/game/world/models.js (decals arrive with the systems that need them).
//   recolor: { from: [col,row], to: 'danfoYellow' | [col,row] } — move UVs
//            from one swatch of the shared colormap atlas to another
//            (see src/game/world/swatches.js; no new textures)
//   stretch: [x, y, z]  — scale the body node only (wheels keep their shape)
//   hideNodes: [...]    — hide named sub-meshes (e.g. kart drivers)
//   decal / stripe / weathering — extra primitive planes or material tweaks
//   atlas: 'variation-b' — use one of the pack's alternate colour atlases
//   yaw: 90 — turn a model that doesn't face +Z like the Kenney cars
//   recenter: true — put the model's base on the ground, footprint centred
//
// Never import file paths anywhere else. Use getAsset(name) / assetUrl(name).

import assetIndex from './assetIndex.json'
import clipIndex from './clipIndex.json'
import peopleIndex from './peopleIndex.json'

export const ASSET_ROOT = '/assets'

// Native unit -> metres. City kits are built on 1x1 road tiles; at x8 a road
// tile is 8 m (two lanes + kerb), a 20 ft container is 6.6 m long, a compound
// wall is 2.2 m high. Car-kit cars are ~2.75 units long; x1.6 gives a 4.4 m car.
export const PACK_SCALE = {
  'car-kit': 1.6,
  'city-kit-roads': 8,
  'city-kit-industrial': 8,
  'city-kit-suburban': 8,
  characters: 1, // characters are normalised to CHARACTER.targetHeight instead
  'vehicles-extra': 0.017, // Quaternius bus: ~7 m long, 2.9 m wide
}

// Placeholder colours used when a model is missing.
const FALLBACK_COLOR = {
  vehicle: '#e0b400',
  prop: '#c86b2a',
  road: '#3b3b3b',
  street: '#7a7a7a',
  building: '#b8a58a',
  nature: '#3f8a3a',
}

const car = (file, use, extra = {}) => ({ file: `car-kit/${file}.glb`, category: 'vehicle', use, ...extra })
const carProp = (file, use, extra = {}) => ({ file: `car-kit/${file}.glb`, category: 'prop', use, ...extra })
const road = (file, use, extra = {}) => ({ file: `city-kit-roads/${file}.glb`, category: 'road', use, ...extra })
const street = (file, use, extra = {}) => ({ file: `city-kit-roads/${file}.glb`, category: 'street', use, ...extra })
const ind = (file, use, extra = {}) => ({ file: `city-kit-industrial/${file}.glb`, category: 'building', use, ...extra })
const indProp = (file, use, extra = {}) => ({ file: `city-kit-industrial/${file}.glb`, category: 'prop', use, ...extra })
const sub = (file, use, extra = {}) => ({ file: `city-kit-suburban/${file}.glb`, category: 'building', use, ...extra })
const subProp = (file, use, extra = {}) => ({ file: `city-kit-suburban/${file}.glb`, category: 'prop', use, ...extra })
const nature = (file, use, extra = {}) => ({ file: `city-kit-suburban/${file}.glb`, category: 'nature', use, ...extra })

export const MODELS = {
  // ---------------- Vehicles (car-kit) ----------------
  danfo: car('van', 'Danfo bus: yellow, black side stripe, body stretched ~5.7 m', {
    tweak: { recolor: { from: [7, 1], to: 'danfoYellow' }, stripe: 'black', stretch: [1, 1.08, 1.3], weathering: 0.25 },
  }),
  taxi: car('taxi', 'Yellow taxi, kept yellow, faded', { tweak: { weathering: 0.3 } }),
  lorry: car('truck', 'Commercial lorry bringing goods to the market'),
  boxTruck: car('delivery', 'Drinks and bread distributor truck (fictional brands on the side)', {
    tweak: { decal: 'brandAd' },
  }),
  privateCar: car('sedan', 'Ordinary "tokunbo" private car', { tweak: { weathering: 0.3 } }),
  bigManSuv: car('suv-luxury', "Rich man's SUV: begging target, convoy car", {
    tweak: { recolor: { from: [4, 1], to: 'black' } },
  }),
  taskForceVan: car('police', 'Task Force van: recoloured khaki-green with fictional TF badge', {
    tweak: { recolor: { from: [6, 2], to: 'green' }, decal: 'taskForceBadge' },
  }),
  molue: { file: 'vehicles-extra/bus.glb', category: 'vehicle', use: 'Molue / big yellow bus (Quaternius; Kenney has no bus)', tweak: { yaw: 90, recenter: true } },

  // ---------------- Props (car-kit) ----------------
  cone: carProp('cone', 'Traffic cone, roadblock'),
  carton: carProp('box', 'Cartons of goods at stalls, runner obstacle'),
  okadaWheel: carProp('wheel-dark', 'Okada wheels (2 per bike)'),
  kekeWheel: carProp('wheel-default', 'Keke centre front wheel'),
  spareTyre: carProp('debris-tire', "Vulcaniser's tyre pile, runner obstacle"),

  // ---------------- Roads (city-kit-roads) ----------------
  roadStraight: road('road-straight', 'Main road (8 m tile)'),
  roadCrossing: road('road-crossing', 'Zebra crossing in front of the bus stop'),
  roadJunctionT: road('road-intersection', 'T-junction'),
  pavedLot: road('road-square', 'Motor park ground, market floor'),
  flyover: road('road-bridge', 'Flyover deck'),

  // ---------------- Street furniture (city-kit-roads) ----------------
  electricityPole: street('electricity-pole', 'NEPA-style pole (fictional power company)'),
  electricityPoleSingle: street('electricity-pole-single', 'Single pole, side street'),
  streetLamp: street('light-square', 'Street lamp (often off: "light no dey")'),
  trafficLight: street('traffic-light', 'Traffic light nobody obeys'),
  busStopSign: street('road-sign-street', 'Bus stop sign (custom "BUS STOP" decal)', { tweak: { decal: 'busStopName' } }),
  shopSign: street('road-sign-empty-hanging', 'Hanging shop sign', { tweak: { decal: 'shopName' } }),
  dumpster: street('dumpster', 'Refuse bin: hiding spot during raids'),

  // ---------------- Market & warehouse zone (city-kit-industrial) ----------------
  marketHall: ind('building-k', 'Covered market hall (saw-tooth roof)'),
  warehouseA: ind('building-h', 'Warehouse'),
  shopRow: ind('building-s', 'Row of lock-up shops'),
  motorParkOffice: ind('building-p', "Chairman's motor park office"),
  printingPress: ind('building-g', 'Printing press: election posters'),
  shippingContainerA: indProp('shipping-container-a', 'Market stall / container shop body'),
  shippingContainerB: indProp('shipping-container-b', 'Market stall / container shop body'),
  shippingContainerC: indProp('shipping-container-c', 'Market stall / container shop body'),
  roofTank: indProp('detail-tank', 'Rooftop water tank'),

  // ---------------- Houses & compounds (city-kit-suburban) ----------------
  // Lagos roofs: long-span green and red roofing is common, so the original
  // green atlas stays for some houses and variation atlases tint the rest.
  tenementA: sub('building-type-a', '"Face-me-I-face-you" tenement'),
  tenementB: sub('building-type-h', 'Tenement, worn', { tweak: { atlas: 'variation-b', weathering: 0.5 } }),
  tenementC: sub('building-type-i', 'Tenement, worn', { tweak: { atlas: 'variation-c', weathering: 0.5 } }),
  bungalowWide: sub('building-type-g', 'Bungalow'),
  mentorHouse: sub('building-type-k', "Mentor's small storey house"),
  shopHouseA: sub('building-type-e', 'Storey building, shop on ground floor'),
  shopHouseB: sub('building-type-j', 'Storey building, shop on ground floor'),
  storeyHouseA: sub('building-type-c', 'Storey house'),
  storeyHouseC: sub('building-type-o', 'Storey house'),
  richManHouse: sub('building-type-b', "Rich man's compound house (begging target)"),
  compoundFence: subProp('fence', 'Compound wall, one segment (2.2 m high)'),
  planter: subProp('planter', 'Flower planter at rich compounds'),
  treeLarge: nature('tree-large', 'Tree (shade where agberos rest)'),
  treeSmall: nature('tree-small', 'Small tree'),
}

// Characters: 8 outfit bodies (Men / Women packs) sharing one skeleton.
// `npm run assets:characters` converts them; peopleIndex.json lists each
// body's parts (Skin, Hair, Shirt...) so looks can colour them.
export const CHARACTER = {
  targetHeight: 1.75, // metres; the loader scales each body to this height
  bodies: peopleIndex.bodies,
  // Mixamo animations, retargeted to this skeleton by `npm run assets:animations`
  // (breathingIdle, walk, run, punch, kick, block, hit, knockedOut, talk...).
  // Each entry: { file, duration, loop, rootMotion: { metres, speed }, use }.
  clips: clipIndex.clips,
  // Main bones (accessories and procedural moves use these names).
  bones: ['Body', 'Hips', 'Abdomen', 'Torso', 'Neck', 'Head', 'ShoulderL', 'UpperArmL', 'LowerArmL', 'PalmL', 'ShoulderR', 'UpperArmR', 'LowerArmR', 'PalmR', 'UpperLegL', 'LowerLegL', 'FootL', 'UpperLegR', 'LowerLegR', 'FootR'],
}

// Extra models from the Low Poly Vehicles pack (Kenney has no bus).
export const EXTRA_MODELS = peopleIndex.extras

// Shared colour atlases. Every GLB in a pack points at Textures/colormap.png.
export const ATLASES = {
  'car-kit': { base: 'car-kit/Textures/colormap.png' },
  'city-kit-roads': { base: 'city-kit-roads/Textures/colormap.png', 'variation-a': 'city-kit-roads/Textures/variation-a.png' },
  'city-kit-industrial': {
    base: 'city-kit-industrial/Textures/colormap.png',
    'variation-a': 'city-kit-industrial/Textures/variation-a.png',
    'variation-b': 'city-kit-industrial/Textures/variation-b.png',
    'variation-c': 'city-kit-industrial/Textures/variation-c.png',
  },
  'city-kit-suburban': {
    base: 'city-kit-suburban/Textures/colormap.png',
    'variation-a': 'city-kit-suburban/Textures/variation-a.png',
    'variation-b': 'city-kit-suburban/Textures/variation-b.png',
    'variation-c': 'city-kit-suburban/Textures/variation-c.png',
  },
}

// Things with no model of their own, built in code from primitives plus parts.
// `parts` lists the manifest models each recipe uses.
export const PROCEDURAL = {
  keke: { parts: ['kekeWheel'], use: 'Keke: simple-shape body, canvas canopy and 3 Kenney wheels (src/game/vehicles/Keke.jsx). The kart chassis looked like a race car, so it is kept only as a spare.' },
  okada: { parts: ['okadaWheel'], use: 'Okada: simple-shape frame, tank, seat, handlebar + 2 Kenney wheels (src/game/vehicles/Okada.jsx)' },
  marketStall: { parts: ['shippingContainerA', 'carton'], use: 'Container + sagging cloth roof (plane) + wooden table (boxes) + goods' },
  containerShop: { parts: ['shippingContainerB', 'shopSign'], use: 'Container shop with painted name board' },
  busStopShelter: { parts: ['busStopSign'], use: 'Primitive shelter (posts + roof + bench) + bus stop sign' },
  radioStall: { parts: ['carton'], use: 'Table + radio box: where news broadcasts play' },
  generator: { parts: [], use: '"I better pass my neighbour" generator: noisy box with exhaust smoke' },
}

const index = assetIndex.packs || {}

function packOf(file) {
  return file.split('/')[0]
}

function boundsOf(file) {
  const [pack, ...rest] = file.split('/')
  const extra = Object.values(peopleIndex.extras || {}).find((e) => e.file === file)
  return index[pack]?.[rest.join('/')]?.bounds || extra?.bounds || null
}

/** Full info for a game name: url, scale, world size, fallback colour. */
export function getAsset(name) {
  const entry = MODELS[name]
  if (!entry) throw new Error(`Unknown asset "${name}". Add it to src/assets/assetManifest.js`)
  const pack = packOf(entry.file)
  const scale = PACK_SCALE[pack] ?? 1
  const bounds = boundsOf(entry.file)
  const size = bounds ? bounds.size.map((v) => v * scale) : [1, 1, 1]
  // centre of the model's footprint relative to its pivot (Kenney pivots are
  // not always centred); used for colliders and placeholder boxes
  let offset = bounds ? bounds.min.map((v, i) => ((v + bounds.max[i]) / 2) * scale) : [0, 0.5, 0]
  const tw = entry.tweak || {}
  if (tw.yaw && Math.abs(tw.yaw) % 180 === 90) size.splice(0, 3, size[2], size[1], size[0])
  if (tw.recenter) offset = [0, size[1] / 2, 0]
  return {
    name,
    ...entry,
    pack,
    url: `${ASSET_ROOT}/${entry.file}`,
    scale,
    size,
    offset,
    available: Boolean(bounds),
    fallbackColor: FALLBACK_COLOR[entry.category] || '#888888',
  }
}

export function assetUrl(name) {
  return getAsset(name).url
}

export function assetNamesByCategory(category) {
  return Object.keys(MODELS).filter((n) => MODELS[n].category === category)
}

/** Every file the manifest refers to (used by the asset check script). */
export function allManifestFiles() {
  return [
    ...Object.values(MODELS).map((m) => m.file),
    ...Object.values(CHARACTER.bodies).map((b) => b.file),
    ...Object.values(CHARACTER.clips).map((c) => c.file),
    ...Object.values(EXTRA_MODELS).map((e) => e.file),
    ...Object.values(ATLASES).flatMap((a) => Object.values(a)),
  ]
}
