import Icon from '../Icon.jsx'
import { powerupsFor, usePowerups, grantPowerup } from '../../game/systems/powerups.js'
import { showRewardedAd } from '../../game/services/adService.js'
import { useGameStore } from '../../game/store/gameStore.js'
import { useOnline, spendToken } from '../../game/online/net.js'

// On an activity's start screen: power-ups for this run, each for watching a
// short sponsor message. Optional; the game pauses while it plays.
export default function PowerupOffer({ mode }) {
  const active = usePowerups((s) => s.active)
  const list = powerupsFor(mode)
  // Lagos Online: power-ups come from Power-up Tokens (the shop), not ads, so a duel stays fair
  const online = useGameStore((s) => Boolean(s.game?.flags?.online))
  const tokens = useOnline((s) => s.me?.items?.powerToken || 0)
  if (!list.length) return null
  if (online && !tokens && !active.length) return null
  return (
    <div className="powerup-offer">
      <small>{online ? `Power-ups for this run · ${tokens} Power-up Token${tokens === 1 ? '' : 's'} (one each)` : 'Power-ups for this run · watch a short ad'}</small>
      <div className="powerup-row">
        {list.map(([id, p]) => {
          const on = active.includes(id)
          return (
            <button
              key={id}
              className={`powerup ${on ? 'on' : ''}`}
              disabled={on || (online && !tokens)}
              title={p.text}
              onClick={async () => {
                if (online ? await spendToken() : await showRewardedAd(`powerup:${id}`)) grantPowerup(id)
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
