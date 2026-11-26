// Back Gate: the 3D stealth mission on the Royal Crest campus at night.
// Pure logic (no React, no three.js), so it can be tested and replayed:
//   createMission(layout, params, seed)  the guards, their routes, the cover
//   stepMission(m, dt, player)           guards patrol, see, chase, search
//   takedown(m)                          put the guard next to you to sleep
//
// The player is driven by the normal free-roam controller (PlayerController):
// this only reads where they are and whether they run. Guards walk on a 1 m
// grid built from the campus buildings plus the mission's own cover (crates,
// containers, walls), with A* paths, and see along their torch beam unless a
// wall is in the way.

import { getAsset } from '../../../assets/assetManifest.js'
import { rng } from '../arcade/px.js'

const DEG = Math.PI / 180
export const START = { x: -34, z: 27, facing: 90 } // outside the hostel
export const GATE = { x: 52, z: -5 } // the back gate (royalCrest spots.backGate)
export const GATE_RADIUS = 3
export const SEE_RANGE = 9 // metres of torch
export const SEE_HALF = 32 * DEG // half the beam's width
export const HEAR_RUN = 6 // running this close is heard
export const PATROL_SPEED = 1.3
export const CHASE_SPEED = 4.1 // you run 4.8: you can outrun them, loudly
export const CATCH = 1.1
export const TAKEDOWN = 2.2
export const LOSE_SIGHT = 3.5 // seconds out of sight before a chase becomes a search
export const TIME = 300 // till dawn

// The cover put on the campus for the night: containers, bins, walls, cars.
// [model, x, z, rotationDeg]
export const COVER = [
  ['shippingContainerA', -26, 21, 0],
  ['dumpster', -19, 30, 90],
  ['compoundFence1x3', -13, 21, 0],
  ['shippingContainerB', -2, 23, 90],
  ['privateCar', 6, 31, 0],
  ['shippingContainerA', 3, 11, 0],
  ['dumpster', -16, 10, 0],
  ['compoundFence1x3', 14, 24, 90],
  ['shippingContainerB', 20, 13, 0],
  ['dumpster', 26, 2, 0],
  ['shippingContainerA', 31, -9, 90],
  ['compoundFence1x3', 40, 4, 0],
  ['dumpster', 44, -12, 90],
  ['privateCar', 22, -20, 90],
  ['shippingContainerB', -6, -10, 0],
  ['compoundFence1x2', 46, -2, 90],
]

// Patrol routes (loops through these points), in the order guards are added
// as it gets harder.
export const ROUTES = [
  [[-30, 15], [-17, 15], [-17, 26], [-30, 26]], // the hostel yard
  [[-8, 30], [10, 27], [10, 18], [-8, 17]], // behind the chapel row
  [[12, 7], [33, 7]], // the cafeteria road
  [[38, -4], [48, -14], [36, -14]], // by the back gate
  [[-12, -2], [18, -2]], // the main road
  [[16, -26], [30, -26], [30, -15]], // the car park side
]

// ---------------------------------------------------------------- Steal Untouched (Port Harcourt arc)
// A rival confraternity's shrine compound in the bush east of Ike's house
// (Nkwo Agu, round the shrine spot): mud walls with a gate on the west, the
// altar and its regalia inside, sentries in and around it. Come in from the
// farm road, take the regalia, and get back out the way you came. Nobody sees
// you at all: "untouched", and the respect triples.
/** Wall segments (compoundFence, 3.8 m) along a line, leaving out a gap round `gap` [x, z]. */
function fence(x1, z1, x2, z2, gap = null) {
  const len = Math.hypot(x2 - x1, z2 - z1)
  const n = Math.max(1, Math.round(len / 3.8))
  const rot = Math.round((Math.atan2(-(z2 - z1), x2 - x1) * 180) / Math.PI)
  const out = []
  for (let i = 0; i < n; i++) {
    const x = x1 + ((x2 - x1) * (i + 0.5)) / n
    const z = z1 + ((z2 - z1) * (i + 0.5)) / n
    if (gap && Math.hypot(x - gap[0], z - gap[1]) < 2.2) continue
    out.push(['compoundFence', +x.toFixed(2), +z.toFixed(2), rot])
  }
  return out
}
const SHRINE_BOX = { minX: 42, maxX: 57.2, minZ: -35, maxZ: -20.6 }
// where you stand to take it, and where its model sits (on the altar)
export const SHRINE_LOOT = { x: 49.6, z: -31.6, model: 'regalia', at: [49.6, 0.84, -33.4], label: 'THE REGALIA' }
export const SHRINE_COVER = [
  ...fence(SHRINE_BOX.minX, SHRINE_BOX.minZ, SHRINE_BOX.maxX, SHRINE_BOX.minZ),
  ...fence(SHRINE_BOX.minX, SHRINE_BOX.maxZ, SHRINE_BOX.maxX, SHRINE_BOX.maxZ),
  ...fence(SHRINE_BOX.maxX, SHRINE_BOX.minZ, SHRINE_BOX.maxX, SHRINE_BOX.maxZ),
  ...fence(SHRINE_BOX.minX, SHRINE_BOX.minZ, SHRINE_BOX.minX, SHRINE_BOX.maxZ, [SHRINE_BOX.minX, -27.8]),
  ['shrineAltar', 49.6, -33.4, 0],
  ['shrinePole', 46, -33.6, 0],
  ['shrinePole', 53.4, -33.6, 0],
  ['crates', 36, -20, 20],
  ['crates', 39.5, -27, -10],
  ['cartons', 47, -24, 0],
  ['crates', 54, -26, 90],
  ['compoundFence', 34.5, -25, 90],
]
export const SHRINE_ROUTES = [
  [[45, -32], [55, -32], [55, -23], [45, -23]], // inside, round the yard
  [[39, -31], [39, -22]], // the gate
  [[42, -38], [58, -38]], // behind the north wall
  [[40, -18.5], [57, -18.5]], // the path along the south wall
  [[46.5, -29], [53, -29]], // before the altar
  [[33, -15], [37, -24]], // the farm road
]

