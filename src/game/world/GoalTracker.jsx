import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { playerState, npcRegistry, useWorldStore } from './worldState.js'
import { GROUND_Y } from './layout.js'

// During a "freeRoam" story beat, shows where to go and tells the story when
// the player gets there.
//   goal: { reach: "spotId" }   arrive inside the spot's radius
//   goal: { talkTo: "ada" }     walk up to Ada and press TALK
//   no goal                     just explore (the beat waits forever)

const TALK_DISTANCE = 2.8

function goalPosition(goal, layout) {
  if (!goal) return null
  if (goal.reach) {
    const s = layout.spots[goal.reach]
    return s ? { x: s.pos[0], z: s.pos[1], radius: s.radius || 3 } : null
  }
  if (goal.talkTo) {
    const n = npcRegistry.get(goal.talkTo)
    return n ? { x: n.position.x, z: n.position.z, radius: TALK_DISTANCE } : null
  }
  return null
}

export default function GoalTracker({ goal, layout, onReached }) {
  const marker = useRef()
  const done = useRef(false)
  const setCanTalk = useWorldStore((s) => s.setCanTalk)
  useEffect(() => () => setCanTalk(null), [setCanTalk])

  useFrame((state) => {
    const target = goalPosition(goal, layout)
    const m = marker.current
    if (m) {
      m.visible = Boolean(target)
      if (target) {
        m.position.set(target.x, GROUND_Y + 0.05, target.z)
        const t = state.clock.elapsedTime
        m.children[1].position.y = 3.2 + Math.sin(t * 3) * 0.25
        m.children[0].scale.setScalar(target.radius * (goal?.talkTo ? 0.5 : 1) * (1 + Math.sin(t * 2) * 0.05))
      }
    }
    if (!target || done.current) return
    const p = playerState.position
    const dist = Math.hypot(p.x - target.x, p.z - target.z)
    if (goal.reach && dist < target.radius) {
      done.current = true
      onReached()
    } else if (goal.talkTo) {
      setCanTalk(dist < TALK_DISTANCE ? goal.talkTo : null)
    }
  })

  return (
    <group ref={marker} visible={false}>
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.85, 1, 32]} />
        <meshBasicMaterial color="#f2c300" transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 3.2, 0]} rotation-x={Math.PI}>
        <coneGeometry args={[0.35, 0.7, 4]} />
        <meshBasicMaterial color="#f2c300" />
      </mesh>
    </group>
  )
}
