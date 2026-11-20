import { useEffect, useRef, useState } from 'react'
import Portrait from './Portrait.jsx'
import { isPaused } from '../../game/store/pauseStore.js'
import Icon from '../Icon.jsx'
import { useReadAloud } from './useReadAloud.js'
import { formatNaira } from '../../game/narrative/stats.js'

// Choice list. Locked options show why. Costs show in naira. Timed choices
// show a shrinking bar and pick `timeoutOption` when time runs out.
// Keyboard: 1–9 picks an option.

export default function ChoiceMenu({ view, onChoose, onRaise = null }) {
  const { text, speaker, speakerName, options, timeout, timeoutOption } = view
  const [left, setLeft] = useState(timeout || 0)
  const chosen = useRef(false)

  useEffect(() => {
    chosen.current = false
    setLeft(timeout || 0)
  }, [view.key, timeout])

  // read aloud: someone else's question, in their voice. The options aren't
  // read out: your character says only the one you pick, once you pick it.
  const asked = text && speaker && speaker !== 'player'
  const { canReplay, replay, sayChosen } = useReadAloud(view.key, (say) => {
    if (asked) say(text, speaker)
  })

  const pick = (opt) => {
    if (chosen.current || opt.locked) return
    chosen.current = true
    sayChosen(opt.text)
    onChoose(opt.index)
  }

  useEffect(() => {
    if (!timeout) return
    // count only the time the game isn't paused
    let used = 0
    let last = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      if (!isPaused()) used += (now - last) / 1000
      last = now
      const remaining = Math.max(0, timeout - used)
      setLeft(remaining)
      if (remaining <= 0) {
        clearInterval(id)
        const fallback = options.find((o) => o.index === timeoutOption && !o.locked)
        if (fallback) pick(fallback)
      }
    }, 100)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.key])

  useEffect(() => {
    const onKey = (e) => {
      const n = Number(e.key)
      if (n >= 1 && n <= options.length) pick(options[n - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="choice-panel">
      {text && (
        <div className="choice-prompt">
          {(speakerName || canReplay) && (
            <div className="dialogue-speaker">
              {speakerName && <Portrait speaker={speaker} />}
              {speakerName && <span className="speaker-name">{speakerName}</span>}
              {canReplay && asked && (
                <button className="dialogue-replay choice-replay" aria-label="Read the choices again" onClick={replay}>
                  <Icon name="sound" size={18} />
                </button>
              )}
            </div>
          )}
          <p>{text}</p>
        </div>
      )}
      {timeout ? (
        <div className="choice-timer">
          <div className="choice-timer-fill" style={{ width: `${(left / timeout) * 100}%` }} />
        </div>
      ) : null}
      <div className="choice-options">
        {options.map((opt, i) => (
          <div key={opt.index} className="choice-row">
            <button className={`choice-btn ${opt.locked ? 'locked' : ''}`} onClick={() => pick(opt)} disabled={opt.locked}>
              <span className="choice-num">{i + 1}</span>
              <span className="choice-text">
                {opt.locked && '🔒 '}
                {opt.text}
                {opt.locked && <small className="choice-lock">{opt.lockedReason}</small>}
              </span>
              {opt.cost > 0 && <span className="choice-cost">{formatNaira(opt.cost)}</span>}
            </button>
            {opt.short && onRaise && !timeout && (
              <button className="btn btn-small choice-raise" onClick={() => onRaise(opt.index)}>
                Go and raise it
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
