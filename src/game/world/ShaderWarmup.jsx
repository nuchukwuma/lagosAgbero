import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { create } from 'zustand'

// Prepares the GPU programs for everything in a new world while the loading
// cover is still up, so the first seconds of play don't stutter.
//
// Without this, each kind of material is compiled the first time it is
// drawn, all in one frame: on a budget phone that is a freeze of half a
// second or more just after the cover lifts. Here we ask the browser to
// compile them all in the background (most phones' browsers can) and keep the
// cover up until they are done, or for a few seconds at most.
//
// warmed: false while models download and while the programs compile.
// Everything else waits for it (the loading cover, the frame-rate monitor).
// cover: the full-screen loading cover is up (set by LoadingOverlay). While it
// is, and the programs aren't ready, we don't draw at all: drawing would
// compile them the slow way, all at once, and nobody would see the frame.

export const useWarmup = create(() => ({ warmed: false, cover: false }))

const MAX_WAIT_MS = 4000 // never hold the cover longer than this for compiling

// Like three's renderer.compileAsync, but safe when the world changes while it
// waits: a material freed in the meantime has no program any more, and
// compileAsync would crash on it. Resolves when every program is ready.
function compileInBackground(gl, scene, camera) {
  let materials
  try {
    materials = gl.compile(scene, camera)
  } catch {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const check = () => {
      for (const m of materials) {
        const program = gl.properties.get(m).currentProgram
        if (!program || program.isReady()) materials.delete(m)
      }
      if (materials.size === 0) resolve()
      else setTimeout(check, 10)
    }
    check()
  })
}

export default function ShaderWarmup() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  // This takes over drawing from react-three-fiber (a priority above 0 does
  // that): the same single draw per frame, skipped while the cover hides it.
  useFrame((state) => {
    const { warmed, cover } = useWarmup.getState()
    if (cover && !warmed) return
    state.gl.render(state.scene, state.camera)
  }, 1)
  useEffect(() => {
    // Keep compiling in the background while the cover is up or something is
    // loading: parts of the world mount at different moments (people, cars,
    // the crowd), so one pass isn't enough. Each pass only does work for
    // materials that are new since the last one. "warmed" means the last pass
    // found nothing new.
    let alive = true
    let timer = 0
    let busy = false
    const count = () => gl.info.programs?.length ?? 0
    const schedule = (ms = 200) => {
      if (alive && !timer && !busy) timer = setTimeout(pass, ms)
    }
    const pass = () => {
      timer = 0
      if (!alive) return
      if (useProgress.getState().active) {
        if (useWarmup.getState().warmed) useWarmup.setState({ warmed: false })
        return schedule()
      }
      busy = true
      const before = count()
      const compiling = compileInBackground(gl, scene, camera)
      const giveUp = new Promise((resolve) => setTimeout(resolve, MAX_WAIT_MS))
      Promise.race([compiling, giveUp]).then(() => {
        busy = false
        if (!alive) return
        const fresh = count() !== before
        if (useWarmup.getState().warmed === fresh) useWarmup.setState({ warmed: !fresh })
        // stop once the cover is down and nothing new turned up
        if (fresh || useWarmup.getState().cover) schedule()
      })
    }
    const wake = () => {
      if (useWarmup.getState().warmed && useProgress.getState().active) useWarmup.setState({ warmed: false })
      schedule()
    }
    const offProgress = useProgress.subscribe(wake)
    const offCover = useWarmup.subscribe((s, old) => s.cover !== old.cover && s.cover && schedule())
    schedule(0)
    return () => {
      alive = false
      clearTimeout(timer)
      offProgress()
      offCover()
      useWarmup.setState({ warmed: false })
    }
  }, [gl, scene, camera])
  return null
}
