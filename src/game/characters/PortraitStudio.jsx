import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { usePortraits, drawPortrait, releasePortraitBodies } from './portraits.js'

// Lives inside the game canvas: draws queued portraits one at a time with the
// game's own renderer (see portraits.js), between frames.
export default function PortraitStudio() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    let busy = false
    let idle = 0
    const work = () => {
      const { queue } = usePortraits.getState()
      if (busy || !queue.length) return
      busy = true
      const job = queue[0]
      clearTimeout(idle)
      drawPortrait(gl, job.look)
        .then((url) => usePortraits.setState((s) => ({ urls: { ...s.urls, [job.key]: url } })))
        .catch((e) => console.warn('[portrait]', job.key, e))
        .finally(() => {
          usePortraits.setState((s) => ({ queue: s.queue.filter((q) => q !== job) }))
          busy = false
          // nobody new for a while: let go of the bodies loaded for portraits
          idle = setTimeout(releasePortraitBodies, 20000)
          work()
        })
    }
    const off = usePortraits.subscribe((s, old) => s.queue !== old.queue && work())
    work()
    return () => {
      off()
      clearTimeout(idle)
    }
  }, [gl])
  return null
}
