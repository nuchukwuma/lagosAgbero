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
  flatbedLorry: car('truck-flat', 'Sand / cement / scrap lorry'),
  boxTruck: car('delivery', 'Drinks and bread distributor truck (fictional brands on the side)', {
    tweak: { decal: 'brandAd' },
  }),
  pickup: car('delivery-flat', 'Open-back pickup loaded with market goods'),
  privateCar: car('sedan', 'Ordinary "tokunbo" private car', { tweak: { weathering: 0.3 } }),
  familyJeep: car('suv', 'Middle-class jeep'),
  bigManSuv: car('suv-luxury', "Rich man's SUV: begging target, convoy car", {
    tweak: { recolor: { from: [4, 1], to: 'black' } },
  }),
  bigManSportsCar: car('sedan-sports', "Rich kid's sports car: begging target"),
  flashyHatchback: car('hatchback-sports', 'Flashy young-money car: loud music, small tip'),
  taskForceVan: car('police', 'Task Force van: recoloured khaki-green with fictional TF badge', {
    tweak: { recolor: { from: [6, 2], to: 'green' }, decal: 'taskForceBadge' },
  }),
  taskForceTow: car('tractor-police', 'Task Force tow tractor that drags away impounded danfos', {
    tweak: { recolor: { from: [6, 2], to: 'green' }, decal: 'taskForceBadge' },
  }),
  ambulance: car('ambulance', 'Hospital branch after a collapse or a lost fight'),
  wasteTruck: car('garbage-truck', 'Fictional waste agency truck, street-clearing event'),
  fireTruck: car('firetruck', 'Market fire random event'),
  demolitionShovel: car('tractor-shovel', 'Stall demolition during Task Force raids'),
  roadWorksTractor: car('tractor', 'Road-works scene, traffic-jam event'),
  molue: { file: 'vehicles-extra/bus.glb', category: 'vehicle', use: 'Molue / big yellow bus (Quaternius; Kenney has no bus)', tweak: { yaw: 90, recenter: true } },
  kekeChassis: car('kart-oobi', 'Base for the keke: driver and front-left/right wheels hidden, one centre wheel and a primitive cabin added', {
    tweak: { hideNodes: ['character', 'wheel-front-left', 'wheel-front-right'] },
  }),

  // ---------------- Props (car-kit) ----------------
  cone: carProp('cone', 'Traffic cone, roadblock'),
  coneFlat: carProp('cone-flat', 'Knocked-over cone'),
  carton: carProp('box', 'Cartons of goods at stalls, runner obstacle'),
  okadaWheel: carProp('wheel-dark', 'Okada wheels (2 per bike)'),
  kekeWheel: carProp('wheel-default', 'Keke centre front wheel'),
  truckWheel: carProp('wheel-truck', "Vulcaniser's tyre pile"),
  spareTyre: carProp('debris-tire', "Vulcaniser's tyre pile, runner obstacle"),
  scrapDoor: carProp('debris-door', 'Mechanic village scrap'),
  scrapBumper: carProp('debris-bumper', 'Accident debris'),
  scrapPlate: carProp('debris-plate-a', 'Scrap metal sheet, runner obstacle'),
  scrapAxle: carProp('debris-drivetrain', 'Mechanic village scrap'),

  // ---------------- Roads (city-kit-roads) ----------------
  roadStraight: road('road-straight', 'Main road (8 m tile)'),
  roadStraightHalf: road('road-straight-half', 'Narrow side street'),
  roadCrossing: road('road-crossing', 'Zebra crossing in front of the bus stop'),
  roadJunctionT: road('road-intersection', 'T-junction'),
  roadCrossroad: road('road-crossroad', 'Four-way junction'),
  roadBend: road('road-bend', 'Corner'),
  roadCurve: road('road-curve', 'Wide curve (16 m)'),
  roadEnd: road('road-end', 'Dead end'),
  roadTurnaround: road('road-end-round', 'Motor park turnaround'),
  roundabout: road('road-roundabout', 'Big roundabout (24 m), rally location'),
  roadLayBy: road('road-side', 'Bus stop lay-by'),
  roadLayByEntry: road('road-side-entry', 'Lay-by entry'),
  roadLayByExit: road('road-side-exit', 'Lay-by exit'),
  roadSplit: road('road-split', 'Road widening into the expressway'),
  pavedLot: road('road-square', 'Motor park ground, market floor'),
  roadDriveway: road('road-driveway-single', 'Gate into a compound'),
  roadMedian: road('road-straight-barrier', 'Expressway median'),
  flyover: road('road-bridge', 'Flyover deck'),
  bridgePillar: road('bridge-pillar-wide', 'Under-bridge hideout pillars'),
  ground: road('tile-low', 'Plain ground / sidewalk tile'),
  raisedKerb: road('tile-high', 'Raised platform / kerb block'),

  // ---------------- Street furniture (city-kit-roads) ----------------
  electricityPole: street('electricity-pole', 'NEPA-style pole (fictional power company)'),
  electricityPoleWide: street('electricity-pole-wide', 'Wide pole over the main road'),
  electricityPoleSingle: street('electricity-pole-single', 'Single pole, side street'),
  electricitySide: street('electricity-side', 'Pole leaning over the road'),
  electricityWires: street('electricity-wires', 'Sagging wires between poles'),
  electricityWiresWide: street('electricity-wires-wide', 'Sagging wires, wide span'),
  streetLamp: street('light-square', 'Street lamp (often off: "light no dey")'),
  streetLampDouble: street('light-curved-double', 'Double lamp on the median'),
  streetLampCurved: street('light-curved', 'Curved lamp'),
  trafficLight: street('traffic-light', 'Traffic light nobody obeys'),
  trafficLightHanging: street('traffic-light-hanging', 'Hanging traffic light at the junction'),
  busStopSign: street('road-sign-street', 'Bus stop sign (custom "BUS STOP" decal)', { tweak: { decal: 'busStopName' } }),
  stopSign: street('road-sign-stop', 'Stop sign'),
  warningSign: street('road-sign-warning', 'Warning sign'),
  posterPost: street('road-sign-empty', 'Post for political / church / "Jesus is Lord" posters', { tweak: { decal: 'poster' } }),
  shopSign: street('road-sign-empty-hanging', 'Hanging shop sign', { tweak: { decal: 'shopName' } }),
  billboard: street('sign-highway-wide', 'Billboard: fictional ads and politician faces', { tweak: { decal: 'billboard' } }),
  billboardTall: street('sign-highway-detailed', 'Tall billboard over the expressway', { tweak: { decal: 'billboard' } }),
  checkpointBarrier: street('construction-barrier', 'Task Force checkpoint barrier'),
  checkpointCone: street('construction-cone', 'Checkpoint cone'),
  checkpointFence: street('construction-fence', 'Checkpoint / demolition fence'),
  checkpointLight: street('construction-light', 'Flashing checkpoint light'),
  dumpster: street('dumpster', 'Refuse bin: hiding spot during raids'),

  // ---------------- Market & warehouse zone (city-kit-industrial) ----------------
  marketHall: ind('building-k', 'Covered market hall (saw-tooth roof)'),
  warehouseA: ind('building-h', 'Warehouse'),
  warehouseB: ind('building-i', 'Warehouse, small'),
  warehouseArched: ind('building-j', 'Arched-roof warehouse: cult hideout candidate'),
  shopRow: ind('building-s', 'Row of lock-up shops'),
  motorParkOffice: ind('building-p', "Chairman's motor park office"),
  partySecretariat: ind('building-a', "Fictional party secretariat (the politician's office)"),
  officeBlock: ind('building-b', 'Office block'),
  agencyTower: ind('building-d', 'Task Force / government agency building'),
  officeSmall: ind('building-o', 'Small office: the fixer'),
  factory: ind('building-e', 'Factory with chimneys'),
  bottlingFactory: ind('building-m', 'Fictional drinks factory (energy items)'),
  bigFactory: ind('building-l', 'Large factory complex'),
  workshop: ind('building-n', 'Workshop with chimney: mechanic / welder'),
  printingPress: ind('building-g', 'Printing press: election posters'),
  depot: ind('building-q', 'Goods depot'),
  coldRoom: ind('building-r', 'Cold room / fish depot'),
  warehouseOffice: ind('building-t', 'Warehouse with office'),
  sawmill: ind('building-c', 'Sawmill / yard with machinery'),
  industrialBlock: ind('building-f', 'Industrial block, background filler'),
  shippingContainerA: indProp('shipping-container-a', 'Market stall / container shop body'),
  shippingContainerB: indProp('shipping-container-b', 'Market stall / container shop body'),
  shippingContainerC: indProp('shipping-container-c', 'Market stall / container shop body'),
  roofTank: indProp('detail-tank', 'Rooftop water tank'),
  fuelTank: indProp('detail-tank-large', 'Fuel depot tank (fuel-hike story)'),
  waterTower: indProp('water-tower', 'Borehole water tower'),
  chimneySmall: indProp('chimney-small', 'Chimney detail'),
  chimneyMedium: indProp('chimney-medium', 'Chimney detail'),
  solarPanels: indProp('solar-panel-landscape-group', "Solar panels on rich men's roofs"),

  // ---------------- Houses & compounds (city-kit-suburban) ----------------
  // Lagos roofs: long-span green and red roofing is common, so the original
  // green atlas stays for some houses and variation atlases tint the rest.
  tenementA: sub('building-type-a', '"Face-me-I-face-you" tenement'),
  tenementB: sub('building-type-h', 'Tenement, worn', { tweak: { atlas: 'variation-b', weathering: 0.5 } }),
  tenementC: sub('building-type-i', 'Tenement, worn', { tweak: { atlas: 'variation-c', weathering: 0.5 } }),
  bungalowWide: sub('building-type-g', 'Bungalow'),
  bungalowSquare: sub('building-type-m', 'Bungalow, square plan'),
  mentorHouse: sub('building-type-k', "Mentor's small storey house"),
  friendHouse: sub('building-type-r', "Friend's family house"),
  shopHouseA: sub('building-type-e', 'Storey building, shop on ground floor'),
  shopHouseB: sub('building-type-j', 'Storey building, shop on ground floor'),
  storeyHouseA: sub('building-type-c', 'Storey house'),
  storeyHouseB: sub('building-type-l', 'Storey house, narrow'),
  storeyHouseC: sub('building-type-o', 'Storey house'),
  storeyHouseD: sub('building-type-s', 'Storey house'),
  storeyHouseE: sub('building-type-u', 'Storey house'),
  richManHouse: sub('building-type-b', "Rich man's compound house (begging target)"),
  richManHouseB: sub('building-type-d', "Rich man's house, wide"),
  richManHouseC: sub('building-type-f', "Rich man's house, deep"),
  chairmanHouse: sub('building-type-t', "The Chairman's house"),
  politicianMansion: sub('building-type-n', "The politician's mansion"),
  bigManDuplex: sub('building-type-p', 'Modern duplex with pillars'),
  fixerDuplex: sub('building-type-q', "The fixer's modern duplex"),
  compoundFence: subProp('fence', 'Compound wall, one segment (2.2 m high)'),
  compoundFenceLow: subProp('fence-low', 'Low fence'),
  compoundFence1x2: subProp('fence-1x2', 'Compound wall set'),
  compoundFence1x3: subProp('fence-1x3', 'Compound wall set'),
  compoundFence1x4: subProp('fence-1x4', 'Compound wall set'),
  compoundFence2x2: subProp('fence-2x2', 'Compound wall set'),
  compoundFence2x3: subProp('fence-2x3', 'Compound wall set'),
  compoundFence3x2: subProp('fence-3x2', 'Compound wall set'),
  compoundFence3x3: subProp('fence-3x3', 'Compound wall set (big compound)'),
  driveway: subProp('driveway-long', 'Compound driveway'),
  drivewayShort: subProp('driveway-short', 'Short driveway'),
  path: subProp('path-long', 'Footpath'),
  pathStones: subProp('path-stones-messy', 'Stepping-stone path'),
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
  // The old Kenney character is kept on disk until the final clean-up phase.
  legacyKenney: { body: 'characters/characterMedium.fbx', skins: 'characters/skins/' },
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
