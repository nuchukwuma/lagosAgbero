import { useState } from 'react'
import SaveSlots from '../SaveSlots.jsx'
import WardrobePanel from '../menu/WardrobePanel.jsx'
import SettingsPanel from '../menu/SettingsPanel.jsx'

const TITLES = { main: 'Paused', save: 'Save game', load: 'Load game', wardrobe: 'Wardrobe', settings: 'Settings', rules: 'How to play' }

// Pause menu: resume, the rules of the game you're in, wardrobe, save, load,
// settings, quit to title. Paused in the middle of a game, it opens on the rules.
export default function GameMenu({ onClose, onSave, onLoad, onQuit, onMap, canDress = true, objective = null, chapter = null, activity = null, howTo = null, onRetry = null, onTutorial = null }) {
  const [tab, setTab] = useState(howTo ? 'rules' : 'main')
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>{TITLES[tab]}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {tab === 'main' && (objective || activity || chapter) && (
          <div className="pause-objective">
            {chapter && <small>{chapter}</small>}
            {activity && (
              <p>
                <strong>Now:</strong> {activity}
              </p>
            )}
            {objective && (
              <p>
                <strong>Objective:</strong> {objective}
              </p>
            )}
          </div>
        )}
        {tab === 'main' && (
          <div className="menu">
            <div className="pause-actions">
              <button className="btn btn-primary" onClick={onClose}>
                Resume
              </button>
              {onRetry && (
                <button className="btn" onClick={onRetry}>
                  ↻ Retry
                </button>
              )}
            </div>
            {howTo && (
              <button className="btn" onClick={() => setTab('rules')}>
                How to play
              </button>
            )}
            {onTutorial && (
              <button className="btn" onClick={onTutorial}>
                Tutorial
              </button>
            )}
            {onMap && (
              <button className="btn" onClick={onMap}>
                Story map
              </button>
            )}
            {canDress && (
              <button className="btn" onClick={() => setTab('wardrobe')}>
                Wardrobe
              </button>
            )}
            <button className="btn" onClick={() => setTab('save')}>
              Save
            </button>
            <button className="btn" onClick={() => setTab('load')}>
              Load
            </button>
            <button className="btn" onClick={() => setTab('settings')}>
              Settings
            </button>
            <button className="btn" onClick={onQuit}>
              Quit to title
            </button>
            <p className="footnote">The game also autosaves after every choice.</p>
          </div>
        )}
        {tab === 'rules' && howTo && (
          <div className="how-to-play">
            <h3>{howTo.title}</h3>
            <ul>
              {howTo.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <div className="pause-actions">
              <button className="btn btn-primary" onClick={onClose}>
                Resume
              </button>
              {onRetry && (
                <button className="btn" onClick={onRetry}>
                  ↻ Retry
                </button>
              )}
            </div>
            {onTutorial && (
              <button className="btn btn-small tutorial-again" onClick={onTutorial}>
                Show me the controls (tutorial)
              </button>
            )}
          </div>
        )}
        {tab === 'wardrobe' && <WardrobePanel onDone={onClose} />}
        {tab === 'settings' && <SettingsPanel />}
        {tab !== 'main' && (
          <>
            {(tab === 'save' || tab === 'load') && <SaveSlots mode={tab} onSave={onSave} onLoad={onLoad} />}
            <button className="btn btn-small" onClick={() => setTab('main')}>
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  )
}
