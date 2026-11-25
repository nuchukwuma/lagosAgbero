import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import Vehicle from '../../vehicles/Vehicle.jsx'
import { Model, ModelInstances } from '../../world/Model.jsx'
import { playerState, shake } from '../../world/worldState.js'
import { sfx, engine } from '../../audio/audio.js'
import { playVoice, preloadVoices } from '../../audio/voice/voice.js'
import { useSprint, race, readSprintInput } from './wireSprintStore.js'
import { createSprint, stepSprint, AVENUES, HALF_ROAD, EDGE, ROADBLOCKS, ALLEYS, DROP_RADIUS } from './wireSprintLogic.js'

// The Wire Sprint in 3D: a Wuse street grid at dusk. Avenues with lane lines,
// lawned blocks of office towers and big houses, the drop points as tall
// beams of light, blue boost arrows, police roadblocks, carts in the alleys,
// the two rival bettors' cars, and you. The camera rides behind your car.

const DEG = Math.PI / 180
const SPAN = EDGE * 2 + 30
const TOWERS = ['officeBlock', 'agencyTower', 'warehouseOffice', 'officeSmall', 'partySecretariat', 'richManHouse', 'politicianMansion', 'bigManDuplex']

function Roads() {
  const dashes = useMemo(() => {
    const out = []
    for (const a of AVENUES)
      for (let v = -EDGE; v < EDGE; v += 9) {
        out.push([a, v, 0]) // north-south avenue
        out.push([v, a, 90]) // east-west avenue
      }
    return out
  }, [])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.05}>
        <planeGeometry args={[SPAN + 200, SPAN + 200]} />
        <meshStandardMaterial color="#4f6b3d" roughness={1} />
      </mesh>
      {AVENUES.map((a) => (
        <group key={a}>
          <mesh rotation-x={-Math.PI / 2} position={[a, 0.01, 0]}>
            <planeGeometry args={[HALF_ROAD * 2, EDGE * 2 + 14]} />
            <meshStandardMaterial color="#38393d" roughness={0.95} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, a]}>
            <planeGeometry args={[EDGE * 2 + 14, HALF_ROAD * 2]} />
            <meshStandardMaterial color="#38393d" roughness={0.95} />
          </mesh>
          {/* kerbs */}
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh position={[a + s * (HALF_ROAD + 0.4), 0.08, 0]}>
                <boxGeometry args={[0.8, 0.16, EDGE * 2 + 14]} />
                <meshStandardMaterial color="#b9b4a8" />
              </mesh>
              <mesh position={[0, 0.081, a + s * (HALF_ROAD + 0.4)]}>
                <boxGeometry args={[EDGE * 2 + 14, 0.16, 0.8]} />
                <meshStandardMaterial color="#b9b4a8" />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      {ALLEYS.map((al, i) => {
        const v = al.from[0] === al.to[0]
        const len = Math.hypot(al.to[0] - al.from[0], al.to[1] - al.from[1])
        return (
          <mesh key={i} rotation-x={-Math.PI / 2} position={[(al.from[0] + al.to[0]) / 2, 0.013, (al.from[1] + al.to[1]) / 2]}>
            <planeGeometry args={v ? [6, len] : [len, 6]} />
            <meshStandardMaterial color="#5a4b3d" roughness={1} />
          </mesh>
        )
      })}
      {dashes.map(([x, z, r], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} rotation-z={r * DEG} position={[x, 0.02, z]}>
          <planeGeometry args={[0.25, 3]} />
          <meshBasicMaterial color="#e8e2cf" />
        </mesh>
      ))}
    </group>
  )
}

