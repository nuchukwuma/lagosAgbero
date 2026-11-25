import { latestSave } from '../game/store/saveSystem.js'
import { devToolsOn } from './GamesScreen.jsx'
import { storyCtx } from '../game/narrative/storyData.js'
import { useGameStore } from '../game/store/gameStore.js'
import { webglSupport } from '../game/world/webgl.js'
import WebGLHelp from './help/WebGLHelp.jsx'
import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import CityPreview from './landing/CityPreview.jsx'
import RoomModal from './landing/RoomModal.jsx'
import { presetStory } from './NewGameScreen.jsx'
import { setRoomIntent } from '../game/online/invite.js'
import { CAMPAIGNS } from '../game/narrative/campaigns.js'
import { ASSET_ROOT } from '../assets/assetManifest.js'
import '@fontsource/bebas-neue/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import { useSettings } from '../game/store/settings.js'
import { unlock, audioRunning, onAudioRunning } from '../game/audio/audio.js'

// Music on the title screen. Browsers stay silent until the first tap, so
// until then this invites one; afterwards it switches the music on and off.
function MusicButton() {
  const music = useSettings((s) => s.music !== false)
  const update = useSettings((s) => s.update)
  const [running, setRunning] = useState(audioRunning())
  useEffect(() => onAudioRunning(setRunning), [])
  const playing = running && music
  return (
    <button
      className={`title-music ${playing ? 'on' : 'waiting'}`}
      aria-label={playing ? 'Music off' : 'Play music'}
      aria-pressed={playing}
      onClick={() => {
        unlock()
        if (!running) update({ music: true })
        else update({ music: !music })
      }}
    >
      <Icon name={playing ? 'music' : 'mute'} size={20} />
      {!playing && <span>{running ? 'Music off' : 'Tap for music'}</span>}
    </button>
  )
}

// Developer shortcut: jump into any chapter with a test player.
function DevChapterPicker() {
  const devStart = useGameStore((s) => s.devStart)
  return (
    <select className="dev-picker" value="" onChange={(e) => e.target.value && devStart(e.target.value)} aria-label="Dev: start chapter">
      <option value="">Dev: jump to chapter…</option>
      {Object.values(storyCtx.chapters).filter((c) => !c.common).map((c) => (
        <option key={c.id} value={c.id}>
          {c.title} ({c.id})
        </option>
      ))}
    </select>
  )
}

// The stories you can play, and the ones being written (the upgrade plan, docs/upgrade-plan.md)
const COMING = [
  { id: 'portHarcourt', title: 'Creek & Confraternity', who: 'Port Harcourt', tagline: 'Turf, creeks and a confraternity that never forgets a face.' },
  { id: 'abuja', title: 'The Maitama Mirage', who: 'Abuja big boy', tagline: 'Wire transfers, convoys and a penthouse with too many cameras.' },
  { id: 'lekki', title: 'The Forbes List Trap', who: 'Lekki tech-bro', tagline: 'A startup on paper, a mansion on credit, and EFCC at the gate.' },
  { id: 'computerVillage', title: "Oga Master's Apprentice", who: 'Computer Village hustler', tagline: 'Phones, parts and a warehouse that is never on the books.' },
]
const WHO = { areaBoy: 'Lagos agbero', grace: 'Village to city', campus: 'Campus exam-runz', politics: 'Ward politics', sugar: 'Hotel madam' }

export default function TitleScreen({ onNavigate, onContinue }) {
  const hasSave = Boolean(latestSave())
  const [modal, setModal] = useState(null) // 'join' | 'create'
  return (
    <div className="screen title-screen landing">
      <CityPreview />
      <MusicButton />
      <header className="landing-hero">
        <p className="landing-kicker">Lagos · Abuja · Port Harcourt · Onitsha</p>
        <h1 className="landing-logo">
          NAIJA<span>VICE</span>
        </h1>
        <p className="tagline">Hustle, scheme, survive. Every choice counts, and Naija go remember.</p>
      </header>
      {!webglSupport().ok && <WebGLHelp compact />}

      <div className="landing-actions">
        <div className="landing-col">
          <h2 className="landing-h">Story</h2>
          <p className="landing-blurb">Five stories, 84 chapters. What you do is remembered, and the street talks.</p>
          {hasSave && (
            <button className="btn btn-primary btn-lux" onClick={onContinue}>
              Continue
            </button>
          )}
          <button className={`btn btn-lux ${hasSave ? '' : 'btn-primary'}`} onClick={() => onNavigate('newGame')}>
            New story
          </button>
          {hasSave && (
            <button className="btn btn-ghost" onClick={() => onNavigate('load')}>
              Load
            </button>
          )}
        </div>
        <div className="landing-col landing-online">
          <h2 className="landing-h">Online with friends</h2>
          <p className="landing-blurb">Your own room, a 4-letter code, a WhatsApp invite. Play, bet, send naira.</p>
          <button
            className="btn btn-lux btn-room"
            onClick={() => {
              setRoomIntent({ create: true })
              onNavigate('online')
            }}
          >
            Create room <small>get a 4-letter code</small>
          </button>
          <button className="btn btn-lux btn-room-join" onClick={() => setModal('join')}>
            Join room <small>enter a code</small>
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setRoomIntent(null)
              onNavigate('online')
            }}
          >
            Public street
          </button>
        </div>
      </div>

      <section className="landing-archetypes" aria-label="Choose your story">
        <h2 className="landing-h">Choose who you are</h2>
        <div className="arch-row">
          {CAMPAIGNS.map((c) => (
            <button
              key={c.id}
              className="arch-card"
              style={c.art ? { '--art': `url(${ASSET_ROOT}/${c.art})` } : undefined}
              onClick={() => {
                presetStory(c.id)
                onNavigate('newGame')
              }}
            >
              <small>{WHO[c.id] || 'Story'}</small>
              <strong>{c.title}</strong>
              <span>{c.tagline}</span>
            </button>
          ))}
          {COMING.map((c) => (
            <div key={c.id} className="arch-card is-coming" aria-disabled="true">
              <small>{c.who}</small>
              <strong>{c.title}</strong>
              <span>{c.tagline}</span>
              <em>Coming</em>
            </div>
          ))}
        </div>
      </section>

      <nav className="landing-more">
        <button className="btn btn-ghost" onClick={() => onNavigate('games')}>
          Games
        </button>
        <button className="btn btn-ghost" onClick={() => onNavigate('endings')}>
          Progress
        </button>
        <button className="btn btn-ghost" onClick={() => onNavigate('about')}>
          About
        </button>
        {import.meta.env.DEV && (
          <button className="btn btn-small" onClick={() => onNavigate('assets')}>
            Asset Check (dev)
          </button>
        )}
        {devToolsOn() && <DevChapterPicker />}
      </nav>
      <p className="footnote">v{__APP_VERSION__} · satire, not a guide · online money is game money only</p>
      {modal && <RoomModal start={modal} onClose={() => setModal(null)} onGo={() => onNavigate('online')} />}
    </div>
  )
}
