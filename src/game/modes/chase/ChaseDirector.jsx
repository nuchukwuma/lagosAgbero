import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useChase } from './chaseStore.js'
import { spawnVehicle, removeVehicle, traffic, LANES } from '../../systems/traffic.js'
import { playerState } from '../../world/worldState.js'
import { resolveCollisions, GROUND_Y } from '../../world/layout.js'
import Character from '../../characters/Character.jsx'
import { Model } from '../../world/Model.jsx'
import { randomLook } from '../../characters/look.js'
import { namedDriver } from '../../systems/fees.js'

// Runs the chase inside the 3D street:
//   - puts the fleeing vehicle ahead of the player in the west lane
//   - gives it a "go-slow" speed: crawl, burst, brake, crawl...
//   - scatters cartons and cones on the pavement, and walks pedestrians
//     across it; running into a pedestrian makes the player stumble
//   - drains stamina while running, refills it while walking
//   - ends the chase: GRAB when close (won), or the vehicle gets past escapeX
//     or time runs out (lost)

const GRAB_DISTANCE = 1.7
const DRAIN = 11 // stamina per second while running
const REGEN = 7

function sideDistance(p, v) {
  const z = LANES[v.lane].z
  const dx = Math.max(Math.abs(p.x - v.x) - v.length / 2, 0)
  const dz = Math.max(Math.abs(p.z - z) - v.width / 2, 0)
  return Math.hypot(dx, dz)
}

// deterministic-ish layout of obstacles between the start and the escape line
function makeObstacles(startX, escapeX, seed = 7) {
  let s = seed
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  const statics = []
  for (let x = startX - 8; x > escapeX + 4; x -= 6 + rnd() * 5) {
    statics.push({ model: rnd() < 0.6 ? 'carton' : 'cone', x, z: -5 - rnd() * 2.2, rot: rnd() * 90 })
  }
  const walkers = []
  for (let i = 0; i < 4; i++) walkers.push({ x: startX - 12 - i * 11 - rnd() * 4, phase: rnd() * Math.PI * 2, speed: 0.5 + rnd() * 0.3, seed: 300 + i * 7 })
  return { statics, walkers }
}

function Walker({ w, colliders }) {
  const ref = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime * w.speed + w.phase
    // stroll back and forth across the pavement (z -7.5 .. -4.2)
    const z = -5.85 + Math.sin(t) * 1.65
    const g = ref.current
    if (g) {
      g.position.set(w.x, GROUND_Y, z)
      g.rotation.y = Math.cos(t) > 0 ? 0 : Math.PI
    }
    colliders.set(w.seed, { x: w.x, z })
  })
  return <Character ref={ref} look={randomLook(w.seed)} animation="walk" position={[w.x, GROUND_Y, -5.8]} />
}

export default function ChaseDirector() {
  const chase = useChase()
  const vehicleRef = useRef(null)
  const elapsed = useRef(0)
  const profile = useRef({ until: 0, speed: 4 })
  const walkerPos = useMemo(() => new Map(), [])
  const escapeX = chase.params.escapeX ?? -52
  const startX = useMemo(() => playerState.position.x, [chase.active]) // eslint-disable-line react-hooks/exhaustive-deps
  const obstacles = useMemo(() => makeObstacles(startX, escapeX), [startX, escapeX])
  const staticColliders = useMemo(() => obstacles.statics.map((o) => ({ x: o.x, z: o.z, hw: 0.4, hd: 0.4, angle: 0 })), [obstacles])

  // spawn the target when the chase begins; clean up afterwards
  useEffect(() => {
    if (!chase.started || vehicleRef.current) return
    const id = String(chase.params.target || 'biodun').replace('driver_', '')
    const driver = namedDriver(id)
    // clear the lane just ahead so nothing spawns inside him
    for (const v of [...traffic.vehicles]) if (v.lane === 'west' && Math.abs(v.x - (startX - 10)) < 12) removeVehicle(v.id)
    const v = spawnVehicle({ kind: chase.params.kind || driver?.kind || 'danfo', lane: 'west', slogan: driver?.slogan || "GOD'S TIME IS THE BEST", tag: { chaseTarget: true }, force: true })
    v.x = startX - 9
    v.speed = 3
    vehicleRef.current = v
    return undefined
  }, [chase.started]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      if (vehicleRef.current) removeVehicle(vehicleRef.current.id)
      playerState.canRun = true
    },
    [],
  )

  useFrame((_, raw) => {
    const s = useChase.getState()
    const v = vehicleRef.current
    if (!s.started || s.ended || !v) return
    const dt = Math.min(raw, 0.05)
    elapsed.current += dt
    const p = playerState.position

    // go-slow: pick a new speed every ~1.5 s
    const diff = s.params.difficulty ?? 1
    if (elapsed.current > profile.current.until) {
      const r = Math.random()
      const speed = r < 0.25 ? 0.6 : r < 0.7 ? 3 + diff * 0.5 : 5.5 + diff
      profile.current = { until: elapsed.current + 1 + Math.random() * 1.5, speed }
    }
    v.maxSpeed = profile.current.speed

    // obstacles block; pedestrians make you stumble
    resolveCollisions(p, 0.35, staticColliders, null)
    for (const w of walkerPos.values()) {
      if (Math.hypot(p.x - w.x, p.z - w.z) < 0.6 && performance.now() > playerState.stunUntil + 400) {
        playerState.stunUntil = performance.now() + 700
        useChase.setState({ bumps: s.bumps + 1 })
      }
    }

    // stamina
    let stamina = s.stamina
    let used = s.staminaUsed
    if (playerState.running) {
      stamina = Math.max(0, stamina - DRAIN * dt)
      used += DRAIN * dt
    } else stamina = Math.min(s.maxStamina, stamina + REGEN * dt * (playerState.moving ? 0.6 : 1))
    if (stamina <= 0) playerState.canRun = false
    else if (stamina > s.maxStamina * 0.25) playerState.canRun = true

    const d = sideDistance(p, v)
    const timeLeft = Math.max(0, (s.params.timeLimit ?? 45) - elapsed.current)
    useChase.setState({ stamina, staminaUsed: used, distance: d, canGrab: d < GRAB_DISTANCE, timeLeft })

    if (v.x < escapeX) s.end('lost', 'escaped')
    else if (timeLeft <= 0) s.end('lost', 'time')
  })

  if (!chase.active) return null
  return (
    <group>
      {obstacles.statics.map((o, i) => (
        <Model key={i} name={o.model} position={[o.x, GROUND_Y, o.z]} rotation-y={(o.rot * Math.PI) / 180} />
      ))}
      {obstacles.walkers.map((w) => (
        <Suspense key={w.seed} fallback={null}>
          <Walker w={w} colliders={walkerPos} />
        </Suspense>
      ))}
    </group>
  )
}
