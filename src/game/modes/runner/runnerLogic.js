// Escape runner rules (pure). The player runs "forward" along +distance in
// one of 3 lanes; obstacles sit at fixed distances.
//   block  (danfo, barrier)   change lane
//   low    (cartons, cones)   jump
//   high   (hanging banner)   slide
//   note                      ₦ to collect
// Every hit makes you stumble and lets the pursuers close in; 3 hits = caught.
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

export function createRun({ goal = 320, seed = 1, difficulty = 1, energy = 70, endless = false } = {}) {
  const density = 0.9 + difficulty * 0.15
  return {
    goal: endless ? Infinity : goal,
    endless,
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
    items: makeCourse(endless ? SEGMENT : goal, seed, density),
    over: null,
    events: [],
  }
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
  r.laneX += (r.lane - r.laneX) * Math.min(1, dt * 12)

  const speed = r.stumbleT > 0 ? r.speed * 0.45 : r.speed
  const before = r.distance
  r.distance += speed * dt
  r.speed = Math.min(r.maxSpeed, r.speed + dt * (r.endless ? 0.22 : 0.12))
  if (r.endless && r.distance > r.builtTo - 120) {
    // build the next stretch ahead; forget rows far behind (nothing piles up)
    r.items = r.items.filter((it) => it.d > r.distance - 30).concat(makeCourse(r.builtTo + SEGMENT, r.seed + r.builtTo, r.density * (1 + r.builtTo / 4000), r.builtTo))
    r.builtTo += SEGMENT
  }
  // pursuers run at a steady pace; stumbling lets them close in
  r.pursuer = Math.max(0, r.pursuer + (speed - (r.speed * 0.92)) * dt)

  for (const it of r.items) {
    if (it.done || it.d < before - 0.5 || it.d > r.distance + 0.5) continue
    if (Math.round(r.laneX) !== it.lane) continue
    it.done = true
    if (it.kind === 'note') {
      r.notes++
      r.events.push({ type: 'note' })
      continue
    }
    const cleared = (it.kind === 'low' && r.y > CLEAR_HEIGHT) || (it.kind === 'high' && r.slideT > 0)
    if (cleared) continue
    r.hits++
    r.stumbleT = 0.8
    r.pursuer = Math.max(0, r.pursuer - 6)
    r.events.push({ type: 'hit', kind: it.kind })
  }

  if (r.hits >= r.maxHits || r.pursuer <= 0) r.over = 'caught'
  else if (r.distance >= r.goal) r.over = 'escaped'
  return r
}
