import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import Vehicle from '../../vehicles/Vehicle.jsx'
import Character from '../../characters/Character.jsx'
import { randomLook } from '../../characters/look.js'
import { ModelInstances } from '../../world/Model.jsx'
import { Props } from '../../world/Scenery.jsx'
import { PROPS, transformPrims, mulberry32 } from '../../world/cityFill.js'
import { playerState, shake } from '../../world/worldState.js'
import { sfx, engine } from '../../audio/audio.js'
import { useCourse, course, readCourseInput } from './courseStore.js'
import { createCourse, stepCourse, toWorld } from './courseLogic.js'

// The course runs in 3D: the way itself (creek water, expressway, market lane,
// avenue) as a ribbon along the centre line, the banks and what stands on them,
// everything in the way, whoever is chasing you (or the convoy you're
// guarding), and your boat / truck / cart / SUV. The camera rides behind you.

const LOOKS = {
  creek: { ground: '#3f4b2a', surface: '#2c5c58', edge: '#5b4630', edgeW: 2.5, dashes: false },
  highway: { ground: '#6d7c47', surface: '#3a3b3f', edge: '#c9c3b5', edgeW: 1.2, dashes: [-4.5, 0, 4.5] },
  market: { ground: '#86593a', surface: '#77684f', edge: '#4f4030', edgeW: 1, dashes: false },
  avenue: { ground: '#5f8a45', surface: '#37383c', edge: '#d3ccbc', edgeW: 1.4, dashes: [0] },
}
const PLAYER_LOOK_FALLBACK = randomLook(11)
const OFFICER = { shirt: '#2f5a2a', trousers: '#1f3a1c', shoes: '#111111', accessories: [{ type: 'beret', color: '#1f3a1c' }] }

/** Like toWorld, but carries on straight before the start (the chasers begin behind you). */
function at(track, s, lat) {
  if (s >= 0) return toWorld(track, s, lat)
  const w = toWorld(track, 0, lat)
  return { ...w, x: w.x + Math.sin(w.h) * s, z: w.z + Math.cos(w.h) * s }
}

/** A strip along the way between two offsets across it. */
function ribbon(track, length, lat0, lat1, y) {
  const pos = []
  const idx = []
  let n = 0
  for (let s = -60; s <= length + 60; s += 2) {
    const a = at(track, s, lat0)
    const b = at(track, s, lat1)
    pos.push(a.x, y, a.z, b.x, y, b.z)
    if (n) idx.push(2 * n - 2, 2 * n - 1, 2 * n, 2 * n - 1, 2 * n + 1, 2 * n)
    n++
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  // the normals point down when the strip runs the other way round: always up
  const nor = g.attributes.normal
  for (let i = 0; i < nor.count; i++) nor.setXYZ(i, 0, 1, 0)
  return g
}

function mangrove(rng) {
  const prims = []
  const h = 3 + rng() * 2
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rng()
    prims.push({ s: 'cyl', p: [Math.sin(a) * 0.6, 0.55, Math.cos(a) * 0.6], d: [0.07, 1.4], c: '#4a3a2a', rx: Math.cos(a) * 0.5, rz: -Math.sin(a) * 0.5 })
  }
  prims.push({ s: 'cyl', p: [0, h / 2 + 0.6, 0], d: [0.16, h], c: '#5a4632' })
  prims.push({ s: 'cone', p: [0, h + 1, 0], d: [2.2 + rng(), 2.4], c: '#2f5a2a' })
  prims.push({ s: 'cone', p: [0.4, h + 0.2, 0.3], d: [1.8, 1.6], c: '#386b2e' })
  return prims
}

function stiltHut(rng) {
  const wall = ['#8a6a48', '#6f5a40', '#9a7a52'][Math.floor(rng() * 3)]
  const prims = []
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) prims.push({ s: 'cyl', p: [x, 0.8, z], d: [0.1, 1.8], c: '#4a3a2a' })
  prims.push({ s: 'box', p: [0, 1.7, 0], d: [4, 0.15, 4], c: '#6e5640' })
  prims.push({ s: 'box', p: [0, 2.8, 0.2], d: [3.2, 2.1, 2.8], c: wall })
  prims.push({ s: 'box', p: [0, 4.0, 0.2], d: [3.8, 0.12, 3.6], c: '#7b4a2b', rx: 0.12 })
  prims.push({ s: 'box', p: [0, 2.5, 1.62], d: [0.8, 1.5, 0.05], c: '#2a1d12' })
  return prims
}

