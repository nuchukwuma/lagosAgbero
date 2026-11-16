// Can this browser draw 3D at all? Some browsers have WebGL switched off
// (Firefox with hardware acceleration off, a blocklisted graphics driver,
// some privacy settings or remote desktops). Checked once and remembered.

let cached = null

/** { ok: boolean, version: 2 | 1 | 0 } */
export function webglSupport() {
  if (cached) return cached
  cached = { ok: false, version: 0 }
  try {
    const canvas = document.createElement('canvas')
    const gl2 = canvas.getContext('webgl2')
    const gl = gl2 || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (gl) cached = { ok: true, version: gl2 ? 2 : 1 }
    // free the test context straight away: browsers allow only a few at once
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    cached = { ok: false, version: 0 }
  }
  return cached
}

/** Which browser, for the right "how to fix it" steps. */
export function browserName(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent) {
  if (/Firefox\//.test(ua)) return 'firefox'
  if (/Edg\//.test(ua)) return 'edge'
  if (/Chrome\/|Chromium\//.test(ua)) return 'chrome'
  if (/Safari\//.test(ua)) return 'safari'
  return 'other'
}
