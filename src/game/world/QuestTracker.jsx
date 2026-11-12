import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { npcRegistry, playerState, useWorldStore } from './worldState.js'
import { availableQuests } from '../systems/quests.js'

// During free roam: a bobbing yellow "!" over everyone who has a side quest
// for you, and a note in the world store when you stand next to one of them
// (the TALK button then starts the quest).

const REACH = 2.8
const mat = new THREE.MeshBasicMaterial({ color: '#f2c300', fog: false })
const edge = new THREE.MeshBasicMaterial({ color: '#1a1408', fog: false })

function Marker({ id }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    const n = npcRegistry.get(id)
    const g = ref.current
    if (!g) return
    g.visible = Boolean(n)
    if (!n) return
    g.position.set(n.position.x, 2.55 + Math.sin(clock.elapsedTime * 3 + id.length) * 0.12, n.position.z)
    g.rotation.y = clock.elapsedTime * 1.5
  })
  return (
    <group ref={ref}>
      <mesh material={edge} position={[0, 0.28, 0]}>
        <boxGeometry args={[0.2, 0.46, 0.2]} />
      </mesh>
      <mesh material={mat} position={[0, 0.28, 0]}>
        <boxGeometry args={[0.15, 0.4, 0.22]} />
      </mesh>
      <mesh material={edge} position={[0, -0.06, 0]}>
        <boxGeometry args={[0.2, 0.18, 0.2]} />
      </mesh>
      <mesh material={mat} position={[0, -0.06, 0]}>
        <boxGeometry args={[0.15, 0.13, 0.22]} />
      </mesh>
    </group>
  )
}

export default function QuestTracker({ game }) {
  const setNearQuest = useWorldStore((s) => s.setNearQuest)
  useEffect(() => () => setNearQuest(null), [setNearQuest])
  const quests = useMemo(() => availableQuests(game), [game])
  useFrame(() => {
    const p = playerState.position
    let best = null
    let bestD = REACH
    for (const q of quests) {
      const n = npcRegistry.get(q.giver)
      if (!n) continue
      const d = Math.hypot(n.position.x - p.x, n.position.z - p.z)
      if (d < bestD) {
        best = q.id
        bestD = d
      }
    }
    setNearQuest(best)
  })
  return quests.map((q) => <Marker key={q.id} id={q.giver} />)
}
