import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useFeeRun } from './feeRunStore.js'
import { traffic, spawnVehicle, LANES } from '../../systems/traffic.js'
import { playerState } from '../../world/worldState.js'
import { randomLook } from '../../characters/look.js'
import { GROUND_Y } from '../../world/layout.js'
import vehicleData from '../../data/vehicles.json'
import { randomSlogan } from '../../systems/traffic.js'

// Lives inside the 3D canvas during a fee run:
//   - sends the scheduled vehicles down the west lane to stop at the spot
//   - finds the stopped vehicle the player is close enough to collect from
//   - notices vehicles that leave without paying
//   - draws a bobbing "₦" marker over vehicles still waiting to be collected

const REACH = 1.8 // metres from the vehicle's side

function distanceToVehicle(p, v) {
  const z = LANES[v.lane].z
  const dx = Math.max(Math.abs(p.x - v.x) - v.length / 2, 0)
  const dz = Math.max(Math.abs(p.z - z) - v.width / 2, 0)
  return Math.hypot(dx, dz)
}

function Markers() {
  const group = useRef()
  useFrame((state) => {
    const g = group.current
    if (!g) return
    const { near } = useFeeRun.getState()
    const waiting = traffic.vehicles.filter((v) => v.tag.feeRun && !v.tag.done && v.state === 'stopped')
    g.children.forEach((m, i) => {
      const v = waiting[i]
      m.visible = Boolean(v)
      if (!v) return
      m.position.set(v.x, GROUND_Y + 3.1 + Math.sin(state.clock.elapsedTime * 3 + i) * 0.15, LANES[v.lane].z)
      m.rotation.y = state.clock.elapsedTime * 2
      m.scale.setScalar(v.id === near ? 1.4 : 1)
    })
  })
  return (
    <group ref={group}>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} visible={false}>
          <octahedronGeometry args={[0.35, 0]} />
          <meshBasicMaterial color="#8ff0a4" />
        </mesh>
      ))}
    </group>
  )
}

export default function FeeRunDirector() {
  const elapsed = useRef(0)
  const spawned = useRef(0)

  useFrame((_, raw) => {
    const run = useFeeRun.getState()
    if (!run.active || !run.started || run.ended) return
    const dt = Math.min(raw, 0.05)
    elapsed.current += dt
    const timeLeft = Math.max(0, run.duration - elapsed.current)
    if (Math.ceil(timeLeft) !== Math.ceil(run.timeLeft)) useFeeRun.setState({ timeLeft })

    // spawn scheduled vehicles
    const next = run.schedule[spawned.current]
    if (next && elapsed.current >= next.at) {
      const seed = 1000 + spawned.current * 17
      const kind = next.kind
      const v = spawnVehicle({
        kind,
        lane: 'west',
        stopAt: { x: run.stopX, wait: run.params.wait ?? 12 },
        tag: { feeRun: true, driver: next.driver },
        slogan: kind === 'danfo' ? next.driver.slogan || randomSlogan() : null,
        color: kind === 'keke' ? vehicleData.kekeColors[seed % vehicleData.kekeColors.length] : kind === 'okada' ? vehicleData.okadaColors[seed % vehicleData.okadaColors.length] : null,
        riderLook: kind === 'keke' || kind === 'okada' ? randomLook(seed, 'male') : null,
      })
      if (v) spawned.current++
    }

    // nearest collectable vehicle
    let best = null
    let bestD = REACH
    for (const v of traffic.vehicles) {
      if (!v.tag.feeRun) continue
      if (v.state === 'leaving' && !v.tag.done) run.missed(v)
      if (v.tag.done || v.state !== 'stopped') continue
      const d = distanceToVehicle(playerState.position, v)
      if (d < bestD) {
        best = v
        bestD = d
      }
    }
    run.setNear(best ? best.id : null)

    // time up: the run ends once nobody is mid-conversation
    if (timeLeft <= 0 && !run.popup) run.end('done')
  })

  return <Markers />
}
