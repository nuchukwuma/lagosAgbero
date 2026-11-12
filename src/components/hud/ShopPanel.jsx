import { useState } from 'react'
import { useGameStore } from '../../game/store/gameStore.js'
import { ITEMS, VENDORS } from '../../game/systems/energy.js'
import { formatNaira } from '../../game/narrative/stats.js'

// Buying energy: drinks, food and "hard jokes". Strong drinks give more now
// but crash later (and the people who care about you notice).
export default function ShopPanel({ vendor, onClose }) {
  const buy = useGameStore((s) => s.buy)
  const money = useGameStore((s) => s.game?.stats.money ?? 0)
  const energy = useGameStore((s) => s.game?.stats.energy ?? 0)
  const [error, setError] = useState(null)
  const v = VENDORS[vendor]
  if (!v) return null
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>{v.title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="muted">
          Pocket {formatNaira(money)} · Energy {Math.round(energy)}
        </p>
        <div className="shop-list">
          {v.items.map((id) => {
            const it = ITEMS[id]
            return (
              <div key={id} className="shop-item">
                <div className="shop-info">
                  <strong>{it.name}</strong>
                  <small>{it.blurb}</small>
                  <span className="shop-stats">
                    +{it.energy} energy{it.crash ? ` · crash −${it.crash} after ${Math.round(it.duration / 60)} min` : ''}
                  </span>
                </div>
                <button className="btn btn-small btn-primary" disabled={money < it.price} onClick={() => setError(buy(id))}>
                  {formatNaira(it.price)}
                </button>
              </div>
            )
          })}
        </div>
        {error && <p className="warn">{error}</p>}
      </div>
    </div>
  )
}
