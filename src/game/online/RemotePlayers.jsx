import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import Character from '../characters/Character.jsx'
import { GROUND_Y } from '../world/layout.js'
import { playerState } from '../world/worldState.js'
import { useOnline, joinPlace, send } from './net.js'
import { MAPS, GROUPS } from './catalog.js'

// Lagos Online in the 3D street: the other players here, walking about with
// their names over their heads, and our own position sent to the server.

const MAX_SHOWN = 24 // the nearest ones; more would slow a phone down

/** The online place for a world (iyanaWahala -> lagos), or null. */
export const mapForWorld = (world) => Object.keys(MAPS).find((k) => MAPS[k].world === world) || null

function Remote({ p }) {
  const ref = useRef()
  const [anim, setAnim] = useState(p.anim || 'idle')
  useEffect(() => {
    if (ref.current) {
      ref.current.position.set(p.x, GROUND_Y, p.z)
      ref.current.rotation.y = p.ry || 0
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    // glide towards the last position the server gave (updates come ~10 times a second)
    const k = Math.min(1, dt * 10)
    g.position.x += (p.x - g.position.x) * k
    g.position.z += (p.z - g.position.z) * k
    if (Math.hypot(p.x - g.position.x, p.z - g.position.z) > 8) g.position.set(p.x, GROUND_Y, p.z) // a jump (a bus ride): no sliding across the map
    let d = (p.ry || 0) - g.rotation.y
    d = Math.atan2(Math.sin(d), Math.cos(d))
    g.rotation.y += d * k
    const a = ['walk', 'run', 'idle'].includes(p.anim) ? p.anim : 'idle'
    if (a !== anim) setAnim(a)
  })
  const group = GROUPS[p.group]
  return (
    <group ref={ref}>
      <Character look={p.look || {}} animation={anim} />
      <Html position={[0, 2.15, 0]} center distanceFactor={9} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="online-tag">
          {p.name}
          {group ? <small>{group.name}</small> : null}
        </div>
      </Html>
    </group>
  )
}

/** Sends where we are (about 10 times a second while moving, once a second standing). */
function Sync({ map }) {
  const status = useOnline((s) => s.status)
  const last = useRef({ t: 0, x: 0, z: 0, anim: '' })
  useEffect(() => {
    if (status === 'online' && map) joinPlace(map, playerState.position.x, playerState.position.z)
  }, [status, map])
  useFrame(() => {
    if (status !== 'online' || !map) return
    const now = performance.now()
    const L = last.current
    if (now - L.t < 100) return
    const { x, z } = playerState.position
    const anim = playerState.running ? 'run' : playerState.moving ? 'walk' : 'idle'
    const moved = Math.hypot(x - L.x, z - L.z) > 0.05 || anim !== L.anim
    if (!moved && now - L.t < 1000) return
    Object.assign(L, { t: now, x, z, anim })
    send({ t: 'move', x: +x.toFixed(2), z: +z.toFixed(2), ry: +playerState.facing.toFixed(2), anim })
  })
  return null
}

export default function RemotePlayers({ world }) {
  const map = mapForWorld(world)
  const players = useOnline((s) => s.players)
  const here = useOnline((s) => s.map)
  // the nearest few, re-chosen whenever someone comes or goes
  const list = here === map ? Object.values(players) : []
  const { x, z } = playerState.position
  const shown = list.length > MAX_SHOWN ? [...list].sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)).slice(0, MAX_SHOWN) : list
  return (
    <>
      <Sync map={map} />
      {shown.map((p) => (
        <Remote key={`${p.id}-${JSON.stringify(p.look || {})}`} p={p} />
      ))}
    </>
  )
}
