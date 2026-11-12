import { STAT_DEFS, formatNaira } from '../../game/narrative/stats.js'
import { QUESTS, questState } from '../../game/systems/quests.js'
import { campaignOf } from '../../game/narrative/campaigns.js'
import characters from '../../game/data/characters.json'

// Player-facing status: money pockets, debt, relationship meters.
// In development builds it also lists flags and remembered choices.

function Meter({ label, value, danger, max = 100, decimals = 0 }) {
  return (
    <div className="meter">
      <div className="meter-label">
        <span>{label}</span>
        <span>{decimals ? value.toFixed(decimals) : Math.round(value)}</span>
      </div>
      <div className="meter-track">
        <div className={`meter-fill ${danger ? 'danger' : ''}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
    </div>
  )
}

export default function StatusPanel({ game, onClose }) {
  const { stats, flags, memory, player } = game
  const campaign = campaignOf(game)
  const shown = new Set(campaign.stats || Object.keys(STAT_DEFS))
  const byGroup = (g) => Object.entries(STAT_DEFS).filter(([k, d]) => d.group === g && shown.has(k))
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
          <Meter key={k} label={d.label} value={stats[k] ?? 0} max={d.max} decimals={d.decimals} danger={(k === 'energy' || k === 'conscience' || k === 'cover') && stats[k] < 25} />
        ))}

        <h3>People</h3>
        {byGroup('relationship').map(([k, d]) => (
          <Meter key={k} label={d.label} value={stats[k] ?? 0} max={d.max} danger={['policeHeat', 'rivalCultHatred', 'hold', 'donsHeat'].includes(k)} />
        ))}

        {QUESTS.some((q) => (q.campaign || 'areaBoy') === campaign.id) && (<>
        <h3>
          Side quests <small>{QUESTS.filter((q) => questState(game, q) === 'done').length}/{QUESTS.length} done</small>
        </h3>
        <ul className="quest-log">
          {QUESTS.map((q) => ({ q, st: questState(game, q) }))
            .filter(({ st }) => st !== 'locked')
            .map(({ q, st }) => (
              <li key={q.id} className={st}>
                <strong>{q.title}</strong> <small>{st === 'done' ? 'done' : st === 'active' ? 'in progress' : `ask ${characters[q.giver]?.name || q.giver}`}</small>
                {st === 'available' && <div className="muted">{q.blurb}</div>}
              </li>
            ))}
        </ul>
        </>)}

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
