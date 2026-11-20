import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

// The edge of the walkable world, made visible: a row of red-and-white
// concrete barriers (like a closed Lagos road) along every side of the
// layout's bounds, where the player stops. One instanced mesh, cheap.
const SIZE = [1.9, 0.8, 0.45]
const GAP = 2.05

export default function Barriers({ bounds }) {
  const ref = useRef()
  const spots = useMemo(() => {
    if (!bounds) return []
    const out = []
    const pad = 0.6 // just outside where you stop
    const { minX, maxX, minZ, maxZ } = bounds
    for (let x = minX; x <= maxX; x += GAP) {
      out.push([x, minZ - pad, 0])
      out.push([x, maxZ + pad, 0])
    }
    for (let z = minZ; z <= maxZ; z += GAP) {
      out.push([minX - pad, z, Math.PI / 2])
      out.push([maxX + pad, z, Math.PI / 2])
    }
    return out
  }, [bounds])
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
  return <instancedMesh ref={ref} args={[geometry, material, spots.length]} frustumCulled={false} />
}
