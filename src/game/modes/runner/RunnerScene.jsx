import { Suspense, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ModelInstances, Model } from '../../world/Model.jsx'
import Character from '../../characters/Character.jsx'
import { randomLook } from '../../characters/look.js'
import Sign from '../../world/Sign.jsx'
import { useRunner, runnerInput } from './runnerStore.js'
import { createRun, stepRun } from './runnerLogic.js'
import { playerState } from '../../world/worldState.js'
import { useGameStore } from '../../store/gameStore.js'
import characters from '../../data/characters.json'
import { sfx } from '../../audio/audio.js'

// The escape run: a straight Lagos road built from the same street pieces.
// The player runs towards -Z; lanes are 2.6 m apart.

const LANE_W = 2.6

// Who is behind you (params.chaser)
export const CHASERS = {
  taskForce: { look: 'bassey', vehicle: 'taskForceVan', text: 'Task Force dey behind you!' },
  hyenas: { look: { shirt: '#8e44ad', trousers: '#ffffff' }, vehicle: 'bigManSuv', text: 'The Hyenas dey behind you.' },
  fellowship: { look: { body: 'male_longsleeve', shirt: '#fbfbfb', trousers: '#fbfbfb' }, seed: 151, vehicle: 'bigManSuv', text: 'Men in white are running after you. They are not shouting. That is worse.' },
  dons: { look: { shirt: '#c0392b', trousers: '#1a1a1a', accessories: [{ type: 'bandana', color: '#c0392b' }] }, seed: 171, vehicle: null, text: 'Crimson Dons behind you. Run!' },
  villagers: { look: { shirt: '#7b241c' }, seed: 191, vehicle: null, text: 'Half the village is chasing you. With brooms.' },
  mob: { look: { shirt: '#5d4037' }, seed: 211, vehicle: null, text: 'An angry crowd dey behind you!' },
}
const Y = 0.02
const BUILDINGS = ['shopHouseA', 'tenementA', 'tenementB', 'storeyHouseA', 'shopRow', 'warehouseA', 'bungalowWide', 'storeyHouseC']
const bannerMat = new THREE.MeshLambertMaterial({ color: '#c0392b' })
const poleMat = new THREE.MeshLambertMaterial({ color: '#3c3f44' })
const noteMat = new THREE.MeshBasicMaterial({ color: '#2ecc71', side: THREE.DoubleSide })

function Course({ run }) {
  const goal = run.goal
  const road = useMemo(() => {
    const items = []
    for (let d = -24; d < goal + 60; d += 8) items.push({ position: [0, 0, -d], rotation: 90 })
    return items
  }, [goal])
  const buildings = useMemo(() => {
    const byModel = {}
    let i = 0
    for (let d = -10; d < goal + 60; d += 13) {
      for (const side of [-1, 1]) {
        const m = BUILDINGS[(i++ * 7) % BUILDINGS.length]
        ;(byModel[m] ||= []).push({ position: [side * 13, Y, -d], rotation: side > 0 ? 270 : 90 })
      }
    }
    return byModel
  }, [goal])
  const poles = useMemo(() => {
    const items = []
    for (let d = 0; d < goal + 60; d += 16) for (const side of [-1, 1]) items.push({ position: [side * 5.6, Y, -d], rotation: 0, scale: 1.5 })
    return items
  }, [goal])
  const groups = useMemo(() => {
    const block = []
    const low = []
    const cones = []
    for (const it of run.items) {
      const x = it.lane * LANE_W
      if (it.kind === 'block') block.push({ position: [x, Y, -it.d], rotation: (it.d * 37) % 2 > 1 ? 0 : 180 })
      if (it.kind === 'low') ((it.d * 13) % 2 > 1 ? low : cones).push({ position: [x, Y, -it.d], rotation: it.d * 40 })
    }
    return { block, low, cones }
  }, [run])
  const banners = run.items.filter((it) => it.kind === 'high')
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.04, -goal / 2]}>
        <planeGeometry args={[80, goal + 140]} />
        <meshLambertMaterial color="#9c6b43" />
      </mesh>
      <ModelInstances name="roadStraight" items={road} />
      {Object.entries(buildings).map(([m, items]) => (
        <ModelInstances key={m} name={m} items={items} />
      ))}
      <ModelInstances name="electricityPoleSingle" items={poles} />
      <ModelInstances name="danfo" items={groups.block} />
      <ModelInstances name="carton" items={groups.low} />
      <ModelInstances name="cone" items={groups.cones} />
      {banners.map((b, i) => (
        <group key={i} position={[b.lane * LANE_W, Y, -b.d]}>
          <mesh material={bannerMat} position={[0, 1.55, 0]}>
            <boxGeometry args={[2.3, 0.5, 0.06]} />
          </mesh>
          {[-1.2, 1.2].map((x) => (
            <mesh key={x} material={poleMat} position={[x, 0.9, 0]}>
              <boxGeometry args={[0.08, 1.8, 0.08]} />
            </mesh>
          ))}
        </group>
      ))}
      <Sign at={[0, -goal - 4, 0]} y={4} size={[8, 1.4]} lines={['YOU DON ESCAPE!']} bg="#2f8f5b" fg="#fff" post />
    </group>
  )
}

