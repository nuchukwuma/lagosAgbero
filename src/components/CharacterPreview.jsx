import { Component, Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import Character from '../game/characters/Character.jsx'
import { webglSupport } from '../game/world/webgl.js'

// A small 3D view of your character while you customise them (New Game,
// Wardrobe). Every change shows at once. The figure turns slowly; drag to
// spin it yourself. After each change they do a quick "how I look?" move.
//
// Light on memory: one person, no world, low resolution, no antialiasing,
// and it only draws while it's on screen.

const SHOW_OFF = ['cheer', 'talk']

function Turntable({ look, spin }) {
  const group = useRef()
  const [anim, setAnim] = useState('idle')
  const first = useRef(true)
  const lookKey = JSON.stringify(look)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setAnim(SHOW_OFF[Math.floor(Math.random() * SHOW_OFF.length)])
    spin.current.face = true // turn to face the player for the show-off
  }, [lookKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (anim === 'talk') {
      const id = setTimeout(() => setAnim('idle'), 1600)
      return () => clearTimeout(id)
    }
    return undefined
  }, [anim])
  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const s = spin.current
    if (s.dragging) g.rotation.y = s.angle
    else if (s.face) {
      // ease back to facing the camera
      const d = Math.atan2(Math.sin(-g.rotation.y), Math.cos(-g.rotation.y))
      g.rotation.y += d * Math.min(1, dt * 6)
      if (Math.abs(d) < 0.02) s.face = false
      s.angle = g.rotation.y
    } else {
      g.rotation.y += dt * 0.35
      s.angle = g.rotation.y
    }
  })
  return (
    <group ref={group}>
      <Character look={look} animation={anim} shadow={false} onClipEnd={() => setAnim('idle')} />
    </group>
  )
}

class Quiet extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function CharacterPreview({ look, className = '' }) {
  const box = useRef()
  const spin = useRef({ angle: 0, dragging: false, face: false, x: 0 })
  const [onScreen, setOnScreen] = useState(true)
  useEffect(() => {
    const el = box.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  if (!webglSupport().ok) return null

  const down = (e) => {
    spin.current.dragging = true
    spin.current.x = e.clientX
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const move = (e) => {
    const s = spin.current
    if (!s.dragging) return
    s.angle += (e.clientX - s.x) * 0.012
    s.x = e.clientX
  }
  const up = () => {
    spin.current.dragging = false
  }

  return (
    <div ref={box} className={`character-preview ${className}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="img" aria-label="Your character">
      <Quiet>
        <Canvas
          dpr={1}
          frameloop={onScreen ? 'always' : 'never'}
          gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
          camera={{ fov: 28, near: 0.1, far: 20, position: [0, 1.1, 4.7] }}
          onCreated={({ camera }) => camera.lookAt(0, 0.9, 0)}
        >
          <hemisphereLight args={['#fff6e5', '#5a4630', 1.5]} />
          <directionalLight position={[2.5, 4, 3]} intensity={1.6} />
          <Suspense fallback={null}>
            <Turntable look={look} spin={spin} />
          </Suspense>
        </Canvas>
      </Quiet>
      <div className="character-preview-floor" aria-hidden="true" />
    </div>
  )
}
