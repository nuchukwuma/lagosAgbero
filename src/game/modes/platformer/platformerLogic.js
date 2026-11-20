// ESCAPE: a side-scrolling platformer for Area Boy (pure rules, no drawing).
// Get across Iyana-Wahala to the objective while the Task Force sweeps the
// streets. You move freely (stand still if you like), jump (and jump again in
// the air), roll under things, strike, and stomp an officer's head. Parked
// cars and danfos, market awnings and rooftops are platforms; open drains are
// death; broken bottles hurt; low banners must be rolled under. Officers walk
// their beat and only chase what they see in front of them; once they've seen
// you they run at you and swing the baton. Three strikes (or one stomp) put an
// officer down. Lose all your health, or fall in a drain, and you start again
// from the last bus stop; lose every life and you're caught.
//
// World units are the sprite's pixels (the runner is about 68 tall), y grows
// downwards and the road surface is y = 0.
import { rng } from '../arcade/px.js'

export const G = 1500 // gravity, px/s²
export const RUN = 150 // px/s
export const JUMP_V = 560
export const DOUBLE_V = 500
export const ROLL_SPEED = 230
export const ROLL_TIME = 0.55
export const STAND_H = 60
export const LOW_H = 26 // rolling: under the banners
export const PW = 18 // the runner's width
export const OFFICER_RUN = 118
export const OFFICER_WALK = 40
export const SIGHT = 210
export const DEATH_Y = 260
export const VEHICLE_SCALE = 2.4
export const PX_PER_M = 10 // 1 metre = 10 world px

// vehicle sizes (crop sizes from the atlas, before scaling): width, height
export const VEHICLES = {
  danfo: [46, 25], corolla: [49, 20], datsun: [49, 20], blueCar: [47, 27], jeep: [50, 27],
  lorry: [45, 27], van: [50, 34], camper: [35, 22], sports: [47, 20],
}

// ---------------------------------------------------------------- the level
/**
 * Build the street: ground (with drains), solid blocks (cars, buildings),
 * one-way ledges (awnings), hazards, officers, notes and bus stops.
 */