// The missions this logic plays. goal: 'takedowns' (every guard asleep opens
// the way out) or 'loot' (take it, then get out).
export const MISSIONS = {
  backGate: { id: 'backGate', world: 'royalCrest', start: START, exit: GATE, cover: COVER, routes: ROUTES, goal: 'takedowns', time: TIME },
  shrineHeist: { id: 'shrineHeist', world: 'nkwoAgu', start: { x: 30, z: -9, facing: 30 }, exit: { x: 30, z: -9 }, cover: SHRINE_COVER, routes: SHRINE_ROUTES, goal: 'loot', loot: SHRINE_LOOT, time: 240 },
}
// ---------------------------------------------------------------- EFCC Raid Escape (the Lekki arc)
// Inside the Rich Street duplex at night. The operatives come in through the
// front door one after another and sweep the rooms with their torches. Take
// the hard drive, the laptop and the cash from the safe (each one you carry
// slows you down), and get out through the back door in the office.
export const RAID_LOOT = [
  { x: 6.3, z: -3.9, model: 'hardDrive', at: [7.0, 1.02, -3.4], label: 'HARD DRIVE' },
  { x: 3.7, z: -4.3, model: 'laptop', at: [3.7, 0.765, -5.25], label: 'LAPTOP' },
  { x: -6.6, z: -1.7, model: 'cashStack', at: [-7.5, 0.91, -1.7], label: 'THE CASH' },
]
export const RAID_ROUTES = [
  [[0, 4.6], [-4.8, 4.2], [-4.8, 1.0], [-1.0, 1.0]], // the living room
  [[0, 4.6], [3.4, 1.4], [6.8, 1.4], [6.8, 4.8]], // the kitchen
  [[-1.0, 0.2], [-4.0, -1.8], [-1.6, -3.2], [-6.4, -3.6]], // the bedroom
  [[0, 0.2], [4.0, -2.2], [6.6, -2.0], [2.0, -3.4]], // the office
  [[0, 3.0], [0, -0.2]], // the hall
  [[-0.2, 5.0], [2.2, 3.2]], // by the front door
]
export const CARRY_SLOW = 0.1 // each thing carried: 10% slower

// you start in the bedroom, away from the front door; the first operative comes in 8 seconds after the gate goes
MISSIONS.raidEscape = { id: 'raidEscape', world: 'duplex', start: { x: -2.4, z: -2.6, facing: 180 }, exit: { x: 6.5, z: -7.5 }, exitRadius: 1.3, cover: [], routes: RAID_ROUTES, goal: 'loot', loot: RAID_LOOT, time: 150, arrive: 8, firstAt: 8, seeRange: 7 }

