import { useEffect } from 'react'
import Joystick from './Joystick.jsx'
import { input } from '../../game/player/input.js'
import { useWorldStore } from '../../game/world/worldState.js'
import characters from '../../game/data/characters.json'

// On-screen controls while walking around: objective, joystick, RUN, TALK.
// Keyboard: WASD / arrows to move, Shift to run, E or Enter to talk.
export default function FreeRoamControls({ view, onTalk }) {
  const canTalk = useWorldStore((s) => s.canTalk)
  const talkName = canTalk ? characters[canTalk]?.name || canTalk : null

  useEffect(() => {
    const onKey = (e) => {
      if ((e.code === 'KeyE' || e.key === 'Enter') && canTalk) onTalk()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canTalk, onTalk])

  useEffect(() => () => (input.runButton = false), [])

  return (
    <>
      {view.objective && (
        <div className="objective">
          <span className="objective-tag">Objective</span> {view.objective}
        </div>
      )}
      <div className="controls">
        <Joystick />
        <div className="action-buttons">
          {talkName && (
            <button className="action-btn talk" onClick={onTalk}>
              TALK
              <small>{talkName}</small>
            </button>
          )}
          <button
            className="action-btn run"
            onPointerDown={() => (input.runButton = true)}
            onPointerUp={() => (input.runButton = false)}
            onPointerLeave={() => (input.runButton = false)}
            onPointerCancel={() => (input.runButton = false)}
          >
            RUN
          </button>
        </div>
      </div>
      <div className="keyboard-hint">WASD / arrows move · Shift run · E talk</div>
    </>
  )
}
