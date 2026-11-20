import { Suspense, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ModelInstances, Model } from '../../world/Model.jsx'
import Character from '../../characters/Character.jsx'
import { randomLook } from '../../characters/look.js'
import Sign from '../../world/Sign.jsx'
import { useRunner, runnerInput } from './runnerStore.js'
import { createRun, stepRun, reviveRun, PICKUPS } from './runnerLogic.js'
import { playerState, shake } from '../../world/worldState.js'
import { useGameStore } from '../../store/gameStore.js'
import characters from '../../data/characters.json'
import { sfx } from '../../audio/audio.js'
import { has } from '../../systems/powerups.js'

// The escape run: a straight Lagos road built from the same street pieces.
// The player runs towards -Z; lanes are 2.6 m apart.

const LANE_W = 2.6

// Who is behind you (params.chaser)
export const CHASERS = {
  taskForce: { look: 'bassey', vehicle: 'taskForceVan', text: 'Task Force dey behind you!', back: 'TASK FORCE DEY YOUR BACK!' },
  hyenas: { look: { shirt: '#8e44ad', trousers: '#ffffff' }, vehicle: 'bigManSuv', text: 'The Hyenas dey behind you.', back: 'HYENAS DEY YOUR BACK!' },
  fellowship: { look: { body: 'male_longsleeve', shirt: '#fbfbfb', trousers: '#fbfbfb' }, seed: 151, vehicle: 'bigManSuv', text: 'Men in white are running after you. They are not shouting. That is worse.', back: 'THE MEN IN WHITE ARE RIGHT BEHIND YOU' },
  dons: { look: { shirt: '#c0392b', trousers: '#1a1a1a', accessories: [{ type: 'bandana', color: '#c0392b' }] }, seed: 171, vehicle: null, text: 'Crimson Dons behind you. Run!', back: 'DONS DEY YOUR BACK!' },
  villagers: { look: { shirt: '#7b241c' }, seed: 191, vehicle: null, text: 'Half the village is chasing you. With brooms.', back: 'THE BROOMS DEY YOUR BACK!' },
  mob: { look: { shirt: '#5d4037' }, seed: 211, vehicle: null, text: 'An angry crowd dey behind you!', back: 'THE CROWD DEY YOUR BACK!' },
}
const Y = 0.02
const BUILDINGS = ['shopHouseA', 'tenementA', 'tenementB', 'storeyHouseA', 'shopRow', 'warehouseA', 'bungalowWide', 'storeyHouseC']
const bannerMat = new THREE.MeshLambertMaterial({ color: '#c0392b' })
const poleMat = new THREE.MeshLambertMaterial({ color: '#3c3f44' })
const noteMat = new THREE.MeshBasicMaterial({ color: '#2ecc71', side: THREE.DoubleSide })
// the mid-run power-ups: a red magnet, a gold star, a blue charm
const pickupMats = {
  magnet: new THREE.MeshBasicMaterial({ color: '#e74c3c' }),
  star: new THREE.MeshBasicMaterial({ color: '#ffd23a' }),
  charm: new THREE.MeshBasicMaterial({ color: '#4b8df0' }),
}
const pickupGeos = {
  magnet: new THREE.TorusGeometry(0.32, 0.1, 6, 12, Math.PI),
  star: new THREE.OctahedronGeometry(0.38),
  charm: new THREE.IcosahedronGeometry(0.3),
}
// empty bottles to throw: on the road, and spinning down the lane
const bottleMat = new THREE.MeshLambertMaterial({ color: '#2e7d4f' })
const bottleGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.42, 8)
const bottleRing = new THREE.MeshBasicMaterial({ color: '#ffd23a', transparent: true, opacity: 0.6, side: THREE.DoubleSide })
const ringGeo = new THREE.RingGeometry(0.32, 0.42, 16)

function Bottles({ run, from, to }) {
  const refs = useRef([])
  const list = useMemo(() => run.items.filter((it) => it.kind === 'bottle' && it.d >= from && it.d < to), [run, from, to])
  useFrame((state) => {
    list.forEach((n, i) => {
      const g = refs.current[i]
      if (!g) return
      g.visible = !n.done
      g.rotation.y = state.clock.elapsedTime * 2
    })
  })
  return list.map((n, i) => (
    <group key={i} ref={(el) => (refs.current[i] = el)} position={[n.lane * LANE_W, 0.25, -n.d]}>
      <mesh material={bottleMat} geometry={bottleGeo} />
      <mesh material={bottleRing} geometry={ringGeo} rotation-x={-Math.PI / 2} position-y={-0.2} />
    </group>
  ))
}