// ---------------------------------------------------------------- more missions, same engine
// Each: where it is, where you start and leave, the guards (and cameras), what
// to take (work: seconds standing still to do it; weight: how much it slows
// you), and the words for the result.
MISSIONS.penthouseRaid = {
  id: 'penthouseRaid',
  world: 'penthouse',
  start: { x: 0, z: 8.4, facing: 180 },
  exit: { x: 12.9, z: -5.4 },
  exitRadius: 1.3,
  cover: [],
  routes: [
    { camera: [-11.5, 9.5], face: 135, sweep: 45 },
    { camera: [11.5, -0.6], face: -135, sweep: 40 },
    [[-8, 7.4], [-3, 7.8], [-2, 3], [-9, 3]],
    [[3, -3], [10, -3], [10, -7], [2, -7]],
    [[-10, -3], [-3, -3], [-3, -6]],
    [[4, 8.4], [10.4, 8.4], [10.4, 2.6]],
  ],
  minGuards: 4,
  extraGuards: 2,
  goal: 'loot',
  loot: [
    { x: 9, z: -8.3, label: 'THE SAFE', verb: 'CRACK IT', work: 4, weight: 2 },
    { x: -5.2, z: -7.4, model: 'cashStack', at: [-5.6, 0.02, -8.4], label: 'THE GOLD', weight: 2 },
  ],
  time: 180,
  seeRange: 8,
  texts: { money: 40000, won: 'Out over the balcony.', wonLine: 'The safe, the gold, and a long climb down. Maitama sleeps on.', lost: 'Security has the lift.', caught: 'Cuffed on a Persian rug.' },
}
MISSIONS.warehouseHeist = {
  id: 'warehouseHeist',
  world: 'warehouse',
  start: { x: -11, z: 8.4, facing: 180 },
  exit: { x: 10, z: -10.9 },
  exitRadius: 1.5,
  cover: [],
  routes: [
    [[-12, -3], [0, -3], [12, -3]],
    [[-12, 8], [12, 8]],
    [[-1, -8.3], [3, -8.3]],
    [[5.7, 2.4], [12.6, 2.4]],
    [[-12.4, -4], [-12.4, 6.8]],
  ],
  minGuards: 3,
  extraGuards: 2,
  goal: 'loot',
  loot: [
    { x: -2.5, z: -8.4, label: 'THE PHONE CARTONS' },
    { x: 11.4, z: 3, label: 'THE LAPTOPS' },
    { x: -11.4, z: -8.6, label: 'THE LEDGER', verb: 'COPY IT', work: 1.2, weight: 0 },
  ],
  time: 180,
  seeRange: 9,
  texts: { money: 30000, won: 'Out through the loading dock.', wonLine: 'Phones, laptops and the ledger that says none of it was ever here. Oga Master will be proud. Or worried.', lost: 'The night watchmen have the doors.', caught: 'The watchmen sit on you till morning.' },
}
MISSIONS.examSneak = {
  id: 'examSneak',
  world: 'examHall',
  start: { x: -8.4, z: 5.8, facing: 180 },
  exit: { x: -8.4, z: 6.6 },
  exitRadius: 1.0,
  cover: [],
  routes: [
    [[-9, -3.4], [9, -3.4]],
    [[0, 6.2], [0, -0.1]],
    [[9.1, 6], [9.1, 0.5]],
  ],
  minGuards: 2,
  extraGuards: 1,
  instantFail: true, // walk inside an invigilator's sightline and it's over
  goal: 'loot',
  loot: [
    { x: 0, z: -5.1, label: 'THE QUESTION PAPER', work: 1.5, weight: 0 },
    { x: 8.6, z: -5.1, label: 'SWAP YOUR SCRIPT', verb: 'SWAP IT', work: 1.5, weight: 0 },
  ],
  time: 150,
  seeRange: 8,
  texts: { money: 15000, won: 'Sorted.', wonLine: 'The question paper in your sock, your script on the marking pile. An A is coming, from somewhere.', lost: 'The exam started without you.', caught: 'Carryover. And a panel.' },
}
MISSIONS.serverBreak = {
  id: 'serverBreak',
  world: 'serverRoom',
  start: { x: 0, z: 5.0, facing: 180 },
  exit: { x: 0, z: 6.6 },
  exitRadius: 1.0,
  cover: [],
  routes: [
    { camera: [7.5, -5.5], face: -135, sweep: 40 },
    [[-6.6, -4.4], [6.6, -4.4], [6.6, 4.0], [-6.6, 4.0]],
    [[0, -4.4], [0, 4.0]],
  ],
  minGuards: 2,
  extraGuards: 1,
  goal: 'loot',
  loot: [
    { x: -7.2, z: -5.0, label: 'BREAKER 1', verb: 'FLIP IT', work: 1.2, weight: 0 },
    { x: 7.2, z: -5.0, label: 'BREAKER 2', verb: 'FLIP IT', work: 1.2, weight: 0 },
    { x: 7.2, z: 3.6, label: 'BREAKER 3', verb: 'FLIP IT', work: 1.2, weight: 0 },
    { x: -3.6, z: -1.6, label: 'DRIVE A', verb: 'PULL IT' },
    { x: 3.6, z: 0.9, label: 'DRIVE B', verb: 'PULL IT' },
  ],
  time: 75,
  seeRange: 7,
  texts: { money: 35000, won: 'Out before the lockdown.', wonLine: 'Three breakers down, two drives in your pocket, and a server room full of very confused lights.', lost: 'The lockdown doors sealed.', caught: 'Security walks you to the lobby. Slowly.' },
}

// Campus at night, on foot (Sort or Carryover): the same grounds and cover as Back Gate.
MISSIONS.hostelDash = {
  id: 'hostelDash',
  world: 'royalCrest',
  start: { x: -30, z: -27, facing: 0 },
  exit: { x: -36, z: 28 },
  exitRadius: 2.5,
  exitLabel: 'YOUR HOSTEL',
  cover: COVER,
  routes: ROUTES,
  goal: 'reach', // just get there
  time: 100,
  texts: { money: 8000, won: 'In your bed before roll call.', wonLine: 'From the syndicate meet-up to your bunk, and security never saw your face.', lost: 'Lights on in the hostel: you are not in your bed.', caught: 'Security takes your ID card.' },
}
MISSIONS.paperRelay = {
  id: 'paperRelay',
  world: 'royalCrest',
  start: { x: 6, z: -12, facing: 0 },
  exit: { x: 0, z: -27 },
  exitRadius: 3,
  exitLabel: 'THE SENATE',
  cover: COVER,
  routes: [ROUTES[4], ROUTES[2], ROUTES[1], ROUTES[5], ROUTES[0], ROUTES[3]],
  minGuards: 3,
  extraGuards: 2,
  goal: 'loot',
  loot: [
    { x: 32, z: -27, label: 'DROP: THE LIBRARY', verb: 'DROP IT', weight: 0 },
    { x: 50, z: 27, label: 'DROP: THE CHAPEL', verb: 'DROP IT', weight: 0 },
    { x: -28, z: 14, label: 'DROP: THE FIELD', verb: 'DROP IT', weight: 0 },
  ],
  time: 150,
  seeRange: 9,
  texts: { money: 12000, won: 'Every packet delivered.', wonLine: 'Three sealed envelopes where they needed to be, and you at the senate building before the exam bell.', lost: 'The exam bell rang.', caught: 'Security found the packets on you.' },
}

