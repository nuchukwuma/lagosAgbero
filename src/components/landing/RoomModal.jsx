import { useEffect, useRef, useState } from 'react'
import { setRoomIntent } from '../../game/online/invite.js'

// Create or join a 4-letter room, straight from the landing page. Either way
// the next screen asks for your street name and look, then puts you in it.
export default function RoomModal({ onClose, onGo, start = 'join' }) {
  const [code, setCode] = useState('')
  const input = useRef()
  useEffect(() => {
    if (start === 'join') input.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, start])
  const go = (intent) => {
    setRoomIntent(intent)
    onGo()
  }
  return (
    <div className="overlay room-modal" onClick={onClose} role="dialog" aria-modal="true" aria-label="Play online">
      <div className="room-card" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn room-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2>Play with friends</h2>
        <p className="muted">A private room is your own copy of the city: only people with the code get in.</p>
        <div className="room-split">
          <section>
            <h3>Create a room</h3>
            <p>Get a 4-letter code to send on WhatsApp.</p>
            <button className="btn btn-primary btn-lux" onClick={() => go({ create: true })}>
              Create room
            </button>
          </section>
          <section>
            <h3>Join a room</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (code.length === 4) go({ code })
              }}
            >
              <input
                ref={input}
                className="room-code-input"
                value={code}
                maxLength={4}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="CODE"
                aria-label="Room code"
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
              />
              <button className="btn btn-lux" disabled={code.length !== 4}>
                Join
              </button>
            </form>
          </section>
        </div>
        <button className="btn btn-small btn-ghost" onClick={() => go(null)}>
          Or walk into the public street
        </button>
      </div>
    </div>
  )
}
