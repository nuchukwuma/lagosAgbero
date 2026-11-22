import { latestSave } from '../game/store/saveSystem.js'
import { devToolsOn } from './GamesScreen.jsx'
import { storyCtx } from '../game/narrative/storyData.js'
import { useGameStore } from '../game/store/gameStore.js'
import { webglSupport } from '../game/world/webgl.js'
import WebGLHelp from './help/WebGLHelp.jsx'
import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
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

export default function TitleScreen({ onNavigate, onContinue }) {
  const hasSave = Boolean(latestSave())
  return (
    <div className="screen title-screen">
      <MusicButton />
      <div className="title-block">
        <h1>NAIJAVICE</h1>
        <p className="tagline">Five stories. Every choice counts. Naija go remember.</p>
      </div>
      {!webglSupport().ok && <WebGLHelp compact />}
      <div className="menu">
        {hasSave && (
          <button className="btn btn-primary" onClick={onContinue}>
            Continue
          </button>
        )}
        <button className={`btn ${hasSave ? '' : 'btn-primary'}`} onClick={() => onNavigate('newGame')}>
          New Game
        </button>
        <button className="btn btn-online" onClick={() => onNavigate('online')}>
          Lagos Online <small>play with friends</small>
        </button>
        {hasSave && (
          <button className="btn" onClick={() => onNavigate('load')}>
            Load
          </button>
        )}
        <button className="btn" onClick={() => onNavigate('endings')}>
          Progress
        </button>
        <button className="btn" onClick={() => onNavigate('about')}>
          About
        </button>
        <button className="btn" onClick={() => onNavigate('games')}>
          Games
        </button>
        {import.meta.env.DEV && (
          <button className="btn btn-small" onClick={() => onNavigate('assets')}>
            Asset Check (dev)
          </button>
        )}
        {devToolsOn() && <DevChapterPicker />}
      </div>
      <p className="footnote">v{__APP_VERSION__} · satire, not a guide</p>
    </div>
  )
}
