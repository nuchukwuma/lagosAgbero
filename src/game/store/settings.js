// Player settings, kept per device in localStorage.
import { create } from 'zustand'

const KEY = 'areaBoy.settings'
const DEFAULTS = { quality: 'auto', music: true, sound: true, voices: true, handsFree: false, orientation: 'landscape', moveControl: 'stick' } // quality: low | medium | high | sharpest ('auto' = chosen for the device); orientation: landscape | portrait | auto (phones); voices: dialogue read aloud; handsFree: move on once a line has been said; moveControl: stick | buttons (moving mini-games)

function read() {
  try {
    return { ...DEFAULTS, ...JSON.parse(window.localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export const useSettings = create((set, get) => ({
  ...read(),
  update(patch) {
    set(patch)
    try {
      const { update: _update, ...data } = { ...get() }
      window.localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      // storage blocked: settings last for this session only
    }
  },
}))

/**
 * How strong is this device? 'low' for budget phones (few cores, little
 * memory), 'mid' otherwise. Used when quality is "auto".
 */
export function deviceTier() {
  if (typeof navigator === 'undefined') return 'mid'
  const cores = navigator.hardwareConcurrency || 4
  const memory = navigator.deviceMemory || 4
  const smallTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches && Math.min(window.screen?.width || 999, window.screen?.height || 999) < 420
  if (memory <= 3 || cores <= 4 || (smallTouch && cores <= 6 && memory <= 4)) return 'low'
  return 'mid'
}

// Graphics levels, from easiest on the phone to sharpest:
//   low       for 2 GB phones: fewer people, cars and props, lower resolution, 30 fps
//   medium    smoothed edges, up to 1.5x resolution
//   high      up to 2x resolution, a little more of the crowd
//   sharpest  the screen's full resolution (up to 3x), the whole crowd, the furthest view
export const QUALITY_LEVELS = ['low', 'medium', 'high', 'sharpest']

/** The level actually used. 'auto' (the first visit) picks low or medium for the device; old saves map across. */
export function effectiveQuality(quality) {
  if (QUALITY_LEVELS.includes(quality)) return quality
  return deviceTier() === 'low' ? 'low' : 'medium' // 'auto', or anything unknown
}

/** Everything the renderer needs for a quality level. */
export function renderProfile(quality) {
  const q = effectiveQuality(quality)
  const max = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  if (q === 'low') return { quality: q, dpr: { min: 0.7, max: Math.min(1, max) }, antialias: false, far: 150 }
  if (q === 'high') return { quality: q, dpr: { min: Math.min(1.5, max), max: Math.min(2, max) }, antialias: true, far: 240 }
  if (q === 'sharpest') return { quality: q, dpr: { min: Math.min(2, max), max: Math.min(3, max) }, antialias: true, far: 270 }
  return { quality: q, dpr: { min: 1, max: Math.min(1.5, max) }, antialias: true, far: 220 } // medium
}

/** The sharpness (pixel ratio cap) for drawn screens like the 2D fights. */
export function canvasRatio(quality) {
  const dev = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  return Math.min(dev, { low: 1.5, medium: 2, high: 2.5, sharpest: 3 }[effectiveQuality(quality)])
}

/** Device pixel ratio range for a quality setting. */
export function dprFor(quality) {
  return renderProfile(quality).dpr
}

export const fullscreenSupported = () => typeof document !== 'undefined' && Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled)

export async function toggleFullscreen() {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) await (document.exitFullscreen || document.webkitExitFullscreen).call(document)
    else await (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement, { navigationUI: 'hide' })
  } catch {
    // some browsers (iOS Safari) refuse: "Add to Home Screen" runs it full screen instead
  }
}