function lamp() {
  return [
    { s: 'cyl', p: [0, 3.5, 0], d: [0.09, 7], c: '#7d8288' },
    { s: 'box', p: [0, 7, 0.9], d: [0.18, 0.12, 1.9], c: '#7d8288' },
    { s: 'box', p: [0, 6.92, 1.75], d: [0.4, 0.1, 0.6], c: '#f4efd5' },
  ]
}

/** What stands beside the way: { prims, models: { name: items } }. Never on the way itself. */
function buildScenery(track, c, seed) {
  const rng = mulberry32(seed * 31 + 7)
  const prims = []
  const models = {}
  const half = c.width / 2
  const pts = track.filter((_, i) => i % 3 === 0)
  const clearOf = (x, z, d) => pts.every((p) => (p.x - x) ** 2 + (p.z - z) ** 2 > d * d)
  const model = (name, w, s, lat, r = 0) => {
    if (!clearOf(w.x, w.z, half + r + 1.5)) return
    // face the way
    const yaw = w.h + (lat > 0 ? Math.PI / 2 : -Math.PI / 2)
    ;(models[name] ||= []).push({ position: [w.x, 0, w.z], rotation: yaw, scale: 1 })
  }
  const prop = (list, w, r = 1) => {
    if (clearOf(w.x, w.z, half + r + 0.8)) prims.push(...transformPrims(list, w.x, w.z, w.h + rng() * 0.6 - 0.3))
  }
  const sides = [-1, 1]
  const look = c.look
  for (let s = -40; s < c.length + 60; s += look === 'market' ? 5 : 12) {
    for (const side of sides) {
      const near = (extra) => at(track, s + rng() * 4, side * (half + extra))
      if (look === 'creek') {
        // mangroves thick at the water's edge, palms and huts behind
        prop(mangrove(rng), near(1 + rng() * 2), 1.5)
        if (rng() < 0.6) prop(mangrove(rng), near(4 + rng() * 6), 1.5)
        if (rng() < 0.35) prop(PROPS.palmTree(rng).prims, near(8 + rng() * 10), 1)
        if (rng() < 0.08) prop(stiltHut(rng), near(5), 3)
        if (rng() < 0.05) prop(PROPS.drums(rng).prims, near(1.5), 1)
      } else if (look === 'highway') {
        if (Math.round(s / 12) % 3 === 0) prop(lamp(), near(1.5), 0.5)
        if (rng() < 0.3) model(rng() < 0.5 ? 'shippingContainerA' : 'shippingContainerB', near(12 + rng() * 6), s, side, 5)
        if (rng() < 0.18) model(['warehouseA', 'warehouseB', 'warehouseArched', 'depot'][Math.floor(rng() * 4)], near(26 + rng() * 8), s, side, 14)
        if (rng() < 0.08) model('billboardTall', near(6), s, side, 3)
        if (rng() < 0.3) prop(PROPS.palmTree(rng).prims, near(4 + rng() * 3), 1)
      } else if (look === 'market') {
        // stalls packed along the lane, shops behind
        const r = rng()
        prop((r < 0.45 ? PROPS.umbrella(rng) : r < 0.7 ? PROPS.kiosk(rng) : r < 0.85 ? PROPS.crates(rng) : PROPS.kegs(rng)).prims, near(1.6), 1.4)
        if (Math.round(s / 5) % 3 === 0) model(['shopRow', 'shopHouseA', 'shopHouseB', 'tenementA', 'storeyHouseC'][Math.floor(rng() * 5)], near(9), s, side, 6)
      } else {
        if (Math.round(s / 12) % 2 === 0) model('treeLarge', near(3), s, side, 1)
        if (Math.round(s / 12) % 3 === 0) model(['politicianMansion', 'officeBlock', 'agencyTower', 'richManHouse', 'partySecretariat'][Math.floor(rng() * 5)], near(22), s, side, 12)
        if (Math.round(s / 12) % 4 === 1) prop(lamp(), near(1.2), 0.5)
      }
    }
  }
  return { prims, models }
}

