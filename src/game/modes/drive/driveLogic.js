// Danfo driving (pure rules, no three.js). An arcade "taxi simulator" on a
// Lagos expressway: the bus drives towards +d (distance in metres).
//
// Road (x across, metres): three lanes at x = -3.4, 0, 3.4 and a shoulder at
// x = 6.6 where bus stops, filling stations and checkpoints are.
//
// Each step: input = { steer -1..1, gas 0..1, brake 0..1, horn }
//   - speed, fuel, damage, lateral position
//   - traffic moves; the horn makes cars ahead change lane (Lagos rules)
//   - stop on the shoulder at a bus stop: drop off / pick up, collect fares
//   - stop at a filling station: the UI offers fuel (buyFuel)
//   - stop at a checkpoint: the UI offers bribe / talk / floor it
//     (checkpointChoice); driving through starts a police chase
//   - police chase: escape by distance, or get caught
// Outcomes: done | caught | outOfFuel | wrecked | abandoned | roadRage
// Events this step are in d.events: [{ type, ... }]

export const LANES = [-3.4, 0, 3.4]
export const SHOULDER = 6.6
export const ROAD_MIN = -5.2
export const ROAD_MAX = 7.6
export const BUS = { length: 5.7, width: 2.3, capacity: 14 }
export const MAX_SPEED = 22 // m/s (~80 km/h)
const FUEL_PER_KM = 9 // % of the tank per km at full throttle
const FUEL_PRICE = 120 // ₦ per % of tank

export const kmh = (ms) => Math.round(ms * 3.6)

