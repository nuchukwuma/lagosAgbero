import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import Character from '../../characters/Character.jsx'
import { randomLook } from '../../characters/look.js'
import { ModelInstances } from '../../world/Model.jsx'
import { Props } from '../../world/Scenery.jsx'
import { PROPS, transformPrims, mulberry32 } from '../../world/cityFill.js'
import { playerState, shake } from '../../world/worldState.js'
import { sfx } from '../../audio/audio.js'
import { useTurf, turf, readTurfInput } from './turfStore.js'
import { createTurf, stepTurf, YARD, FLAGS, FLAG_R, BLOCKS, TEAMS } from './turfLogic.js'

// Turf Flag Brawl in 3D: a sandy yard on a Port Harcourt creek at dusk,
// plank jetties out over the water, shacks along the back, drums and crates,
// three flags with their rings, two crews of three. The camera looks north
// over your shoulder from up high.

const W = YARD.maxX - YARD.minX
const D = YARD.maxZ - YARD.minZ
const CX = (YARD.maxX + YARD.minX) / 2
const CZ = (YARD.maxZ + YARD.minZ) / 2
const SHACKS = ['tenementB', 'shopHouseA', 'storeyHouseB', 'tenementC', 'shopHouseB']

function Yard() {
  const { prims, shacks } = useMemo(() => {
    const rng = mulberry32(17)
    const prims = []
    // jetties out over the creek, on the north side
    for (const jx of [-11, 9]) {
      for (let k = 0; k < 7; k++) prims.push({ s: 'box', p: [jx, -0.05, YARD.minZ - 0.6 - k * 1.1], d: [2.4, 0.12, 1.0], c: k % 2 ? '#7a5a3a' : '#6e5134' })
      for (const sx of [-1.1, 1.1]) for (const sz of [-2, -5.5]) prims.push({ s: 'cyl', p: [jx + sx, -0.6, YARD.minZ + sz], d: [0.12, 1.4], c: '#4a3a2a' })
    }
    // palms along the sides, mangroves on the far banks
    for (const [x, z] of [[-18, 8], [18, 8], [-18, -2], [18, -3]]) prims.push(...transformPrims(PROPS.palmTree(rng).prims, x, z, rng() * 6))
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2
      const x = Math.sin(a) * 46
      const z = -10 - Math.abs(Math.cos(a)) * 28
      prims.push(...transformPrims(PROPS.tree(rng).prims, x, z, rng() * 6))
    }
    // drums and crates (the blocks)
    BLOCKS.forEach((b, i) => {
      if (i % 2) prims.push({ s: 'box', p: [b.x, 0.55, b.z], d: [b.r * 1.5, 1.1, b.r * 1.5], c: '#8a5a2b' })
      else for (const [dx, dz] of [[-0.35, 0], [0.4, 0.2], [0, -0.4]]) prims.push({ s: 'cyl', p: [b.x + dx, 0.5, b.z + dz], d: [0.32, 1.0], c: i % 3 ? '#2f5d8a' : '#b3201f' })
    })
    const shacks = []
    for (let x = YARD.minX + 2; x <= YARD.maxX; x += 8) shacks.push({ name: SHACKS[shacks.length % SHACKS.length], position: [x, 0, YARD.maxZ + 6], rotation: Math.PI, scale: 1 })
    return { prims, shacks }
  }, [])
  const byName = useMemo(() => {
    const out = {}
    for (const s of shacks) (out[s.name] ||= []).push(s)
    return out
  }, [shacks])
  return (
    <group>
      {/* the creek */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.45, -20]}>
        <planeGeometry args={[240, 200]} />
        <meshStandardMaterial color="#3f8f8c" roughness={0.25} metalness={0.1} emissive="#123b3a" emissiveIntensity={0.4} />
      </mesh>
      {/* the yard: packed sand on a bank */}
      <mesh position={[CX, -0.3, CZ]}>
        <boxGeometry args={[W, 0.6, D]} />
        <meshStandardMaterial color="#9a7a52" roughness={1} />
      </mesh>
      <mesh position={[CX, -0.3, YARD.maxZ + 8]}>
        <boxGeometry args={[W + 40, 0.6, 16]} />
        <meshStandardMaterial color="#7d6446" roughness={1} />
      </mesh>
      <Props prims={prims} />
      {Object.entries(byName).map(([name, items]) => (
        <ModelInstances key={name} name={name} items={items} />
      ))}
    </group>
  )
}