// Lekki at night: Pearl Estate. In past the gate (its guard post and camera),
// security on foot round the streets, and drones overhead lighting circles on
// the ground. Tear the night's page out of the gate log, plant a tracker on the
// Chairman's SUV, and out to the keke waiting on the expressway.
MISSIONS.droneDodge = {
  id: 'droneDodge',
  world: 'lekki',
  start: { x: -34, z: -6, facing: 90 },
  exit: { x: 34, z: -6 },
  exitRadius: 2.5,
  exitLabel: 'THE KEKE',
  cover: [
    ['shippingContainerB', 12, -26, 0], // a builder's container on the cross street
    ['dumpster', -8, -20, 90],
    ['dumpster', 28, -31, 0],
    ['crates', 4, -34, 0],
  ],
  routes: [
    { camera: [3.5, -11.2], face: -160, sweep: 45 },
    { drone: [[-40, -20], [-10, -33], [-40, -34]], speed: 3.2, radius: 3.4 },
    [[1.5, -14], [1.5, -40]],
    { drone: [[40, -20], [12, -30], [40, -38], [20, -14]], speed: 3.6, radius: 3.4 },
    [[-44, -26], [44, -26]],
    [[-8, -13], [12, -13]],
    { drone: [[-22, -20], [22, -20], [22, -33], [-22, -33]], speed: 2.8, radius: 3.6 },
    [[30, -34], [44, -34], [44, -21]],
  ],
  minGuards: 5,
  extraGuards: 3,
  goal: 'loot',
  loot: [
    { x: 6.5, z: -16.2, label: 'THE GATE LOG', verb: 'TEAR IT OUT', work: 1.5, weight: 0 },
    { x: -26.6, z: -27.5, label: "THE CHAIRMAN'S SUV", verb: 'PLANT THE TRACKER', work: 2.5, weight: 0 },
  ],
  time: 210,
  seeRange: 9,
  texts: { money: 30000, won: 'Out to the keke.', wonLine: "The gate log has a page missing and the Chairman's SUV has a new passenger that blinks.", lost: 'The estate locks down at five.', caught: 'Estate security, and then the police, and then a long night.' },
}

export const missionOf = (id) => MISSIONS[id] || MISSIONS.backGate
/** A mission's loot as a list (one thing or several). */
export const lootOf = (cfg) => (cfg.loot ? (Array.isArray(cfg.loot) ? cfg.loot : [cfg.loot]) : [])

export const coverBoxes = (cover = COVER) =>
  cover.map(([model, x, z, rot]) => {
    const s = getAsset(model)?.size || [2, 2, 2]
    return { x, z, hw: s[0] / 2, hd: s[2] / 2, angle: rot * DEG, model }
  })

function insideBox(c, x, z, pad) {
  const dx = x - c.x
  const dz = z - c.z
  const ca = Math.cos(-c.angle)
  const sa = Math.sin(-c.angle)
  const lx = dx * ca - dz * sa
  const lz = dx * sa + dz * ca
  return Math.abs(lx) < c.hw + pad && Math.abs(lz) < c.hd + pad
}

/**
 * The walk grid: 1 = blocked for walking, 2 = also blocks sight. Cells are
 * 1 m outdoors; inside a building 0.5 m (cell), with a slimmer margin, so
 * guards fit through doorways.
 */
export function buildGrid(bounds, boxes, cell = 1, margin = 0.6) {
  const x0 = bounds.minX
  const z0 = bounds.minZ
  const w = Math.round((bounds.maxX - bounds.minX) / cell) + 1
  const h = Math.round((bounds.maxZ - bounds.minZ) / cell) + 1
  const cells = new Uint8Array(w * h)
  for (const c of boxes) {
    const r = Math.ceil((Math.hypot(c.hw, c.hd) + 2) / cell)
    const gx0 = Math.round((c.x - x0) / cell)
    const gz0 = Math.round((c.z - z0) / cell)
    for (let gz = gz0 - r; gz <= gz0 + r; gz++)
      for (let gx = gx0 - r; gx <= gx0 + r; gx++) {
        if (gx < 0 || gz < 0 || gx >= w || gz >= h) continue
        const x = gx * cell + x0
        const z = gz * cell + z0
        if (insideBox(c, x, z, 0.05 + cell * 0.05)) cells[gz * w + gx] = 2
        else if (!cells[gz * w + gx] && insideBox(c, x, z, margin)) cells[gz * w + gx] = 1
      }
  }
  return { x0, z0, w, h, cells, cell }
}

const cellOf = (g, x, z) => [Math.round((x - g.x0) / g.cell), Math.round((z - g.z0) / g.cell)]
const snap = (g, v) => Math.round(v / g.cell) * g.cell
export function walkable(g, x, z) {
  const [cx, cz] = cellOf(g, x, z)
  return cx >= 0 && cz >= 0 && cx < g.w && cz < g.h && g.cells[cz * g.w + cx] === 0
}

/** Can someone at a see b? (No wall or container in between.) */
export function lineOfSight(g, ax, az, bx, bz) {
  const d = Math.hypot(bx - ax, bz - az)
  const n = Math.ceil(d / (g.cell / 2))
  for (let i = 1; i < n; i++) {
    const [cx, cz] = cellOf(g, ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n)
    if (cx < 0 || cz < 0 || cx >= g.w || cz >= g.h) return false
    if (g.cells[cz * g.w + cx] === 2) return false
  }
  return true
}

function nearestFree(g, x, z) {
  const sx = snap(g, x - g.x0) + g.x0
  const sz = snap(g, z - g.z0) + g.z0
  if (walkable(g, sx, sz)) return [sx, sz]
  for (let r = 1; r < 6 / g.cell; r++)
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) if (walkable(g, sx + dx * g.cell, sz + dz * g.cell)) return [sx + dx * g.cell, sz + dz * g.cell]
  return null
}

