import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { PerformanceMonitor } from '@react-three/drei'
import Lighting from './Lighting.jsx'
import Sky from './Sky.jsx'
import Crowd from './Crowd.jsx'
import { BlobShadows } from './Shadows.jsx'
import { storyCtx } from '../narrative/storyData.js'
import StreetScene from './StreetScene.jsx'
import NPCs from './NPCs.jsx'
import CameraRig from './CameraRig.jsx'
import GoalTracker from './GoalTracker.jsx'
import PlayerController from '../player/PlayerController.jsx'
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
import DriveScene from '../modes/drive/DriveScene.jsx'
import { useDrive } from '../modes/drive/driveStore.js'
import { useSettings, renderProfile } from '../store/settings.js'
import { withAllegiance } from '../characters/look.js'
import { useRunner } from '../modes/runner/runnerStore.js'
import ConductorDirector from '../modes/conductor/ConductorDirector.jsx'
import { useBus } from '../modes/conductor/ConductorMode.jsx'
import { WORLD_MODES } from '../modes/modeRegistry.js'
import { LOW_ENERGY } from '../systems/energy.js'
import VendorTracker from './VendorTracker.jsx'
import ActivityTracker from './ActivityTracker.jsx'
import QuestTracker from './QuestTracker.jsx'
import Pickups from './Pickups.jsx'
import { getLayout } from './worlds.js'

// The 3D street behind the story. The story view decides:
//   location   where the player stands when a scene starts
//   time       dawn / day / dusk / night lighting
//   speaker    who the camera frames and who plays "talk"
//   freeRoam   player control + goal marker

export const STREET_LAYOUT = getLayout('iyanaWahala') // kept for tools and tests
const DIALOGUE_VIEWS = new Set(['dialogue', 'choice', 'news'])
const DEG = Math.PI / 180

function useSceneTeleport(view, layout) {
  const last = useRef(null)
  const lastStory = useRef(null) // the last scene of a normal (non-common) chapter
  useEffect(() => {
    const key = `${layout.id}/${view.chapterId}/${view.sceneId}`
    if (last.current === key) return
    // first scene, or a different world (village -> Lagos): start somewhere sensible
    const first = last.current === null || !last.current.startsWith(`${layout.id}/`)
    last.current = key
    if (storyCtx.chapters[view.chapterId]?.common) return // side quests, events, raids: stay put
    // back from a quest / event / raid to the scene that was interrupted:
    // the player stays where they were
    const resumed = lastStory.current === key
    lastStory.current = key
    if (resumed) return
    const spot = view.location ? layout.spots[view.location] : null
    if (spot) playerState.teleport = { x: spot.pos[0], z: spot.pos[1], facing: (spot.facing ?? 0) * DEG }
    else if (first) playerState.teleport = { x: layout.spawn.pos[0], z: layout.spawn.pos[1], facing: (layout.spawn.facing ?? 0) * DEG }
  }, [view.chapterId, view.sceneId, view.location, layout])
}

// Fetch the clips everyone uses straight away, so nobody pops from the
// fallback pose into breathing/walking a second later.
const COMMON_CLIPS = ['breathingIdle', 'walk', 'run', 'talk', 'argue', 'pickUp']