/** The blocks: a lawn, towers along the avenues, trees. */
function Blocks({ colliders }) {
  const { byModel, lawns, trees } = useMemo(() => {
    const byModel = {}
    const lawns = []
    const trees = []
    let n = 0
    for (const c of colliders.filter((b) => b.block)) {
      lawns.push(c)
      // buildings set back from the avenue, facing it, along the block's sides
      const sides = [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]
      for (const [sx, sz] of sides) {
        const along = sx === 0 ? c.hw : c.hd
        const count = Math.max(1, Math.floor((along * 2) / 22))
        for (let i = 0; i < count; i++) {
          const t = (i + 0.5) / count - 0.5
          const m = TOWERS[(n++ * 7 + i * 3) % TOWERS.length]
          const inset = 9
          const x = sx === 0 ? c.x + t * c.hw * 2 : c.x + sx * (c.hw - inset)
          const z = sz === 0 ? c.z + t * c.hd * 2 : c.z + sz * (c.hd - inset)
          const rot = sx === 0 ? (sz < 0 ? 180 : 0) : sx < 0 ? -90 : 90
          ;(byModel[m] ||= []).push({ position: [x, 0.1, z], rotation: rot * DEG, scale: 1 })
        }
        trees.push({ position: [c.x + sx * (c.hw - 2.5) + (sz ? c.hw * 0.6 : 0), 0.1, c.z + sz * (c.hd - 2.5) + (sx ? c.hd * 0.6 : 0)], rotation: 0, scale: 1 })
      }
    }
    return { byModel, lawns, trees }
  }, [colliders])
  return (
    <group>
      {lawns.map((c, i) => (
        <mesh key={i} position={[c.x, 0.05, c.z]}>
          <boxGeometry args={[c.hw * 2, 0.1, c.hd * 2]} />
          <meshStandardMaterial color="#5f8a45" roughness={1} />
        </mesh>
      ))}
      {Object.entries(byModel).map(([m, items]) => (
        <ModelInstances key={m} name={m} items={items} />
      ))}
      <ModelInstances name="treeLarge" items={trees} />
    </group>
  )
}

