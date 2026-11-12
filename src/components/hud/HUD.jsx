import RedEyes from './RedEyes.jsx'
import { formatNaira } from '../../game/narrative/stats.js'
import { formatClock } from '../../game/systems/clock.js'
import Icon from '../Icon.jsx'
import { campaignOf } from '../../game/narrative/campaigns.js'
import { STAT_DEFS } from '../../game/narrative/stats.js'

// Always-visible status: who you are, money, energy (red eyes), notoriety.
export default function HUD({ game, onStatus, onMenu }) {
  const { stats, player } = game
  const { meter = 'redEyes', bar = { stat: 'notoriety', label: 'Notoriety' } } = campaignOf(game).hud || {}
  const pct = (k) => Math.max(0, Math.min(100, ((stats[k] ?? 0) / (STAT_DEFS[k]?.max || 100)) * 100))
  return (
    <div className="hud">
      <div className="hud-left">
        <div className="hud-name">
          {player.name} <span>"{player.nickname}"</span>
        </div>
        <div className="hud-money">{formatNaira(stats.money)}</div>
        <div className="hud-clock">
          {campaignOf(game).features?.energy !== false ? `Day ${stats.day} · ` : ''}
          {formatClock(game.time)}
          {game.flags.raining ? ' · 🌧' : ''}
        </div>
      </div>
      <div className="hud-mid">
        {meter === 'redEyes' ? (
          <RedEyes energy={stats.energy} />
        ) : (
          meter && (
            <div className="hud-meter" title={meter.label}>
              <Icon name={meter.icon || 'star'} size={14} />
              <span>{meter.label}</span>
              <div className="meter-bar">
                <div style={{ width: `${pct(meter.stat)}%`, background: pct(meter.stat) < 30 ? '#e2553a' : '#2ecc71' }} />
              </div>
            </div>
          )
        )}
        {bar && (
          <div className="hud-notoriety" title={bar.label}>
            <span>★</span>
            <div className="notoriety-bar">
              <div className="notoriety-fill" style={{ width: `${pct(bar.stat)}%` }} />
            </div>
            {STAT_DEFS[bar.stat]?.decimals ? <small className="hud-bar-value">{stats[bar.stat].toFixed(STAT_DEFS[bar.stat].decimals)}</small> : null}
          </div>
        )}
      </div>
      <div className="hud-right">
        <button className="icon-btn" onClick={onStatus} aria-label="Status" title="Status">
          <Icon name="stats" size={22} />
        </button>
        <button className="icon-btn" onClick={onMenu} aria-label="Menu" title="Pause menu">
          <Icon name="pause" size={22} />
        </button>
      </div>
    </div>
  )
}