const SHOT_POOL = 3
function Shots({ run }) {
  const refs = useRef([])
  useFrame(() => {
    for (let i = 0; i < SHOT_POOL; i++) {
      const m = refs.current[i]
      if (!m) continue
      const sh = run.shots[i]
      m.visible = Boolean(sh)
      if (!sh) continue
      m.position.set(sh.lane * LANE_W, Y + sh.y, -sh.d)
      m.rotation.x = sh.spin
    }
  })
  return Array.from({ length: SHOT_POOL }, (_, i) => <mesh key={i} ref={(el) => (refs.current[i] = el)} material={bottleMat} geometry={bottleGeo} visible={false} />)
}

// The course is drawn for the stretch [from, to): the whole run for a normal
// escape; for an endless run, the current two stretches only (it is rebuilt,
// with a new key, every time the run builds more road).
function Course({ run, from, to }) {
  const goal = run.goal
  const road = useMemo(() => {
    const items = []
    for (let d = Math.floor(from / 8) * 8; d < to; d += 8) items.push({ position: [0, 0, -d], rotation: 90 })
    return items
  }, [from, to])
  const buildings = useMemo(() => {
    const byModel = {}
    let i = Math.floor(from / 13) * 2
    for (let d = Math.floor(from / 13) * 13 + 3; d < to; d += 13) {
      for (const side of [-1, 1]) {
        const m = BUILDINGS[(((i++ * 7) % BUILDINGS.length) + BUILDINGS.length) % BUILDINGS.length] // i can start below zero
        ;(byModel[m] ||= []).push({ position: [side * 13, Y, -d], rotation: side > 0 ? 270 : 90 })
      }
    }
    return byModel
  }, [from, to])
  const poles = useMemo(() => {
    const items = []
    for (let d = Math.max(0, Math.ceil(from / 16) * 16); d < to; d += 16) for (const side of [-1, 1]) items.push({ position: [side * 5.6, Y, -d], rotation: 0, scale: 1.5 })
    return items
  }, [from, to])
  const groups = useMemo(() => {
    const block = []
    const low = []
    const cones = []
    for (const it of run.items) {
      if (it.d < from || it.d >= to) continue
      const x = it.lane * LANE_W
      if (it.kind === 'block') block.push({ position: [x, Y, -it.d], rotation: (it.d * 37) % 2 > 1 ? 0 : 180 })
      if (it.kind === 'low') ((it.d * 13) % 2 > 1 ? low : cones).push({ position: [x, Y, -it.d], rotation: it.d * 40 })
    }
    return { block, low, cones }
  }, [run, from, to])
  const banners = run.items.filter((it) => it.kind === 'high' && it.d >= from && it.d < to)
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.04, -(from + to) / 2]}>
        <planeGeometry args={[80, to - from + 80]} />
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
      {!run.endless && <Sign at={[0, -goal - 4, 0]} y={4} size={[8, 1.4]} lines={['YOU DON ESCAPE!']} bg="#2f8f5b" fg="#fff" post />}
    </group>
  )
}

