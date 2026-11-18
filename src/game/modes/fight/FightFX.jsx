// Hit effects for street fights, cartoon style: where a blow lands, a burst
// of light (a star and a ring) with sparks flying out, and a comic word on
// screen ("GBAM!"); the one who's hit squashes for a moment. Blocks give a
// smaller, cool-coloured burst. Everything is a small fixed pool of meshes,
// reused, so a long fight makes no garbage.
//
//   impact(position, { kind: 'punch' | 'kick' | 'special' | 'block' })
//   <FightFX />                 inside the canvas
//   <ImpactWords />             over it (FightMode)

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { create } from 'zustand'

const POOL = 4
const SPARKS = 8
const LIFE = 0.32 // seconds a burst lasts

const STYLE = {
  punch: { size: 0.55, color: '#fff3b0', ring: '#ffb020', words: ['GBAM!', 'KPA!', 'POW!', 'WHAM!'] },
  kick: { size: 0.75, color: '#ffe08a', ring: '#ff7a1a', words: ['KPAU!', 'BOOM!', 'GBOSA!', 'WHUMP!'] },
  special: { size: 1.25, color: '#ffffff', ring: '#ff3d2e', words: ['LAGOS ROUNDABOUT!', 'KPAKPAKPA!', 'GBAGAUN!'] },
  block: { size: 0.4, color: '#d8f1ff', ring: '#5aa9ff', words: ['BLOCK!', 'TCHK!'] },
}

// ---- what happened (filled by FightDirector, read by the pool) ----
const queue = []
let wordId = 0
export const useImpactWords = create(() => ({ words: [] }))

/** A blow landed (or was blocked) at `position` (world). */
export function impact(position, { kind = 'punch' } = {}) {
  queue.push({ position: position.clone(), kind })
}

function starGeometry(points = 8, inner = 0.42) {
  const shape = new THREE.Shape()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : 1
    const a = (i / (points * 2)) * Math.PI * 2
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  return new THREE.ShapeGeometry(shape)
}
const STAR = starGeometry()
const RING = new THREE.RingGeometry(0.78, 1, 24)
const SPARK = new THREE.PlaneGeometry(0.06, 0.26)

function material(color) {
  // drawn over everything near it, never lit or fogged: it's light
  return new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, depthTest: false, fog: false, side: THREE.DoubleSide, toneMapped: false })
}

export default function FightFX() {
  const { camera, size } = useThree()
  const slots = useMemo(
    () =>
      Array.from({ length: POOL }, () => ({
        t: Infinity,
        kind: 'punch',
        star: material('#fff'),
        ring: material('#fff'),
        spark: material('#fff'),
        dirs: Array.from({ length: SPARKS }, () => new THREE.Vector3()),
      })),
    [],
  )
  const groups = useRef([])
  const next = useRef(0)
  const v = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05)
    // start new bursts
    while (queue.length) {
      const hit = queue.shift()
      const i = next.current++ % POOL
      const s = slots[i]
      const st = STYLE[hit.kind] || STYLE.punch
      s.t = 0
      s.kind = hit.kind
      s.star.color.set(st.color)
      s.ring.color.set(st.ring)
      s.spark.color.set(st.ring)
      s.dirs.forEach((d, k) => d.set(Math.cos((k / SPARKS) * Math.PI * 2 + Math.random() * 0.5), Math.sin((k / SPARKS) * Math.PI * 2 + Math.random() * 0.5), 0).multiplyScalar(0.8 + Math.random() * 0.8))
      const g = groups.current[i]
      if (g) g.position.copy(hit.position)
      // the word, where the burst is on screen
      v.copy(hit.position).project(camera)
      const words = st.words
      useImpactWords.setState((w) => ({
        words: [
          ...w.words.slice(-3),
          {
            id: ++wordId,
            text: words[Math.floor(Math.random() * words.length)],
            x: ((v.x + 1) / 2) * size.width,
            y: ((1 - v.y) / 2) * size.height + 6, // on the blow (the health bars sit just above the fighters on phones)
            rot: Math.random() * 24 - 12,
            kind: hit.kind,
          },
        ],
      }))
    }
    // play them
    slots.forEach((s, i) => {
      const g = groups.current[i]
      if (!g) return
      s.t += dt
      const k = s.t / LIFE
      g.visible = k < 1
      if (!g.visible) return
      const st = STYLE[s.kind] || STYLE.punch
      g.quaternion.copy(camera.quaternion) // always face the camera
      const [star, ring, ...sparks] = g.children
      const pop = k < 0.25 ? k / 0.25 : 1 // grows fast, then fades
      star.scale.setScalar(st.size * (0.4 + pop * 0.8) * (1 - k * 0.3))
      star.rotation.z = k * 1.2
      s.star.opacity = 1 - k * k
      ring.scale.setScalar(st.size * (0.3 + k * 1.6))
      s.ring.opacity = (1 - k) * 0.9
      sparks.forEach((m, n) => {
        const d = s.dirs[n]
        m.position.set(d.x * st.size * 1.6 * k, d.y * st.size * 1.6 * k, 0)
        m.rotation.z = Math.atan2(d.y, d.x) - Math.PI / 2
        m.scale.setScalar(1 - k)
      })
      s.spark.opacity = 1 - k
    })
  })

  return slots.map((s, i) => (
    <group key={i} ref={(el) => (groups.current[i] = el)} visible={false} renderOrder={10}>
      <mesh geometry={STAR} material={s.star} renderOrder={12} />
      <mesh geometry={RING} material={s.ring} renderOrder={11} />
      {Array.from({ length: SPARKS }, (_, n) => (
        <mesh key={n} geometry={SPARK} material={s.spark} renderOrder={11} />
      ))}
    </group>
  ))
}

/** The comic words ("GBAM!") over the fight; each pops and fades by itself. */
export function ImpactWords() {
  const words = useImpactWords((s) => s.words)
  return (
    <div className="impact-words" aria-hidden="true">
      {words.map((w) => [
        // the special lights up the whole screen for a moment
        w.kind === 'special' && <div key={`f${w.id}`} className="impact-flash" />,
        <span
          key={w.id}
          className={`impact-word impact-${w.kind}`}
          style={{ left: w.x, top: w.y, '--rot': `${w.rot}deg` }}
          onAnimationEnd={() => useImpactWords.setState((s) => ({ words: s.words.filter((x) => x.id !== w.id) }))}
        >
          {w.text}
        </span>,
      ])}
    </div>
  )
}
