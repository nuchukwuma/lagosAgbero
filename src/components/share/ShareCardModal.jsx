import { useEffect, useRef, useState } from 'react'
import { useShareCard, closeShareCard, drawShareCard, shareCanvas, saveCanvas } from './shareCard.js'

// The share card, shown big, with Share and Save. Lives at the top of the app.
export default function ShareCardModal() {
  const card = useShareCard((s) => s.card)
  const canvas = useRef()
  const [ready, setReady] = useState(false)
  const [note, setNote] = useState(null)
  useEffect(() => {
    if (!card || !canvas.current) return undefined
    let live = true
    setReady(false)
    setNote(null)
    drawShareCard(canvas.current, card).then(() => live && setReady(true))
    return () => {
      live = false
    }
  }, [card])
  if (!card) return null
  const text = `${card.title}${card.line ? ` (${card.line})` : ''} · NaijaVice`
  return (
    <div className="overlay share-modal" onClick={closeShareCard} role="dialog" aria-modal="true" aria-label="Share card">
      <div className="share-card-box" onClick={(e) => e.stopPropagation()}>
        <canvas ref={canvas} className="share-canvas" />
        <div className="share-actions">
          <button className="btn btn-primary btn-lux" disabled={!ready} onClick={async () => setNote((await shareCanvas(canvas.current, text)) === 'saved' ? 'Saved: post it from your photos.' : null)}>
            Share
          </button>
          <button className="btn btn-lux" disabled={!ready} onClick={async () => setNote((await saveCanvas(canvas.current)) === 'saved' ? 'Saved to your downloads.' : "Couldn't save here.")}>
            Save picture
          </button>
          <button className="btn btn-ghost" onClick={closeShareCard}>
            Close
          </button>
        </div>
        {note && <p className="muted">{note}</p>}
      </div>
    </div>
  )
}
