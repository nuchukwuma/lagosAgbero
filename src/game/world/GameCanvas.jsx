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
import { loadClips } from '../characters/clipLoader.js'
import Traffic from './Traffic.jsx'
import FeeRunDirector from '../modes/feeCollection/FeeRunDirector.jsx'
import { useFeeRun } from '../modes/feeCollection/feeRunStore.js'
import ChaseDirector from '../modes/chase/ChaseDirector.jsx'
import { useChase } from '../modes/chase/chaseStore.js'
import FightDirector from '../modes/fight/FightDirector.jsx'
import { useFight, opponentProfile } from '../modes/fight/fightStore.js'
import RunnerScene from '../modes/runner/RunnerScene.jsx'
import { useSettings, dprFor } from '../store/settings.js'
import { withAllegiance } from '../characters/look.js'
import { useRunner } from '../modes/runner/runnerStore.js'
import ConductorDirector from '../modes/conductor/ConductorDirector.jsx'
import { useBus } from '../modes/conductor/ConductorMode.jsx'
import { WORLD_MODES } from '../modes/modeRegistry.js'
import { LOW_ENERGY } from '../systems/energy.js'
import VendorTracker from './VendorTracker.jsx'
import ActivityTracker from './ActivityTracker.jsx'
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

// Fetch the clips everyone uses straight away, so nobody pops from the
// fallback pose into breathing/walking a second later.
const COMMON_CLIPS = ['breathingIdle', 'walk', 'run', 'talk', 'argue']

export default function GameCanvas({ view, game, activity = null, paused = false, onGoalReached }) {
  const layout = STREET_LAYOUT
  useSceneTeleport(view, layout)
  useEffect(() => {
    loadClips(COMMON_CLIPS).catch(() => {})
  }, [])

  const freeRoam = view.type === 'freeRoam' && !activity
  // a street mode started by the story, or by the player (activity)
  const modeName = activity ? activity.mode : view.type === 'mode' ? view.mode : null
  const worldMode = Boolean(modeName && WORLD_MODES.has(modeName))
  const feeRunActive = useFeeRun((s) => s.active && s.started && !s.ended)
  const chaseActive = useChase((s) => s.active && s.started && !s.ended)
  const fightOn = useFight((s) => s.active)
  const runnerOn = useRunner((s) => s.active) && modeName === 'runner'
  const busOn = useBus((s) => s.active) && modeName === 'conductor'
  const fightOpponent = useFight((s) => (s.active ? opponentProfile(s.params.opponent).character : null))
  const talking = DIALOGUE_VIEWS.has(view.type)
  const speaker = talking ? view.speaker : null
  const eyeRed = Math.min(1, Math.max(0, game.stats.energy / 100))
  const look = useMemo(() => withAllegiance(game.player.look || {}, game.flags), [game.player.look, game.flags.tortoise, game.flags.leftTortoises, game.flags.hidesColours]) // eslint-disable-line react-hooks/exhaustive-deps
  // Drop the render resolution on slow phones, raise it again if there's room.
  // Settings: auto lets PerformanceMonitor pick; low / high fix the resolution.
  const quality = useSettings((s) => s.quality)
  const range = dprFor(quality)
  const [dpr, setDpr] = useState(range.max)
  useEffect(() => setDpr(range.max), [quality]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Canvas
      className="game-canvas"
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 50, near: 0.3, far: 180, position: [0, 8, 12] }}
    >
      <PerformanceMonitor onDecline={() => setDpr(range.min)} onIncline={() => setDpr(range.max)} flipflops={3} onFallback={() => setDpr(range.min)} />
      <Lighting time={view.time} raining={Boolean(game.flags.raining)} />
      {runnerOn ? (
        <Suspense fallback={null}>
          <RunnerScene playerLook={look} />
        </Suspense>
      ) : (
      <Suspense fallback={null}>
          <StreetScene layout={layout} />
          <NPCs layout={layout} flags={game.flags} positions={view.positions} speaker={speaker} mood={view.mood} hidden={fightOpponent ? [fightOpponent] : []} />
          {!(fightOn && modeName === 'fight') && !busOn && <PlayerController layout={layout} look={look} enabled={(freeRoam || feeRunActive || chaseActive) && !paused} eyeRed={eyeRed} tired={game.stats.energy < LOW_ENERGY} />}
          {freeRoam && <VendorTracker />}
          {freeRoam && <ActivityTracker layout={layout} game={game} />}
          <Traffic paused={paused} raining={Boolean(game.flags.raining)} />
          {worldMode && modeName === 'feeCollection' && <FeeRunDirector />}
          {worldMode && modeName === 'chase' && <ChaseDirector />}
          {worldMode && modeName === 'fight' && fightOn && <FightDirector playerLook={look} />}
          {busOn && <ConductorDirector playerLook={look} slogan={(activity?.params || view.params)?.slogan} />}
        </Suspense>
      )}
      {freeRoam && <GoalTracker key={view.key} goal={view.goal} layout={layout} onReached={onGoalReached} />}
      <CameraRig mode={busOn ? 'vehicle' : runnerOn ? 'runner' : modeName === 'fight' && fightOn ? 'fight' : talking ? 'dialogue' : 'follow'} speaker={speaker} ceiling={runnerOn ? null : layout.raw.flyover} />
    </Canvas>
  )
}