/** A* on the grid, 8 directions, no cutting corners. Returns [[x, z], ...] (world metres) or null. */
export function findPath(g, from, to, maxNodes = 6000) {
  const a = nearestFree(g, from[0], from[1])
  const b = nearestFree(g, to[0], to[1])
  if (!a || !b) return null
  const [sx, sz] = cellOf(g, a[0], a[1])
  const [tx, tz] = cellOf(g, b[0], b[1])
  const key = (x, z) => z * g.w + x
  const open = [[sx, sz]]
  const cost = new Map([[key(sx, sz), 0]])
  const from_ = new Map()
  const est = (x, z) => Math.hypot(tx - x, tz - z)
  const f = new Map([[key(sx, sz), est(sx, sz)]])
  let seen = 0
  while (open.length && seen++ < maxNodes) {
    let bi = 0
    for (let i = 1; i < open.length; i++) if (f.get(key(...open[i])) < f.get(key(...open[bi]))) bi = i
    const [cx, cz] = open.splice(bi, 1)[0]
    if (cx === tx && cz === tz) {
      const out = []
      let k = key(cx, cz)
      while (k !== undefined) {
        out.push([(k % g.w) * g.cell + g.x0, Math.floor(k / g.w) * g.cell + g.z0])
        k = from_.get(k)
      }
      return out.reverse()
    }
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue
        const nx = cx + dx
        const nz = cz + dz
        if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h || g.cells[key(nx, nz)]) continue
        if (dx && dz && (g.cells[key(cx + dx, cz)] || g.cells[key(cx, cz + dz)])) continue
        const c = cost.get(key(cx, cz)) + (dx && dz ? 1.414 : 1)
        const k = key(nx, nz)
        if (c < (cost.get(k) ?? Infinity)) {
          cost.set(k, c)
          f.set(k, c + est(nx, nz))
          from_.set(k, key(cx, cz))
          if (!open.some(([ox, oz]) => ox === nx && oz === nz)) open.push([nx, nz])
        }
      }
  }
  return null
}

/** Shorten a grid path to the corners you can walk straight between. */
function smooth(g, path) {
  if (!path || path.length < 3) return path
  const out = [path[0]]
  let i = 0
  while (i < path.length - 1) {
    let j = path.length - 1
    while (j > i + 1 && !clearWalk(g, path[i], path[j])) j--
    out.push(path[j])
    i = j
  }
  return out
}
function clearWalk(g, a, b) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1])
  const n = Math.ceil(d / (g.cell / 2))
  for (let i = 1; i < n; i++) if (!walkable(g, a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n)) return false
  return true
}

/**
 * A new night. params.difficulty / params.level (0..1) sets how many guards (4 to 6).
 * layout: the campus layout (colliders, bounds) from worlds.js.
 */
export function createMission(layout, params = {}, seed = 1, missionId = 'backGate') {
  const cfg = missionOf(missionId)
  const r = rng(seed)
  const level = Math.max(0, Math.min(1, params.level ?? (params.difficulty != null ? (params.difficulty - 1) / 2 : 0.4)))
  const cover = coverBoxes(cfg.cover)
  // inside a building: a finer grid, so guards (and paths) fit through doorways
  const grid = layout.raw?.interior ? buildGrid(layout.bounds, [...layout.colliders, ...cover], 0.5, 0.3) : buildGrid(layout.bounds, [...layout.colliders, ...cover])
  // cameras always; the people on foot: 4 to 6 as it gets harder (or the mission's own count)
  const count = Math.min(cfg.routes.length, (cfg.minGuards ?? 4) + Math.round(level * (cfg.extraGuards ?? 2)))
  const guards = cfg.routes.slice(0, count).map((route, i) => {
    // a security drone: flies its loop over everything, lighting a circle on the ground under it
    if (route.drone) {
      const pts = route.drone
      return { id: i, fixed: true, drone: true, speed: route.speed ?? 3, radius: route.radius ?? 3.2, wait: 0, home: pts, legs: pts.map((p) => [p]), leg: 1 % pts.length, x: pts[0][0], z: pts[0][1], ry: 0, state: 'patrol', spot: 0, path: null, lastSeen: null, lostT: 0, lookT: 0, repath: 0, cash: 0, said: null, saidT: 0, cool: 0, trackT: 0 }
    }
    // a CCTV camera: fixed, sweeping its view to and fro; it can't chase or be taken down, it raises the alarm
    if (route.camera) {
      const [cx, cz] = route.camera
      const face = (route.face * Math.PI) / 180
      return { id: i, fixed: true, face, sweep: ((route.sweep ?? 40) * Math.PI) / 180, wait: 0, home: [[cx, cz]], legs: [[[cx, cz]]], leg: 0, x: cx, z: cz, ry: face, state: 'patrol', spot: 0, path: null, lastSeen: null, lostT: 0, lookT: 0, repath: 0, cash: 0, said: null, saidT: 0, cool: 0 }
    }
    const pts = route.map(([x, z]) => nearestFree(grid, x, z))
    // the walk between each point and the next, round the loop
    const legs = pts.map((p, k) => smooth(grid, findPath(grid, p, pts[(k + 1) % pts.length])) || [p])
    // a raid: they come in one after another (arrive: seconds apart)
    return { id: i, wait: cfg.arrive ? (cfg.firstAt || 0) + cfg.arrive * i : 0, home: pts, legs, leg: 0, step: 1, x: pts[0][0], z: pts[0][1], ry: 0, state: 'patrol', spot: 0, path: null, lastSeen: null, lostT: 0, lookT: 0, look: 0, repath: 0, cash: 300 + Math.round((r() * 500) / 50) * 50, said: null, saidT: 0 }
  })
  return {
    id: cfg.id,
    cfg,
    level,
    hasLoot: false, // all of it in hand
    loot: lootOf(cfg).map((l) => ({ ...l, taken: false })),
    carried: 0,
    canGrab: false, // standing at a thing to take (its index), or false
    spotted: false, // seen at any point (Steal Untouched: then it isn't untouched)
    spotMul: params.spotMul ?? 1,
    grid,
    cover,
    guards,
    time: cfg.time + (params.extraTime || 0),
    tries: params.tries ?? 3,
    startTries: params.tries ?? 3,
    cash: 0,
    takedowns: 0,
    open: cfg.goal === 'reach', // the way out (all guards asleep, the loot in hand, or just there)
    over: false,
    won: false,
    caughtT: 0, // seconds since you were caught (the screen flashes)
    events: [], // for sounds and lines: { type: 'spotted'|'caught'|'down'|'open'|'heard', id }
    canTakedown: null,
  }
}