export default function GameCanvas({ view, game, activity = null, paused = false, onGoalReached }) {
  const layout = getLayout(view.world) // Iyana-Wahala, the village, the campus...
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
  const driveOn = useDrive((s) => s.active) && modeName === 'drive'
  const fightOpponent = useFight((s) => (s.active ? opponentProfile(s.params.opponent).character : null))
  const talking = DIALOGUE_VIEWS.has(view.type)
  const speaker = talking ? view.speaker : null
  const eyeRed = Math.min(1, Math.max(0, game.stats.energy / 100))
  const look = useMemo(() => withAllegiance(game.player.look || {}, game.flags), [game.player.look, game.flags.tortoise, game.flags.leftTortoises, game.flags.hidesColours]) // eslint-disable-line react-hooks/exhaustive-deps
  // Drop the render resolution on slow phones, raise it again if there's room.
  // Settings: auto lets PerformanceMonitor pick; low / high fix the resolution.
  const chosen = useSettings((s) => s.quality)
  const profile = renderProfile(chosen)
  const quality = profile.quality // 'auto' on a budget phone becomes 'low'
  const range = profile.dpr
  const [dpr, setDpr] = useState(range.max)
  useEffect(() => setDpr(range.max), [quality]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Canvas
      key={profile.antialias ? 'aa' : 'no-aa'} // antialiasing can only be chosen when the canvas is created
      className="game-canvas"
      dpr={dpr}
      gl={{ antialias: profile.antialias, powerPreference: 'high-performance', stencil: true }}
      camera={{ fov: 50, near: 0.3, far: profile.far, position: [0, 8, 12] }}
      onCreated={({ gl, scene, camera }) => {
        if (import.meta.env.DEV) Object.assign(window, { __gl: gl, __scene: scene, __cam: camera, __THREE: THREE }) // dev: perf checks
      }}
    >
      <PerformanceMonitor onDecline={() => setDpr(range.min)} onIncline={() => setDpr(range.max)} flipflops={3} onFallback={() => setDpr(range.min)} />
      <Lighting time={view.time} raining={Boolean(game.flags.raining)} />
      <Sky />
      <BlobShadows />
      {driveOn ? (
        <Suspense fallback={null}>
          <DriveScene />
        </Suspense>
      ) : runnerOn ? (
        <Suspense fallback={null}>
          <RunnerScene playerLook={look} />
        </Suspense>
      ) : (
      <Suspense fallback={null}>
          <StreetScene key={`scene-${layout.id}`} layout={layout} />
          <group userData={{ tag: 'npcs' }}>
          <NPCs layout={layout} flags={game.flags} positions={view.positions} speaker={speaker} mood={view.mood} hidden={fightOpponent ? [fightOpponent] : []} />
          </group>
          {!(fightOn && modeName === 'fight') && !busOn && <PlayerController layout={layout} look={look} enabled={(freeRoam || feeRunActive || chaseActive) && !paused} eyeRed={eyeRed} tired={game.stats.energy < LOW_ENERGY} />}
          {freeRoam && <VendorTracker />}
          {freeRoam && <ActivityTracker layout={layout} game={game} />}
          {freeRoam && <QuestTracker key={`quests-${layout.id}`} game={game} />}
          {freeRoam && <Pickups layout={layout} game={game} />}
          <group userData={{ tag: 'traffic' }}>
            {layout.raw.traffic !== false && <Traffic key={`traffic-${layout.id}`} density={layout.raw.traffic?.density ?? 3} paused={paused} raining={Boolean(game.flags.raining)} />}
          </group>
          <Suspense fallback={null}>
            <group userData={{ tag: 'crowd' }}>
              <Crowd key={`crowd-${layout.id}`} layout={layout} quality={quality} paused={paused} />
            </group>
          </Suspense>
          {worldMode && modeName === 'feeCollection' && <FeeRunDirector />}
          {worldMode && modeName === 'chase' && <ChaseDirector />}
          {worldMode && modeName === 'fight' && fightOn && <FightDirector playerLook={look} />}
          {busOn && <ConductorDirector playerLook={look} slogan={(activity?.params || view.params)?.slogan} />}
        </Suspense>
      )}
      {freeRoam && <GoalTracker key={view.key} goal={view.goal} layout={layout} onReached={onGoalReached} />}
      <CameraRig mode={driveOn ? 'drive' : busOn ? 'vehicle' : runnerOn ? 'runner' : modeName === 'fight' && fightOn ? 'fight' : talking ? 'dialogue' : 'follow'} speaker={speaker} ceiling={runnerOn || driveOn ? null : layout.raw.flyover} obstacles={runnerOn || driveOn ? null : layout.shadows} />
    </Canvas>
  )
}
