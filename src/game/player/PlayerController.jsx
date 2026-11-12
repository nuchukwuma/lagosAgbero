import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import Character from '../characters/Character.jsx'
import { input, readMove, attachKeyboard } from './input.js'
import { playerState } from '../world/worldState.js'
import { resolveCollisions, GROUND_Y } from '../world/layout.js'
import { CHARACTER } from '../../assets/assetManifest.js'
import { vehicleColliders } from '../systems/traffic.js'

// Moves the player around the street. "Up" on the joystick / W walks away
// from the camera (north, -Z, in the normal view). Animations follow speed: idle / walk / run.

const WALK_SPEED = 1.9 // m/s
const RUN_SPEED = 4.8
const RADIUS = 0.35
const TURN_RATE = 12 // how quickly the body turns to face the way you move

// Play locomotion clips at the speed that matches how fast we move, so feet
// don't slide. The chibi body has short legs, hence the extra factor.
const clipRate = (clip, speed) => {
  const natural = CHARACTER.clips[clip]?.rootMotion?.speed || 1
  return Math.min(2.2, Math.max(0.6, (speed / natural) * 0.85))
}

export default function PlayerController({ layout, look, enabled, eyeRed = 0, tired = false }) {
  const ref = useRef()
  const [anim, setAnim] = useState({ name: 'idle', speed: 1 })
  const animRef = useRef(anim)
  const basis = useRef(false)

  useEffect(() => attachKeyboard(), [])
  useEffect(() => {
    input.enabled = enabled
    if (!enabled) input.joy.x = input.joy.y = 0
  }, [enabled])

  useFrame((_, rawDelta) => {
    const g = ref.current
    if (!g) return
    const dt = Math.min(rawDelta, 0.05)
    const p = playerState.position

    if (playerState.teleport) {
      const t = playerState.teleport
      p.set(t.x, GROUND_Y, t.z)
      playerState.facing = t.facing ?? playerState.facing
      playerState.teleport = null
    }

    let next = { name: 'idle', speed: 1 }
    const stunned = performance.now() < playerState.stunUntil
    const gesture = playerState.gesture && performance.now() < playerState.gesture.until ? playerState.gesture : null
    if (!gesture) playerState.gesture = null
    const m = enabled && !stunned && !gesture ? readMove() : { x: 0, y: 0, len: 0 }
    playerState.running = false
    playerState.moving = false
    if (stunned) next = { name: 'bumped', speed: 1.3 }
    else if (gesture) next = { name: gesture.name, speed: gesture.speed }
    else if (m.len > 0.08) {
      const running = (m.run || m.len > 0.95) && playerState.canRun && !tired
      playerState.running = running
      playerState.moving = true
      const speed = (running ? RUN_SPEED : WALK_SPEED) * Math.max(0.5, m.len)
      // screen up = away from the camera: north (-Z) normally, south when the
      // camera films from the north. The direction only changes while the
      // stick is at rest, so a camera flip never reverses a walk in progress.
      const flip = basis.current ? -1 : 1
      const dx = m.x * flip
      const dz = -m.y * flip
      const len = Math.hypot(dx, dz) || 1
      p.x += (dx / len) * speed * dt
      p.z += (dz / len) * speed * dt
      resolveCollisions(p, RADIUS, layout.colliders, layout.bounds)
      resolveCollisions(p, RADIUS, vehicleColliders(), layout.bounds)
      const target = Math.atan2(dx, dz)
      let diff = target - playerState.facing
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      playerState.facing += diff * Math.min(1, TURN_RATE * dt)
      const clip = running ? 'run' : tired ? 'drunkWalk' : 'walk'
      next = { name: clip, speed: Math.round(clipRate(clip, speed) * 10) / 10 }
    }

    if (m.len <= 0.08) basis.current = playerState.viewFlipped

    g.position.copy(p)
    g.rotation.y = playerState.facing
    if (next.name !== animRef.current.name || next.speed !== animRef.current.speed) {
      animRef.current = next
      setAnim(next)
    }
  })

  return <Character ref={ref} look={{ ...look, eyeRed }} animation={anim.name} speed={anim.speed} />
}