const faceTo = (g, x, z) => Math.atan2(x - g.x, z - g.z)
function turn(g, want, dt, rate = 5) {
  let d = want - g.ry
  d = Math.atan2(Math.sin(d), Math.cos(d))
  g.ry += d * Math.min(1, dt * rate)
}

/** Walk a guard along `path` (world points); true when it gets to the end. */
function walk(g, path, speed, dt) {
  if (!path?.length) return true
  let left = speed * dt
  while (left > 0 && path.length) {
    const [tx, tz] = path[0]
    const d = Math.hypot(tx - g.x, tz - g.z)
    if (d < 0.05) {
      path.shift()
      continue
    }
    turn(g, faceTo(g, tx, tz), dt, 8)
    const k = Math.min(1, left / d)
    g.x += (tx - g.x) * k
    g.z += (tz - g.z) * k
    if (k < 1) break // used up this frame's walk (no tiny leftovers going round forever)
    left -= d
    path.shift()
  }
  return !path.length
}

/** Is the point inside this guard's torch beam, with nothing in the way? */
export function sees(m, g, x, z, range) {
  range ??= SEE_RANGE
  const d = Math.hypot(x - g.x, z - g.z)
  if (d > range) return false
  if (d > 0.8) {
    let a = Math.atan2(x - g.x, z - g.z) - g.ry
    a = Math.atan2(Math.sin(a), Math.cos(a))
    if (Math.abs(a) > SEE_HALF) return false
  }
  return lineOfSight(m.grid, g.x, g.z, x, z)
}

function say(g, text) {
  g.said = text
  g.saidT = 2.2
}

function backToRoute(m, g) {
  g.state = 'return'
  const p = g.home[g.leg]
  g.path = smooth(m.grid, findPath(m.grid, [g.x, g.z], p)) || [p]
}

/**
 * One frame. player: { x, z, running, moving }.
 * Returns the mission (changed in place); m.events lists what happened this frame.
 */
export function stepMission(m, dt, player) {
  m.events = []
  if (m.over) return m
  m.time -= dt
  if (m.caughtT > 0) m.caughtT -= dt
  if (m.time <= 0) {
    m.time = 0
    m.over = true
    m.events.push({ type: 'dawn' })
    return m
  }
  let best = null
  let bestD = TAKEDOWN
  for (const g of m.guards) {
    if (g.state === 'down') continue
    if (g.wait > 0) {
      // not through the door yet
      g.wait -= dt
      if (g.wait <= 0) {
        say(g, 'EFCC! Nobody move!')
        m.events.push({ type: 'arrive', id: g.id })
      }
      continue
    }
    if (g.saidT > 0) g.saidT -= dt
    if (g.drone) {
      stepDrone(m, g, dt, player)
      continue
    }
    const d = Math.hypot(player.x - g.x, player.z - g.z)
    const inBeam = sees(m, g, player.x, player.z, m.cfg.seeRange)
    if (g.fixed) {
      stepCamera(m, g, dt, inBeam, d, player)
      continue
    }
    // the exam hall: walking inside an invigilator's sightline is the end
    if (m.cfg.instantFail && inBeam && player.moving) {
      say(g, 'You! Bring that paper!')
      m.spotted = true
      m.failed = 'seen'
      m.over = true
      m.events.push({ type: 'spotted', id: g.id }, { type: 'caught' })
      return m
    }
    // being seen: the ? fills, faster up close and when you run; crouched and still is hardest to see
    if (inBeam && g.state !== 'chase') {
      const near = 1 - d / SEE_RANGE
      g.spot += dt * (0.7 + near * 2.2) * (player.running ? 1.6 : player.moving ? 1 : 0.55) * m.spotMul
      if (g.state === 'patrol' || g.state === 'return') {
        g.state = 'alert'
        g.lookT = 0
      }
      g.lastSeen = [player.x, player.z]
    } else if (g.state !== 'chase') g.spot = Math.max(0, g.spot - dt * 0.35)
    if (g.spot >= 1 && g.state !== 'chase') {
      g.state = 'chase'
      g.spot = 1
      g.lostT = 0
      g.repath = 0
      say(g, 'Hey! Stop there!')
      m.spotted = true
      m.events.push({ type: 'spotted', id: g.id })
    }
    // running close by is heard: he turns to look
    if (!inBeam && player.running && d < HEAR_RUN && (g.state === 'patrol' || g.state === 'return')) {
      g.state = 'alert'
      g.lookT = 0
      g.lastSeen = [player.x, player.z]
      say(g, 'Who is there?')
      m.events.push({ type: 'heard', id: g.id })
    }
    // a sleeping colleague in the beam: he goes to look
    if (g.state === 'patrol')
      for (const o of m.guards)
        if (o.state === 'down' && !o.found && sees(m, g, o.x, o.z, 7)) {
          o.found = true
          g.state = 'search'
          g.spot = Math.max(g.spot, 0.4)
          g.lastSeen = [o.x, o.z]
          g.path = smooth(m.grid, findPath(m.grid, [g.x, g.z], [o.x, o.z])) || []
          g.lookT = 0
          say(g, 'Ah! Who did this?')
          m.events.push({ type: 'body', id: g.id })
        }

    switch (g.state) {
      case 'patrol': {
        if (!g.path?.length) {
          g.path = g.legs[g.leg].slice(1)
          if (!g.path.length) g.path = [g.home[(g.leg + 1) % g.home.length]]
        }
        if (walk(g, g.path, PATROL_SPEED, dt)) {
          g.leg = (g.leg + 1) % g.legs.length
          g.path = null
          g.lookT = 1.2 // a look round at each corner
          g.state = 'pause'
        }
        break
      }
      case 'pause':
        g.lookT -= dt
        turn(g, g.ry + Math.sin(g.lookT * 3) * 0.6, dt, 2)
        if (g.lookT <= 0) g.state = 'patrol'
        break
      case 'alert':
        // stops, faces what he saw or heard; if nothing more, carries on
        turn(g, faceTo(g, g.lastSeen[0], g.lastSeen[1]), dt, 4)
        g.lookT += dt
        if (!inBeam && g.lookT > 2.2) backToRoute(m, g)
        break
      case 'chase': {
        if (inBeam || (d < 2.5 && lineOfSight(m.grid, g.x, g.z, player.x, player.z))) {
          g.lostT = 0
          g.lastSeen = [player.x, player.z]
        } else g.lostT += dt
        g.repath -= dt
        if (g.repath <= 0 || !g.path?.length) {
          g.repath = 0.5
          g.path = smooth(m.grid, findPath(m.grid, [g.x, g.z], g.lastSeen, 3000)) || []
        }
        walk(g, g.path, CHASE_SPEED, dt)
        if (d < CATCH) {
          caught(m)
          return m
        }
        if (g.lostT > LOSE_SIGHT) {
          g.state = 'search'
          g.spot = 0.5
          g.path = smooth(m.grid, findPath(m.grid, [g.x, g.z], g.lastSeen)) || []
          g.lookT = 0
          say(g, 'Where did he go?')
          m.events.push({ type: 'lost', id: g.id })
        }
        break
      }
      case 'search':
        if (walk(g, g.path, PATROL_SPEED * 1.6, dt)) {
          g.lookT += dt
          turn(g, g.ry + 2.2 * dt * 3, dt, 3)
          if (g.lookT > 3) backToRoute(m, g)
        }
        break
      case 'return':
        if (walk(g, g.path, PATROL_SPEED, dt)) {
          g.state = 'patrol'
          g.path = null
        }
        break
      default:
    }
    // close enough, and he isn't after you: a takedown
    if (!g.fixed && g.state !== 'chase' && d < bestD && !(inBeam && g.spot > 0.6)) {
      best = g.id
      bestD = d
    }
  }
  m.canTakedown = best
  // the loot: close enough to take it
  const near = m.loot.findIndex((l) => !l.taken && Math.hypot(player.x - l.x, player.z - l.z) < 1.8)
  m.canGrab = near >= 0 && !m.working ? near : false
  // working at something (a safe, a switch): stand still beside it until it's done
  if (m.working) {
    const w = m.working
    const item = m.loot[w.index]
    if (player.moving || Math.hypot(player.x - item.x, player.z - item.z) > 2) {
      m.working = null
      m.events.push({ type: 'workStopped', label: item.label })
    } else {
      w.t += dt
      if (w.t >= item.work) {
        m.working = null
        take(m, w.index)
      }
    }
  }
  const exit = m.cfg.exit
  if (m.open && Math.hypot(player.x - exit.x, player.z - exit.z) < (m.cfg.exitRadius || GATE_RADIUS)) {
    m.over = true
    m.won = true
    m.events.push({ type: 'escaped' })
  }
  return m
}

