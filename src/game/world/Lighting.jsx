import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TOP_VIEW } from './CameraRig.jsx'

// Time-of-day lighting. No shadow maps (too slow for budget phones): a sky
// colour, fog in the same colour to hide the world's edge, a hemisphere light
// and one directional "sun". Changes of time blend smoothly over a few
// seconds; rain greys the sky and dims everything.

export const TIMES = {
  dawn: { sky: '#f2a46b', hemiSky: '#ffd9b0', hemiGround: '#6b4f3a', hemi: 1.1, sun: '#ffb27a', sunI: 1.5, sunPos: [60, 25, -20], fog: [35, 110] },
  day: { sky: '#9fd3ee', hemiSky: '#ffffff', hemiGround: '#8a6f4f', hemi: 1.15, sun: '#fff4e0', sunI: 2.0, sunPos: [20, 60, 30], fog: [45, 140] },
  dusk: { sky: '#e0795a', hemiSky: '#ffc49b', hemiGround: '#4d3426', hemi: 0.95, sun: '#ff9a6a', sunI: 1.3, sunPos: [-60, 20, 10], fog: [35, 110] },
  night: { sky: '#121a36', hemiSky: '#7d8fd0', hemiGround: '#3a2e24', hemi: 1.25, sun: '#b4c3ff', sunI: 0.9, sunPos: [-30, 50, 20], fog: [25, 85] },
}
const RAIN = { sky: new THREE.Color('#6f7a86'), dim: 0.7, fog: [20, 70] }

export default function Lighting({ time = 'day', raining = false }) {
  const scene = useThree((s) => s.scene)
  const hemi = useRef()
  const sun = useRef()
  const lamps = useRef()
  const target = useMemo(() => {
    const t = TIMES[time] || TIMES.day
    const sky = new THREE.Color(t.sky)
    if (raining) sky.lerp(RAIN.sky, 0.6)
    const dim = raining ? RAIN.dim : 1
    return {
      sky,
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
