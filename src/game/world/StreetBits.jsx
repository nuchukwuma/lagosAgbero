import { useMemo } from 'react'
import * as THREE from 'three'
import { GROUND_Y } from './layout.js'

// Simple shapes for things the Kenney packs don't have: the flyover, sagging electricity wires and the bus shelter.

const concrete = new THREE.MeshLambertMaterial({ color: '#8e8a83' })
const concreteDark = new THREE.MeshLambertMaterial({ color: '#6f6b64' })
const metal = new THREE.MeshLambertMaterial({ color: '#3c3f44' })
const roofMat = new THREE.MeshLambertMaterial({ color: '#2f8f5b' })

export function Flyover({ f }) {
  const len = f.toZ - f.fromZ
  const midZ = (f.fromZ + f.toZ) / 2
  return (
    <group>
      <mesh material={concrete} position={[f.x, f.deckY, midZ]}>
        <boxGeometry args={[f.width, 1.2, len]} />
      </mesh>
      {/* parapets */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={concreteDark} position={[f.x + s * (f.width / 2 - 0.15), f.deckY + 1.0, midZ]}>
          <boxGeometry args={[0.3, 0.8, len]} />
        </mesh>
      ))}
      {f.pillars.map((z) =>
        [-1, 1].map((s) => (
          <mesh key={`${z}${s}`} material={concreteDark} position={[f.x + s * (f.width / 2 - 1.5), (f.deckY - 0.6) / 2, z]}>
            <boxGeometry args={[1.2, f.deckY - 0.6, 1.2]} />
          </mesh>
        )),
      )}
    </group>
  )
}

/** Sagging cables: a curve per span, all merged into one line object. */
export function Wires({ poleGroups }) {
  const geometry = useMemo(() => {
    const points = []
    const HEIGHTS = [5.9, 6.25, 5.9]
    const OFFSETS = [-0.9, 0, 0.9]
    const addSpan = (a, b, offsetAxis) => {
      for (let w = 0; w < 3; w++) {
        const o = OFFSETS[w]
        const ax = a[0] + (offsetAxis === 'z' ? 0 : o)
        const az = a[1] + (offsetAxis === 'z' ? o : 0)
        const bx = b[0] + (offsetAxis === 'z' ? 0 : o)
        const bz = b[1] + (offsetAxis === 'z' ? o : 0)
        const span = Math.hypot(bx - ax, bz - az)
        const sag = 0.35 + span * 0.035
        const seg = 12
        for (let i = 0; i < seg; i++) {
          for (const t of [i / seg, (i + 1) / seg]) {
            const y = HEIGHTS[w] + GROUND_Y - sag * 4 * t * (1 - t)
            points.push(ax + (bx - ax) * t, y, az + (bz - az) * t)
          }
        }
      }
    }
    for (const poles of poleGroups) {
      const sorted = [...poles].sort((p, q) => p[0] - q[0])
      for (let i = 0; i + 1 < sorted.length; i++) addSpan(sorted[i], sorted[i + 1], 'z')
    }
    // a few cables crossing the road between facing poles: the Lagos tangle
    if (poleGroups.length >= 2) {
      const [north, south] = poleGroups
      for (const n of north) {
        const s = south.find((p) => Math.abs(p[0] - n[0]) < 0.5)
        if (s) addSpan(n, s, 'x')
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return g
  }, [poleGroups])
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#141414" />
    </lineSegments>
  )
}

export function BusShelter({ at }) {
  const [x, z, rot = 0] = at
  return (
    <group position={[x, GROUND_Y, z]} rotation-y={(rot * Math.PI) / 180}>
      <mesh material={roofMat} position={[0, 2.6, 0]}>
        <boxGeometry args={[6, 0.12, 2.2]} />
      </mesh>
      {[-2.8, 2.8].map((px) =>
        [-0.9, 0.9].map((pz) => (
          <mesh key={`${px}${pz}`} material={metal} position={[px, 1.3, pz]}>
            <boxGeometry args={[0.1, 2.6, 0.1]} />
          </mesh>
        )),
      )}
      <mesh material={metal} position={[0, 0.45, -0.6]}>
        <boxGeometry args={[4.5, 0.08, 0.5]} />
      </mesh>
    </group>
  )
}
