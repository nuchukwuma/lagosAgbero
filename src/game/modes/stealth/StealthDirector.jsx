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
import { playVoice, preloadVoices } from '../../audio/voice/voice.js'
import { has } from '../../systems/powerups.js'
import { useStealth, mission } from './stealthStore.js'
import { createMission, stepMission, grabLoot, carrySpeed, SEE_RANGE, SEE_HALF } from './stealthLogic.js'

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
// what they wear: campus guards; confraternity sentries (red berets); EFCC operatives (black, caps)
const UNIFORMS = {
  sneak: null,
  shrineHeist: { shirt: '#3a2a1e', trousers: '#1c1612', shoes: '#111111', accessories: [{ type: 'beanie', color: '#b3201f' }] },
  raidEscape: { shirt: '#14161c', trousers: '#14161c', shoes: '#0b0b0b', accessories: [{ type: 'cap', color: '#0b0b0b' }] },
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
    mesh.current.visible = g.state !== 'down' && !(g.wait > 0)
    if (!mesh.current.visible) return
    const range = m.cfg.seeRange ?? SEE_RANGE
    const pos = geo.attributes.position.array
    pos[0] = g.x
    pos[1] = GROUND_Y + 0.05
    pos[2] = g.z
    for (let i = 0; i <= RAYS; i++) {
      const a = g.ry - SEE_HALF + (2 * SEE_HALF * i) / RAYS
      const sx = Math.sin(a)
      const sz = Math.cos(a)
      let len = range
      for (let d = 0.5; d <= range; d += 0.5) {
        const cx = Math.round((g.x + sx * d - m.grid.x0) / m.grid.cell)
        const cz = Math.round((g.z + sz * d - m.grid.z0) / m.grid.cell)
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

/** A CCTV camera on a wall bracket, its red light on, turning as it sweeps. */
function Cctv({ g }) {
  const ref = useRef()
  const [sign, setSign] = useState('')
  useFrame(() => {
    if (ref.current) ref.current.rotation.y = g.ry
    const s = g.saidT > 0 ? g.said : g.spot > 0.03 ? `?${Math.round(g.spot * 100)}` : ''
    if (s !== sign) setSign(s)
  })
  return (
    <group position={[g.x, 0, g.z]}>
      <mesh position-y={1.4}>
        <cylinderGeometry args={[0.05, 0.05, 2.8, 6]} />
        <meshStandardMaterial color="#2b2f35" />
      </mesh>
      <group ref={ref} position-y={2.75}>
        <mesh position-z={0.18}>
          <boxGeometry args={[0.22, 0.2, 0.5]} />
          <meshStandardMaterial color="#e9e6df" />
        </mesh>
        <mesh position={[0, 0, 0.44]}>
          <sphereGeometry args={[0.05, 8, 6]} />
          <meshBasicMaterial color="#ff3b30" />
        </mesh>
      </group>
      {sign && (
        <Html position={[0, 3.3, 0]} center distanceFactor={10} zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`guard-sign ${sign.startsWith('?') ? 'is-spot' : 'is-chase'}`}>{sign.startsWith('?') ? <><b>?</b><i style={{ width: `${sign.slice(1)}%` }} /></> : sign}</div>
        </Html>
      )}
    </group>
  )
}

function Guard({ g, uniform = UNIFORM }) {
  const ref = useRef()
  const [anim, setAnim] = useState('walk')
  const [sign, setSign] = useState({ text: '', kind: '' })
  const look = useMemo(() => ({ ...randomLook(400 + g.id * 17), ...uniform }), [g.id, uniform])
  useFrame(() => {
    const o = ref.current
    if (!o) return
    o.visible = !(g.wait > 0) // a raid: not through the door yet
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

/** The way out: a red ring while it's shut, green and calling you once it's open. (A heist's only shows once you have the loot.) */
function Gate({ open, at, label, hideShut }) {
  const arrow = useRef()
  useFrame((st) => {
    if (arrow.current) arrow.current.position.y = GROUND_Y + 3 + Math.sin(st.clock.elapsedTime * 3) * 0.3
  })
  const color = open ? '#2ecc71' : '#e2553a'
  if (hideShut && !open) return null
  return (
    <group position={[at.x, 0, at.z]}>
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
        <div className={`guard-sign ${open ? 'is-open' : 'is-locked'}`}>{open ? `${label} · OPEN` : `${label} · LOCKED`}</div>
      </Html>
    </group>
  )
}

/** A thing to take (a heist): where it sits, glowing, until you take it. */
function Loot({ item, taken }) {
  const ring = useRef()
  useFrame((st) => {
    if (ring.current) ring.current.material.opacity = 0.45 + Math.sin(st.clock.elapsedTime * 3) * 0.2
  })
  if (taken) return null
  const [mx, my, mz] = item.at || [item.x, 0, item.z]
  return (
    <group>
      {item.model && <Model name={item.model} position={[mx, my, mz]} />}
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[item.x, GROUND_Y + 0.06, item.z]}>
        <ringGeometry args={[0.7, 1.0, 32]} />
        <meshBasicMaterial color="#ffd23a" transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <Html position={[mx, my + 1.1, mz]} center distanceFactor={12} zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
        <div className="guard-sign is-loot">{item.label}</div>
      </Html>
    </group>
  )
}

export default function StealthDirector({ layout }) {
  const params = useStealth((s) => s.params)
  const started = useStealth((s) => s.started)
  const attempt = useStealth((s) => s.attempt)
  const open = useStealth((s) => s.hud.open)
  const taken = useStealth((s) => s.hud.taken || [])
  const [m, setM] = useState(null)
  const placed = useRef(false)
  const hudT = useRef(0)

  // a new night for every attempt
  useEffect(() => {
    const seed = params.seed ?? Math.floor(Math.random() * 99999)
    const mm = createMission(layout, { ...params, tries: has('friendlyPorter') ? 5 : 3, spotMul: has('sleepyGuards') ? 0.6 : 1 }, seed + attempt * 101, params.mission || 'backGate')
    mission.current = mm
    preloadVoices(['callout_spotted', 'callout_lost', 'callout_body'])
    playerState.extraColliders = mm.cover
    playerState.sneaking = true
    placed.current = false
    setM(mm)
    return () => {
      playerState.extraColliders = null
      playerState.sneaking = false
      playerState.speedBoost = 1
    }
  }, [layout, attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dtRaw) => {
    const mm = mission.current
    if (!mm) return
    // to the hostel door (after the scene's own placing has happened)
    if (!placed.current) {
      placed.current = true
      const st = mm.cfg.start
      playerState.teleport = { x: st.x, z: st.z, facing: (st.facing * Math.PI) / 180 }
      return
    }
    if (!started || mm.over) return
    const dt = Math.min(0.1, dtRaw)
    const p = playerState.position
    stepMission(mm, dt, { x: p.x, z: p.z, running: playerState.running, moving: playerState.moving })
    for (const e of mm.events) {
      if (e.type === 'spotted') {
        sfx('whistle')
        playVoice('callout_spotted', { fx: 'none', minGap: 6 })
      } else if (e.type === 'lost') playVoice('callout_lost', { fx: 'none', minGap: 8 })
      else if (e.type === 'body') playVoice('callout_body', { fx: 'none', minGap: 8 })
      else if (e.type === 'caught') {
        sfx('hurt')
        shake(0.3, 0.4)
        const st = mm.cfg.start
        if (!mm.over) playerState.teleport = { x: st.x, z: st.z, facing: (st.facing * Math.PI) / 180 }
      } else if (e.type === 'arrive') {
        sfx('door')
        playVoice('raid_efcc', { fx: 'megaphone', minGap: 12, volume: 0.8 })
      } else if (e.type === 'open') sfx('door')
      else if (e.type === 'alarm') {
        sfx('siren')
        shake(0.12, 0.4)
      } else if (e.type === 'workStarted') sfx('click')
      else if (e.type === 'escaped') sfx('win')
      else if (e.type === 'dawn') sfx('lose')
    }
    // the overlay: a few times a second is plenty
    hudT.current -= dt
    if (hudT.current <= 0 || mm.events.length || mm.over) {
      hudT.current = 0.2
      const people = mm.guards.filter((g) => !g.fixed)
      const left = people.filter((g) => g.state !== 'down').length
      const item = mm.canGrab !== false ? mm.loot[mm.canGrab] : null
      const work = mm.working ? { label: mm.loot[mm.working.index].label, p: mm.working.t / mm.loot[mm.working.index].work } : null
      useStealth.setState({
        hud: { time: mm.time, left, total: people.length, cameras: mm.guards.length - people.length, grabVerb: item?.verb || null, grabLabel: item?.label || null, working: work, tries: mm.tries, cash: mm.cash, open: mm.open, canTakedown: mm.canTakedown, canGrab: mm.canGrab, hasLoot: mm.hasLoot, spotted: mm.spotted, taken: mm.loot.flatMap((l, i) => (l.taken ? [i] : [])), lootLeft: mm.loot.filter((l) => !l.taken).length, carried: mm.carried, waiting: mm.guards.filter((g) => g.wait > 0).length, caught: mm.caughtT > 0, chased: mm.guards.some((g) => g.state === 'chase') },
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
          {g.fixed ? <Cctv g={g} /> : <Guard g={g} uniform={UNIFORMS[m.id] || UNIFORM} />}
          <Beam g={g} />
        </group>
      ))}
      <Gate open={open} at={m.cfg.exit} label={m.cfg.goal === 'loot' ? 'GET OUT' : 'BACK GATE'} hideShut={m.cfg.goal === 'loot'} />
      {m.loot.map((item, i) => (
        <Loot key={`${attempt}-${i}`} item={item} taken={taken.includes(i)} />
      ))}
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

/** Take the loot, from the button or the E key. */
export function doGrab() {
  const mm = mission.current
  if (!mm || !grabLoot(mm)) return
  playGesture('pickUp', { speed: 1.3, seconds: 0.8 })
  sfx('coin')
  // heavier now: slower on your feet
  playerState.speedBoost = carrySpeed(mm)
  useStealth.setState((s) => ({ hud: { ...s.hud, hasLoot: mm.hasLoot, canGrab: false, open: mm.open, carried: mm.carried, taken: mm.loot.flatMap((l, i) => (l.taken ? [i] : [])), lootLeft: mm.loot.filter((l) => !l.taken).length } }))
}
