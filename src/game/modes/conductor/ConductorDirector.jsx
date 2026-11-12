import { Suspense, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useBus } from './ConductorMode.jsx'
import { spawnVehicle, removeVehicle, LANES } from '../../systems/traffic.js'
import Character from '../../characters/Character.jsx'
import { playerState } from '../../world/worldState.js'
import { GROUND_Y } from '../../world/layout.js'

// The conductor's danfo in the 3D street: drives east between stops, pulls
// in when the mission is at a stop, and wraps around to "the next part of
// the route". The player hangs out of the side door.

const LANE = 'east'

export default function ConductorDirector({ playerLook, slogan = 'NO TELLING' }) {
  const bus = useRef(null)
  const conductor = useRef()
  const phase = useBus((s) => s.phase)

  useEffect(() => {
    const home = { x: playerState.position.x, z: playerState.position.z, facing: playerState.facing }
    const v = spawnVehicle({ kind: 'danfo', lane: LANE, slogan, tag: { conductorBus: true }, force: true })
    v.x = -40
    v.speed = 0
    bus.current = v
    return () => {
      removeVehicle(v.id)
      playerState.vehicleView = null
      playerState.teleport = home // step off where you boarded
    }
  }, [slogan])

  useFrame(() => {
    const v = bus.current
    if (!v) return
    v.maxSpeed = phase === 'driving' ? 9 : 0
    if (v.x > 70) v.x = -75 // next stretch of the route
    const z = LANES[LANE].z
    playerState.vehicleView = { x: v.x, z }
    if (conductor.current) {
      conductor.current.position.set(v.x - 1.3, GROUND_Y + 0.15, z + 1.15)
      conductor.current.rotation.y = 0.4
    }
  })

  return (
    <Suspense fallback={null}>
      <Character ref={conductor} look={playerLook} animation={phase === 'driving' ? 'goofyRun' : 'talk'} speed={phase === 'driving' ? 0.4 : 1} />
    </Suspense>
  )
}
