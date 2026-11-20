// Escape runner rules (pure). The player runs "forward" along +distance in
// one of 3 lanes; obstacles sit at fixed distances.
//   block  (danfo, barrier)   change lane
//   low    (cartons, cones)   jump
//   high   (hanging banner)   slide
//   note                      ₦ to collect
//   car  (danfo, taxi)        drives AT you down its lane: change lane
//   officer (Task Force)       runs AT you down its lane to grab you: change lane
// Every hit makes you stumble and lets the pursuers close in; 3 hits = caught.
// Right after a hit they're at your back for a few seconds (closeT), where
// you can see them.
// Reach `goal` metres = escaped.
//
// Jumps are real arcs (launch speed + gravity): jump too late and the carton
// still gets you. Slide in the air to drop straight down.
// Endless runs (the Gauntlet): no finish line, the course keeps being built
// ahead of you (and old rows are dropped behind), the pace keeps rising, and
// the score is how far you got.

export const LANES = [-1, 0, 1]
export const SLIDE_TIME = 0.7
export const JUMP_SPEED = 6.2 // m/s up
export const GRAVITY = 19 // m/s²: about 0.65 s in the air, 1 m high
const CLEAR_HEIGHT = 0.25 // feet must be this high to clear a low obstacle
const SEGMENT = 240 // endless: metres of course built at a time
export const CLOSE_TIME = 3.5 // seconds the pursuers stay at your back after a hit
// oncoming cars: they set off when you're CAR_LEAD metres from where you'd
// meet (if you keep your pace), so there's always time to see them and move
const CAR_LEAD = 42
const CAR_MODELS = ['danfo', 'taxi', 'danfo']
export const CAR_HALF = { danfo: 2.9, taxi: 2.3 } // half their length, metres
const OFFICER_LEAD = 34
const OFFICER_REACH = 0.55 // metres: how close an officer must get to grab you
const MOVERS = new Set(['car', 'officer']) // things that come at you

const KINDS = ['block', 'low', 'high']

/** Deterministic course from a seed. */
export function makeCourse(goal, seed = 1, density = 1, from = 30) {
  let s = seed
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  const items = []
  for (let d = from; d < goal - 10; d += (14 + rnd() * 10) / density) {
    // at least one lane stays passable
    const free = Math.floor(rnd() * 3) - 1
    for (const lane of LANES) {
      if (lane === free) {
        if (rnd() < 0.5) items.push({ d: d + 2, lane, kind: 'note' })
        continue
      }
      if (rnd() < 0.55) items.push({ d, lane, kind: KINDS[Math.floor(rnd() * 3)] })
    }
  }
  return items
}

/**
 * Oncoming cars, in the gaps between rows of obstacles (so where you meet one
 * there's nothing else in your way). Separate dice from the course, so a
 * seed's obstacles stay where they were.
 */
export function makeTraffic(items, seed, density = 1, from = 70) {
  let s = (seed * 7 + 1013) % 233280
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  const rows = [...new Set(items.filter((it) => it.kind !== 'note' && !MOVERS.has(it.kind)).map((it) => it.d))].sort((a, b) => a - b)
  const cars = []
  const chance = Math.min(0.4, 0.14 + 0.1 * density)
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i]
    const b = rows[i + 1]
    if (a < from || b - a < 11 || rnd() > chance) continue
    const meet = (a + b) / 2
    const lanes = [...LANES].sort(() => rnd() - 0.5).slice(0, rnd() < 0.25 && meet > 200 ? 2 : 1) // one free lane at least
    // further on, some gaps send Task Force officers running at you instead
    const officers = meet > 110 && rnd() < Math.min(0.85, 0.55 + 0.4 * (density - 1.05)) // more of them when the route is hot
    for (const lane of lanes) {
      if (officers) cars.push({ d: meet, meet, lane, kind: 'officer', v: 3.2 + rnd() * 1.4, active: false })
      else cars.push({ d: meet, meet, lane, kind: 'car', model: CAR_MODELS[Math.floor(rnd() * CAR_MODELS.length)], v: 6 + rnd() * 5, active: false })
    }
  }
  return cars
}

