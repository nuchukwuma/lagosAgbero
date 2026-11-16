import { useEffect, useMemo } from 'react'

// useMemo for GPU resources: whatever the factory builds is freed on the
// graphics card when the component goes away (leaving a world, ending a
// mode). Without this, every world you visit stays in memory until the tab
// is closed, which is what kills the game on a 2 GB phone.
//
// Frees every BufferGeometry found in the value (also inside arrays and
// plain objects, e.g. [{ geometry, material }]). Materials and textures are
// freed only when they are the value itself: ones found inside are usually
// shared (staticBatch's materials, cached textures).
//
// The arrays stay in memory, so if the same value is drawn again (React's
// strict-mode remount in development) three.js simply uploads it again.

function freeGeometries(value, depth = 0) {
  if (!value || depth > 3) return
  if (value.isBufferGeometry) value.dispose()
  else if (Array.isArray(value)) for (const v of value) freeGeometries(v, depth + 1)
  else if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) for (const v of Object.values(value)) freeGeometries(v, depth + 1)
}

export function disposeValue(value) {
  if (!value) return
  if (value.isMaterial || value.isTexture) value.dispose()
  else freeGeometries(value)
}

export function useDisposable(factory, deps) {
  const value = useMemo(factory, deps) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => disposeValue(value), [value])
  return value
}