export function buildLevel({ metres = 700, seed = 1, difficulty = 1 } = {}) {
  const r = rng(seed)
  const L = metres * PX_PER_M
  const lv = { length: L, ground: [], blocks: [], ledges: [], hazards: [], officers: [], notes: [], checkpoints: [0], props: [] }
  let x = 0
  let groundFrom = -400
  const pick = (list) => list[Math.floor(r() * list.length)]
  const note = (nx, ny) => lv.notes.push({ x: nx, y: ny, got: false })
  const officer = (from, to) => {
    const ox = from + r() * (to - from)
    lv.officers.push({ x: ox, y: 0, home: [from, to], dir: r() < 0.5 ? 1 : -1, state: 'patrol', hp: 3, t: 0, alertT: 0, windup: 0, cool: 0, stun: 0, seenT: 0, lostT: 0 })
  }
  const pit = (w) => {
    lv.ground.push({ x0: groundFrom, x1: x })
    x += w
    groundFrom = x
  }
  // a quiet start
  x = 240
  for (let i = 0; i < 3; i++) note(120 + i * 30, -30)
  let sinceCheckpoint = 0
  const officerChance = 0.32 + difficulty * 0.1
  while (x < L - 300) {
    const kind = pick(['flat', 'pit', 'cars', 'cars', 'wire', 'stalls', 'roofs', 'bottles', 'post', 'pit', 'cars'])
    const start = x
    if (kind === 'flat') {
      const w = 220 + r() * 160
      for (let i = 0; i < 4; i++) note(x + 40 + i * 30, -30 - (i % 2) * 20)
      if (r() < officerChance) officer(x + 30, x + w - 30)
      x += w
    } else if (kind === 'pit') {
      x += 40
      const w = 55 + r() * (35 + difficulty * 10)
      note(x + w / 2, -110)
      pit(w)
      x += 60
    } else if (kind === 'cars') {
      const n = 1 + Math.floor(r() * 3)
      x += 30
      for (let i = 0; i < n; i++) {
        const v = pick(Object.keys(VEHICLES))
        const [vw, vh] = VEHICLES[v]
        const w = vw * VEHICLE_SCALE
        const h = vh * VEHICLE_SCALE - 6
        lv.blocks.push({ x, y: -h, w, h, kind: 'vehicle', vehicle: v })
        note(x + w / 2, -h - 30)
        x += w + 25 + r() * 60
      }
      if (r() < officerChance) officer(start, x)
    } else if (kind === 'wire') {
      x += 40
      const w = 70 + r() * 50
      lv.hazards.push({ x, y: -50, w, h: 16, kind: 'banner' }) // stand and it hits your chest; roll under
      lv.props.push({ kind: 'post', x: x - 4 }, { kind: 'post', x: x + w })
      note(x + w / 2, -12)
      x += w + 60
    } else if (kind === 'stalls') {
      x += 30
      const steps = 2 + Math.floor(r() * 2)
      for (let i = 0; i < steps; i++) {
        const y = -(70 + i * 55)
        const w = 90 + r() * 40
        lv.ledges.push({ x, y, w, kind: 'awning', color: pick(['#d9342b', '#2f6fd6', '#2e9e4f', '#f2c230']) })
        note(x + w / 2, y - 26)
        x += w * 0.7
      }
      if (r() < officerChance + 0.15) officer(start, x + 60) // they walk under the awnings: go over them
      x += 90
    } else if (kind === 'roofs') {
      x += 40
      const n = 2 + Math.floor(r() * 2)
      // a car to step up from, then buildings with alleys between
      const [vw, vh] = VEHICLES.danfo
      lv.blocks.push({ x, y: -(vh * VEHICLE_SCALE - 6), w: vw * VEHICLE_SCALE, h: vh * VEHICLE_SCALE - 6, kind: 'vehicle', vehicle: 'danfo' })
      x += vw * VEHICLE_SCALE + 10
      for (let i = 0; i < n; i++) {
        const h = 95 + r() * 45
        const w = 140 + r() * 100
        lv.blocks.push({ x, y: -h, w, h, kind: 'building', sign: pick(['BUKA', 'PURE WATER', 'GOD DEY', 'VULCANIZER', 'PHONE REPAIRS', 'ALHAJI STORES']) })
        for (let k = 0; k < 3; k++) note(x + 30 + k * 35, -h - 28)
        x += w
        if (i < n - 1) {
          const gap = 45 + r() * 45
          if (r() < 0.35) pit(gap) // the alley is a drain
          else x += gap
        }
      }
      x += 60
    } else if (kind === 'bottles') {
      x += 50
      const w = 40 + r() * 40
      lv.hazards.push({ x, y: -8, w, h: 8, kind: 'bottles' })
      note(x + w / 2, -80)
      x += w + 70
    } else if (kind === 'post') {
      // a Task Force post: officers in the open; an awning to sneak over them
      const w = 300 + r() * 120
      lv.ledges.push({ x: x + 60, y: -105, w: w - 120, kind: 'awning', color: '#7a5c3a' })
      officer(x + 20, x + w - 20)
      if (difficulty > 1 || r() < 0.5) officer(x + 20, x + w - 20)
      for (let i = 0; i < 4; i++) note(x + 90 + i * 40, -130)
      x += w
    }
    sinceCheckpoint += x - start
    if (sinceCheckpoint > 1300) {
      x += 30
      lv.checkpoints.push(x)
      lv.props.push({ kind: 'busStop', x })
      x += 60
      sinceCheckpoint = 0
    }
  }
  x = Math.max(x, L - 200)
  lv.ground.push({ x0: groundFrom, x1: L + 600 })
  lv.goal = L
  return lv
}

// ---------------------------------------------------------------- the run
export function createEscape(params = {}, seed = 1) {
  const level = buildLevel({ metres: params.metres ?? 700, seed, difficulty: params.difficulty ?? 1 })
  return {
    level,
    p: freshRunner(0),
    lives: params.lives ?? 3,
    maxHp: 5,
    checkpoint: 0,
    held: { left: false, right: false },
    notes: 0,
    seen: 0,
    downed: 0,
    over: false,
    escaped: false,
    msg: '',
    msgT: 0,
    t: 0,
    sound: [],
  }
}

