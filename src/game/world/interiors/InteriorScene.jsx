import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { StaticWorld } from '../Scenery.jsx'
import { GROUND_Y, WALL_THICKNESS } from '../layout.js'
import { playerState } from '../worldState.js'

// Inside a building: the floors of its rooms, its walls, warm lights, and the
// furniture (the layout's model groups). No roof: the camera looks down into
// the rooms, and any wall standing between it and you drops to a low stub, so
// you can always see where you are (the "cutaway").

const CUT = 0.35 // how high a wall stays when it's in the way
const tmp = new THREE.Vector3()

function Wall({ w, height, color, trim }) {
  const ref = useRef()
  const [x1, z1, x2, z2] = w
  const len = Math.hypot(x2 - x1, z2 - z1)
  const mid = [(x1 + x2) / 2, (z1 + z2) / 2]
  const angle = -Math.atan2(z2 - z1, x2 - x1)
  useFrame(({ camera }, dt) => {
    const g = ref.current
    if (!g) return
    // is this wall between the camera and the player? (on opposite sides of its line, and near the player)
    const p = playerState.position
    tmp.copy(camera.position)
    const side = (px, pz) => (x2 - x1) * (pz - z1) - (z2 - z1) * (px - x1)
    const t = ((p.x - x1) * (x2 - x1) + (p.z - z1) * (z2 - z1)) / (len * len)
    const along = t > -0.25 && t < 1.25
    const between = along && Math.sign(side(p.x, p.z)) !== Math.sign(side(tmp.x, tmp.z)) && Math.abs(side(p.x, p.z)) / len < 7
    const want = between ? CUT / height : 1
    g.scale.y += (want - g.scale.y) * Math.min(1, dt * 8)
    g.position.y = GROUND_Y + (height * g.scale.y) / 2
  })
  return (
    <group position={[mid[0], 0, mid[1]]} rotation-y={angle}>
      <mesh ref={ref} position-y={GROUND_Y + height / 2} castShadow={false}>
        <boxGeometry args={[len + WALL_THICKNESS, height, WALL_THICKNESS]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position-y={GROUND_Y + 0.06}>
        <boxGeometry args={[len + WALL_THICKNESS + 0.02, 0.12, WALL_THICKNESS + 0.04]} />
        <meshStandardMaterial color={trim} roughness={0.8} />
      </mesh>
    </group>
  )
}

export default function InteriorScene({ layout }) {
  const it = layout.raw.interior
  const height = it.height || 2.8
  const rooms = useMemo(() => it.rooms || [], [it])
  return (
    <group userData={{ tag: 'interior' }}>
      {/* the ground outside (so the edges don't look cut off) */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#3d3a33" roughness={1} />
      </mesh>
      {rooms.map((r) => (
        <mesh key={r.name} position={[r.x + r.w / 2, GROUND_Y - 0.01, r.z + r.d / 2]} receiveShadow>
          <boxGeometry args={[r.w, 0.04, r.d]} />
          <meshStandardMaterial color={r.floor || '#b9a58a'} roughness={0.85} />
        </mesh>
      ))}
      {(it.walls || []).map((w, i) => (
        <Wall key={i} w={w} height={height} color={it.wall || '#e7ddc9'} trim={it.trim || '#6b5a45'} />
      ))}
      {(it.lights || []).map(([x, z], i) => (
        <pointLight key={i} position={[x, height - 0.3, z]} intensity={6} distance={9} decay={1.6} color="#ffd9a0" />
      ))}
      <StaticWorld groups={layout.groups} />
    </group>
  )
}