function Drop({ d }) {
  const beam = useRef()
  useFrame((st) => {
    if (beam.current) beam.current.material.opacity = d.hit ? 0.12 : 0.35 + Math.sin(st.clock.elapsedTime * 2.5) * 0.12
  })
  const color = d.hit ? '#7d8592' : '#3cff8a'
  return (
    <group position={[d.x, 0, d.z]}>
      <mesh ref={beam} position-y={14}>
        <cylinderGeometry args={[2.2, 2.2, 28, 18, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.05}>
        <ringGeometry args={[DROP_RADIUS - 1, DROP_RADIUS, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <Html position={[0, 6, 0]} center distanceFactor={40} zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`guard-sign ${d.hit ? 'is-sleep' : 'is-open'}`}>{d.hit ? `✓ ${d.name}` : d.name}</div>
      </Html>
    </group>
  )
}

function Boosts({ s }) {
  const group = useRef()
  useFrame((st) => {
    const g = group.current
    if (!g) return
    s.boosts.forEach((b, i) => {
      const o = g.children[i]
      if (!o) return
      o.visible = !b.taken
      o.rotation.y = st.clock.elapsedTime * 2
      o.position.y = 1 + Math.sin(st.clock.elapsedTime * 3 + i) * 0.25
    })
  })
  return (
    <group ref={group}>
      {s.boosts.map((b, i) => (
        <mesh key={i} position={[b.x, 1, b.z]}>
          <coneGeometry args={[0.9, 1.6, 4]} />
          <meshStandardMaterial color="#2f8cff" emissive="#2f8cff" emissiveIntensity={0.8} />
        </mesh>
      ))}
    </group>
  )
}

function Roadblocks() {
  return ROADBLOCKS.map(([x1, z1, x2, z2], i) => {
    const mx = (x1 + x2) / 2
    const mz = (z1 + z2) / 2
    const ns = x1 === x2
    const items = [-4.5, -1.5, 1.5, 4.5].map((o) => ({ position: ns ? [mx + o, 0, mz] : [mx, 0, mz + o], rotation: ns ? 0 : Math.PI / 2, scale: 1 }))
    return (
      <group key={i}>
        <ModelInstances name="checkpointBarrier" items={items} />
        <Model name="taskForceVan" position={ns ? [mx + 3, 0, mz - 4] : [mx - 4, 0, mz + 3]} rotation-y={ns ? Math.PI / 2 : 0} />
        <Html position={[mx, 3.5, mz]} center distanceFactor={40} zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
          <div className="guard-sign is-chase">POLICE · ROAD CLOSED</div>
        </Html>
      </group>
    )
  })
}

function Carts() {
  const items = ALLEYS.flatMap((a) => a.carts.map(([x, z]) => ({ position: [x, 0, z], rotation: 0, scale: 1 })))
  return <ModelInstances name="crates" items={items} />
}

function Rival({ r }) {
  const ref = useRef()
  useFrame(() => {
    if (!ref.current) return
    ref.current.position.set(r.x, 0, r.z)
    ref.current.rotation.y = r.heading
  })
  return <Vehicle ref={ref} kind="bigManSuv" color={r.color} position={[r.x, 0, r.z]} />
}

export default function WireSprintScene() {
  const params = useSprint((s) => s.params)
  const started = useSprint((s) => s.started)
  const attempt = useSprint((s) => s.attempt)
  const [s, setS] = useState(null)
  const car = useRef()
  const hudT = useRef(0)

  useEffect(() => {
    const ss = createSprint(params)
    race.current = ss
    setS(ss)
    preloadVoices(['brief_wireSprint'])
    return () => {
      playerState.chaseView = null
      engine(null) // the engine sound stops
    }
  }, [attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const ss = race.current
    if (!ss) return
    if (started && !ss.over) {
      stepSprint(ss, dt, readSprintInput())
      for (const e of ss.events) {
        if (e.type === 'drop') sfx('cash')
        else if (e.type === 'boost') sfx('whoosh')
        else if (e.type === 'bump') {
          sfx(e.hard ? 'crash' : 'bump')
          shake(e.hard ? 0.4 : 0.15, 0.3)
        } else if (e.type === 'rivalDrop') sfx('horn')
        else if (e.type === 'won') sfx('win')
        else if (e.type === 'lost') sfx('lose')
      }
    }
    const c = ss.car
    engine(Math.min(1, Math.abs(c.speed) / 28))
    if (car.current) {
      car.current.position.set(c.x, 0, c.z)
      car.current.rotation.y = c.heading
    }
    playerState.chaseView = { x: c.x, z: c.z, heading: c.heading, speed: c.speed }
    hudT.current -= dt
    if (hudT.current <= 0 || ss.over) {
      hudT.current = 0.15
      useSprint.setState({
        hud: {
          time: ss.time,
          speed: Math.round(Math.abs(c.speed) * 3.6),
          boost: c.boost > 0,
          car: { x: c.x, z: c.z, heading: c.heading },
          drops: ss.drops.map((d) => ({ name: d.name, hit: d.hit, x: d.x, z: d.z, dist: Math.round(Math.hypot(d.x - c.x, d.z - c.z)) })),
          rivals: ss.rivals.map((r) => ({ name: r.name, hits: r.hits, x: r.x, z: r.z })),
        },
        ...(ss.over ? { ended: true } : {}),
      })
    }
  })

  if (!s) return null
  return (
    <group>
      <Roads />
      <Blocks colliders={s.colliders} />
      <Roadblocks />
      <Carts />
      {s.drops.map((d) => (
        <Drop key={d.id} d={d} />
      ))}
      <Boosts s={s} />
      {s.rivals.map((r, i) => (
        <Rival key={`${attempt}-${i}`} r={r} />
      ))}
      <Vehicle ref={car} kind="bigManSportsCar" color="#c9a13b" position={[s.car.x, 0, s.car.z]} rotation-y={s.car.heading} />
    </group>
  )
}

/** The race's opening line, once you press go. */
export const briefSprint = () => playVoice('brief_wireSprint', { fx: 'radio' })
