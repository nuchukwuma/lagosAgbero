// The player's own choice of camera while walking around (CameraRig "follow").
//
//   auto     the game picks: behind you from the street side, and rises or
//            changes side by itself when buildings get in the way
//   any other view: you choose where the camera stands (cycle with the camera
//   button or V), or drag the screen to swing it round; the wheel or a pinch
//   zooms. Something in the way: the camera moves in closer, then up.
//
// yaw: where the camera stands, seen from above. 0 = south of you looking
// north (the usual view); PI/2 = east of you looking west.

import { create } from 'zustand'

export const VIEWS = [
  { id: 'auto', label: 'Auto' },
  { id: 'behind', label: 'From the other side', yaw: Math.PI },
  { id: 'left', label: 'From the left', yaw: -Math.PI / 2 },
  { id: 'right', label: 'From the right', yaw: Math.PI / 2 },
  { id: 'south', label: 'From the street', yaw: 0 },
  { id: 'top', label: 'From above', yaw: 0, elev: 1.25, zoom: 1.1 },
]

export const DEFAULT_ELEV = Math.atan2(6.2, 11.5) // how steeply the usual view looks down
export const ELEV_RANGE = [0.18, 1.35]
export const ZOOM_RANGE = [0.45, 1.6]

// read every frame by the camera and the player's controls (no React)
export const cam = { mode: 'auto', yaw: 0, elev: DEFAULT_ELEV, zoom: 1, autoYaw: 0 }

// for the HUD: the name of the view, shown for a moment after a change
export const useCamLabel = create(() => ({ label: null, at: 0, mode: 'auto' }))
const announce = (label) => useCamLabel.setState({ label, at: performance.now(), mode: cam.mode })

/** Next view in the list (the camera button / V). */
export function cycleView() {
  const i = VIEWS.findIndex((v) => v.id === cam.mode)
  const next = VIEWS[(i + 1) % VIEWS.length] // 'free' (dragged) isn't in the list: goes back to Auto
  cam.mode = next.id
  if (next.yaw != null) cam.yaw = next.yaw
  cam.elev = next.elev ?? DEFAULT_ELEV
  cam.zoom = next.zoom ?? 1
  announce(next.label)
}

/** Back to the game's own choice. */
export function autoView() {
  cam.mode = 'auto'
  cam.elev = DEFAULT_ELEV
  cam.zoom = 1
  announce('Auto')
}

/** Swing the camera round (drag): dx, dy in screen pixels. */
export function dragView(dx, dy) {
  if (cam.mode === 'auto') cam.yaw = cam.autoYaw // carry on from where the game had it
  if (cam.mode !== 'free') announce('Free camera · tap the camera button for Auto')
  cam.mode = 'free'
  cam.yaw -= dx * 0.008
  cam.elev = Math.min(ELEV_RANGE[1], Math.max(ELEV_RANGE[0], cam.elev + dy * 0.005))
}

/** Zoom: < 1 closer, > 1 further. */
export function zoomView(factor) {
  cam.zoom = Math.min(ZOOM_RANGE[1], Math.max(ZOOM_RANGE[0], cam.zoom * factor))
}

/** Q / R on a keyboard: turn the camera a bit. */
export function turnView(dir) {
  dragView(dir * 45, 0)
}