function Notes({ run }) {
  const refs = useRef([])
  const notes = useMemo(() => run.items.filter((it) => it.kind === 'note'), [run])
  useFrame((state) => {
    notes.forEach((n, i) => {
      const m = refs.current[i]
      if (!m) return
      m.visible = !n.done
      m.rotation.y = state.clock.elapsedTime * 3
    })
  })
  return notes.map((n, i) => (
    <mesh key={i} ref={(el) => (refs.current[i] = el)} material={noteMat} position={[n.lane * LANE_W, 1.0, -n.d]}>
      <planeGeometry args={[0.6, 0.3]} />
    </mesh>
  ))
}

export default function RunnerScene({ playerLook }) {
  const params = useRunner((s) => s.params)
  const started = useRunner((s) => s.started)
  const energy = useGameStore((s) => s.game?.stats.energy ?? 70)
  const run = useMemo(() => createRun({ goal: params.goal ?? 320, seed: params.seed ?? Math.floor(Math.random() * 1000), difficulty: params.difficulty ?? 1, energy }), [params]) // eslint-disable-line react-hooks/exhaustive-deps
  const player = useRef()
  const chasers = useRef()
  const [anim, setAnim] = useState('run')
  const hudTimer = useRef(0)
  const ended = useRef(false)
  const chaser = CHASERS[params.chaser] || CHASERS.taskForce
  const chaserLook = useMemo(() => (chaser.look === 'bassey' ? characters.bassey.look : { ...randomLook(chaser.seed || 131, 'male'), ...chaser.look }), [chaser])

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05)
    if (started && !run.over) {
      if (runnerInput.jump) sfx('jump')
      if (runnerInput.slide) sfx('slide')
      stepRun(run, { ...runnerInput }, dt)
      for (const ev of run.events) sfx(ev.type === 'note' ? 'coin' : 'bump')
      runnerInput.left = runnerInput.right = runnerInput.jump = runnerInput.slide = false
      hudTimer.current -= dt
      if (hudTimer.current <= 0 || run.events.length) {
        hudTimer.current = 0.15
        useRunner.setState({ hud: { distance: run.distance, goal: run.goal, hits: run.hits, maxHits: run.maxHits, notes: run.notes, pursuer: run.pursuer } })
      }
    }
    if (run.over && !ended.current) {
      ended.current = true
      setTimeout(() => useRunner.getState().end(run.over), 900)
    }
    const x = run.laneX * LANE_W
    const z = -run.distance
    const jumpY = run.jumpT > 0 ? Math.sin((1 - run.jumpT / 0.6) * Math.PI) * 1.3 : 0
    if (player.current) {
      player.current.position.set(x, Y + jumpY, z)
      player.current.rotation.y = Math.PI // facing -Z
    }
    if (chasers.current) chasers.current.position.set(0, Y, z + run.pursuer + 2)
    playerState.runnerView = { x, z }
    const next = run.over === 'caught' ? 'stunned' : run.stumbleT > 0 ? 'bumped' : run.slideT > 0 ? 'slide' : run.jumpT > 0 ? 'roll' : 'run'
    if (next !== anim) setAnim(next)
  })

  return (
    <group>
      <Course run={run} />
      <Notes run={run} />
      <Suspense fallback={null}>
        <Character ref={player} look={playerLook} animation={anim} speed={anim === 'run' ? 1.2 : anim === 'roll' ? 1.6 : 1.4} />
        <group ref={chasers}>
          {chaser.vehicle && <Model name={chaser.vehicle} position={[2.6, 0, 5]} rotation-y={Math.PI} />}
          <Character look={chaserLook} animation="run" speed={1.2} position={[-1.2, 0, 0]} rotation-y={Math.PI} />
          <Character look={{ ...chaserLook, skin: '#4e2f1d' }} animation="run" speed={1.15} position={[1.0, 0, 1.4]} rotation-y={Math.PI} />
        </group>
      </Suspense>
    </group>
  )
}