function caught(m) {
  m.tries--
  m.caughtT = 1.5
  m.events.push({ type: 'caught' })
  if (m.tries <= 0) {
    m.over = true
    return
  }
  // back to the hostel door; the ones still awake go back to their rounds
  for (const g of m.guards) {
    if (g.state === 'down' || g.wait > 0) continue
    g.x = g.home[0][0]
    g.z = g.home[0][1]
    g.leg = 0
    g.path = null
    g.state = 'patrol'
    g.spot = 0
    g.trackT = 0
  }
  m.events.push({ type: 'reset' })
}

/** Put the guard next to you to sleep (m.canTakedown). */
export function takedown(m) {
  const g = m.guards.find((x) => x.id === m.canTakedown)
  if (!g || m.over) return null
  g.state = 'down'
  g.spot = 0
  g.said = null
  m.takedowns++
  m.cash += g.cash
  m.canTakedown = null
  m.events.push({ type: 'down', id: g.id })
  if (m.cfg.goal === 'takedowns' && m.guards.every((x) => x.state === 'down') && !m.open) {
    m.open = true
    m.events.push({ type: 'open' })
  }
  return g
}

/** Take the loot (m.canGrab): now get out. */
export function grabLoot(m) {
  if (m.canGrab === false || m.over) return false
  const item = m.loot[m.canGrab]
  if (!item || item.taken) return false
  // some things take time (cracking a safe, flipping a breaker): stand still till it's done
  if (item.work) {
    m.working = { index: m.canGrab, t: 0 }
    m.canGrab = false
    m.events.push({ type: 'workStarted', label: item.label })
    return true
  }
  take(m, m.canGrab)
  return true
}

function take(m, index) {
  const item = m.loot[index]
  item.taken = true
  m.carried += item.weight ?? 1
  m.canGrab = false
  m.events.push({ type: 'loot', label: item.label })
  if (m.loot.every((l) => l.taken)) {
    m.hasLoot = true
    m.open = true
    m.events.push({ type: 'open' })
  }
}

/** A CCTV camera: sweeps; if it fills its ?, the alarm sends the guards to where you were. */
function stepCamera(m, g, dt, inBeam, d, player) {
  g.ry = g.face + Math.sin(m.cfg.time - m.time) * g.sweep * 0.9
  if (g.cool > 0) {
    g.cool -= dt
    return
  }
  if (inBeam) {
    g.spot += dt * (0.9 + (1 - d / (m.cfg.seeRange || SEE_RANGE)) * 1.8) * (player.moving ? 1 : 0.5) * m.spotMul
    g.lastSeen = [player.x, player.z]
  } else g.spot = Math.max(0, g.spot - dt * 0.4)
  if (g.spot >= 1) {
    g.spot = 0
    g.cool = 5 // it rings, then watches again
    raiseAlarm(m, g, player, 'ALARM!')
  }
}

