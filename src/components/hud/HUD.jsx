import RedEyes from './RedEyes.jsx'
import { formatNaira } from '../../game/narrative/stats.js'

// Always-visible status: who you are, money, energy (red eyes), notoriety.
export default function HUD({ game, onStatus, onMenu }) {
  const { stats, player } = game
  return (
    <div className="hud">
      <div className="hud-left">
        <div className="hud-name">
          {player.name} <span>"{player.nickname}"</span>
        </div>
        <div className="hud-money">{formatNaira(stats.money)}</div>
      </div>
      <div className="hud-mid">
        <RedEyes energy={stats.energy} />
        <div className="hud-notoriety" title="Notoriety">
          <span>★</span>
          <div className="notoriety-bar">
            <div className="notoriety-fill" style={{ width: `${stats.notoriety}%` }} />
          </div>
        </div>
      </div>
      <div className="hud-right">
        <button className="icon-btn" onClick={onStatus} aria-label="Status">
          ☰
        </button>
        <button className="icon-btn" onClick={onMenu} aria-label="Menu">
          ⏸
        </button>
      </div>
    </div>
  )
}