export function mulberry(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const STOP_NAMES = ['Iyana-Wahala', 'Under-Bridge', 'Oshodi', 'Ikeja Along', 'Ojota', 'Mile 12', 'Ketu', 'Maryland', 'Anthony', 'Obalende']
const CAR_KINDS = ['privateCar', 'taxi', 'danfo', 'privateCar', 'lorry', 'okada', 'keke', 'bigManSuv', 'taxi', 'boxTruck']
const CAR_SIZE = { privateCar: [2.0, 4.2], taxi: [2.0, 4.4], danfo: [2.3, 5.7], lorry: [2.4, 4.7], okada: [0.8, 1.9], keke: [1.3, 2.6], bigManSuv: [2.2, 4.6], boxTruck: [2.4, 5.2], taskForceVan: [2.3, 5.0] }
export const carSize = (kind) => CAR_SIZE[kind] || [2.0, 4.4]

/**
 * options: { seed, length (m), stops, fuel (0-100), police (true), checkpoints, difficulty, startFare }
 */
export function createDrive({ seed = 1, length = 2400, stops = 5, fuel = 55, police = true, checkpoints = 1, difficulty = 1, fare = 300 } = {}) {
  const rng = mulberry(seed)
  const places = []
  // bus stops spread along the route, the last one at the end
  for (let i = 0; i < stops; i++) places.push({ type: 'stop', d: Math.round(((i + 1) / stops) * (length - 120)), name: STOP_NAMES[(i + 1) % STOP_NAMES.length], waiting: 2 + Math.floor(rng() * 5), served: false })
  places.push({ type: 'fuel', d: Math.round(length * (0.28 + rng() * 0.12)), used: false })
  if (length > 1800) places.push({ type: 'fuel', d: Math.round(length * (0.68 + rng() * 0.08)), used: false })
  if (police) for (let i = 0; i < checkpoints; i++) places.push({ type: 'checkpoint', d: Math.round(length * (0.45 + i * 0.25 + rng() * 0.08)), state: 'ahead', bribe: 1000 + Math.round(rng() * 4) * 500 })
  // keep places apart
  places.sort((a, b) => a.d - b.d)
  for (let i = 1; i < places.length; i++) if (places[i].d - places[i - 1].d < 90) places[i].d = places[i - 1].d + 90
  return {
    rng,
    seed,
    length,
    fare,
    difficulty,
    d: 0,
    x: LANES[1],
    speed: 0,
    fuel,
    damage: 0,
    passengers: [], // { dest: index of a stop place }
    fares: 0,
    spent: 0, // fuel + bribes
    bribes: 0,
    crashes: 0,
    places,
    cars: [],
    nextCarId: 1,
    spawnTimer: 0,
    chase: null, // { gap, escapeAt }
    chases: 0,
    escaped: 0,
    halted: null, // place the bus is stopped at (for the UI)
    boardTimer: 0,
    hornCooldown: 0,
    time: 0,
    events: [],
    over: null,
  }
}

const lanesFree = (d, x, dz, cars, except) => !cars.some((c) => c !== except && Math.abs(c.x - x) < 2.2 && Math.abs(c.d - dz) < 9)

function spawnCar(d) {
  const r = d.rng
  const kind = CAR_KINDS[Math.floor(r() * CAR_KINDS.length)]
  const lane = Math.floor(r() * LANES.length)
  const ahead = r() < 0.8
  const dz = d.d + (ahead ? 70 + r() * 60 : -45)
  const speed = (kind === 'lorry' || kind === 'boxTruck' ? 9 : kind === 'keke' ? 8 : kind === 'okada' ? 14 : 11) + r() * 5
  if (!lanesFree(d, LANES[lane], dz, d.cars)) return
  d.cars.push({ id: d.nextCarId++, kind, x: LANES[lane], targetX: LANES[lane], d: dz, speed: ahead ? speed : speed + 8, w: carSize(kind)[0], l: carSize(kind)[1], honked: 0 })
}

/** The place the bus is inside (by distance), if any. */
export function placeAt(d) {
  return d.places.find((p) => Math.abs(d.d - p.d) < (p.type === 'checkpoint' ? 14 : 18)) || null
}

/** Places ahead, nearest first (for the HUD). */
export function upcoming(d, n = 3) {
  return d.places.filter((p) => p.d > d.d - 5 && !(p.type === 'stop' && p.served)).slice(0, n)
}

export function stepDrive(d, input, dt) {
  d.events = []
  if (d.over) return d
  d.time += dt
  const gas = input.gas || 0
  const brake = input.brake || 0

  // ---- engine and fuel ----
  const engineOn = d.fuel > 0
  const top = MAX_SPEED * (1 - d.damage / 220)
  let accel = engineOn ? gas * 4.2 * (1 - d.speed / top) : 0
  accel -= brake * 9 + 0.35 + d.speed * 0.012 // brakes, rolling resistance, air
  d.speed = Math.max(0, Math.min(top, d.speed + accel * dt))
  const moved = d.speed * dt
  d.d += moved
  d.fuel = Math.max(0, d.fuel - (moved / 1000) * FUEL_PER_KM * (0.35 + gas * 0.75))
  if (d.fuel === 0 && d.speed < 0.2 && d.halted?.type !== 'fuel') {
    d.over = 'outOfFuel'
    return d
  }

  // ---- steering (only while moving, like a real vehicle) ----
  const grip = Math.min(1, d.speed / 4)
  d.x = Math.max(ROAD_MIN + BUS.width / 2, Math.min(ROAD_MAX - BUS.width / 2, d.x + (input.steer || 0) * 5.5 * grip * dt))

  // ---- traffic ----
  d.spawnTimer -= dt
  const want = 7 + d.difficulty * 2
  if (d.spawnTimer <= 0 && d.cars.length < want) {
    spawnCar(d)
    d.spawnTimer = 0.7 + d.rng() * 1.4
  }
  d.hornCooldown = Math.max(0, d.hornCooldown - dt)
  const honk = input.horn && d.hornCooldown === 0
  if (honk) {
    d.hornCooldown = 0.6
    d.events.push({ type: 'horn' })
  }
  for (const c of d.cars) {
    // slow down behind whatever is in front (including the bus)
    let limit = c.speed
    const blockers = [...d.cars.filter((o) => o !== c), { x: d.x, d: d.d, speed: d.speed, l: BUS.length }]
    for (const o of blockers) {
      const gap = o.d - c.d - (o.l + c.l) / 2
      if (Math.abs(o.x - c.x) < 2 && gap > 0 && gap < 10) limit = Math.min(limit, o.speed * (gap / 10))
    }
    // the horn: cars just ahead of the bus move over if they can
    if (honk && Math.abs(c.x - d.x) < 2 && c.d > d.d && c.d - d.d < 30) {
      const options = LANES.filter((lx) => Math.abs(lx - c.x) > 1 && lanesFree(d, lx, c.d, d.cars, c))
      if (options.length) {
        c.targetX = options[Math.floor(d.rng() * options.length)]
        c.honked = 1
      }
    }
    c.x += Math.sign(c.targetX - c.x) * Math.min(Math.abs(c.targetX - c.x), 3 * dt)
    c.d += Math.max(0, limit) * dt
  }
  d.cars = d.cars.filter((c) => c.d > d.d - 70 && c.d < d.d + 180)

  // ---- collisions ----
  for (const c of d.cars) {
    const overlapX = Math.abs(c.x - d.x) < (c.w + BUS.width) / 2 - 0.15
    const overlapZ = Math.abs(c.d - d.d) < (c.l + BUS.length) / 2 - 0.2
    if (!overlapX || !overlapZ) continue
    const rel = Math.abs(d.speed - c.speed)
    const front = c.d > d.d
    // push apart
    if (front) {
      c.d = d.d + (c.l + BUS.length) / 2
      c.speed = Math.max(c.speed, d.speed * 0.9)
    } else c.d = d.d - (c.l + BUS.length) / 2
    if (rel > 2.5) {
      const hit = Math.min(35, rel * 2.2)
      d.damage = Math.min(100, d.damage + hit)
      d.speed *= 0.45
      d.crashes++
      d.events.push({ type: 'crash', kind: c.kind, hit })
      // some drivers come out ready to fight
      if (rel > 7 && c.kind !== 'okada' && c.kind !== 'keke' && d.rng() < 0.35) {
        d.over = 'roadRage'
        d.rageWith = c.kind
        return d
      }
    } else {
      d.events.push({ type: 'scrape' })
      d.damage = Math.min(100, d.damage + 1)
    }
  }
  if (d.damage >= 100) {
    // wrecked with the police behind you: jump out and run (the game
    // chains the escape runner after this outcome)
    d.over = d.chase ? 'abandoned' : 'wrecked'
    return d
  }

  // ---- places: stops, fuel, checkpoints ----
  const here = placeAt(d)
  const onShoulder = d.x > SHOULDER - 1.6
  const stopped = d.speed < 1.2
  d.halted = here && stopped && (here.type === 'checkpoint' || onShoulder) ? here : null

  if (d.halted?.type === 'stop' && !d.halted.served) {
    d.boardTimer -= dt
    if (d.boardTimer <= 0) {
      d.boardTimer = 0.55
      const stopIndex = d.places.filter((p) => p.type === 'stop').indexOf(d.halted)
      const alighting = d.passengers.findIndex((p) => p.dest === stopIndex)
      if (alighting >= 0) {
        d.passengers.splice(alighting, 1)
        d.events.push({ type: 'alight' })
      } else if (d.halted.waiting > 0 && d.passengers.length < BUS.capacity) {
        d.halted.waiting--
        const stops = d.places.filter((p) => p.type === 'stop').length
        const dest = Math.min(stops - 1, stopIndex + 1 + Math.floor(d.rng() * Math.max(1, stops - stopIndex - 1)))
        d.passengers.push({ dest })
        d.fares += d.fare
        d.events.push({ type: 'board', fare: d.fare })
      } else {
        d.halted.served = true
        d.events.push({ type: 'stopDone', name: d.halted.name })
      }
    }
  }

  // passengers whose stop you drove past get off angry at the next chance (no tip, and they tell people)
  for (const p of d.places) {
    if (p.type !== 'stop' || p.passed || d.d < p.d + 25) continue
    p.passed = true
    const idx = d.places.filter((q) => q.type === 'stop').indexOf(p)
    const missed = d.passengers.filter((q) => q.dest === idx).length
    if (missed) {
      d.passengers = d.passengers.filter((q) => q.dest !== idx)
      d.fares = Math.max(0, d.fares - missed * Math.round(d.fare / 2))
      d.events.push({ type: 'missedStop', count: missed, name: p.name })
    } else if (!p.served && p.waiting > 0) d.events.push({ type: 'skippedStop', name: p.name })
  }

  // checkpoints: drive through without stopping and the police come after you
  for (const p of d.places) {
    if (p.type !== 'checkpoint' || p.state !== 'ahead') continue
    if (d.d > p.d + 10) {
      p.state = 'ran'
      startChase(d)
    }
  }

  // ---- police chase ----
  if (d.chase) {
    const ch = d.chase
    const policeSpeed = Math.min(MAX_SPEED * 1.02, ch.speed + 6 * dt)
    ch.speed = policeSpeed
    // traffic slows the police too
    const slowed = d.cars.some((c) => c.d < d.d && c.d > d.d - ch.gap && Math.abs(c.x - d.x) < 2.4)
    ch.gap += (d.speed - policeSpeed * (slowed ? 0.7 : 1)) * dt
    ch.siren -= dt
    if (ch.siren <= 0) {
      ch.siren = 1.6
      d.events.push({ type: 'siren' })
    }
    if (ch.gap < 3) {
      d.over = 'caught'
      return d
    }
    if (d.d > ch.escapeAt || ch.gap > 140) {
      d.chase = null
      d.escaped++
      d.events.push({ type: 'escaped' })
    }
  }

  if (d.d >= d.length) d.over = 'done'
  return d
}

export function startChase(d) {
  if (d.chase) return
  d.chase = { gap: 45, speed: Math.max(10, d.speed), escapeAt: d.d + 650, siren: 0 }
  d.chases++
  d.events.push({ type: 'chase' })
}

/** At a filling station: buy `percent` of a tank. Returns the cost. */
export function buyFuel(d, percent, money = Infinity) {
  const room = 100 - d.fuel
  const want = Math.min(room, percent)
  const affordable = Math.min(want, Math.floor(money / FUEL_PRICE))
  if (affordable <= 0) return 0
  d.fuel += affordable
  const cost = affordable * FUEL_PRICE
  d.spent += cost
  d.events.push({ type: 'fuel', cost })
  return cost
}

export const fuelCost = (percent) => percent * FUEL_PRICE

/**
 * At a checkpoint the bus has stopped at. choice: 'bribe' | 'talk' | 'flee'
 * Returns { ok, cost }.
 */
export function checkpointChoice(d, place, choice, { goodwill = 10 } = {}) {
  if (place.state !== 'ahead') return { ok: true, cost: 0 }
  if (choice === 'bribe') {
    place.state = 'paid'
    d.bribes += place.bribe
    d.spent += place.bribe
    return { ok: true, cost: place.bribe }
  }
  if (choice === 'talk') {
    const chance = 0.25 + Math.min(0.35, goodwill / 200) + (d.passengers.length >= 8 ? 0.15 : 0)
    if (d.rng() < chance) {
      place.state = 'waved'
      return { ok: true, cost: 0 }
    }
    // talking failed: the price went up
    place.bribe = Math.round(place.bribe * 1.5)
    return { ok: false, cost: 0 }
  }
  place.state = 'ran'
  startChase(d)
  return { ok: true, cost: 0 }
}

/** The mode result. */
export function driveResult(d) {
  const repair = Math.round(d.damage * 60)
  const pay = d.fares - d.spent - (d.over === 'done' ? repair : 0)
  const outcome = d.over || 'done'
  const heat = d.chases * 6 - (d.over === 'caught' ? 0 : 0) + (outcome === 'caught' ? 6 : 0)
  return {
    outcome,
    moneyChange: outcome === 'caught' ? -Math.min(5000, d.spent) : Math.round(pay),
    stats: { policeHeat: heat, notoriety: d.escaped * 2, energy: -6, communityGoodwill: d.places.filter((p) => p.type === 'stop' && p.served).length >= 3 ? 1 : 0 },
    flags: [outcome === 'done' ? 'droveRoute' : `drive_${outcome}`, ...(d.escaped ? ['escapedPolice'] : [])],
    remember: d.rageWith ? { roadRage: d.rageWith } : undefined,
    summary: { fares: d.fares, fuel: d.spent - d.bribes, bribes: d.bribes, repair, crashes: d.crashes, km: Math.round(d.d / 100) / 10 },
  }
}
