import { useEffect, useState } from 'react'
import { SKIN_TONES } from '../game/characters/look.js'
import { useGameStore } from '../game/store/gameStore.js'
import { useOnline, connect, disconnect, serverUrl } from '../game/online/net.js'
import { MAPS } from '../game/online/catalog.js'
import CharacterPreview from './CharacterPreview.jsx'

// Lagos Online: the open world shared with other players. Pick a name and a
// look (no account: this device remembers you), connect, and you're on the
// street at Iyana-Wahala.

const NAME_KEY = 'naijavice.onlineName'
const LOOK_KEY = 'naijavice.onlineLook'
const SHIRTS = ['#d8d2c4', '#c0392b', '#2c5aa0', '#2f8f5b', '#e0b400', '#8e44ad', '#1a1a1a']
const OUTFITS = [
  ['mini_male_f', 'T-shirt'],
  ['mini_male_e', 'Overalls'],
  ['mini_soldier', 'Beanie'],
  ['mini_raider', 'Ponytail'],
  ['mini_male_a', 'Glasses'],
  ['mini_female_a', 'Blouse'],
  ['mini_female_f', 'Dress'],
]

function remembered(key, fallback) {
  try {
    const v = window.localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}
function remember(key, v) {
  try {
    window.localStorage.setItem(key, JSON.stringify(v))
  } catch {
    // storage blocked: fine
  }
}

export default function OnlineScreen({ onBack }) {
  const status = useOnline((s) => s.status)
  const error = useOnline((s) => s.error)
  const me = useOnline((s) => s.me)
  const [name, setName] = useState(() => remembered(NAME_KEY, ''))
  const saved = remembered(LOOK_KEY, {})
  const [skin, setSkin] = useState(saved.skin || SKIN_TONES[2])
  const [shirt, setShirt] = useState(saved.shirt || SHIRTS[1])
  const [body, setBody] = useState(saved.body || OUTFITS[0][0])
  const [going, setGoing] = useState(false)
  const clean = name.trim().slice(0, 16)
  const look = { trousers: '#2c3e50', shoes: '#1e1e1e', accessories: [], body, skin, shirt }

  // connected and the server knows us: onto the street
  useEffect(() => {
    if (going && status === 'online' && me) {
      setGoing(false)
      useGameStore.getState().startOnline({ name: me.name, look: { ...look, ...(me.look || {}) } })
    }
  }, [going, status, me]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="screen new-game-screen hero-screen online-screen">
      <CharacterPreview look={look} className="hero-preview" />
      <div className="hero-form">
        <div className="chapter-tag">Lagos Online</div>
        <h2>Enter the street</h2>
        <p className="muted">
          One open world with other players: {Object.values(MAPS)
            .map((m) => m.name)
            .join(', ')}
          , joined by buses. Play each other, bet, join a group, take quests from the people in the stories. Money here is game money only.
        </p>
        <form
          className="menu"
          onSubmit={(e) => {
            e.preventDefault()
            if (clean.length < 2) return
            remember(NAME_KEY, clean)
            remember(LOOK_KEY, { skin, shirt, body })
            setGoing(true)
            connect({ name: clean, look })
          }}
        >
          <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your street name" maxLength={16} autoFocus aria-label="Your street name" />
          <div className="swatch-row" role="radiogroup" aria-label="Skin tone">
            <span>Skin</span>
            {SKIN_TONES.map((c) => (
              <button type="button" key={c} className={`swatch ${skin === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setSkin(c)} aria-label={`Skin tone ${c}`} aria-pressed={skin === c} />
            ))}
          </div>
          <div className="swatch-row" role="radiogroup" aria-label="Outfit">
            <span>Outfit</span>
            {OUTFITS.map(([id, label]) => (
              <button type="button" key={id} className={`chip ${body === id ? 'on' : ''}`} onClick={() => setBody(id)} aria-pressed={body === id}>
                {label}
              </button>
            ))}
          </div>
          <div className="swatch-row" role="radiogroup" aria-label="Shirt colour">
            <span>Shirt</span>
            {SHIRTS.map((c) => (
              <button type="button" key={c} className={`swatch ${shirt === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setShirt(c)} aria-label={`Shirt ${c}`} aria-pressed={shirt === c} />
            ))}
          </div>
          <button className="btn btn-primary" type="submit" disabled={clean.length < 2 || (going && status === 'connecting')}>
            {going && status === 'connecting' ? 'Connecting…' : 'Go online'}
          </button>
          {status === 'error' && (
            <p className="warn">
              {error} <small>({serverUrl()})</small>
            </p>
          )}
          <button
            className="btn"
            type="button"
            onClick={() => {
              setGoing(false)
              disconnect()
              onBack()
            }}
          >
            Back
          </button>
        </form>
      </div>
    </div>
  )
}