/** Painted lines, and the static things in the way (logs, spikes, gates). */
function buildCourseProps(m) {
  const { track, c } = m
  const L = LOOKS[c.look]
  const prims = []
  const models = { checkpointBarrier: [], checkpointCone: [] }
  if (L.dashes)
    for (let s = 0; s < c.length + 40; s += 9)
      for (const lat of L.dashes) {
        const w = toWorld(track, s, lat)
        prims.push(...transformPrims([{ s: 'box', p: [0, 0.03, 0], d: [0.22, 0.02, 3], c: '#ece4c8' }], w.x, w.z, w.h))
      }
  for (const o of m.obstacles) {
    const w = toWorld(track, o.s, o.lat)
    if (o.kind === 'debris') {
      // a floating log, or a drum
      const log = Math.round(o.s) % 3 !== 0
      prims.push(...transformPrims(log ? [{ s: 'cyl', p: [0, 0.15, 0], d: [0.3, 2.2], c: '#5a4632', rz: Math.PI / 2 }] : [{ s: 'cyl', p: [0, 0.35, 0], d: [0.4, 0.9], c: '#2f5d8a' }], w.x, w.z, w.h + o.s))
    } else if (o.kind === 'spikes') {
      const list = [{ s: 'box', p: [0, 0.05, 0], d: [o.w * 2, 0.08, 0.5], c: '#2a2a2a' }]
      for (let x = -o.w + 0.15; x < o.w; x += 0.3) list.push({ s: 'cone', p: [x, 0.17, 0], d: [0.06, 0.18], c: '#c9ccd1' })
      prims.push(...transformPrims(list, w.x, w.z, w.h))
    } else if (o.kind === 'barrier') {
      for (const d of [-o.w / 2, o.w / 2]) {
        const b = toWorld(track, o.s, o.lat + d)
        models.checkpointBarrier.push({ position: [b.x, 0, b.z], rotation: w.h + Math.PI / 2, scale: 1 })
      }
    } else if (o.kind === 'gateOpen') {
      // the gantry over the whole line
      for (const side of [-1, 1]) {
        const g = toWorld(track, o.s, side * (c.width / 2 + 0.6))
        prims.push(...transformPrims([{ s: 'box', p: [0, 3, 0], d: [0.4, 6, 0.4], c: '#c9ccd1' }], g.x, g.z, w.h))
      }
      const mid = toWorld(track, o.s, 0)
      prims.push(...transformPrims([{ s: 'box', p: [0, 6, 0], d: [c.width + 1.6, 0.6, 0.5], c: '#2f6b3a' }], mid.x, mid.z, w.h))
    } else if (o.kind === 'taskForce') {
      for (let d = -o.w + 0.6; d <= o.w - 0.5; d += 1.2) {
        const b = toWorld(track, o.s, o.lat + d)
        models.checkpointCone.push({ position: [b.x, 0, b.z], rotation: w.h, scale: 1 })
      }
    }
  }
  return { prims, models }
}

