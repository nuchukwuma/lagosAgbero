import { useEffect, useState } from 'react'

// Which controls to show. A phone/tablet (coarse pointer or touch only) gets
// the joystick and big buttons; a desktop/laptop gets keyboard hints. It
// re-checks when the pointer type changes (e.g. a tablet with a keyboard),
// and the first real touch switches to touch controls on any device.

function detect() {
  if (typeof window === 'undefined') return { touch: false, portrait: false }
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  const noHover = window.matchMedia?.('(hover: none)').matches
  return {
    touch: Boolean(coarse || (noHover && navigator.maxTouchPoints > 0) || forcedTouch),
    portrait: window.innerHeight > window.innerWidth,
  }
}

let forcedTouch = false
const listeners = new Set()

if (typeof window !== 'undefined') {
  window.addEventListener('touchstart', () => {
    if (!forcedTouch) {
      forcedTouch = true
      listeners.forEach((l) => l())
    }
  }, { passive: true, once: true })
}

export function useDevice() {
  const [device, setDevice] = useState(detect)
  useEffect(() => {
    const update = () => setDevice(detect())
    listeners.add(update)
    window.addEventListener('resize', update)
    const mq = window.matchMedia?.('(pointer: coarse)')
    mq?.addEventListener?.('change', update)
    return () => {
      listeners.delete(update)
      window.removeEventListener('resize', update)
      mq?.removeEventListener?.('change', update)
    }
  }, [])
  return device
}