function Notes({ run, from, to }) {
  const refs = useRef([])
  const notes = useMemo(() => run.items.filter((it) => it.kind === 'note' && it.d >= from && it.d < to), [run, from, to])
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

function Pickups({ run, from, to }) {
  const refs = useRef([])
  const list = useMemo(() => run.items.filter((it) => PICKUPS[it.kind] && it.d >= from && it.d < to), [run, from, to])
  useFrame((state) => {
    list.forEach((n, i) => {
      const m = refs.current[i]
      if (!m) return
      m.visible = !n.done
      m.rotation.y = state.clock.elapsedTime * 2.5
      m.position.y = 1.1 + Math.sin(state.clock.elapsedTime * 4 + i) * 0.15
    })
  })
  return list.map((n, i) => <mesh key={i} ref={(el) => (refs.current[i] = el)} material={pickupMats[n.kind]} geometry={pickupGeos[n.kind]} position={[n.lane * LANE_W, 1.1, -n.d]} />)
}

// Oncoming danfos and taxis: each drives down its lane towards you once it
// sets off (runnerLogic), and is hidden until then.
function Cars({ run, from, to }) {
  const refs = useRef([])
  const cars = useMemo(() => run.items.filter((it) => it.kind === 'car' && it.meet >= from && it.meet < to), [run, from, to])
  useFrame(() => {
    cars.forEach((c, i) => {
      const m = refs.current[i]
      if (!m) return
      m.visible = c.active && c.d > run.distance - 12
      if (!m.visible) return
      const off = (c.off || 0) * (c.swerve || 0)
      m.position.set(c.lane * LANE_W + off, Y, -c.d)
      m.rotation.y = -off * 0.12 // nose turned towards the kerb
    })
  })
  return cars.map((c, i) => (
    <group key={i} ref={(el) => (refs.current[i] = el)} visible={false}>
      <Model name={c.model} />
    </group>
  ))
}

// Officers running at you: a pool of three runners, handed to whichever
// officers are nearest (only a few are ever in view), so the run stays light.
const OFFICER_POOL = 3
function Officers({ run, look }) {
  const refs = useRef([])
  useFrame(() => {
    const near = []
    for (const it of run.items) if (it.kind === 'officer' && it.active && it.d > run.distance - 8 && it.d < run.distance + 70) near.push(it)
    near.sort((a, b) => a.d - b.d)
    for (let i = 0; i < OFFICER_POOL; i++) {
      const g = refs.current[i]
      if (!g) continue
      const it = near[i]
      g.visible = Boolean(it)
      if (!it) continue
      g.position.set(it.lane * LANE_W, Y, -it.d)
      g.rotation.y = 0 // running towards you (+Z)
      g.rotation.x = it.downed ? -1.45 : it.grabbed ? -0.5 : 0 // knocked flat by a bottle, or missed you and went sprawling
    }
  })
  return Array.from({ length: OFFICER_POOL }, (_, i) => (
    <group key={i} ref={(el) => (refs.current[i] = el)} visible={false}>
      <Character look={look} animation="run" speed={1.25} />
    </group>
  ))
}

export default function RunnerScene({ playerLook }) {
  const params = useRunner((s) => s.params)
  const started = useRunner((s) => s.started)
  const energy = useGameStore((s) => s.game?.stats.energy ?? 70)
  const run = useMemo(() => createRun({ goal: params.goal ?? 540, seed: params.seed ?? Math.floor(Math.random() * 1000), difficulty: params.difficulty ?? 1, energy, endless: Boolean(params.endless) }), [params]) // eslint-disable-line react-hooks/exhaustive-deps
  if (import.meta.env.DEV && typeof window !== 'undefined') window.__run = run // dev bots: read the run
  const [builtTo, setBuiltTo] = useState(run.builtTo) // endless runs: redraw the road when more is built
  const player = useRef()
  const chasers = useRef()
  const [anim, setAnim] = useState('run')
  const hudTimer = useRef(0)
  const ended = useRef(false)
  const chaser = CHASERS[params.chaser] || CHASERS.taskForce
  const shown = useRef(run.pursuer) // how far behind the chasers are drawn
  const chaserLook = useMemo(() => (chaser.look === 'bassey' ? characters.bassey.look : { ...randomLook(chaser.seed || 131, 'male'), ...chaser.look }), [chaser])

  // power-ups, applied when the run starts: a free stumble, a head start
  const boosted = useRef(false)
  useFrame((_, raw) => {
    const dt = Math.max(0, Math.min(raw, 0.05))
    if (started && !boosted.current) {
      boosted.current = true
      if (has('charm')) run.maxHits += 1
      if (has('headStart')) run.pursuer += 15
    }
    // "Keep running" after an ad: back on your feet
    if (useRunner.getState().reviveReq) {
      reviveRun(run)
      ended.current = false
      useRunner.setState({ reviveReq: false, ended: null })
      sfx('whistle')
    }
    if (started && !run.over) {
      if (runnerInput.slide) sfx('slide')
      stepRun(run, { ...runnerInput }, dt)
      for (const ev of run.events) {
        if (ev.type === 'horn') sfx('horn')
        else if (ev.type === 'officer') sfx('whistle')
        else if (ev.type === 'hit') {
          sfx(ev.kind === 'car' ? 'crash' : ev.kind === 'officer' ? 'hurt' : 'bump')
          sfx('whistle') // and they're on you
        } else if (ev.type === 'power') sfx('special')
        else if (ev.type === 'throw') sfx('whoosh')
        else if (ev.type === 'down') sfx('punch')
        else if (ev.type === 'ammo') sfx('click')
        else if (ev.type === 'saved' || ev.type === 'smash') sfx('block')
        else sfx(ev.type === 'note' ? 'coin' : 'jump')
      }
      runnerInput.left = runnerInput.right = runnerInput.jump = runnerInput.slide = runnerInput.throw = false
      hudTimer.current -= dt
      if (hudTimer.current <= 0 || run.events.length) {
        hudTimer.current = 0.15
        useRunner.setState({ hud: { distance: run.distance, goal: run.goal, hits: run.hits, maxHits: run.maxHits, notes: run.notes, pursuer: run.pursuer, endless: run.endless, close: run.closeT > 0, magnet: run.magnetT, star: run.invT, charms: run.charms, ammo: run.ammo } })
      }
      if (run.builtTo !== builtTo) setBuiltTo(run.builtTo)
      for (const ev of run.events) if (ev.type === 'hit') shake(0.35, 0.3)
    }
    if (run.over && !ended.current) {
      ended.current = true
      setTimeout(() => useRunner.getState().end(run.over), 900)
    }
    const x = run.laneX * LANE_W
    const z = -run.distance
    const jumpY = run.y
    if (player.current) {
      player.current.position.set(x, Y + jumpY, z)
      player.current.rotation.y = Math.PI // facing -Z
      // untouchable: the runner flickers
      player.current.visible = !(run.invT > 0 && run.invT < 5.5 && Math.floor(run.invT * 10) % 2)
    }
    // The chasers are drawn where they are: normally too far back to see. Right
    // after a stumble they rush up to your back (in view, under the camera)
    // and stay there a few seconds, then drop back as you get away.
    const target = run.over === 'caught' ? 0.4 : run.closeT > 0 ? Math.min(run.pursuer, 1.1) : run.pursuer
    shown.current += (target - shown.current) * (1 - Math.exp(-dt * (target < shown.current ? 7 : 1.1)))
    if (chasers.current) chasers.current.position.set(run.laneX * LANE_W * 0.6, Y, z + shown.current)
    playerState.runnerView = { x, z }
    const next = run.over === 'caught' ? 'stunned' : run.stumbleT > 0 ? 'bumped' : run.slideT > 0 ? 'slide' : run.jumpT > 0 ? 'roll' : 'run'
    if (next !== anim) setAnim(next)
  })

  return (
    <group>
      {run.endless ? (
        <>
          <Course key={builtTo} run={run} from={Math.max(-24, builtTo - 480)} to={builtTo + 40} />
          <Notes key={`n${builtTo}`} run={run} from={Math.max(0, builtTo - 480)} to={builtTo + 40} />
          <Pickups key={`p${builtTo}`} run={run} from={Math.max(0, builtTo - 480)} to={builtTo + 40} />
          <Bottles key={`b${builtTo}`} run={run} from={Math.max(0, builtTo - 480)} to={builtTo + 40} />
          <Cars key={`c${builtTo}`} run={run} from={Math.max(0, builtTo - 480)} to={builtTo + 40} />
        </>
      ) : (
        <>
          <Course run={run} from={-24} to={run.goal + 60} />
          <Notes run={run} from={0} to={run.goal + 60} />
          <Pickups run={run} from={0} to={run.goal + 60} />
          <Bottles run={run} from={0} to={run.goal + 60} />
          <Cars run={run} from={0} to={run.goal + 60} />
        </>
      )}
      <Suspense fallback={null}>
        <Character ref={player} look={playerLook} animation={anim} speed={anim === 'run' ? 1.2 : anim === 'roll' ? 1.6 : 1.4} />
        <Officers run={run} look={characters.bassey.look} />
        <Shots run={run} />
        <group ref={chasers}>
          {chaser.vehicle && <Model name={chaser.vehicle} position={[2.6, 0, 5]} rotation-y={Math.PI} />}
          <Character look={chaserLook} animation="run" speed={1.2} position={[-1.3, 0, 0]} rotation-y={Math.PI} />
          <Character look={{ ...chaserLook, skin: '#4e2f1d' }} animation="run" speed={1.15} position={[1.3, 0, 0.5]} rotation-y={Math.PI} />
        </group>
      </Suspense>
    </group>
  )
}