function freshRunner(x) {
  return { x, y: 0, vx: 0, vy: 0, dir: 1, ground: true, jumps: 0, coyote: 0, roll: 0, attack: 0, hit: 0, invul: 1, hp: 5, dead: 0, landT: 0 }
}

export const runnerH = (p) => (p.roll > 0 ? LOW_H : STAND_H)
const groundAt = (lv, x) => lv.ground.some((g) => x >= g.x0 && x <= g.x1)
/** Can an officer stand here? (They don't climb cars or jump drains.) */
const walkable = (lv, x) => groundAt(lv, x - 8) && groundAt(lv, x + 8) && !lv.blocks.some((b) => x > b.x - 8 && x < b.x + b.w + 8)

/** Is there something to stand on right under (x, y)? Returns the surface y or null. */
export function surfaceUnder(lv, x0, x1, y, fromY) {
  let best = null
  const consider = (top) => {
    if (top >= fromY - 0.01 && top <= y + 0.01 && (best == null || top < best)) best = top
  }
  for (const g of lv.ground) if (x1 > g.x0 && x0 < g.x1) consider(0)
  for (const b of lv.blocks) if (x1 > b.x && x0 < b.x + b.w) consider(b.y)
  for (const l of lv.ledges) if (x1 > l.x && x0 < l.x + l.w) consider(l.y)
  return best
}

export function press(s, id, down = true) {
  const p = s.p
  if (id === 'left' || id === 'right') {
    s.held[id] = down
    return
  }
  if (!down || s.over || p.dead > 0) return
  if (id === 'jump') {
    if (p.roll > 0) return
    if (p.ground || p.coyote > 0) {
      p.vy = -JUMP_V
      p.ground = false
      p.coyote = 0
      p.jumps = 1
      s.sound.push('jump')
    } else if (p.jumps < 2) {
      p.vy = -DOUBLE_V
      p.jumps = 2
      s.sound.push('jump')
    }
  } else if (id === 'roll') {
    if (p.roll <= 0 && p.attack <= 0) {
      p.roll = ROLL_TIME
      s.sound.push('slide')
    }
  } else if (id === 'hit') {
    if (p.attack <= 0 && p.roll <= 0) {
      p.attack = 0.36
      p.struck = false
      s.sound.push('whoosh')
    }
  }
}

function hurt(s, dmg, from) {
  const p = s.p
  if (p.invul > 0 || p.dead > 0) return
  p.hp -= dmg
  p.hit = 0.35
  p.invul = 1.1
  p.vx = from < p.x ? 220 : -220
  p.vy = -260
  p.ground = false
  s.sound.push('hurt')
  if (p.hp <= 0) die(s, 'The Task Force pinned you down.')
}

function die(s, why) {
  const p = s.p
  if (p.dead > 0) return
  p.dead = 1.3
  p.hp = 0
  s.lives--
  s.msg = why
  s.msgT = 2
  s.sound.push('ko')
}

function respawn(s) {
  s.p = freshRunner(s.checkpoint + 20)
  // officers near the bus stop calm down
  for (const o of s.level.officers) if (o.state !== 'down') Object.assign(o, { state: 'patrol', alertT: 0, windup: 0, seenT: 0, lostT: 0 })
}

