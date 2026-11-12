import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TOP_VIEW } from './CameraRig.jsx'
import { env } from './env.js'

// Time-of-day lighting. No shadow maps (too slow for budget phones; see
// Shadows.jsx for the cheap ones): a horizon colour, fog in the same colour
// to hide the world's edge, a hemisphere light and one directional "sun". Changes of time blend smoothly over a few
// seconds; rain greys the sky and dims everything.

export const TIMES = {
  dawn: { sky: '#f4b183', zenith: '#6f8fc0', hemiSky: '#ffe2c4', hemiGround: '#6b4f3a', hemi: 0.95, sun: '#ffb27a', sunI: 1.9, sunPos: [60, 24, 14], fog: [40, 125], shadow: 0.26, night: 0.15 },
  day: { sky: '#cfe8f5', zenith: '#3d8bd9', hemiSky: '#eaf4ff', hemiGround: '#8a6f4f', hemi: 0.95, sun: '#fff1d6', sunI: 2.4, sunPos: [45, 52, 24], fog: [55, 150], shadow: 0.36, night: 0 },
  dusk: { sky: '#f08a5d', zenith: '#3f4a8a', hemiSky: '#ffc49b', hemiGround: '#4d3426', hemi: 0.85, sun: '#ff9a6a', sunI: 1.6, sunPos: [-60, 20, 16], fog: [40, 120], shadow: 0.24, night: 0.55 },
  night: { sky: '#1a2244', zenith: '#060a1a', hemiSky: '#7d8fd0', hemiGround: '#3a2e24', hemi: 1.15, sun: '#b4c3ff', sunI: 0.8, sunPos: [-25, 50, 22], fog: [28, 95], shadow: 0.12, night: 1 },
}
const RAIN = { sky: new THREE.Color('#6f7a86'), dim: 0.7, fog: [20, 70] }

export default function Lighting({ time = 'day', raining = false }) {
  const scene = useThree((s) => s.scene)
  const hemi = useRef()
  const sun = useRef()
  const lamps = useRef()
  const started = useRef(false)
  const target = useMemo(() => {
    const t = TIMES[time] || TIMES.day
    const sky = new THREE.Color(t.sky)
    if (raining) sky.lerp(RAIN.sky, 0.6)
    const dim = raining ? RAIN.dim : 1
    return {
      sky,
      zenith: new THREE.Color(t.zenith).lerp(RAIN.sky, raining ? 0.7 : 0),
      shadow: raining ? 0.1 : t.shadow,
      night: t.night,
      hemiSky: new THREE.Color(t.hemiSky),
      hemiGround: new THREE.Color(t.hemiGround),
      hemi: t.hemi * dim,
      sun: new THREE.Color(t.sun),
      sunI: t.sunI * dim,
      sunPos: new THREE.Vector3(...t.sunPos),
      fog: raining ? RAIN.fog : t.fog,
      lampsOn: time === 'night' || time === 'dusk' || raining,
    }
  }, [time, raining])

  // first frame: jump straight to the target
  useEffect(() => {
    if (!scene.background) scene.background = target.sky.clone()
    if (!scene.fog && !TOP_VIEW) scene.fog = new THREE.Fog(target.sky.clone(), target.fog[0], target.fog[1])
    if (!started.current) {
      started.current = true
      env.horizon.copy(target.sky)
      env.zenith.copy(target.zenith)
      env.sunColor.copy(target.sun)
      env.sunDir.copy(target.sunPos).normalize()
      env.shadow = target.shadow
      env.night = target.night
    }
  }, [scene, target])

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 1.2)
    scene.background?.lerp(target.sky, k)
    if (scene.fog) {
      scene.fog.color.copy(scene.background)
      scene.fog.near += (target.fog[0] - scene.fog.near) * k
      scene.fog.far += (target.fog[1] - scene.fog.far) * k
    }
    if (hemi.current) {
      hemi.current.color.lerp(target.hemiSky, k)
      hemi.current.groundColor.lerp(target.hemiGround, k)
      hemi.current.intensity += (target.hemi - hemi.current.intensity) * k
    }
    if (sun.current) {
      sun.current.color.lerp(target.sun, k)
      sun.current.intensity += (target.sunI - sun.current.intensity) * k
      sun.current.position.lerp(target.sunPos, k)
    }
    // shared state for the sky dome, fake shadows and window lights
    env.horizon.copy(scene.background || target.sky)
    env.zenith.lerp(target.zenith, k)
    env.sunColor.lerp(target.sun, k)
    if (sun.current) env.sunDir.copy(sun.current.position).normalize()
    env.shadow += (target.shadow - env.shadow) * k
    env.night += (target.night - env.night) * k
    if (lamps.current) {
      for (const l of lamps.current.children) l.intensity += ((target.lampsOn ? l.userData.on : 0) - l.intensity) * k
    }
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={[target.hemiSky, target.hemiGround, target.hemi]} />
      <directionalLight ref={sun} position={target.sunPos.toArray()} color={target.sun} intensity={target.sunI} />
      {/* the only two lamps that actually work at Iyana-Wahala */}
      <group ref={lamps}>
        <pointLight position={[-16, 4, -6]} color="#ffcf7a" intensity={0} distance={18} decay={1.6} userData={{ on: 30 }} />
        <pointLight position={[2, 5.5, -14]} color="#ffcf7a" intensity={0} distance={16} decay={1.6} userData={{ on: 22 }} />
      </group>
    </>
  )
}