function Ground({ track, c }) {
  const L = LOOKS[c.look]
  const { surface, edges, plane } = useMemo(() => {
    const xs = track.map((p) => p.x)
    const zs = track.map((p) => p.z)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cz = (Math.min(...zs) + Math.max(...zs)) / 2
    const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) + 500
    const half = c.width / 2
    return {
      surface: ribbon(track, c.length, -half, half, 0.02),
      edges: [ribbon(track, c.length, -half - L.edgeW, -half, 0.06), ribbon(track, c.length, half, half + L.edgeW, 0.06)],
      plane: { cx, cz, size },
    }
  }, [track, c, L.edgeW])
  useEffect(() => () => [surface, ...edges].forEach((g) => g.dispose()), [surface, edges])
  const water = c.surface === 'water'
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[plane.cx, -0.05, plane.cz]}>
        <planeGeometry args={[plane.size, plane.size]} />
        <meshStandardMaterial color={L.ground} roughness={1} />
      </mesh>
      <mesh geometry={surface}>
        <meshStandardMaterial color={L.surface} roughness={water ? 0.25 : 0.95} metalness={water ? 0.15 : 0} side={THREE.DoubleSide} />
      </mesh>
      {edges.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={L.edge} roughness={1} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

function Boat({ color = '#e6e1d3', stripe = '#2a6fb0', crew }) {
  return (
    <group>
      <mesh position={[0, 0.32, -0.2]}>
        <boxGeometry args={[1.7, 0.55, 3.8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.32, 1.7]} rotation-y={Math.PI / 4}>
        <boxGeometry args={[1.2, 0.55, 1.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.5, -0.2]}>
        <boxGeometry args={[1.76, 0.12, 3.6]} />
        <meshStandardMaterial color={stripe} />
      </mesh>
      <mesh position={[0, 0.61, -0.3]}>
        <boxGeometry args={[1.4, 0.04, 3.2]} />
        <meshStandardMaterial color="#3b2f25" />
      </mesh>
      <mesh position={[0, 0.75, -2.25]}>
        <boxGeometry args={[0.42, 0.9, 0.45]} />
        <meshStandardMaterial color="#26282c" />
      </mesh>
      <mesh position={[0, 0.72, 0.4]}>
        <boxGeometry args={[1.3, 0.22, 0.5]} />
        <meshStandardMaterial color="#6e5640" />
      </mesh>
      {crew && (
        <Suspense fallback={null}>
          <Character look={crew} animation="crouchIdle" position={[0, 0.55, -1.3]} />
        </Suspense>
      )}
    </group>
  )
}

const CRATE_COLORS = ['#a77a3f', '#8a5a2b', '#b98a4f']
function Cart({ crates, look, leanRef }) {
  return (
    <group>
      <group ref={leanRef}>
        <mesh position={[0, 0.62, 0.2]}>
          <boxGeometry args={[1.25, 0.1, 2.0]} />
          <meshStandardMaterial color="#7a5a3a" />
        </mesh>
        {[-0.38, 0.38].map((x) => (
          <mesh key={x} position={[x, 0.75, -1.25]} rotation-x={0.35}>
            <boxGeometry args={[0.07, 0.07, 0.9]} />
            <meshStandardMaterial color="#5a4030" />
          </mesh>
        ))}
        {Array.from({ length: crates }, (_, i) => (
          <mesh key={i} position={[(i % 2 ? 0.3 : -0.3), 0.92 + Math.floor(i / 4) * 0.5, -0.4 + (Math.floor(i / 2) % 2) * 0.9]}>
            <boxGeometry args={[0.55, 0.48, 0.8]} />
            <meshStandardMaterial color={CRATE_COLORS[i % 3]} />
          </mesh>
        ))}
      </group>
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} position={[x, 0.38, 0.5]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.38, 0.38, 0.12, 14]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
      ))}
      <Suspense fallback={null}>
        <Character look={look} animation="run" position={[0, 0, -1.8]} speed={0.9} />
      </Suspense>
    </group>
  )
}

/** Something that moves along the way: put it where the logic says, facing along. */
function useOnCourse(ref, track, get) {
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const q = get()
    if (!q) return
    const w = at(track, q.s, q.lat)
    g.position.set(w.x, q.y || 0, w.z)
    g.rotation.y = w.h + (q.yaw || 0)
    g.rotation.z = q.roll || 0
  })
}

function Police({ o, track }) {
  const ref = useRef()
  const bar = useRef()
  useOnCourse(ref, track, () => o)
  useFrame((st) => {
    if (bar.current) bar.current.material.color.set(Math.sin(st.clock.elapsedTime * 10) > 0 ? '#2f6bff' : '#ff3030')
  })
  return (
    <group ref={ref}>
      <Vehicle kind="privateCar" color="#f4f4f4" />
      <mesh ref={bar} position={[0, 1.62, -0.1]}>
        <boxGeometry args={[1.1, 0.14, 0.3]} />
        <meshBasicMaterial color="#2f6bff" />
      </mesh>
    </group>
  )
}

function Shopper({ o, track, seed }) {
  const ref = useRef()
  const look = useMemo(() => randomLook(900 + seed), [seed])
  useOnCourse(ref, track, () => ({ ...o, yaw: o.vlat > 0 ? -Math.PI / 2 : Math.PI / 2 }))
  return (
    <group ref={ref}>
      <Suspense fallback={null}>
        <Character look={look} animation="walk" />
      </Suspense>
    </group>
  )
}

function TaskForce({ o, track, seed }) {
  const look = useMemo(() => ({ ...randomLook(700 + seed), ...OFFICER }), [seed])
  const a = at(track, o.s + 1.2, o.lat)
  return (
    <group position={[a.x, 0, a.z]} rotation-y={a.h + Math.PI}>
      <Suspense fallback={null}>
        <Character look={look} animation="idle" />
      </Suspense>
      <Html position={[0, 2.6, 0]} center distanceFactor={30} zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
        <div className="guard-sign is-chase">TASK FORCE</div>
      </Html>
    </group>
  )
}

