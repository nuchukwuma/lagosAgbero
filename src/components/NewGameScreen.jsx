import { useState } from 'react'
import { SKIN_TONES } from '../game/characters/look.js'

// Pick your name and a first look. The street gives you "JJC" until you earn
// a real nickname. Full customisation (outfits, accessories) comes later.

const SHIRTS = ['#d8d2c4', '#c0392b', '#2c5aa0', '#2f8f5b', '#e0b400', '#1a1a1a']

export default function NewGameScreen({ onStart, onBack }) {
  const [name, setName] = useState('')
  const [skin, setSkin] = useState(SKIN_TONES[2])
  const [shirt, setShirt] = useState(SHIRTS[0])
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
          if (clean) onStart({ name: clean, nickname: 'JJC', look: { base: 'male', skin, shirt, trousers: '#2c3e50', shoes: '#2a2a2a' } })
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
        <div className="swatch-row" role="radiogroup" aria-label="Skin tone">
          <span>Skin</span>
          {SKIN_TONES.map((c) => (
            <button type="button" key={c} className={`swatch ${skin === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setSkin(c)} aria-label={`Skin tone ${c}`} aria-pressed={skin === c} />
          ))}
        </div>
        <div className="swatch-row" role="radiogroup" aria-label="Shirt colour">
          <span>Shirt</span>
          {SHIRTS.map((c) => (
            <button type="button" key={c} className={`swatch ${shirt === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setShirt(c)} aria-label={`Shirt ${c}`} aria-pressed={shirt === c} />
          ))}
        </div>
        <button className="btn btn-primary" type="submit" disabled={!clean}>
          Start
        </button>
        <button className="btn" type="button" onClick={onBack}>
          Back
        </button>
      </form>
    </div>
  )
}
