import { useState } from 'react'
import { listSaves, deleteSave } from '../game/store/saveSystem.js'
import { formatNaira } from '../game/narrative/stats.js'

// Lists the save slots. mode "save" writes to manual slots; mode "load" reads any slot.
export default function SaveSlots({ mode, onSave, onLoad }) {
  const [saves, setSaves] = useState(listSaves)
  const refresh = () => setSaves(listSaves())

  return (
    <div className="save-slots">
      {saves.map((s) => {
        const isAuto = s.slot === 'auto'
        if (mode === 'save' && isAuto) return null
        const label = isAuto ? 'Autosave' : `Slot ${s.slot}`
        return (
          <div key={s.slot} className="save-slot">
            <div className="save-info">
              <strong>{label}</strong>
              {s.empty ? (
                <small>Empty</small>
              ) : (
                <small>
                  {s.summary?.campaign ? `${s.summary.campaign} · ` : ''}{s.summary?.name} · {s.summary?.chapterTitle} · {formatNaira(s.summary?.money || 0)}
                  <br />
                  {new Date(s.savedAt).toLocaleString()}
                </small>
              )}
            </div>
            <div className="save-actions">
              {mode === 'save' && (
                <button
                  className="btn btn-small"
                  onClick={() => {
                    onSave(s.slot)
                    refresh()
                  }}
                >
                  Save
                </button>
              )}
              {mode === 'load' && !s.empty && (
                <button className="btn btn-small btn-primary" onClick={() => onLoad(s.slot)}>
                  Load
                </button>
              )}
              {!s.empty && !isAuto && (
                <button
                  className="btn btn-small"
                  onClick={() => {
                    deleteSave(s.slot)
                    refresh()
                  }}
                  aria-label={`Delete ${label}`}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