// Power-ups you pick up mid-run, no ads needed: some naira notes are
// swapped for one (separate dice, so a seed's course stays the same).
export const PICKUPS = {
  magnet: { name: 'Money magnet', time: 8 }, // notes in every lane fly to you
  star: { name: 'Untouchable', time: 6 }, // run straight through anything
  charm: { name: 'Free stumble', time: 0 }, // the next stumble doesn't count
}
const PICKUP_KINDS = Object.keys(PICKUPS)
export function addPickups(items, seed, chance = 0.08) {
  let s = (seed * 13 + 4271) % 233280
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  for (const it of items) if (it.kind === 'note' && it.d > 40 && rnd() < chance) it.kind = PICKUP_KINDS[Math.floor(rnd() * PICKUP_KINDS.length)]
  return items
}

const withTraffic = (items, seed, density, traffic) => addPickups(traffic ? items.concat(makeTraffic(items, seed, density)) : items, seed)

export function createRun({ goal = 540, seed = 1, difficulty = 1, energy = 70, endless = false, traffic = true } = {}) {
  const density = 0.9 + difficulty * 0.15
  return {
    goal: endless ? Infinity : goal,
    endless,
    traffic,
    difficulty,
    seed,
    density,
    builtTo: endless ? SEGMENT : goal,
    distance: 0,
    speed: 9 + difficulty,
    maxSpeed: endless ? 22 : 13 + difficulty * 1.5,
    lane: 0,
    laneX: 0,
    y: 0, // feet above the road
    vy: 0,
    jumpT: 0, // > 0 while in the air (kept for the animation)
    slideT: 0,
    stumbleT: 0,
    hits: 0,
    maxHits: energy < 25 ? 2 : 3,
    notes: 0,
    pursuer: 18, // metres behind
    magnetT: 0, // power-ups picked up on the way
    invT: 0,
    charms: 0,
    closeT: 0, // > 0: the pursuers are right at your back (just after a hit)
    items: withTraffic(makeCourse(endless ? SEGMENT : goal, seed, density), seed, density, traffic),
    over: null,
    events: [],
  }
}

function hit(r, kind) {
  if (r.charms > 0) {
    // the charm takes it: a little wobble and on you go
    r.charms--
    r.stumbleT = 0.25
    r.events.push({ type: 'saved', kind })
    return
  }
  r.hits++
  r.stumbleT = 0.8
  r.closeT = CLOSE_TIME // they're on you: you can see them at your back
  r.pursuer = Math.max(0, r.pursuer - 6)
  r.events.push({ type: 'hit', kind })
}

