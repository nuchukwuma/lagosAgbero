import { Suspense, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import Lighting from '../../game/world/Lighting.jsx'
import Sky from '../../game/world/Sky.jsx'
import StreetScene from '../../game/world/StreetScene.jsx'
import FrameCap from '../../game/world/FrameCap.jsx'
import { getLayout } from '../../game/world/worlds.js'
import { webglSupport } from '../../game/world/webgl.js'
import { useSettings } from '../../game/store/settings.js'

// The landing page's background: the real Iyana-Wahala street at dusk, the
// camera drifting slowly round it. Weak devices, Light mode, "reduce motion"
// and data-saver get the still title picture instead. The street's models are
// the ones the game uses, so they're already loaded when you start playing.

function Orbit() {
  useFrame(({ camera, clock }) => {
    const a = 0.6 + clock.elapsedTime * 0.035
    camera.position.set(Math.sin(a) * 36, 15 + Math.sin(clock.elapsedTime * 0.11) * 2.5, -6 + Math.cos(a) * 36)
    camera.lookAt(0, 2, -6)
  })
  return null
}

function liveOk() {
  try {
    if (!webglSupport().ok) return false
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
    if (navigator.connection?.saveData) return false
    if ((navigator.deviceMemory ?? 4) < 3) return false
  } catch {
    return false
  }
  return true
}

export default function CityPreview() {
  const light = useSettings((s) => s.quality === 'low')
  const [live, setLive] = useState(false)
  const [shown, setShown] = useState(false) // the street fades in once it has drawn
  useEffect(() => {
    // after the page has painted: the landing shows at once, the street follows
    const id = setTimeout(() => setLive(!light && liveOk()), 250)
    return () => clearTimeout(id)
  }, [light])
  return (
    <div className="city-preview" aria-hidden="true">
      <div className="city-still" />
      {live && (
        <Canvas
          className={`city-canvas ${shown ? 'is-shown' : ''}`}
          dpr={1}
          frameloop="never"
          gl={{ antialias: false, powerPreference: 'low-power' }}
          camera={{ fov: 42, near: 0.5, far: 220, position: [30, 16, 20] }}
          onCreated={() => setTimeout(() => setShown(true), 900)}
        >
          <FrameCap fps={30} />
          <Lighting time="dusk" raining={false} />
          <Sky />
          <Suspense fallback={null}>
            <StreetScene layout={getLayout('iyanaWahala')} />
          </Suspense>
          <Orbit />
        </Canvas>
      )}
      <div className="city-shade" />
    </div>
  )
}
