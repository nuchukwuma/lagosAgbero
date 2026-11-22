import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import Character from '../../characters/Character.jsx'
import { Model } from '../../world/Model.jsx'
import { randomLook } from '../../characters/look.js'
import { GROUND_Y } from '../../world/layout.js'
import { playerState, playGesture, shake } from '../../world/worldState.js'
import { sfx } from '../../audio/audio.js'
import { has } from '../../systems/powerups.js'
import { useStealth, mission } from './stealthStore.js'
import { createMission, stepMission, START, GATE, SEE_RANGE, SEE_HALF } from './stealthLogic.js'

// Back Gate inside the 3D campus at night. Runs the mission every frame:
// guards walk their rounds with a torch beam (it stops at walls and
// containers), the cover for the night stands about, and the back gate waits,
// locked until every guard is asleep. The player is the normal free-roam
// player (PlayerController), crouched.

const RAYS = 28
const beamMats = {
  calm: new THREE.MeshBasicMaterial({ color: '#ffe48a', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
  alert: new THREE.MeshBasicMaterial({ color: '#ffb020', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }),
  chase: new THREE.MeshBasicMaterial({ color: '#ff3b30', transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }),
}
const UNIFORM = { shirt: '#2b3a55', trousers: '#1b2233', shoes: '#111111', accessories: [{ type: 'cap', color: '#1b2233' }] }

/** A guard's torch beam on the ground, cut short where a wall is in the way. */
function Beam({ g }) {
  const mesh = useRef()
  const geo = useMemo(() => {
    const b = new THREE.BufferGeometry()
    b.setAttribute('position', new THREE.BufferAttribute(new Float32Array((RAYS + 2) * 3), 3))
    const idx = []
    for (let i = 1; i <= RAYS; i++) idx.push(0, i, i + 1)
    b.setIndex(idx)
    return b
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  useFrame(() => {
    const m = mission.current
    if (!m || !mesh.current) return
    mesh.current.visible = g.state !== 'down'
    if (g.state === 'down') return
    const pos = geo.attributes.position.array
    pos[0] = g.x
    pos[1] = GROUND_Y + 0.05
    pos[2] = g.z
    for (let i = 0; i <= RAYS; i++) {
      const a = g.ry - SEE_HALF + (2 * SEE_HALF * i) / RAYS
      const sx = Math.sin(a)
      const sz = Math.cos(a)
      let len = SEE_RANGE
      for (let d = 0.5; d <= SEE_RANGE; d += 0.5) {
        const cx = Math.round(g.x + sx * d - m.grid.x0)
        const cz = Math.round(g.z + sz * d - m.grid.z0)
        if (cx < 0 || cz < 0 || cx >= m.grid.w || cz >= m.grid.h || m.grid.cells[cz * m.grid.w + cx] === 2) {
          len = d - 0.3
          break
        }
      }
      pos[(i + 1) * 3] = g.x + sx * len
      pos[(i + 1) * 3 + 1] = GROUND_Y + 0.05
      pos[(i + 1) * 3 + 2] = g.z + sz * len
    }
    geo.attributes.position.needsUpdate = true
    geo.computeBoundingSphere()
    mesh.current.material = g.state === 'chase' ? beamMats.chase : g.spot > 0.05 || g.state === 'alert' || g.state === 'search' ? beamMats.alert : beamMats.calm
  })
  return <mesh ref={mesh} geometry={geo} material={beamMats.calm} renderOrder={2} frustumCulled={false} />
}

function Guard({ g }) {
  const ref = useRef()
  const [anim, setAnim] = useState('walk')
  const [sign, setSign] = useState({ text: '', kind: '' })
  const look = useMemo(() => ({ ...randomLook(400 + g.id * 17), ...UNIFORM }), [g.id])
  useFrame(() => {
    const o = ref.current
    if (!o) return
    o.position.set(g.x, GROUND_Y, g.z)
    o.rotation.y = g.ry
    const a = g.state === 'down' ? 'knockedOut' : g.state === 'chase' ? 'run' : ['patrol', 'return', 'search'].includes(g.state) && g.path?.length ? 'walk' : 'idle'
    if (a !== anim) setAnim(a)
    // over his head: ? filling as he notices you, ! when he's after you, his words, zzz asleep
    const s =
      g.state === 'down'
        ? { text: 'z z z', kind: 'sleep' }
        : g.state === 'chase'
          ? { text: g.saidT > 0 ? `! ${g.said}` : '!', kind: 'chase' }
          : g.saidT > 0
            ? { text: g.said, kind: 'say' }
            : g.spot > 0.03
              ? { text: `?${Math.round(g.spot * 100)}`, kind: 'spot' }
              : { text: '', kind: '' }
    if (s.text !== sign.text) setSign(s)
  })
  const spot = sign.kind === 'spot' ? Number(sign.text.slice(1)) : 0
  return (
    <group ref={ref} position={[g.x, GROUND_Y, g.z]}>
      <Character look={look} animation={anim} speed={anim === 'run' ? 1.2 : 1} />
      {sign.text && (
        <Html position={[0, 2.25, 0]} center distanceFactor={10} zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`guard-sign is-${sign.kind}`}>
            {sign.kind === 'spot' ? (
              <>
                <b>?</b>
                <i style={{ width: `${spot}%` }} />
              </>
            ) : (
              sign.text
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

/** The back gate: a red ring while it's locked, green and calling you once it's open. */
function Gate({ open }) {
  const arrow = useRef()
  useFrame((st) => {
    if (arrow.current) arrow.current.position.y = GROUND_Y + 3 + Math.sin(st.clock.elapsedTime * 3) * 0.3
  })
  const color = open ? '#2ecc71' : '#e2553a'
  return (
    <group position={[GATE.x, 0, GATE.z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={GROUND_Y + 0.06}>
        <ringGeometry args={[2.4, 3, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} depthWrite={false} />
      </mesh>
      {open && (
        <mesh ref={arrow} rotation-x={Math.PI}>
          <coneGeometry args={[0.5, 0.9, 4]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
      <Html position={[0, 2.2, 0]} center distanceFactor={12} zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`guard-sign ${open ? 'is-open' : 'is-locked'}`}>{open ? 'BACK GATE · OPEN' : 'BACK GATE · LOCKED'}</div>
      </Html>
    </group>
  )
}

export default function StealthDirector({ layout }) {
  const params = useStealth((s) => s.params)
  const started = useStealth((s) => s.started)
  const attempt = useStealth((s) => s.attempt)
  const open = useStealth((s) => s.hud.open)
  const [m, setM] = useState(null)
  const placed = useRef(false)
  const hudT = useRef(0)

  // a new night for every attempt
  useEffect(() => {
    const seed = params.seed ?? Math.floor(Math.random() * 99999)
    const mm = createMission(layout, { ...params, tries: has('friendlyPorter') ? 5 : 3, spotMul: has('sleepyGuards') ? 0.6 : 1 }, seed + attempt * 101)
    mission.current = mm
    playerState.extraColliders = mm.cover
    playerState.sneaking = true
    placed.current = false
    setM(mm)
    return () => {
      playerState.extraColliders = null
      playerState.sneaking = false
    }
  }, [layout, attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dtRaw) => {
    const mm = mission.current
    if (!mm) return
    // to the hostel door (after the scene's own placing has happened)
    if (!placed.current) {
      placed.current = true
      playerState.teleport = { x: START.x, z: START.z, facing: (START.facing * Math.PI) / 180 }
      return
    }
    if (!started || mm.over) return
    const dt = Math.min(0.1, dtRaw)
    const p = playerState.position
    stepMission(mm, dt, { x: p.x, z: p.z, running: playerState.running, moving: playerState.moving })
    for (const e of mm.events) {
      if (e.type === 'spotted') sfx('whistle')
      else if (e.type === 'caught') {
        sfx('hurt')
        shake(0.3, 0.4)
        if (!mm.over) playerState.teleport = { x: START.x, z: START.z, facing: (START.facing * Math.PI) / 180 }
      } else if (e.type === 'open') sfx('door')
      else if (e.type === 'escaped') sfx('win')
      else if (e.type === 'dawn') sfx('lose')
    }
    // the overlay: a few times a second is plenty
    hudT.current -= dt
    if (hudT.current <= 0 || mm.events.length || mm.over) {
      hudT.current = 0.2
      const left = mm.guards.filter((g) => g.state !== 'down').length
      useStealth.setState({
        hud: { time: mm.time, left, total: mm.guards.length, tries: mm.tries, cash: mm.cash, open: mm.open, canTakedown: mm.canTakedown, caught: mm.caughtT > 0, chased: mm.guards.some((g) => g.state === 'chase') },
        ...(mm.over && !useStealth.getState().ended ? { ended: { over: true } } : {}),
      })
    }
  })

  if (!m) return null
  return (
    <group userData={{ tag: 'stealth' }}>
      {m.cover.map((c, i) => (
        <Model key={i} name={c.model} position={[c.x, GROUND_Y, c.z]} rotation-y={c.angle} />
      ))}
      {m.guards.map((g) => (
        <group key={`${attempt}-${g.id}`}>
          <Guard g={g} />
          <Beam g={g} />
        </group>
      ))}
      <Gate open={open} />
    </group>
  )
}

/** The takedown, from the button or the E key: you strike, he drops. */
export function doTakedown(takedownFn) {
  const mm = mission.current
  if (!mm?.canTakedown && mm?.canTakedown !== 0) return
  const g = mm.guards.find((x) => x.id === mm.canTakedown)
  if (g) playerState.facing = Math.atan2(g.x - playerState.position.x, g.z - playerState.position.z)
  if (takedownFn(mm)) {
    playGesture('punch', { speed: 1.4, seconds: 0.7 })
    sfx('punch')
    setTimeout(() => sfx('coin'), 350)
  }
}
