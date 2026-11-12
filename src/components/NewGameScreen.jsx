import { useState } from 'react'
import { SKIN_TONES } from '../game/characters/look.js'
import { CAMPAIGNS } from '../game/narrative/campaigns.js'
import { endingsFound } from '../game/store/saveSystem.js'
import { storyCtx } from '../game/narrative/storyData.js'

// Pick your name and a first look. The street gives you "JJC" until you earn
// a real nickname. Full customisation (outfits, accessories) comes later.

const SHIRTS = ['#d8d2c4', '#c0392b', '#2c5aa0', '#2f8f5b', '#e0b400', '#1a1a1a']
const OUTFITS = [
  ['male_casual', 'T-shirt'],
  ['male_shirt', 'Shirt'],
  ['male_longsleeve', 'Long sleeve'],
]

// Step 1: pick a story. Each campaign is its own branching story.
function StorySelect({ onPick, onBack }) {
  const found = new Set(endingsFound())
  return (
    <div className="screen new-game-screen">
      <h2>Choose a story</h2>
      <div className="story-cards">
        {CAMPAIGNS.map((c) => {
          const endings = Object.entries(storyCtx.endings).filter(([k, e]) => !k.startsWith('_') && (e.campaign || 'areaBoy') === c.id)
          return (
            <button key={c.id} className="story-card" onClick={() => onPick(c)}>
              <strong>{c.title}</strong>
              <span>{c.tagline}</span>
              <small>
                {endings.length} endings · found {endings.filter(([k]) => found.has(k)).length}
              </small>
            </button>
          )
        })}
      </div>
      <p className="footnote">Every choice is remembered. Different choices open different scenes and endings.</p>
      <button className="btn" onClick={onBack}>
        Back
      </button>
    </div>
  )
}

export default function NewGameScreen({ onStart, onBack }) {
  const [campaign, setCampaign] = useState(null)
  if (!campaign) return <StorySelect onPick={setCampaign} onBack={onBack} />
  return <HeroScreen key={campaign.id} campaign={campaign} onStart={onStart} onBack={() => setCampaign(null)} />
}

// Step 2: the hero's name and look.
function HeroScreen({ campaign, onStart, onBack }) {
  const hero = campaign.hero || {}
  const [name, setName] = useState(hero.name || '')
  const [skin, setSkin] = useState(hero.look?.skin || SKIN_TONES[2])
  const [shirt, setShirt] = useState(hero.look?.shirt || SHIRTS[0])
  const [body, setBody] = useState(hero.look?.body || OUTFITS[0][0])
  const clean = name.trim().slice(0, 20)
  const areaBoy = campaign.id === 'areaBoy'

  return (
    <div className="screen new-game-screen">
      <div className="chapter-tag">{campaign.title}</div>
      <h2>{areaBoy ? 'Who you be?' : `You are ${hero.name}`}</h2>
      <p className="muted">
        {areaBoy ? (
          <>
            Your government name. The street go call you <strong>"JJC"</strong> until you earn your own name.
          </>
        ) : (
          campaign.tagline
        )}
      </p>
      <form
        className="menu"
        onSubmit={(e) => {
          e.preventDefault()
          if (clean) onStart({ name: clean, nickname: hero.nickname || 'JJC', campaign: campaign.id, look: { body, skin, shirt, trousers: hero.look?.trousers || '#2c3e50', shoes: '#1e1e1e' } })
        }}
      >
        <input
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={hero.placeholder || 'Your name'}
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
        <button className="btn btn-primary" type="submit" disabled={!clean}>
          Start
        </button>
        <button className="btn" type="button" onClick={onBack}>
          Choose another story
        </button>
      </form>
    </div>
  )
}