function Blocker({ o, track, half }) {
  const ref = useRef()
  const fly = useRef(0)
  useFrame((_, dt) => {
    if (o.gone) fly.current = Math.min(1, fly.current + dt * 1.5)
  })
  // knocked off: it slides off the road, slewed round
  useOnCourse(ref, track, () => ({ s: o.s + fly.current * 6, lat: o.lat + Math.sign(o.lat || 1) * fly.current * (half + 3 - Math.abs(o.lat)), yaw: Math.PI / 2 + fly.current * 1.2, roll: fly.current * 0.25 }))
  return (
    <group ref={ref}>
      <Vehicle kind="privateCar" color="#7a1f1f" />
    </group>
  )
}

function Boost({ o, track }) {
  const ref = useRef()
  const w = at(track, o.s, o.lat)
  useFrame((st) => {
    if (!ref.current) return
    ref.current.visible = !o.hit
    ref.current.rotation.y = st.clock.elapsedTime * 2
    ref.current.position.y = 1 + Math.sin(st.clock.elapsedTime * 3 + o.s) * 0.25
  })
  return (
    <mesh ref={ref} position={[w.x, 1, w.z]}>
      <coneGeometry args={[0.9, 1.6, 4]} />
      <meshStandardMaterial color="#2f8cff" emissive="#2f8cff" emissiveIntensity={0.8} />
    </mesh>
  )
}

function GateSign({ o, track }) {
  const w = at(track, o.s, o.lat)
  return (
    <Html position={[w.x, 4.4, w.z]} center distanceFactor={40} zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
      <div className="guard-sign is-open">OPEN LANE ▼</div>
    </Html>
  )
}

function Pursuer({ q, track, seed }) {
  const ref = useRef()
  const crew = useMemo(() => ({ ...randomLook(500 + seed), accessories: [{ type: 'beanie', color: '#b3201f' }] }), [seed])
  useOnCourse(ref, track, () => ({ s: q.s, lat: q.lat, y: Math.sin(performance.now() / 300 + seed) * 0.05 }))
  return (
    <group ref={ref}>
      <Boat color="#3a3a3a" stripe="#b3201f" crew={crew} />
    </group>
  )
}

function Convoy({ cv, track }) {
  const cars = [useRef(), useRef(), useRef()]
  useFrame(() => {
    cars.forEach((r, i) => {
      if (!r.current) return
      const w = at(track, cv.s - i * 8, 0)
      r.current.position.set(w.x, 0, w.z)
      r.current.rotation.y = w.h
    })
  })
  return cars.map((r, i) => <Vehicle key={i} ref={r} kind="bigManSuv" color={i === 1 ? '#111111' : '#1d2a3a'} />)
}

