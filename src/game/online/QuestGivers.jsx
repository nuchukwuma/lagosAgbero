import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import Character from '../characters/Character.jsx'
import characters from '../data/characters.json'
import { GROUND_Y } from '../world/layout.js'
import { playerState, npcRegistry } from '../world/worldState.js'
import { useOnline } from './net.js'
import { QUEST_GIVERS, giverState } from './catalog.js'

// Lagos Online: the people from the stories who give quests. The ones the
// world doesn't already have are put on the street here. Each has a sign over
// their head (! a quest going, ✓ a reward to collect), the one you asked the
// way to has a bouncing arrow, and standing next to one lets you talk to them.

const DEG = Math.PI / 180
const NEAR = 3

/** One we put on the street (registered like the world's own people, for the maps). */
function Giver({ id, pos, facing }) {
  const ref = useRef()
  useEffect(() => {
    const entry = { position: new THREE.Vector3(pos[0], GROUND_Y, pos[1]) }
    npcRegistry.set(id, entry)
    return () => {
      if (npcRegistry.get(id) === entry) npcRegistry.delete(id)
    }
  }, [id, pos])
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    // turn to you when you come close
    const p = playerState.position
    const close = Math.hypot(p.x - pos[0], p.z - pos[1]) < 6
    const want = close ? Math.atan2(p.x - pos[0], p.z - pos[1]) : (facing || 0) * DEG
    let d = want - g.rotation.y
    d = Math.atan2(Math.sin(d), Math.cos(d))
    g.rotation.y += d * Math.min(1, dt * 5)
  })
  return <Character ref={ref} look={characters[id]?.look || {}} animation="idle" position={[pos[0], GROUND_Y, pos[1]]} rotation-y={(facing || 0) * DEG} />
}

/** The sign over a giver's head, following wherever they stand. */
function Sign({ id, state, guided }) {
  const ref = useRef()
  useFrame((st) => {
    const n = npcRegistry.get(id)
    const g = ref.current
    if (!g) return
    g.visible = Boolean(n)
    if (n) g.position.set(n.position.x, GROUND_Y + 2.5 + (guided ? Math.abs(Math.sin(st.clock.elapsedTime * 3)) * 0.4 : 0), n.position.z)
  })
  return (
    <group ref={ref} visible={false}>
      <Html center distanceFactor={10} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`quest-sign ${state === 'ready' ? 'is-ready' : ''} ${guided ? 'is-guided' : ''}`}>
          {guided && <span className="quest-sign-arrow">▼</span>}
          <b>{state === 'ready' ? '✓' : '!'}</b>
          <small>{characters[id]?.name || id}</small>
        </div>
      </Html>
    </group>
  )
}

export default function QuestGivers({ map }) {
  const me = useOnline((s) => s.me)
  const guide = useOnline((s) => s.guide)
  const here = Object.entries(QUEST_GIVERS).filter(([, g]) => g.map === map)
  const near = useRef(null)
  // who you're standing next to (the HUD offers to talk to them)
  useFrame(() => {
    const p = playerState.position
    let best = null
    let bestD = NEAR
    for (const [id] of here) {
      const n = npcRegistry.get(id)
      if (!n) continue
      const d = Math.hypot(n.position.x - p.x, n.position.z - p.z)
      if (d < bestD) {
        best = id
        bestD = d
      }
    }
    if (best !== near.current) {
      near.current = best
      useOnline.setState((s) => ({ nearGiver: best, guide: best && s.guide === best ? null : s.guide }))
    }
  })
  useEffect(() => () => useOnline.setState({ nearGiver: null }), [])
  return (
    <>
      {here
        .filter(([, g]) => g.pos)
        .map(([id, g]) => (
          <Giver key={id} id={id} pos={g.pos} facing={g.facing} />
        ))}
      {here.map(([id]) => {
        const st = giverState(id, me)
        return st || guide === id ? <Sign key={`sign-${id}`} id={id} state={st} guided={guide === id} /> : null
      })}
    </>
  )
}
