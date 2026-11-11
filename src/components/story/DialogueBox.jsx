import { useEffect, useRef, useState } from 'react'
import Portrait from './Portrait.jsx'

// Dialogue line with a typewriter effect.
// Tap / Space / Enter: first finishes the line, second moves on.

const CHARS_PER_SECOND = 45
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function DialogueBox({ view, onNext }) {
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
          <Portrait speaker={speaker} />
          <span className="speaker-name">{speakerName}</span>
          {mood && <span className="speaker-mood">({mood})</span>}
        </div>
      )}
      <p className="dialogue-text">{text.slice(0, shown)}</p>
      <div className={`dialogue-next ${done ? 'visible' : ''}`}>▼ tap</div>
    </div>
  )
}
