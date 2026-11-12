import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { getAsset } from '../../assets/assetManifest.js'
import { buildStaticBatches } from './staticBatch.js'
import { mergePrims, PRIM_MATERIAL } from './primGeometry.js'
import { earthTexture, paverTexture, facadeTextures, blobTexture } from './textures.js'
import { mulberry32 } from './cityFill.js'
import { GROUND_Y } from './layout.js'
import { env } from './env.js'

// The static street, drawn in as few draw calls as possible.

/** All layout models (roads, buildings, poles, parked vehicles), merged. */
export function StaticWorld({ groups }) {
  const names = useMemo(() => [...new Set(groups.map((g) => g.model))].filter((n) => getAsset(n).available), [groups])
  const gltfs = useGLTF(names.map((n) => getAsset(n).url))
  const batches = useMemo(() => buildStaticBatches(groups, new Map(names.map((n, i) => [n, gltfs[i]]))), [groups, names, gltfs])
  return batches.map((b, i) => <mesh key={i} geometry={b.geometry} material={b.material} matrixAutoUpdate={false} />)
}

/** Kiosks, umbrellas, drums, kegs, goats... (shapes with vertex colours). */
export function Props({ prims }) {
  const geometries = useMemo(() => mergePrims(prims), [prims])
  return geometries.map((g, i) => <mesh key={i} geometry={g} material={PRIM_MATERIAL} matrixAutoUpdate={false} />)
}

const WALLS = ['#d9c7a3', '#c9b08a', '#b8c4c8', '#e3d6b8', '#c7a58a', '#a9b79a', '#d8b9a0', '#bfb4a6']
const ROOFS = ['#7b4a2b', '#8a8f93', '#5f6b70', '#94623d', '#3f6b52']

/** Far buildings: plain blocks with a window texture; windows glow at night. */
export function Skyline({ blocks }) {
  const material = useRef()
  const geometry = useMemo(() => {
    const rng = mulberry32(77)
    const list = []
    const c = new THREE.Color()
    for (const b of blocks) {
      const g = new THREE.BoxGeometry(b.w, b.h, b.d)
      const uv = g.attributes.uv
      const pos = g.attributes.position
      const nor = g.attributes.normal
      const wall = c.set(WALLS[Math.floor(rng() * WALLS.length)]).clone()
      const roof = c.set(ROOFS[Math.floor(rng() * ROOFS.length)]).clone()
      const col = new Float32Array(pos.count * 3)
      const u0 = Math.floor(rng() * 4) / 4
      for (let i = 0; i < pos.count; i++) {
        const top = nor.getY(i) > 0.5
        const along = Math.abs(nor.getX(i)) > 0.5 ? b.d : b.w
        if (top || nor.getY(i) < -0.5) uv.setXY(i, 0.004, 0.004) // plain wall pixel
        else uv.setXY(i, u0 + (uv.getX(i) * along) / 12, (uv.getY(i) * b.h) / 12)
        const k = top ? roof : wall
        const shade = top ? 1 : 0.8 + 0.2 * (pos.getY(i) > 0 ? 1 : 0)
        col[i * 3] = k.r * shade
        col[i * 3 + 1] = k.g * shade
        col[i * 3 + 2] = k.b * shade
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3))
      g.rotateY((b.rot * Math.PI) / 180)
      g.translate(b.x, b.h / 2, b.z)
      list.push(g)
    }
    return list.length ? mergeGeometries(list, false) : null
  }, [blocks])
  const tex = useMemo(() => facadeTextures(), [])
  useFrame(() => {
    if (material.current) material.current.emissiveIntensity = env.night * 1.1
  })
  if (!geometry) return null
  return (
    <mesh geometry={geometry} matrixAutoUpdate={false}>
      <meshLambertMaterial ref={material} map={tex.map} vertexColors emissive="#ffffff" emissiveMap={tex.lights} emissiveIntensity={0} />
    </mesh>
  )
}

