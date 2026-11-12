// Escape runner rules (pure). The player runs "forward" along +distance in
// one of 3 lanes; obstacles sit at fixed distances.
//   block  (danfo, barrier)   change lane
//   low    (cartons, cones)   jump
//   high   (hanging banner)   slide
//   note                      ₦ to collect
// Every hit makes you stumble and lets the pursuers close in; 3 hits = caught.
// Reach `goal` metres = escaped.

export const LANES = [-1, 0, 1]
export const JUMP_TIME = 0.6
export const SLIDE_TIME = 0.7

const KINDS = ['block', 'low', 'high']

/** Deterministic course from a seed. */
export function makeCourse(goal, seed = 1, density = 1) {
  let s = seed
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  const items = []
  for (let d = 30; d < goal - 10; d += (14 + rnd() * 10) / density) {
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

export function createRun({ goal = 320, seed = 1, difficulty = 1, energy = 70 } = {}) {
  return {
    goal,
    distance: 0,
    speed: 9 + difficulty,
    maxSpeed: 13 + difficulty * 1.5,
    lane: 0,
    laneX: 0,
    jumpT: 0,
    slideT: 0,
    stumbleT: 0,
    hits: 0,
    maxHits: energy < 25 ? 2 : 3,
    notes: 0,
    pursuer: 18, // metres behind
    items: makeCourse(goal, seed, 0.9 + difficulty * 0.15),
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
  if (input.jump && r.jumpT <= 0 && r.slideT <= 0) r.jumpT = JUMP_TIME
  if (input.slide && r.slideT <= 0 && r.jumpT <= 0) r.slideT = SLIDE_TIME
  r.jumpT = Math.max(0, r.jumpT - dt)
  r.slideT = Math.max(0, r.slideT - dt)
  r.stumbleT = Math.max(0, r.stumbleT - dt)
  r.laneX += (r.lane - r.laneX) * Math.min(1, dt * 12)

  const speed = r.stumbleT > 0 ? r.speed * 0.45 : r.speed
  const before = r.distance
  r.distance += speed * dt
  r.speed = Math.min(r.maxSpeed, r.speed + dt * 0.12)
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
    const cleared = (it.kind === 'low' && r.jumpT > 0) || (it.kind === 'high' && r.slideT > 0)
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
