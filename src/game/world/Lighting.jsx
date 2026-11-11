import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TOP_VIEW } from './CameraRig.jsx'

// Time-of-day presets. No shadow maps (too slow for budget phones): a sky
// colour, fog in the same colour to hide the world's edge, a hemisphere light
// and one directional "sun". Phase 6 animates between these.

export const TIMES = {
  dawn: { sky: '#f2a46b', hemiSky: '#ffd9b0', hemiGround: '#6b4f3a', hemi: 1.1, sun: '#ffb27a', sunI: 1.5, sunPos: [60, 25, -20], fog: [35, 110] },
  day: { sky: '#9fd3ee', hemiSky: '#ffffff', hemiGround: '#8a6f4f', hemi: 1.15, sun: '#fff4e0', sunI: 2.0, sunPos: [20, 60, 30], fog: [45, 140] },
  dusk: { sky: '#e0795a', hemiSky: '#ffc49b', hemiGround: '#4d3426', hemi: 0.95, sun: '#ff9a6a', sunI: 1.3, sunPos: [-60, 20, 10], fog: [35, 110] },
  night: { sky: '#121a36', hemiSky: '#4a5d99', hemiGround: '#1d1712', hemi: 0.75, sun: '#9db1ff', sunI: 0.5, sunPos: [-30, 50, 20], fog: [25, 85] },
}

export default function Lighting({ time = 'day' }) {
  const t = TIMES[time] || TIMES.day
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.background = new THREE.Color(t.sky)
    scene.fog = TOP_VIEW ? null : new THREE.Fog(t.sky, t.fog[0], t.fog[1])
  }, [scene, t])
  return (
    <>
      <hemisphereLight args={[t.hemiSky, t.hemiGround, t.hemi]} />
      <directionalLight position={t.sunPos} color={t.sun} intensity={t.sunI} />
      {time === 'night' && (
        <>
          {/* the only two lamps that actually work at Iyana-Wahala */}
          <pointLight position={[-16, 4, -6]} color="#ffcf7a" intensity={30} distance={18} decay={1.6} />
          <pointLight position={[2, 5.5, -14]} color="#ffcf7a" intensity={22} distance={16} decay={1.6} />
        </>
      )}
    </>
  )
}
