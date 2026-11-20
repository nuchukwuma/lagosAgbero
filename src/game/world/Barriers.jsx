import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

// The edge of the walkable world, made visible: a row of red-and-white
// concrete barriers along every side of the layout's bounds, where the player
// stops. Where a road runs off the map the traffic must still pass, so the
// gap stays open and a yellow-and-black stripe is painted across the road.
// One instanced mesh (plus a flat stripe per road), cheap.
const SIZE = [1.9, 0.8, 0.45]
// yellow-and-black hazard stripes, as a tiny repeating texture
const stripeMat = (() => {
  if (typeof document === 'undefined') return new THREE.MeshBasicMaterial({ color: '#f2c230' })
  const c = document.createElement('canvas')
  c.width = 16
  c.height = 16
  const g = c.getContext('2d')
  g.fillStyle = '#f2c230'
  g.fillRect(0, 0, 16, 16)
  g.fillStyle = '#1a1a1a'
  for (let i = -16; i < 32; i += 8) {
    g.beginPath()
    g.moveTo(i, 0)
    g.lineTo(i + 4, 0)
    g.lineTo(i + 20, 16)
    g.lineTo(i + 16, 16)
    g.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(8, 1)
  tex.magFilter = THREE.NearestFilter
  return new THREE.MeshBasicMaterial({ map: tex })
})()
const GAP = 2.05

/** Strips of road as rects { x0, x1, z0, z1 } from the world JSON's road lines and tiles. */
function roadRects(roads = []) {
  const half = 4.2
  const out = []
  for (const r of roads) {
    if (!/^road/.test(r.model || '')) continue
    const pts = r.line ? [r.line.from, r.line.to] : r.at || []
    if (!pts.length) continue
    const xs = pts.map((q) => q[0])
    const zs = pts.map((q) => q[1])
    // a line of tiles is a strip from end to end, as wide as a road
    if (r.line) out.push({ x0: Math.min(...xs) - half, x1: Math.max(...xs) + half, z0: Math.min(...zs) - half, z1: Math.max(...zs) + half })
  }
  return out
}

export default function Barriers({ bounds, roads }) {
  const ref = useRef()
  const rects = useMemo(() => roadRects(roads), [roads])
  const onRoad = (x, z) => rects.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)
  // where a road leaves the map: a painted stripe across it at the edge
  const stripes = useMemo(() => {
    if (!bounds) return []
    const out = []
    for (const r of rects) {
      if (r.x0 < bounds.minX && r.x1 > bounds.minX) out.push({ x: bounds.minX - 0.3, z: (r.z0 + r.z1) / 2, w: 0.6, d: r.z1 - r.z0 })
      if (r.x0 < bounds.maxX && r.x1 > bounds.maxX) out.push({ x: bounds.maxX + 0.3, z: (r.z0 + r.z1) / 2, w: 0.6, d: r.z1 - r.z0 })
      if (r.z0 < bounds.minZ && r.z1 > bounds.minZ) out.push({ x: (r.x0 + r.x1) / 2, z: bounds.minZ - 0.3, w: r.x1 - r.x0, d: 0.6 })
      if (r.z0 < bounds.maxZ && r.z1 > bounds.maxZ) out.push({ x: (r.x0 + r.x1) / 2, z: bounds.maxZ + 0.3, w: r.x1 - r.x0, d: 0.6 })
    }
    return out
  }, [bounds, rects])
  const spots = useMemo(() => {
    if (!bounds) return []
    const out = []
    const pad = 0.6 // just outside where you stop
    const { minX, maxX, minZ, maxZ } = bounds
    const add = (x, z, rot) => !onRoad(x, z) && out.push([x, z, rot])
    for (let x = minX; x <= maxX; x += GAP) {
      add(x, minZ - pad, 0)
      add(x, maxZ + pad, 0)
    }
    for (let z = minZ; z <= maxZ; z += GAP) {
      add(minX - pad, z, Math.PI / 2)
      add(maxX + pad, z, Math.PI / 2)
    }
    return out
  }, [bounds, rects]) // eslint-disable-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => new THREE.BoxGeometry(...SIZE), [])
  const material = useMemo(() => new THREE.MeshLambertMaterial(), [])
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const red = new THREE.Color('#c0392b')
    const white = new THREE.Color('#ecebe6')
    spots.forEach(([x, z, rot], i) => {
      m.compose(new THREE.Vector3(x, SIZE[1] / 2, z), q.setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(1, 1, 1))
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, i % 4 < 2 ? red : white)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [spots])
  useLayoutEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])
  if (!spots.length) return null
  return (
    <>
      <instancedMesh ref={ref} args={[geometry, material, spots.length]} frustumCulled={false} />
      {stripes.map((s, i) => (
        <mesh key={i} position={[s.x, 0.04, s.z]} rotation-x={-Math.PI / 2} material={stripeMat}>
          <planeGeometry args={[s.w, s.d]} />
        </mesh>
      ))}
    </>
  )
}
