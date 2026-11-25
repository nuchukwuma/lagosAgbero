// Taking a picture of the 3D view (for share cards). The canvas doesn't keep
// its last frame, so the picture is taken inside a frame: CaptureBridge (in
// GameCanvas) draws the scene once more and reads it straight away.
const waiting = []

/** A JPEG data URL of the 3D view, or null if nothing is drawing right now. */
export function captureView(timeout = 700) {
  return new Promise((resolve) => {
    const done = (url) => {
      clearTimeout(t)
      resolve(url)
    }
    const t = setTimeout(() => {
      const i = waiting.indexOf(done)
      if (i >= 0) waiting.splice(i, 1)
      resolve(null)
    }, timeout)
    waiting.push(done)
  })
}

/** Called by CaptureBridge every frame: hand the picture to whoever asked. */
export function takeCaptures(read) {
  if (!waiting.length) return
  let url = null
  try {
    url = read()
  } catch {
    url = null
  }
  for (const done of waiting.splice(0)) done(url)
}
