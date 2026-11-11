import { STAT_DEFS, formatNaira } from '../../game/narrative/stats.js'

// Player-facing status: money pockets, debt, relationship meters.
// In development builds it also lists flags and remembered choices.

function Meter({ label, value, danger }) {
  return (
    <div className="meter">
      <div className="meter-label">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="meter-track">
        <div className={`meter-fill ${danger ? 'danger' : ''}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export default function StatusPanel({ game, onClose }) {
  const { stats, flags, memory, player } = game
  const byGroup = (g) => Object.entries(STAT_DEFS).filter(([, d]) => d.group === g)
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>
            {player.name} <small>"{player.nickname}"</small>
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <h3>Money</h3>
        <div className="money-grid">
          {byGroup('money').map(([k, d]) => (
            <div key={k} className={`money-cell ${k === 'debt' ? 'debt' : ''}`}>
              <small>{d.label}</small>
              <strong>{formatNaira(stats[k])}</strong>
            </div>
          ))}
        </div>

        <h3>Street</h3>
        {byGroup('street').map(([k, d]) => (
          <Meter key={k} label={d.label} value={stats[k]} danger={k === 'energy' && stats[k] < 25} />
        ))}

        <h3>People</h3>
        {byGroup('relationship').map(([k, d]) => (
          <Meter key={k} label={d.label} value={stats[k]} danger={k === 'policeHeat' || k === 'rivalCultHatred'} />
        ))}

        {import.meta.env.DEV && (
          <details className="dev-details">
            <summary>Developer: flags & memory</summary>
            <pre>{JSON.stringify({ flags: Object.keys(flags), memory, story: game.story }, null, 2)}</pre>
          </details>
        )}
      </div>
    </div>
  )
}
