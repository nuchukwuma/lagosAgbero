import { useState } from 'react'
import SaveSlots from '../SaveSlots.jsx'
import WardrobePanel from '../menu/WardrobePanel.jsx'
import SettingsPanel from '../menu/SettingsPanel.jsx'

const TITLES = { main: 'Paused', save: 'Save game', load: 'Load game', wardrobe: 'Wardrobe', settings: 'Settings' }

// Pause menu: resume, wardrobe, save, load, settings, quit to title.
export default function GameMenu({ onClose, onSave, onLoad, onQuit, canDress = true }) {
  const [tab, setTab] = useState('main')
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>{TITLES[tab]}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {tab === 'main' && (
          <div className="menu">
            <button className="btn btn-primary" onClick={onClose}>
              Resume
            </button>
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