export default function CourseScene({ playerLook }) {
  const id = useCourse((s) => s.id)
  const params = useCourse((s) => s.params)
  const started = useCourse((s) => s.started)
  const attempt = useCourse((s) => s.attempt)
  const [m, setM] = useState(null)
  const me = useRef()
  const lean = useRef()
  const hudT = useRef(0)
  const camH = useRef(null)
  const [crates, setCrates] = useState(0)

  useEffect(() => {
    const mm = createCourse(id, params)
    course.current = mm
    camH.current = null
    setM(mm)
    setCrates(mm.crates)
    return () => {
      playerState.chaseView = null
      engine(null)
    }
  }, [attempt, id]) // eslint-disable-line react-hooks/exhaustive-deps

  const scenery = useMemo(() => (m ? buildScenery(m.track, m.c, params.seed ?? 7) : null), [m]) // eslint-disable-line react-hooks/exhaustive-deps
  const courseProps = useMemo(() => (m ? buildCourseProps(m) : null), [m])

  useFrame((st, dt) => {
    const mm = course.current
    if (!mm) return
    if (started && !mm.over) {
      stepCourse(mm, dt, readCourseInput())
      for (const e of mm.events) {
        if (e.type === 'hit') {
          sfx('crash')
          shake(0.35, 0.3)
        } else if (e.type === 'spill') {
          sfx('bump')
          setCrates(e.left)
        } else if (e.type === 'seized') {
          sfx('whistle')
          setCrates(e.left)
        } else if (e.type === 'bump') sfx('bump')
        else if (e.type === 'boost') sfx('whoosh')
        else if (e.type === 'ram') {
          sfx('crash')
          shake(0.3, 0.25)
        } else if (e.type === 'convoyHit') sfx('hornLong')
        else if (e.type === 'won') sfx('win')
        else if (e.type === 'lost') sfx('lose')
      }
    }
    const p = mm.p
    const w = toWorld(mm.track, p.s, p.lat)
    // the body points where it's going: along the way, slewed by the sideways drift
    const yaw = w.h - Math.atan2(p.latV, Math.max(p.v, 3))
    if (me.current) {
      me.current.position.set(w.x, mm.c.surface === 'water' ? Math.sin(st.clock.elapsedTime * 3) * 0.06 : 0, w.z)
      me.current.rotation.y = yaw
      me.current.rotation.z = mm.c.surface === 'water' ? p.latV * 0.04 : 0
    }
    if (lean.current) lean.current.rotation.z = Math.max(-0.35, Math.min(0.35, mm.tipT * 0.8 * Math.sign(p.latV || 1)))
    engine(mm.c.vehicle === 'cart' ? null : Math.min(1, p.v / mm.c.top))
    // the camera follows the way's heading, smoothed (not every twitch of the wheel)
    if (camH.current == null) camH.current = w.h
    camH.current += (w.h - camH.current) * Math.min(1, dt * 3)
    playerState.chaseView = { x: w.x, z: w.z, heading: camH.current, speed: mm.c.vehicle === 'cart' ? p.v * 2.5 : p.v }
    hudT.current -= dt
    if (hudT.current <= 0 || mm.over) {
      hudT.current = 0.15
      const gap = mm.pursuers.length ? Math.min(...mm.pursuers.map((q) => p.s - q.s)) : null
      useCourse.setState({
        hud: {
          time: mm.time,
          speed: Math.round(p.v * 3.6),
          done: Math.min(1, (mm.convoy ? mm.convoy.s : p.s) / mm.c.length),
          damage: mm.damage,
          maxDamage: mm.c.damage || 0,
          crates: mm.crates,
          maxCrates: mm.c.crates || 0,
          convoy: mm.convoy ? { health: mm.convoy.health, max: mm.c.convoyHealth, ahead: Math.round(p.s - mm.convoy.s) } : null,
          rivalGap: gap == null ? null : Math.round(gap),
          boost: mm.boostT > 0,
          tipping: mm.tipT > 0.05,
        },
        ...(mm.over ? { ended: true } : {}),
      })
    }
  })

  if (!m) return null
  const kind = m.c.vehicle
  const half = m.c.width / 2
  const look = playerLook || PLAYER_LOOK_FALLBACK
  return (
    <group>
      <Ground track={m.track} c={m.c} />
      <Props prims={scenery.prims} />
      {Object.entries(scenery.models).map(([name, items]) => (
        <ModelInstances key={name} name={name} items={items} />
      ))}
      <Props prims={courseProps.prims} />
      {Object.entries(courseProps.models).map(([name, items]) => (
        <ModelInstances key={name} name={name} items={items} />
      ))}
      {m.obstacles.map((o, i) =>
        o.kind === 'police' ? (
          <Police key={`${attempt}-${i}`} o={o} track={m.track} />
        ) : o.kind === 'shopper' ? (
          <Shopper key={`${attempt}-${i}`} o={o} track={m.track} seed={i} />
        ) : o.kind === 'taskForce' ? (
          <TaskForce key={`${attempt}-${i}`} o={o} track={m.track} seed={i} />
        ) : o.kind === 'blocker' ? (
          <Blocker key={`${attempt}-${i}`} o={o} track={m.track} half={half} />
        ) : o.kind === 'boost' ? (
          <Boost key={`${attempt}-${i}`} o={o} track={m.track} />
        ) : o.kind === 'gateOpen' ? (
          <GateSign key={`${attempt}-${i}`} o={o} track={m.track} />
        ) : null,
      )}
      {m.pursuers.map((q, i) => (
        <Pursuer key={`${attempt}-${i}`} q={q} track={m.track} seed={i} />
      ))}
      {m.convoy && <Convoy cv={m.convoy} track={m.track} />}
      <group ref={me}>
        {kind === 'boat' ? (
          <Boat crew={look} />
        ) : kind === 'cart' ? (
          <Cart crates={crates} look={look} leanRef={lean} />
        ) : (
          <Vehicle kind={kind === 'truck' ? 'boxTruck' : 'bigManSuv'} color={kind === 'truck' ? '#d6a21e' : '#e8e8e8'} />
        )}
      </group>
    </group>
  )
}