const colorOf = (p) => (p > 0 ? TEAMS.you.color : p < 0 ? TEAMS.them.color : '#d8d2c2')

function Flag({ f }) {
  const cloth = useRef()
  const ring = useRef()
  const arc = useRef()
  const [label, setLabel] = useState({ owner: null, contested: false })
  useFrame((st) => {
    const fl = turf.current?.flags.find((x) => x.id === f.id)
    if (!fl) return
    const h = 0.6 + Math.abs(fl.p) * 3.2
    if (cloth.current) {
      cloth.current.position.y = h
      cloth.current.material.color.set(colorOf(fl.p))
      cloth.current.rotation.y = Math.sin(st.clock.elapsedTime * 3 + f.x) * 0.25
    }
    if (ring.current) ring.current.material.color.set(fl.contested ? '#ffb020' : colorOf(fl.owner === 'you' ? 1 : fl.owner === 'them' ? -1 : 0))
    if (arc.current) {
      arc.current.scale.setScalar(Math.max(0.001, Math.abs(fl.p)))
      arc.current.material.color.set(colorOf(fl.p))
    }
    if (fl.owner !== label.owner || Boolean(fl.contested) !== label.contested) setLabel({ owner: fl.owner, contested: Boolean(fl.contested) })
  })
  return (
    <group position={[f.x, 0, f.z]}>
      <mesh position-y={2.1}>
        <cylinderGeometry args={[0.06, 0.06, 4.2, 8]} />
        <meshStandardMaterial color="#c9ccd1" />
      </mesh>
      <mesh ref={cloth} position={[0.55, 1, 0]}>
        <boxGeometry args={[1.0, 0.65, 0.04]} />
        <meshStandardMaterial color="#d8d2c2" />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.03}>
        <ringGeometry args={[FLAG_R - 0.18, FLAG_R, 48]} />
        <meshBasicMaterial color="#d8d2c2" transparent opacity={0.85} />
      </mesh>
      {/* how far up the pole: a disc that grows */}
      <mesh ref={arc} rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[FLAG_R - 0.2, 40]} />
        <meshBasicMaterial color="#d8d2c2" transparent opacity={0.25} depthWrite={false} />
      </mesh>
      <Html position={[0, 4.8, 0]} center distanceFactor={22} zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`guard-sign ${label.contested ? 'is-spot' : label.owner === 'you' ? 'is-chase' : label.owner === 'them' ? 'is-say' : ''}`} style={label.owner === 'them' && !label.contested ? { background: TEAMS.them.color } : undefined}>
          {f.label}
          {label.contested ? ' · CONTESTED' : ''}
        </div>
      </Html>
    </group>
  )
}

function Fighter({ f, look }) {
  const ref = useRef()
  const [anim, setAnim] = useState('fightIdle')
  useFrame(() => {
    const g = ref.current
    if (!g) return
    g.visible = f.outT <= 0
    g.position.set(f.x, 0, f.z)
    g.rotation.y = f.face
    const a = f.stun > 0 ? 'stunned' : f.shoveT > 0 ? 'bodyBlock' : f.moving ? 'run' : 'fightIdle'
    if (a !== anim) setAnim(a)
  })
  return (
    <group ref={ref}>
      <Suspense fallback={null}>
        <Character look={look} animation={anim} speed={anim === 'run' ? 1.1 : 1} />
      </Suspense>
      {f.me && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.04}>
          <ringGeometry args={[0.55, 0.7, 24]} />
          <meshBasicMaterial color="#ffd23a" />
        </mesh>
      )}
    </group>
  )
}

