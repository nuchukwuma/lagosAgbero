import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import Lighting from './Lighting.jsx'
import StreetScene from './StreetScene.jsx'
import NPCs from './NPCs.jsx'
import CameraRig from './CameraRig.jsx'
import GoalTracker from './GoalTracker.jsx'
import PlayerController from '../player/PlayerController.jsx'
import { parseLayout } from './layout.js'
import { playerState } from './worldState.js'
import street from '../data/world/iyanaWahala.json'

// The 3D street behind the story. The story view decides:
//   location   where the player stands when a scene starts
//   time       dawn / day / dusk / night lighting
//   speaker    who the camera frames and who plays "talk"
//   freeRoam   player control + goal marker

export const STREET_LAYOUT = parseLayout(street)
const DIALOGUE_VIEWS = new Set(['dialogue', 'choice', 'news'])
const DEG = Math.PI / 180

function useSceneTeleport(view, layout) {
  const last = useRef(null)
  useEffect(() => {
    const key = `${view.chapterId}/${view.sceneId}`
    if (last.current === key) return
    const first = last.current === null
    last.current = key
    const spot = view.location ? layout.spots[view.location] : null
    if (spot) playerState.teleport = { x: spot.pos[0], z: spot.pos[1], facing: (spot.facing ?? 0) * DEG }
    else if (first) playerState.teleport = { x: layout.spawn.pos[0], z: layout.spawn.pos[1], facing: (layout.spawn.facing ?? 0) * DEG }
  }, [view.chapterId, view.sceneId, view.location, layout])
}

export default function GameCanvas({ view, game, paused = false, onGoalReached }) {
  const layout = STREET_LAYOUT
  useSceneTeleport(view, layout)

  const freeRoam = view.type === 'freeRoam'
  const talking = DIALOGUE_VIEWS.has(view.type)
  const speaker = talking ? view.speaker : null
  const eyeRed = Math.min(1, Math.max(0, game.stats.energy / 100))
  const look = useMemo(() => game.player.look || {}, [game.player.look])
  // Drop the render resolution on slow phones, raise it again if there's room.
  const [dpr, setDpr] = useState(1.5)

  return (
    <Canvas
      className="game-canvas"
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 50, near: 0.3, far: 180, position: [0, 8, 12] }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} flipflops={3} onFallback={() => setDpr(1)} />
      <Lighting time={view.time} />
      <Suspense fallback={null}>
        <StreetScene layout={layout} />
        <NPCs layout={layout} flags={game.flags} positions={view.positions} speaker={speaker} mood={view.mood} />
        <PlayerController layout={layout} look={look} enabled={freeRoam && !paused} eyeRed={eyeRed} />
      </Suspense>
      {freeRoam && <GoalTracker key={view.key} goal={view.goal} layout={layout} onReached={onGoalReached} />}
      <CameraRig mode={talking ? 'dialogue' : 'follow'} speaker={speaker} />
    </Canvas>
  )
}