/** A camera or a drone has you: everyone on foot comes to look where you were. */
function raiseAlarm(m, g, player, line) {
  m.spotted = true
  say(g, line)
  m.events.push({ type: 'alarm', id: g.id })
  for (const o of m.guards) {
    if (o.fixed || o.state === 'down' || o.wait > 0 || o.state === 'chase') continue
    o.state = 'search'
    o.spot = Math.max(o.spot, 0.5)
    o.lastSeen = [player.x, player.z]
    o.path = smooth(m.grid, findPath(m.grid, [o.x, o.z], o.lastSeen)) || []
    o.lookT = 0
  }
}

export const DRONE_TRACK = 4 // seconds a drone follows you after it has marked you

/**
 * A security drone: flies its loop (walls don't stop it), its light a circle
 * on the ground. Stand in the light and its ? fills (slower if you keep still);
 * full, it marks you: the alarm, and it follows you for a few seconds.
 */
function stepDrone(m, g, dt, player) {
  const tracking = g.trackT > 0
  if (tracking) g.trackT -= dt
  const [tx, tz] = tracking ? [player.x, player.z] : g.home[g.leg]
  const d = Math.hypot(tx - g.x, tz - g.z)
  if (!tracking && d < 0.3) g.leg = (g.leg + 1) % g.home.length
  else if (d > 0.01) {
    const k = Math.min(1, (g.speed * (tracking ? 0.85 : 1) * dt) / d)
    g.x += (tx - g.x) * k
    g.z += (tz - g.z) * k
    g.ry = Math.atan2(tx - g.x, tz - g.z)
  }
  if (g.cool > 0) {
    g.cool -= dt
    return
  }
  const pd = Math.hypot(player.x - g.x, player.z - g.z)
  if (pd < g.radius) {
    g.spot += dt * (1.1 + (1 - pd / g.radius) * 1.6) * (player.running ? 1.3 : player.moving ? 1 : 0.45) * m.spotMul
    g.lastSeen = [player.x, player.z]
  } else g.spot = Math.max(0, g.spot - dt * 0.5)
  if (g.spot >= 1) {
    g.spot = 0
    g.cool = 6
    g.trackT = DRONE_TRACK
    raiseAlarm(m, g, player, 'TARGET MARKED')
  }
}

/** How fast you move carrying what you've taken (1 = free hands; heavy things count more). */
export const carrySpeed = (m) => Math.max(0.45, 1 - CARRY_SLOW * (m?.carried || 0))

export function missionResult(m) {
  const tx = m.cfg.texts
  if (tx) {
    const got = m.loot.filter((l) => l.taken).length
    return {
      outcome: m.won ? 'won' : 'lost',
      score: got * 100 + m.takedowns * 30 + (m.won ? 300 + Math.round(m.time) * 2 + (m.spotted ? 0 : 200) : 0),
      moneyChange: m.won ? tx.money : 0,
      headline: m.won ? tx.won : m.failed || m.tries <= 0 ? tx.caught : tx.lost,
      line: m.won ? `${tx.wonLine}${m.spotted ? '' : ' Nobody saw a thing.'}` : `${got} of ${m.loot.length} done when it ended.`,
    }
  }
  if (m.id === 'raidEscape') {
    const got = m.loot.filter((l) => l.taken).length
    return {
      outcome: m.won ? 'won' : 'lost',
      score: got * 100 + m.takedowns * 30 + (m.won ? 300 + Math.round(m.time) * 2 : 0),
      moneyChange: m.won ? 50000 : 0,
      headline: m.won ? 'Escaped the EFCC raid.' : m.tries <= 0 ? 'Cuffed on your own rug.' : 'They sealed the house.',
      line: m.won
        ? `Out through the back with the hard drive, the laptop and ₦50 million in a Ghana-must-go bag, ${Math.round(m.time)} seconds before they sealed the house.`
        : `${got} of ${m.loot.length} things in your hands when it ended. Tomorrow's papers will spell your name wrong.`,
    }
  }
  if (m.cfg.goal === 'loot') {
    const untouched = m.won && !m.spotted && m.tries === (m.startTries ?? m.tries)
    return {
      outcome: m.won ? 'won' : 'lost',
      untouched,
      score: m.takedowns * 20 + (m.won ? 200 : 0) + (untouched ? 400 : 0),
      moneyChange: m.cash + (m.won ? 3000 : 0),
      respectMul: untouched ? 3 : 1,
      headline: !m.won ? (m.tries <= 0 ? 'They caught you inside their compound.' : 'First light. The sentries change shift.') : untouched ? 'Stolen untouched.' : 'You got the regalia, but they saw you.',
      line: !m.won
        ? `${m.takedowns} sentries down, and the regalia still on the altar.`
        : untouched
          ? 'Nobody saw you come, nobody saw you go. By morning the whole creek is talking. Respect ×3.'
          : 'The regalia is yours. So is a rival confraternity that knows your face.',
    }
  }
  return {
    outcome: m.won ? 'won' : 'lost',
    score: m.takedowns * 30 + Math.round(m.cash / 20) + (m.won ? 100 + m.tries * 30 : 0),
    moneyChange: m.cash,
    headline: m.won ? 'Out of the back gate. The night is yours.' : m.tries <= 0 ? 'The porter locks the hostel door.' : 'Dawn. The cleaners are coming out.',
    line: m.won ? `${m.takedowns} guards sleeping till morning, ₦${m.cash.toLocaleString('en-NG')} back from them. (Tomorrow you will say you slept early.)` : `${m.takedowns} guards down before the night ran out. Back to bed.`,
  }
}