// ---------------------------------------------------------------- one tick
export function stepEscape(s, dt) {
  if (s.over) return
  s.t += dt
  s.msgT -= dt
  const lv = s.level
  const p = s.p
  if (p.dead > 0) {
    p.dead -= dt
    p.vy += G * dt
    p.y = Math.min(p.y + p.vy * dt, DEATH_Y + 40)
    if (p.dead <= 0) {
      if (s.lives <= 0) {
        s.over = true
        return
      }
      respawn(s)
    }
    return
  }
  p.invul = Math.max(0, p.invul - dt)
  p.hit = Math.max(0, p.hit - dt)
  p.landT = Math.max(0, p.landT - dt)
  // moving: rolling carries you forward; otherwise the held direction (or stand still)
  if (p.roll > 0) {
    p.roll -= dt
    p.vx = p.dir * ROLL_SPEED
  } else if (p.hit > 0) {
    p.vx *= 0.92
  } else {
    const want = (s.held.right ? 1 : 0) - (s.held.left ? 1 : 0)
    if (want) p.dir = want
    const target = want * RUN * (p.attack > 0 && p.ground ? 0.3 : 1)
    p.vx += (target - p.vx) * Math.min(1, dt * (p.ground ? 14 : 6))
  }
  if (p.attack > 0) p.attack -= dt
  // gravity and vertical movement, landing on the first surface below
  const oldY = p.y
  p.vy = Math.min(p.vy + G * dt, 1100)
  let ny = p.y + p.vy * dt
  const x0 = p.x - PW / 2
  const x1 = p.x + PW / 2
  if (p.vy >= 0) {
    const top = surfaceUnder(lv, x0, x1, ny, oldY)
    if (top != null) {
      if (!p.ground && p.vy > 500) p.landT = 0.18
      ny = top
      p.vy = 0
      p.ground = true
      p.jumps = 0
      p.coyote = 0.1
    } else {
      if (p.ground) p.coyote = 0.1
      p.ground = false
    }
  } else {
    // heads hit the underside of solid blocks
    for (const b of lv.blocks)
      if (x1 > b.x && x0 < b.x + b.w && ny - runnerH(p) < b.y + b.h && oldY - runnerH(p) >= b.y + b.h - 0.01) {
        ny = b.y + b.h + runnerH(p)
        p.vy = 0
      }
    p.ground = false
  }
  p.coyote = Math.max(0, p.coyote - dt)
  p.y = ny
  // horizontal movement, stopped by the sides of solid blocks
  let nx = p.x + p.vx * dt
  for (const b of lv.blocks) {
    const top = p.y - runnerH(p)
    if (p.y > b.y + 0.5 && top < b.y + b.h) {
      if (p.vx > 0 && p.x + PW / 2 <= b.x + 0.5 && nx + PW / 2 > b.x) nx = b.x - PW / 2
      if (p.vx < 0 && p.x - PW / 2 >= b.x + b.w - 0.5 && nx - PW / 2 < b.x + b.w) nx = b.x + b.w + PW / 2
    }
  }
  p.x = Math.max(PW, nx)
  // drains: fall through and you're gone
  if (p.y > DEATH_Y) return die(s, 'You fell into the gutter. Lagos gutters do not give back.')
  // hazards
  for (const h of lv.hazards) {
    const top = p.y - runnerH(p)
    if (p.x + PW / 2 > h.x && p.x - PW / 2 < h.x + h.w && p.y > h.y && top < h.y + h.h) {
      if (h.kind === 'bottles') {
        hurt(s, 1, h.x + h.w / 2)
        p.vy = -380
      } else hurt(s, 1, p.x - p.dir * 10)
    }
  }
  // naira notes
  for (const n of lv.notes)
    if (!n.got && Math.abs(n.x - p.x) < 16 && n.y > p.y - runnerH(p) - 8 && n.y < p.y + 6) {
      n.got = true
      s.notes++
      s.sound.push('coin')
    }
  // bus stops
  for (const c of lv.checkpoints)
    if (c > s.checkpoint && p.x >= c) {
      s.checkpoint = c
      s.msg = 'Bus stop: if they catch you now, you start from here.'
      s.msgT = 1.6
      s.sound.push('correct')
    }
  stepOfficers(s, dt)
  if (p.x >= lv.goal) {
    s.escaped = true
    s.over = true
    s.sound.push('win')
  }
}

// ---------------------------------------------------------------- the Task Force
/** Can this officer see the runner? In front of them, near, on about their level; rolling or crouching is harder to spot. */
export function canSee(o, p) {
  const dx = p.x - o.x
  if (Math.sign(dx) !== o.dir && Math.abs(dx) > 12) return false
  const range = p.roll > 0 ? SIGHT * 0.5 : SIGHT
  return Math.abs(dx) < range && Math.abs(p.y - o.y) < 40
}

