import { useState } from 'react'
import SaveSlots from '../SaveSlots.jsx'

// Pause menu: resume, save, load, quit to title.
export default function GameMenu({ onClose, onSave, onLoad, onQuit }) {
  const [tab, setTab] = useState('main')
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>{tab === 'main' ? 'Paused' : tab === 'save' ? 'Save game' : 'Load game'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {tab === 'main' && (
          <div className="menu">
            <button className="btn btn-primary" onClick={onClose}>
              Resume
            </button>
            <button className="btn" onClick={() => setTab('save')}>
              Save
            </button>
            <button className="btn" onClick={() => setTab('load')}>
              Load
            </button>
            <button className="btn" onClick={onQuit}>
              Quit to title
            </button>
            <p className="footnote">The game also autosaves after every choice.</p>
          </div>
        )}
        {tab !== 'main' && (
          <>
            <SaveSlots mode={tab} onSave={onSave} onLoad={onLoad} />
            <button className="btn btn-small" onClick={() => setTab('main')}>
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  )
}
