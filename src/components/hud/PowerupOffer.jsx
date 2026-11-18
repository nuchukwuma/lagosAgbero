import Icon from '../Icon.jsx'
import { powerupsFor, usePowerups, grantPowerup } from '../../game/systems/powerups.js'
import { showRewardedAd } from '../../game/services/adService.js'

// On an activity's start screen: power-ups for this run, each for watching a
// short sponsor message. Optional; the game pauses while it plays.
export default function PowerupOffer({ mode }) {
  const active = usePowerups((s) => s.active)
  const list = powerupsFor(mode)
  if (!list.length) return null
  return (
    <div className="powerup-offer">
      <small>Power-ups for this run · watch a short ad</small>
      <div className="powerup-row">
        {list.map(([id, p]) => {
          const on = active.includes(id)
          return (
            <button
              key={id}
              className={`powerup ${on ? 'on' : ''}`}
              disabled={on}
              title={p.text}
              onClick={async () => {
                if (await showRewardedAd(`powerup:${id}`)) grantPowerup(id)
              }}
            >
              <Icon name={p.icon} size={18} />
              <span>
                <strong>{p.name}</strong>
                <em>{on ? 'Ready!' : p.text}</em>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
