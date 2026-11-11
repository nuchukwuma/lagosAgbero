import { useRef, useState } from 'react'
import { input } from '../../game/player/input.js'

// Virtual joystick for touch screens (also works with a mouse).
// Writes straight into the shared input object; no React state per frame.

const RADIUS = 52

export default function Joystick() {
  const base = useRef(null)
  const pointer = useRef(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })

  const update = (e) => {
    const r = base.current.getBoundingClientRect()
    let dx = e.clientX - (r.left + r.width / 2)
    let dy = e.clientY - (r.top + r.height / 2)
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS
      dy = (dy / len) * RADIUS
    }
    input.joy.x = dx / RADIUS
    input.joy.y = -dy / RADIUS
    setKnob({ x: dx, y: dy })
  }
  const end = () => {
    pointer.current = null
    input.joy.x = 0
    input.joy.y = 0
    setKnob({ x: 0, y: 0 })
  }

  return (
    <div
      ref={base}
      className="joystick"
      onPointerDown={(e) => {
        pointer.current = e.pointerId
        e.currentTarget.setPointerCapture(e.pointerId)
        update(e)
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
      role="application"
      aria-label="Move"
    >
      <div className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  )
}