function stepOfficers(s, dt) {
  const p = s.p
  for (const o of s.level.officers) {
    if (o.state === 'down') continue
    o.t += dt
    o.cool = Math.max(0, o.cool - dt)
    if (o.stun > 0) {
      o.stun -= dt
      continue
    }
    const dx = p.x - o.x
    const sees = p.dead <= 0 && canSee(o, p)
    if (o.state === 'patrol') {
      // walk the beat, turning at the ends (and sometimes just looking around)
      const nx = o.x + o.dir * OFFICER_WALK * dt
      if (nx < o.home[0] || nx > o.home[1] || !walkable(s.level, nx)) o.dir = -o.dir
      else o.x = nx
      if (sees) {
        o.seenT += dt
        if (o.seenT > 0.35) {
          o.state = 'chase'
          o.alertT = 0.6
          s.seen++
          s.sound.push('whistle')
        }
      } else o.seenT = Math.max(0, o.seenT - dt)
    } else if (o.state === 'chase') {
      o.alertT = Math.max(0, o.alertT - dt)
      if (o.alertT > 0) continue // the "!" moment: you have a breath to run
      o.dir = Math.sign(dx) || o.dir
      const close = Math.abs(dx) < 34 && Math.abs(p.y - o.y) < 24
      if (o.windup > 0) {
        o.windup -= dt
        if (o.windup <= 0) {
          // the baton comes down: rolling or jumping clear dodges it
          o.cool = 1.1
          if (Math.abs(p.x - o.x) < 40 && Math.sign(p.x - o.x) === o.dir && p.roll <= 0 && Math.abs(p.y - o.y) < 20) hurt(s, 1, o.x)
          s.sound.push('block')
        }
      } else if (close && o.cool <= 0 && p.dead <= 0) {
        o.windup = 0.45
      } else if (!close) {
        // run at you, but they can't climb: they wait below and lose interest
        const nx = o.x + Math.sign(dx) * OFFICER_RUN * dt
        if (walkable(s.level, nx)) o.x = nx
      }
      if (Math.abs(dx) > SIGHT * 1.4 || Math.abs(p.y - o.y) > 60 || p.dead > 0) {
        o.lostT += dt
        if (o.lostT > 2.5) {
          o.state = 'patrol'
          o.lostT = 0
          o.seenT = 0
          o.home = [Math.min(o.home[0], o.x), Math.max(o.home[1], o.x)]
        }
      } else o.lostT = 0
    }
    // your strike
    if (p.attack > 0.08 && p.attack < 0.28 && !p.struck && Math.sign(o.x - p.x) === p.dir && Math.abs(o.x - p.x) < 40 && Math.abs(o.y - p.y) < 30) {
      p.struck = true
      o.hp--
      o.stun = 0.5
      o.windup = 0
      o.x += p.dir * 26
      s.sound.push('punch')
      if (o.state === 'patrol') {
        o.state = 'chase'
        s.seen++
      }
      if (o.hp <= 0) knockDown(s, o)
    }
    // stomp: land on their head
    if (o.state !== 'down' && p.vy > 120 && Math.abs(o.x - p.x) < 20 && p.y > o.y - STAND_H - 6 && p.y < o.y - STAND_H + 18) {
      knockDown(s, o)
      p.vy = -460
      p.jumps = 1
      s.sound.push('kick')
    }
    // walking into an officer who's chasing knocks you about
    if (o.state === 'chase' && o.alertT <= 0 && Math.abs(o.x - p.x) < 14 && Math.abs(o.y - p.y) < 30 && p.roll <= 0) hurt(s, 1, o.x)
  }
}

function knockDown(s, o) {
  o.state = 'down'
  o.hp = 0
  o.t = 0
  s.downed++
  s.msg = ['"Ah! My back!"', 'He stays down. His cap rolls into the gutter.', '"Oga, abeg! Abeg!"'][s.downed % 3]
  s.msgT = 1.2
}

export const metresLeft = (s) => Math.max(0, Math.ceil((s.level.goal - s.p.x) / PX_PER_M))