/** Warm glows at kiosks and lamps after dark (one instanced, additive mesh). */
export function NightGlows({ lights }) {
  const mesh = useRef()
  const material = useMemo(() => new THREE.MeshBasicMaterial({ map: blobTexture(), color: '#ffb347', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }), [])
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  useFrame(({ camera }) => {
    const im = mesh.current
    if (!im) return
    material.opacity = env.night * 0.85
    im.visible = env.night > 0.03
    if (!im.visible) return
    const q = camera.quaternion
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    lights.forEach((l, i) => {
      const size = l.size || 2.6
      im.setMatrixAt(i, m.compose(p.set(l.x, l.y, l.z), q, s.set(size, size, size)))
    })
    im.instanceMatrix.needsUpdate = true
  })
  if (!lights.length) return null
  return <instancedMesh ref={mesh} args={[geometry, material, lights.length]} frustumCulled={false} renderOrder={5} />
}

// ---- ground ----
const EARTH = new THREE.Color('#a8744a')
const EARTH_DARK = new THREE.Color('#7d5536')
const EARTH_PALE = new THREE.Color('#c39a6b')
const WEED = new THREE.Color('#6f7f3a')

/** Red earth with patches (vertex colours) and grain (texture). */
export function Ground({ bounds }) {
  const size = 420
  const geometry = useMemo(() => {
    const seg = 56
    const g = new THREE.PlaneGeometry(size, size, seg, seg)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    const col = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    // smooth value noise from a coarse random grid
    const rng = mulberry32(3)
    const N = 24
    const grid = Array.from({ length: N * N }, () => rng())
    const sample = (x, z) => {
      const fx = ((x / size + 0.5) * (N - 1)) % (N - 1)
      const fz = ((z / size + 0.5) * (N - 1)) % (N - 1)
      const ix = Math.floor(fx)
      const iz = Math.floor(fz)
      const tx = fx - ix
      const tz = fz - iz
      const a = grid[iz * N + ix]
      const b = grid[iz * N + ix + 1]
      const d = grid[(iz + 1) * N + ix]
      const e2 = grid[(iz + 1) * N + ix + 1]
      return a + (b - a) * tx + (d - a) * tz + (a - b - d + e2) * tx * tz
    }
    for (let i = 0; i < pos.count; i++) {
      const n = sample(pos.getX(i), pos.getZ(i))
      const n2 = sample(pos.getZ(i) * 2.3 + 40, pos.getX(i) * 2.3 - 20)
      c.copy(EARTH).lerp(n < 0.5 ? EARTH_DARK : EARTH_PALE, Math.abs(n - 0.5) * 1.3)
      if (n2 > 0.72) c.lerp(WEED, (n2 - 0.72) * 2.2)
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const uv = g.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (size / 7), uv.getY(i) * (size / 7))
    return g
  }, [])
  const map = useMemo(() => earthTexture(), [])
  return (
    <mesh geometry={geometry} position={[(bounds.minX + bounds.maxX) / 2, -0.04, (bounds.minZ + bounds.maxZ) / 2]}>
      <meshLambertMaterial map={map} vertexColors />
    </mesh>
  )
}

/** Pavements and market floors with a paver texture. */
export function Pavements({ list }) {
  const map = useMemo(() => paverTexture(), [])
  const earth = useMemo(() => earthTexture(), [])
  const meshes = useMemo(
    () =>
      list.map((p, i) => {
        const [x, z, w, d] = p.rect
        const g = new THREE.PlaneGeometry(w, d)
        g.rotateX(-Math.PI / 2)
        const uv = g.attributes.uv
        for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (w / 3), uv.getY(k) * (d / 3))
        g.translate(x + w / 2, GROUND_Y + 0.005 + i * 0.001, z + d / 2)
        return { g, color: p.color, texture: p.texture }
      }),
    [list],
  )
  // "texture": "earth" for grass fields and laterite paths, pavers otherwise
  return meshes.map((m, i) => (
    <mesh key={i} geometry={m.g}>
      <meshLambertMaterial map={m.texture === 'earth' ? earth : map} color={m.color} />
    </mesh>
  ))
}

