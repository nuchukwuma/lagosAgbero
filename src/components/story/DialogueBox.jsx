import { useEffect, useRef, useState } from 'react'
import Portrait from './Portrait.jsx'
import { expressionFor } from '../../game/characters/eris.js'
import Icon from '../Icon.jsx'
import { useReadAloud, handsFree } from './useReadAloud.js'
import { voicesSupported } from '../../game/audio/voices.js'

// Dialogue line with a typewriter effect, read aloud in the speaker's voice
// (Settings → Voices; useReadAloud.js).
// Tap / Space / Enter: first finishes the line, second moves on.
// Hands-free: moves on by itself once the line has been said.

const CHARS_PER_SECOND = 45
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function DialogueBox({ view, onNext, onUndo = null }) {
  const { text, speaker, speakerName, mood } = view
  const [shown, setShown] = useState(reducedMotion() ? text.length : 0)
  const done = shown >= text.length
  const doneRef = useRef(done)
  doneRef.current = done

  useEffect(() => {
    setShown(reducedMotion() ? text.length : 0)
  }, [view.key, text])

  useEffect(() => {
    if (done) return
    const id = setInterval(() => setShown((n) => Math.min(text.length, n + 2)), 2000 / CHARS_PER_SECOND)
    return () => clearInterval(id)
  }, [done, text])

  // read aloud; hands-free moves on a moment after the line is said
  const onNextRef = useRef(onNext)
  onNextRef.current = onNext
  const beat = view.key ?? text
  const beatRef = useRef(beat)
  beatRef.current = beat
  const { canReplay, replay } = useReadAloud(beat, (say) => {
    say(text, speaker || 'narrator', {
      // only if the player hasn't moved on already
      onDone: () => handsFree() && setTimeout(() => beatRef.current === beat && onNextRef.current(), 700),
    })
  })
  // hands-free on a device without voices: wait as long as it takes to read
  useEffect(() => {
    if (!done || voicesSupported() || !handsFree()) return undefined
    const id = setTimeout(() => onNextRef.current(), 1500 + text.split(/\s+/).length * 320)
    return () => clearTimeout(id)
  }, [done, text])

  const next = () => {
    if (!doneRef.current) setShown(text.length)
    else onNext()
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const narrator = !speakerName
  return (
    <div className={`dialogue-box ${narrator ? 'is-narrator' : ''}`} onClick={next} role="button" tabIndex={0}>
      {!narrator && (
        <div className="dialogue-speaker">
          <Portrait speaker={speaker} expression={expressionFor(mood, text)} />
          <span className="speaker-name">{speakerName}</span>
          {mood && <span className="speaker-mood">({mood})</span>}
        </div>
      )}
      {canReplay && (
        <button
          className="dialogue-replay"
          aria-label="Say it again"
          onClick={(e) => {
            e.stopPropagation()
            replay()
          }}
        >
          <Icon name="sound" size={18} />
        </button>
      )}
      {onUndo && (
        <button
          className="dialogue-undo"
          onClick={(e) => {
            e.stopPropagation()
            onUndo()
          }}
        >
          ↶ Change my answer
        </button>
      )}
      <p className="dialogue-text">{text.slice(0, shown)}</p>
      <div className={`dialogue-next ${done ? 'visible' : ''}`}>▼ tap</div>
    </div>
  )
}
