import { Suspense, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Character from '../characters/Character.jsx'
import { randomLook } from '../characters/look.js'
import { checkCondition } from '../narrative/conditions.js'
import { npcRegistry, playerState } from './worldState.js'
import { GROUND_Y } from './layout.js'
import characters from '../data/characters.json'

// Story characters and background extras standing around the street.
// - An NPC appears only if its "if" condition (story flags) is true.
// - A scene can move NPCs with "positions": { "professor": [x, z, facing] }.
// - Whoever is speaking plays "talk" (or "argue" when angry) and turns to the player.

const DEG = Math.PI / 180

function NPC({ id, look, pos, facing, anim, speaking, mood }) {
  const ref = useRef()
  const targetYaw = useRef(facing * DEG)
  useEffect(() => {
    if (ref.current) ref.current.rotation.y = facing * DEG
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    if (speaking) {
      const p = playerState.position
      targetYaw.current = Math.atan2(p.x - pos[0], p.z - pos[1])
    } else targetYaw.current = facing * DEG
    let diff = targetYaw.current - g.rotation.y
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    g.rotation.y += diff * Math.min(1, dt * 6)
  })

  const animation = speaking ? (mood === 'angry' || mood === 'nervous' ? 'argue' : 'talk') : anim || 'idle'
  return <Character ref={ref} look={look} animation={animation} position={[pos[0], GROUND_Y, pos[1]]} />
}

export default function NPCs({ layout, flags, positions = {}, speaker, mood, hidden = [] }) {
  const state = { flags, stats: {}, memory: {} }
  const npcs = (layout.raw.npcs || []).filter((n) => checkCondition(n.if, state) && !hidden.includes(n.id))
  return (
    <>
      {npcs.map((n) => {
        const override = positions[n.id]
        const pos = override ? [override[0], override[1]] : n.pos
        const facing = override?.[2] ?? n.facing ?? 0
        return (
          <Suspense key={n.id} fallback={null}>
            <NPC id={n.id} look={characters[n.id]?.look} pos={pos} facing={facing} anim={n.anim} speaking={speaker === n.id} mood={mood} />
          </Suspense>
        )
      })}
      {(layout.raw.extras || []).map((e) => (
        <Suspense key={`extra-${e.seed}`} fallback={null}>
          <Character look={randomLook(e.seed)} animation={e.anim || 'idle'} position={[e.pos[0], GROUND_Y, e.pos[1]]} rotation-y={(e.facing || 0) * DEG} />
        </Suspense>
      ))}
    </>
  )
}
