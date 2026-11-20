import { useEffect } from 'react'
import { useThree, advance } from '@react-three/fiber'

// Light mode draws at most `fps` frames a second (the canvas runs with
// frameloop="never" and this drives it). On a budget phone a steady 30 looks
// smoother than a frame rate that jumps between 25 and 50, and the phone stays
// cooler and the battery lasts longer.
export default function FrameCap({ fps = 30 }) {
  const get = useThree((s) => s.get)
  useEffect(() => {
    const step = 1000 / fps
    let raf = 0
    let last = -Infinity
    const tick = (t) => {
      raf = requestAnimationFrame(tick)
      // the screen refreshes every ~16.7 ms: draw on every other refresh, with a little slack
      if (t - last < step - 4) return
      last = t
      const state = get()
      const now = t / 1000
      // after a pause (tab in the background) carry on as if one short frame had passed
      if (now - state.clock.elapsedTime > 0.1) state.clock.elapsedTime = now - 0.1
      // the first frame's timestamp can be a little older than the clock's start: never step back in time
      if (now < state.clock.elapsedTime) state.clock.elapsedTime = now
      advance(now, true, state)
    }
    get().clock.elapsedTime = performance.now() / 1000
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [fps, get])
  return null
}
