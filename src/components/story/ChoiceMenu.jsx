import { useEffect, useRef, useState } from 'react'
import Portrait from './Portrait.jsx'
import { formatNaira } from '../../game/narrative/stats.js'

// Choice list. Locked options show why. Costs show in naira. Timed choices
// show a shrinking bar and pick `timeoutOption` when time runs out.
// Keyboard: 1–9 picks an option.

export default function ChoiceMenu({ view, onChoose }) {
  const { text, speaker, speakerName, options, timeout, timeoutOption } = view
  const [left, setLeft] = useState(timeout || 0)
  const chosen = useRef(false)

  useEffect(() => {
    chosen.current = false
    setLeft(timeout || 0)
  }, [view.key, timeout])

  const pick = (opt) => {
    if (chosen.current || opt.locked) return
    chosen.current = true
    onChoose(opt.index)
  }

  useEffect(() => {
    if (!timeout) return
    const started = performance.now()
    const id = setInterval(() => {
      const remaining = Math.max(0, timeout - (performance.now() - started) / 1000)
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
          {speakerName && (
            <div className="dialogue-speaker">
              <Portrait speaker={speaker} />
              <span className="speaker-name">{speakerName}</span>
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
          <button key={opt.index} className={`choice-btn ${opt.locked ? 'locked' : ''}`} onClick={() => pick(opt)} disabled={opt.locked}>
            <span className="choice-num">{i + 1}</span>
            <span className="choice-text">
              {opt.locked && '🔒 '}
              {opt.text}
              {opt.locked && <small className="choice-lock">{opt.lockedReason}</small>}
            </span>
            {opt.cost > 0 && <span className="choice-cost">{formatNaira(opt.cost)}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
