import { formatNaira } from '../../game/narrative/stats.js'

// Phase 1 mini HUD. The full HUD (with red eyes) arrives in Phase 2.
export default function TopBar({ game, onStatus, onMenu }) {
  const { stats, player } = game
  return (
    <div className="top-bar">
      <div className="top-bar-who">
        <span className="who-name">{player.name}</span>
        <span className="who-nick">"{player.nickname}"</span>
      </div>
      <div className="top-bar-stats">
        <span title="Pocket money">{formatNaira(stats.money)}</span>
        <span title="Energy">⚡ {Math.round(stats.energy)}</span>
        <span title="Notoriety">★ {Math.round(stats.notoriety)}</span>
      </div>
      <div className="top-bar-buttons">
        <button className="icon-btn" onClick={onStatus} aria-label="Status">
          ☰ Status
        </button>
        <button className="icon-btn" onClick={onMenu} aria-label="Menu">
          ⏸
        </button>
      </div>
    </div>
  )
}
