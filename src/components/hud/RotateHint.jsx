import { useEffect, useState } from 'react'
import { useSettings } from '../../game/store/settings.js'
import { currentOrientation, needsTurn } from '../../game/systems/orientation.js'

// "Turn your phone" card, for when the screen can't be locked to the chosen
// direction (iPhone, some browsers). One tap keeps playing as it's held.
export function useTurnHint() {
  const setting = useSettings((s) => s.orientation)
  const [held, setHeld] = useState(currentOrientation)
  useEffect(() => {
    const mq = window.matchMedia?.('(orientation: portrait)')
    if (!mq) return undefined
    const on = () => setHeld(currentOrientation())
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return needsTurn(setting, held) ? setting : null
}

export default function RotateHint({ want }) {
  const update = useSettings((s) => s.update)
  if (!want) return null
  const sideways = want === 'landscape'
  return (
    <div className="rotate-hint" role="dialog" aria-label="Turn your phone">
      <div className={`rotate-phone ${sideways ? 'to-landscape' : 'to-portrait'}`} aria-hidden="true">
        <span />
      </div>
      <h2>{sideways ? 'Turn your phone sideways' : 'Hold your phone upright'}</h2>
      <p className="muted">NaijaVice plays best {sideways ? 'in landscape' : 'in portrait'}. You can change this any time in Settings.</p>
      <button className="btn" onClick={() => update({ orientation: 'auto' })}>
        Play {sideways ? 'upright' : 'sideways'} instead
      </button>
    </div>
  )
}
