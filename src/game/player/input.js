// Player input shared by the keyboard, the on-screen joystick and buttons.
// Plain mutable object (not React state) so reading it every frame is free.
//
//   move.x  -1 (left) .. 1 (right)      move.y  -1 (down/back) .. 1 (up/forward)
//   run     true while Shift / the RUN button is held

export const input = {
  joy: { x: 0, y: 0 },
  keys: new Set(),
  runButton: false,
  enabled: false,
}

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
}

let attached = 0
function onDown(e) {
  const k = KEYMAP[e.code]
  if (!k) return
  // don't steal arrows/space from text fields
  if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return
  input.keys.add(k)
  if (input.enabled && k !== 'run') e.preventDefault()
}
function onUp(e) {
  const k = KEYMAP[e.code]
  if (k) input.keys.delete(k)
}
function onBlur() {
  input.keys.clear()
  input.joy.x = 0
  input.joy.y = 0
}

/** Call from a component effect; returns a cleanup function. */
export function attachKeyboard() {
  if (attached++ === 0) {
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
  }
  return () => {
    if (--attached === 0) {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
      onBlur()
    }
  }
}

/** Combined movement vector, length 0..1. */
export function readMove() {
  let x = input.joy.x
  let y = input.joy.y
  if (input.keys.has('left')) x -= 1
  if (input.keys.has('right')) x += 1
  if (input.keys.has('up')) y += 1
  if (input.keys.has('down')) y -= 1
  const len = Math.hypot(x, y)
  if (len > 1) {
    x /= len
    y /= len
  }
  return { x, y, len: Math.min(1, len), run: input.runButton || input.keys.has('run') }
}