/** Open gutters with broken slabs, weeds, stones, oil stains: the small stuff. */
export function GroundDetail({ layout }) {
  const { geometries, stains } = useMemo(() => {
    const rng = mulberry32(19)
    const b = layout.bounds
    const prims = []
    // gutters behind both pavements, with concrete slabs (some missing)
    for (const z of [-8.45, 8.45]) {
      prims.push({ s: 'box', p: [0, 0.035, z], d: [b.maxX - b.minX + 100, 0.02, 0.62], c: '#2a2622', flat: true })
      for (let x = b.minX - 50; x < b.maxX + 50; x += 1.3) {
        if (rng() < 0.3) continue
        prims.push({ s: 'box', p: [x, 0.07, z], d: [1.2, 0.07, 0.72], c: rng() < 0.5 ? '#a39d93' : '#8f897f', ry: (rng() - 0.5) * 0.12, flat: true })
      }
    }
    // weeds and stones on bare earth
    const inside = (x, z) => layout.colliders.some((c) => Math.abs(x - c.x) < c.hw + 0.4 && Math.abs(z - c.z) < c.hd + 0.4)
    const paved = (x, z) => Math.abs(z) < 8.9 || (layout.raw.pavements || []).some((p) => x > p.rect[0] && x < p.rect[0] + p.rect[2] && z > p.rect[1] && z < p.rect[1] + p.rect[3]) || (x > -50 && x < -26 && z > -34 && z < -10) || (x > 23 && x < 33 && z > 0)
    for (let i = 0; i < 520; i++) {
      const x = b.minX - 30 + rng() * (b.maxX - b.minX + 60)
      const z = b.minZ - 14 + rng() * (b.maxZ - b.minZ + 28)
      if (paved(x, z) || inside(x, z)) continue
      if (rng() < 0.7) {
        const h = 0.18 + rng() * 0.3
        prims.push({ s: 'cone', p: [x, h / 2, z], d: [0.14 + rng() * 0.2, h], c: rng() < 0.5 ? '#5f7a34' : '#7b8f3c', flat: true })
        if (rng() < 0.5) prims.push({ s: 'cone', p: [x + 0.2, h / 3, z + 0.12], d: [0.12, h * 0.66], c: '#6c8a3a', flat: true })
      } else prims.push({ s: 'box', p: [x, 0.05, z], d: [0.16 + rng() * 0.2, 0.1, 0.14 + rng() * 0.2], c: '#8a7f72', ry: rng() * 3, flat: true })
    }
    // oil stains and patches on the road
    const stainList = []
    for (let i = 0; i < 26; i++) stainList.push({ x: -90 + rng() * 180, z: (rng() - 0.5) * 6.4, s: 1.2 + rng() * 2.6, o: 0.18 + rng() * 0.2 })
    for (let i = 0; i < 10; i++) stainList.push({ x: -48 + rng() * 20, z: -32 + rng() * 20, s: 1.5 + rng() * 2, o: 0.2 + rng() * 0.15 })
    return { geometries: mergePrims(prims), stains: stainList }
  }, [layout])

  const stainMesh = useRef()
  const stainMat = useMemo(() => new THREE.MeshBasicMaterial({ map: blobTexture(), color: '#0d0b0a', transparent: true, depthWrite: false, opacity: 0.3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), [])
  const stainGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  const setStains = (im) => {
    stainMesh.current = im
    if (!im) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    stains.forEach((s, i) => im.setMatrixAt(i, m.compose(new THREE.Vector3(s.x, 0.012, s.z), q, new THREE.Vector3(s.s * 1.6, 1, s.s))))
    im.instanceMatrix.needsUpdate = true
  }
  return (
    <>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} material={PRIM_MATERIAL} matrixAutoUpdate={false} />
      ))}
      <instancedMesh ref={setStains} args={[stainGeo, stainMat, stains.length]} frustumCulled={false} />
    </>
  )
}