/** Where someone went into the creek: a ring of water that spreads and fades. */
function Splashes() {
  const refs = useRef([])
  const live = useRef([])
  useFrame((_, dt) => {
    const t = turf.current
    if (t) for (const e of t.events) if (e.type === 'splash') live.current.push({ x: t.fighters[e.id].x, z: t.fighters[e.id].z, age: 0 })
    live.current = live.current.filter((s) => (s.age += dt) < 1.2).slice(-6)
    refs.current.forEach((m, i) => {
      const s = live.current[i]
      if (!m) return
      m.visible = Boolean(s)
      if (!s) return
      m.position.set(s.x, -0.38, s.z)
      m.scale.setScalar(0.5 + s.age * 2.2)
      m.material.opacity = 0.8 * (1 - s.age / 1.2)
    })
  })
  return Array.from({ length: 6 }, (_, i) => (
    <mesh key={i} ref={(el) => (refs.current[i] = el)} rotation-x={-Math.PI / 2} visible={false}>
      <ringGeometry args={[0.6, 0.9, 24]} />
      <meshBasicMaterial color="#e8f6ff" transparent opacity={0.8} depthWrite={false} />
    </mesh>
  ))
}

const withBeret = (look, color) => ({ ...look, accessories: [{ type: 'beret', color }] })

export default function TurfScene({ playerLook }) {
  const params = useTurf((s) => s.params)
  const started = useTurf((s) => s.started)
  const attempt = useTurf((s) => s.attempt)
  const [t, setT] = useState(null)
  const hudT = useRef(0)

  useEffect(() => {
    const tt = createTurf(params)
    turf.current = tt
    setT(tt)
    return () => {
      playerState.chaseView = null
    }
  }, [attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  const looks = useMemo(
    () =>
      t
        ? t.fighters.map((f) => (f.me ? withBeret({ ...(playerLook || randomLook(3)), shirt: TEAMS.you.color }, '#1a1a1a') : withBeret({ ...randomLook(200 + f.id * 7), shirt: f.team === 'you' ? '#c0392b' : '#2471a3' }, TEAMS[f.team].color)))
        : [],
    [t, playerLook],
  )

  useFrame((_, dt) => {
    const tt = turf.current
    if (!tt) return
    if (started && !tt.over) {
      stepTurf(tt, dt, readTurfInput())
      for (const e of tt.events) {
        if (e.type === 'shove') sfx(e.hit ? 'punch' : 'whoosh')
        else if (e.type === 'shoved' && tt.fighters[e.id].me) shake(0.25, 0.25)
        else if (e.type === 'splash') sfx('slide')
        else if (e.type === 'capture') sfx(e.team === 'you' ? 'cash' : 'wrong')
        else if (e.type === 'won') sfx('win')
        else if (e.type === 'lost') sfx('lose')
        else if (e.type === 'dropped') sfx('click')
      }
    }
    const m = tt.fighters.find((f) => f.me)
    // the camera: high over your shoulder, always looking north over the yard
    const cx = m.outT > 0 ? m.home[0] : m.x
    const cz = m.outT > 0 ? m.home[1] : m.z
    playerState.chaseView = { x: cx * 0.6, z: Math.min(cz, 8) + 6, heading: Math.PI, speed: 0, back: 7, up: 14 }
    hudT.current -= dt
    if (hudT.current <= 0 || tt.over) {
      hudT.current = 0.12
      useTurf.setState({
        hud: {
          time: tt.time,
          score: { ...tt.score },
          flags: tt.flags.map((f) => ({ id: f.id, label: f.label, owner: f.owner, p: f.p, contested: f.contested })),
          cd: Math.max(0, m.cd),
          out: m.outT > 0 ? Math.ceil(m.outT) : 0,
        },
        ...(tt.over ? { ended: true } : {}),
      })
    }
  })

  if (!t) return null
  return (
    <group>
      <Yard />
      {FLAGS.map((f) => (
        <Flag key={f.id} f={f} />
      ))}
      {t.fighters.map((f, i) => (
        <Fighter key={`${attempt}-${f.id}`} f={f} look={looks[i]} />
      ))}
      <Splashes />
    </group>
  )
}
