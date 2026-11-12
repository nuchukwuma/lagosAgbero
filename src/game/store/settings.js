// Player settings, kept per device in localStorage.
import { create } from 'zustand'

const KEY = 'areaBoy.settings'
const DEFAULTS = { quality: 'auto' } // auto | low | high

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
      const { update, ...data } = { ...get() } // eslint-disable-line no-unused-vars
      window.localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      // storage blocked: settings last for this session only
    }
  },
}))

/** Device pixel ratio range for a quality setting. */
export function dprFor(quality) {
  const max = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  if (quality === 'low') return { min: 0.75, max: 0.75 }
  if (quality === 'high') return { min: Math.min(2, max), max: Math.min(2, max) }
  return { min: 1, max: Math.min(1.5, max) }
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
