import { useEffect } from 'react'
import Joystick from './Joystick.jsx'
import { input } from '../../game/player/input.js'
import { useDevice } from './useDevice.js'

// Shared movement controls for every mode played in the street:
// joystick + RUN on touch screens; on keyboard devices only the action
// button shows (WASD / arrows move, Shift runs, E acts).
export default function MoveControls({ actionLabel = null, actionSub = null, onAction }) {
  const { touch } = useDevice()
  useEffect(() => () => (input.runButton = false), [])
  return (
    <>
      <div className="controls">
        {touch ? <Joystick /> : <span />}
        <div className="action-buttons">
          {actionLabel && (
            <button className="action-btn talk" onClick={onAction}>
              {actionLabel}
              {actionSub && <small>{actionSub}</small>}
            </button>
          )}
          {touch && (
            <button
              className="action-btn run"
              onPointerDown={() => (input.runButton = true)}
              onPointerUp={() => (input.runButton = false)}
              onPointerLeave={() => (input.runButton = false)}
              onPointerCancel={() => (input.runButton = false)}
            >
              RUN
            </button>
          )}
        </div>
      </div>
      {!touch && <div className="keyboard-hint">WASD / arrows move · Shift run · E {actionLabel ? actionLabel.toLowerCase() : 'act'}</div>}
    </>
  )
}
