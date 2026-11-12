import { useEffect, useReducer, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import Vehicle from '../vehicles/Vehicle.jsx'
import { traffic, updateTraffic, spawnVehicle, clearTraffic, randomKind, randomSlogan, LANES } from '../systems/traffic.js'
import { playerState, useWorldStore } from './worldState.js'
import { randomLook } from '../characters/look.js'
import { GROUND_Y } from './layout.js'
import vehicleData from '../data/vehicles.json'

// Keeps the road alive: ambient vehicles in both lanes, danfos that pull in
// at the Front Stop, plus whatever a gameplay mode spawns (fee runs).

const FRONT_STOP_X = -20 // where a westbound danfo's nose stops at the Front Stop

function TrafficVehicle({ v }) {
  const ref = useRef()
  useFrame(() => {
    if (!ref.current) return
    ref.current.position.set(v.x, GROUND_Y, LANES[v.lane].z)
  })
  const yaw = LANES[v.lane].dir > 0 ? Math.PI / 2 : -Math.PI / 2
  return <Vehicle ref={ref} kind={v.kind} slogan={v.slogan} color={v.color} riderLook={v.riderLook} position={[v.x, GROUND_Y, LANES[v.lane].z]} rotation-y={yaw} />
}

export default function Traffic({ density = 3, paused = false, raining = false }) {
  const [, rerender] = useReducer((n) => n + 1, 0)
  const seen = useRef(-1)
  const timers = useRef({ west: 0.5, east: 2 })

  useEffect(() => () => clearTraffic(), [])

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05)
    if (!paused) {
      const jam = performance.now() < useWorldStore.getState().jamUntil
      const want = jam ? density + 3 : density
      for (const lane of ['west', 'east']) {
        timers.current[lane] -= dt
        const ambient = traffic.vehicles.filter((v) => v.lane === lane && v.tag.ambient).length
        if (timers.current[lane] <= 0 && ambient < want) {
          const kind = randomKind()
          const seed = traffic.nextId * 13 + 7
          const isDanfo = kind === 'danfo'
          const v = spawnVehicle({
            kind,
            lane,
            tag: { ambient: true },
            slogan: isDanfo ? randomSlogan() : null,
            color: kind === 'keke' ? vehicleData.kekeColors[seed % vehicleData.kekeColors.length] : kind === 'okada' ? vehicleData.okadaColors[seed % vehicleData.okadaColors.length] : null,
            riderLook: kind === 'keke' || kind === 'okada' ? randomLook(seed, 'male') : null,
            stopAt: isDanfo && lane === 'west' && Math.random() < 0.45 ? { x: FRONT_STOP_X, wait: 3 + Math.random() * 3 } : null,
          })
          timers.current[lane] = v ? 4 + Math.random() * 6 : 1
        }
      }
      updateTraffic(dt, playerState.position, jam ? 0.3 : raining ? 0.75 : 1)
    }
    if (traffic.version !== seen.current) {
      seen.current = traffic.version
      rerender()
    }
  })

  return traffic.vehicles.map((v) => <TrafficVehicle key={v.id} v={v} />)
}
