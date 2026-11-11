import { useState } from 'react'

// Pick your name. The street gives you "JJC" until you earn a real nickname.
export default function NewGameScreen({ onStart, onBack }) {
  const [name, setName] = useState('')
  const clean = name.trim().slice(0, 20)

  return (
    <div className="screen new-game-screen">
      <h2>Who you be?</h2>
      <p className="muted">
        Your government name. The street go call you <strong>"JJC"</strong> until you earn your own name.
      </p>
      <form
        className="menu"
        onSubmit={(e) => {
          e.preventDefault()
          if (clean) onStart({ name: clean, nickname: 'JJC' })
        }}
      >
        <input
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tunde, Emeka, Musa"
          maxLength={20}
          autoFocus
          aria-label="Your name"
        />
        <button className="btn btn-primary" type="submit" disabled={!clean}>
          Start
        </button>
        <button className="btn" type="button" onClick={onBack}>
          Back
        </button>
      </form>
      <p className="footnote">Looks and outfit come in a later update.</p>
    </div>
  )
}
