import { useEffect, useState } from 'react'

// Full-screen title cards ("5:40 a.m. — Iyana-Wahala"). Tap through them.
export default function CutsceneCards({ view, onDone }) {
  const [i, setI] = useState(0)
  useEffect(() => setI(0), [view.key])
  const card = view.cards[i]
  const next = () => (i + 1 < view.cards.length ? setI(i + 1) : onDone())

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

  if (!card) return null
  return (
    <div className="cutscene" onClick={next} role="button" tabIndex={0}>
      <div className="cutscene-card" key={i}>
        {card.title && <h2>{card.title}</h2>}
        {card.text && <p>{card.text}</p>}
      </div>
      <div className="cutscene-hint">tap to continue</div>
    </div>
  )
}