/** input: { left, right, jump, slide } (pressed this frame) */
export function stepRun(r, input, dt) {
  if (r.over) return r
  r.events = []
  if (input.left) r.lane = Math.max(-1, r.lane - 1)
  if (input.right) r.lane = Math.min(1, r.lane + 1)
  const grounded = r.y <= 0
  if (input.jump && grounded && r.slideT <= 0) {
    r.vy = JUMP_SPEED
    r.events.push({ type: 'jump' })
  }
  if (input.slide && !grounded) r.vy = Math.min(r.vy, -12) // drop out of the air
  else if (input.slide && r.slideT <= 0) r.slideT = SLIDE_TIME
  if (r.vy !== 0 || r.y > 0) {
    r.y += r.vy * dt
    r.vy -= GRAVITY * dt
    if (r.y <= 0) {
      r.y = 0
      r.vy = 0
    }
  }
  r.jumpT = r.y > 0 ? 1 : 0
  r.slideT = Math.max(0, r.slideT - dt)
  r.stumbleT = Math.max(0, r.stumbleT - dt)
  r.closeT = Math.max(0, r.closeT - dt)
  r.magnetT = Math.max(0, r.magnetT - dt)
  r.invT = Math.max(0, r.invT - dt)
  r.laneX += (r.lane - r.laneX) * Math.min(1, dt * 12)

  const speed = r.stumbleT > 0 ? r.speed * 0.45 : r.speed
  const before = r.distance
  r.distance += speed * dt
  r.speed = Math.min(r.maxSpeed, r.speed + dt * (r.endless ? 0.22 * (1 + (r.difficulty - 1) * 0.25) : 0.12)) // a hot Gauntlet speeds up faster
  if (r.endless && r.distance > r.builtTo - 120) {
    // build the next stretch ahead; forget rows far behind (nothing piles up)
    const density = r.density * (1 + r.builtTo / 4000)
    const more = makeCourse(r.builtTo + SEGMENT, r.seed + r.builtTo, density, r.builtTo)
    r.items = r.items.filter((it) => it.d > r.distance - 30).concat(withTraffic(more, r.seed + r.builtTo, density, r.traffic))
    r.builtTo += SEGMENT
  }
  // pursuers run at a steady pace; stumbling lets them close in
  r.pursuer = Math.max(0, r.pursuer + (speed - (r.speed * 0.92)) * dt)

  // oncoming cars and officers: set off in time, come down their lane, knock
  // you over (or grab you) if you're in it
  for (const it of r.items) {
    if (!MOVERS.has(it.kind)) continue
    if (it.done) {
      if (it.grabbed) it.d -= Math.max(0, (it.v -= 12 * dt)) * dt // stumbles to a stop behind you
      // knocked you over: it brakes and swerves off to the roadside
      if (it.swerve) {
        it.d -= it.v * dt
        it.v = Math.max(0, it.v - 40 * dt) // slams the brakes
        it.off = Math.min(5.2, (it.off || 0) + dt * 16) // and jerks out of your way
      }
      continue
    }
    if (!it.active) {
      const officer = it.kind === 'officer'
      const gap = it.meet - r.distance
      if (gap > (officer ? OFFICER_LEAD : CAR_LEAD)) continue
      it.active = true
      it.d = it.meet + (Math.max(0, gap) / Math.max(1, r.speed)) * it.v
      r.events.push({ type: officer ? 'officer' : 'horn', lane: it.lane })
    }
    it.d -= it.v * dt
    const reach = it.kind === 'officer' ? OFFICER_REACH : (CAR_HALF[it.model] || 2.5) + 0.3
    if (Math.abs(it.d - r.distance) < reach && Math.round(r.laneX) === it.lane && r.y < 1.4) {
      it.done = true
      if (it.kind === 'officer') it.grabbed = true
      else it.swerve = it.lane !== 0 ? it.lane : r.distance % 2 > 1 ? 1 : -1 // towards the nearer side
      if (r.invT > 0) r.events.push({ type: 'smash', kind: it.kind })
      else hit(r, it.kind)
    }
  }

  for (const it of r.items) {
    if (MOVERS.has(it.kind)) continue
    if (it.done || it.d < before - 0.5) continue
    // the magnet pulls notes from every lane, a little ahead of you
    const pulled = it.kind === 'note' && r.magnetT > 0 && it.d <= r.distance + 6
    if (!pulled && (it.d > r.distance + 0.5 || Math.round(r.laneX) !== it.lane)) continue
    it.done = true
    if (it.kind === 'note') {
      r.notes++
      r.events.push({ type: 'note' })
      continue
    }
    if (PICKUPS[it.kind]) {
      if (it.kind === 'magnet') r.magnetT = PICKUPS.magnet.time
      else if (it.kind === 'star') r.invT = PICKUPS.star.time
      else r.charms++
      r.events.push({ type: 'power', kind: it.kind })
      continue
    }
    const cleared = (it.kind === 'low' && r.y > CLEAR_HEIGHT) || (it.kind === 'high' && r.slideT > 0)
    if (cleared) continue
    if (r.invT > 0) {
      r.events.push({ type: 'smash', kind: it.kind })
      continue
    }
    hit(r, it.kind)
  }

  if (r.hits >= r.maxHits || (r.pursuer <= 0 && r.invT <= 0)) r.over = 'caught'
  else if (r.distance >= r.goal) r.over = 'escaped'
  return r
}

/** Back on your feet after being caught (the revive): a clear stretch ahead and a moment untouchable. */
export function reviveRun(r) {
  r.over = null
  r.hits = 0
  r.stumbleT = 0
  r.closeT = 0
  r.pursuer = Math.max(r.pursuer, 16)
  r.invT = 2.5
  for (const it of r.items) if (!it.done && it.kind !== 'note' && !PICKUPS[it.kind] && it.d > r.distance - 2 && it.d < r.distance + 30) it.done = true
}
