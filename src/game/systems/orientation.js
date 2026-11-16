// Which way phones are held: the player chooses Landscape (default),
// Portrait or Auto in Settings.
//
// Browsers only let a page lock the screen's direction in full screen (and
// in an installed app) on Android. So on a phone, starting to play goes full
// screen and locks the chosen direction; where that isn't allowed (iPhone,
// iPad, some browsers), the game shows a "turn your phone" card instead,
// with a button to keep playing the way the phone is held.

export const ORIENTATIONS = [
  ['landscape', 'Landscape'],
  ['portrait', 'Portrait'],
  ['auto', 'Auto'],
]

/** A phone or small tablet (touch screen, short side under 600 px). */
export function isPhone() {
  if (typeof window === 'undefined') return false
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  return Boolean(coarse) && Math.min(window.screen?.width || 9999, window.screen?.height || 9999) < 600
}

/** 'landscape' | 'portrait': how the screen is held right now. */
export function currentOrientation() {
  if (typeof window === 'undefined') return 'landscape'
  return window.matchMedia?.('(orientation: portrait)').matches ? 'portrait' : 'landscape'
}

/** Should the "turn your phone" card show? */
export function needsTurn(setting, held = currentOrientation(), phone = isPhone()) {
  return phone && setting !== 'auto' && held !== setting
}

/**
 * Try to hold the screen the chosen way (Android Chrome: full screen + lock).
 * Call from a tap (starting or continuing a game). Never throws.
 */
export async function applyOrientation(setting) {
  if (!isPhone() || typeof screen === 'undefined' || !screen.orientation) return false
  try {
    if (setting === 'auto') {
      screen.orientation.unlock?.()
      return true
    }
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
    }
    await screen.orientation.lock(setting)
    return true
  } catch {
    return false // not allowed here: the turn-your-phone card takes over
  }
}
