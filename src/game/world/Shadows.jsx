import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { env } from './env.js'
import { blobTexture } from './textures.js'

// Cheap shadows for budget phones (no shadow maps):
//  - FakeShadows: every building / stall / kiosk footprint is extruded along
//    the sun direction on the ground. One mesh, moved by a shader uniform.
//  - BlobShadows: a soft dark blob under every person and vehicle (one
//    instanced mesh, fed by a registry).
// A stencil bit makes overlapping shadows darken the ground only once.

const SHADOW_Y = 0.2 // just above road kerbs (0.16 m)

const stencil = {
  stencilWrite: true,
  stencilFunc: THREE.NotEqualStencilFunc,
  stencilRef: 1,
  stencilZPass: THREE.ReplaceStencilOp,
}

function rotate(x, z, angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [x * c + z * s, -x * s + z * c]
}

export function FakeShadows({ boxes }) {
  const scene = useThree((s) => s.scene)
  const geometry = useMemo(() => {
    const pos = []
    const lift = []
    const add = (p, l) => {
      pos.push(p[0], SHADOW_Y, p[1])
      lift.push(l)
    }
    for (const b of boxes) {
      const corners = [
        [-b.hw, -b.hd],
        [b.hw, -b.hd],
        [b.hw, b.hd],
        [-b.hw, b.hd],
      ].map(([x, z]) => {
        const [rx, rz] = rotate(x, z, b.angle)
        return [b.x + rx, b.z + rz]
      })
      const h = b.h
      // top face, pushed along the sun direction
      for (const i of [0, 1, 2, 0, 2, 3]) add(corners[i], h)
      // four sides between the footprint and the pushed top
      for (let i = 0; i < 4; i++) {
        const a = corners[i]
        const c = corners[(i + 1) % 4]
        add(a, 0); add(c, 0); add(c, h)
        add(a, 0); add(c, h); add(a, h)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('aLift', new THREE.Float32BufferAttribute(lift, 1))
    return g
  }, [boxes])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        ...stencil,
        uniforms: { uDir: { value: new THREE.Vector2() }, uOpacity: { value: 0.3 }, uFog: { value: new THREE.Vector2(40, 120) } },
        vertexShader: /* glsl */ `
          attribute float aLift;
          uniform vec2 uDir;
          varying float vDepth;
          void main() {
            vec3 p = position;
            p.xz += uDir * aLift;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vDepth = -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          precision mediump float;
          uniform float uOpacity;
          uniform vec2 uFog;
          varying float vDepth;
          void main() {
            float a = uOpacity * (1.0 - smoothstep(uFog.x, uFog.y, vDepth));
            if (a < 0.01) discard;
            gl_FragColor = vec4(0.03, 0.02, 0.06, a);
          }`,
      }),
    [],
  )

  useFrame(() => {
    // shadow of a 1 m pole: opposite the sun, longer when the sun is low
    const d = env.sunDir
    const len = Math.min(1.6, Math.hypot(d.x, d.z) / Math.max(0.25, d.y))
    const n = Math.hypot(d.x, d.z) || 1
    material.uniforms.uDir.value.set((-d.x / n) * len, (-d.z / n) * len)
    material.uniforms.uOpacity.value = env.shadow
    if (scene.fog) material.uniforms.uFog.value.set(scene.fog.near * 0.9, scene.fog.far * 0.8)
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={2} />
}

// ---- blob shadows ----
// Anything that moves registers itself: { object, radius } or { object, size: [w, l] }
export const shadowCasters = new Set()

export function useBlobShadow(ref, options) {
  useEffect(() => {
    const entry = { ref, ...options }
    shadowCasters.add(entry)
    return () => shadowCasters.delete(entry)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref])
}

// The background crowd adds its own blobs: flat [x, z, x, z...] for walkers,
// [{ x, z }] for people standing around.
export const crowdBlobs = { walkers: [], standers: [] }

const MAX = 200
const tmp = new THREE.Matrix4()
const q = new THREE.Quaternion()
const p = new THREE.Vector3()
const s = new THREE.Vector3()
const e = new THREE.Euler()
const qw = new THREE.Quaternion()

export function BlobShadows() {
  const mesh = useRef()
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: blobTexture(),
        color: '#05030a',
        transparent: true,
        depthWrite: false,
        alphaTest: 0.03,
        opacity: 0.45,
        fog: false,
        ...stencil,
      }),
    [],
  )
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])

  useFrame(() => {
    const m = mesh.current
    if (!m) return
    let n = 0
    for (const c of shadowCasters) {
      const o = c.ref.current
      if (!o || n >= MAX) continue
      o.getWorldPosition(p)
      if (p.y > 0.6 && !c.size) continue // riding something that has its own shadow
      let yaw = 0
      if (c.size) {
        o.getWorldQuaternion(qw)
        yaw = e.setFromQuaternion(qw, 'YXZ').y
        s.set(c.size[0] * 1.5, 1, c.size[1] * 1.3)
      } else s.set(c.radius * 2.6, 1, c.radius * 2.6)
      q.setFromEuler(e.set(0, yaw, 0))
      // nudge the blob away from the sun a little
      p.x -= env.sunDir.x * 0.25
      p.z -= env.sunDir.z * 0.25
      p.y = SHADOW_Y + 0.004
      m.setMatrixAt(n++, tmp.compose(p, q, s))
    }
    q.identity()
    s.set(1.05, 1, 1.05)
    const w = crowdBlobs.walkers
    for (let i = 0; i + 1 < w.length && n < MAX; i += 2) m.setMatrixAt(n++, tmp.compose(p.set(w[i] - env.sunDir.x * 0.25, SHADOW_Y + 0.004, w[i + 1] - env.sunDir.z * 0.25), q, s))
    for (const c of crowdBlobs.standers) {
      if (n >= MAX) break
      m.setMatrixAt(n++, tmp.compose(p.set(c.x - env.sunDir.x * 0.25, SHADOW_Y + 0.004, c.z - env.sunDir.z * 0.25), q, s))
    }
    m.count = n
    m.instanceMatrix.needsUpdate = true
    material.opacity = 0.2 + env.shadow * 0.9
  })

  return <instancedMesh ref={mesh} args={[geometry, material, MAX]} frustumCulled={false} renderOrder={3} />
}
