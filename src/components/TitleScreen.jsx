import { latestSave, endingsFound } from '../game/store/saveSystem.js'
import { storyCtx } from '../game/narrative/storyData.js'
import { useGameStore } from '../game/store/gameStore.js'

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
  const total = Object.keys(storyCtx.endings).filter((k) => !k.startsWith('_')).length
  const found = endingsFound().filter((id) => storyCtx.endings[id]).length
  return (
    <div className="screen title-screen">
      <div className="title-block">
        <h1>AREA BOY</h1>
        <p className="tagline">Owo da? Na street go teach you.</p>
        {found > 0 && (
          <p className="endings-found">
            Endings found {found}/{total}
          </p>
        )}
      </div>
      <div className="menu">
        {hasSave && (
          <button className="btn btn-primary" onClick={onContinue}>
            Continue
          </button>
        )}
        <button className={`btn ${hasSave ? '' : 'btn-primary'}`} onClick={() => onNavigate('newGame')}>
          New Game
        </button>
        {hasSave && (
          <button className="btn" onClick={() => onNavigate('load')}>
            Load
          </button>
        )}
        <button className="btn" onClick={() => onNavigate('about')}>
          About
        </button>
        {import.meta.env.DEV && (
          <button className="btn btn-small" onClick={() => onNavigate('assets')}>
            Asset Check (dev)
          </button>
        )}
        {import.meta.env.DEV && <DevChapterPicker />}
      </div>
      <p className="footnote">v{__APP_VERSION__} · satire, not a guide</p>
    </div>
  )
}
