import { useMemo, useState } from 'react'
import { useGameStore } from '../../game/store/gameStore.js'
import { WARDROBE, styleOf, costOf, earnedNicknames } from '../../game/systems/wardrobe.js'
import { useCheckout } from '../../game/services/payments.js'
import { formatNaira } from '../../game/narrative/stats.js'

// Outfits, colours, accessories and nicknames. Looks change reactions (see
// wardrobe.json "styles"). New things cost pocket money; owned things are free.
export default function WardrobePanel({ onDone }) {
  const game = useGameStore((s) => s.game)
  const dress = useGameStore((s) => s.dress)
  const entitlements = useCheckout((s) => s.entitlements)
  const current = game.player.look || {}
  const [look, setLook] = useState(() => ({ ...current, accessories: [...(current.accessories || [])] }))
  const [nickname, setNickname] = useState(game.player.nickname)
  const [error, setError] = useState(null)
  const female = (look.body || '').startsWith('female')
  const outfits = WARDROBE.outfits.filter((o) => o.id.startsWith(female ? 'female' : 'male'))
  const nicknames = useMemo(() => earnedNicknames(game, entitlements), [game, entitlements])
  const cost = costOf(current, look, game.owned || [])
  const style = styleOf(look)
  const owned = new Set(game.owned || [])

  const hasAcc = (a) => look.accessories.some((x) => (x.id || x.type) === (a.id || a.type))
  const toggleAcc = (a) =>
    setLook((l) => ({
      ...l,
      accessories: hasAcc(a) ? l.accessories.filter((x) => (x.id || x.type) !== (a.id || a.type)) : [...l.accessories.filter((x) => x.type !== a.type), { type: a.type, ...(a.id ? { id: a.id } : {}), color: a.color || l.shirt }],
    }))

  return (
    <div className="wardrobe">
      <div className="swatch-row">
        <span>Outfit</span>
        {outfits.map((o) => (
          <button key={o.id} className={`chip ${look.body === o.id ? 'on' : ''}`} onClick={() => setLook((l) => ({ ...l, body: o.id }))}>
            {o.label}
            {o.price && !owned.has(`outfit:${o.id}`) && current.body !== o.id ? ` · ${formatNaira(o.price)}` : ''}
          </button>
        ))}
      </div>
      {['shirt', 'trousers'].map((part) => (
        <div key={part} className="swatch-row">
          <span>{part === 'shirt' ? 'Top' : 'Bottom'}</span>
          {WARDROBE.colours.map((c) => (
            <button key={c} className={`swatch ${look[part] === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setLook((l) => ({ ...l, [part]: c }))} aria-label={`${part} ${c}`} />
          ))}
        </div>
      ))}
      <div className="swatch-row wrap">
        <span>Extras</span>
        {WARDROBE.accessories.map((a) => {
          const locked = a.entitlement && !entitlements.includes(a.entitlement)
          if (locked) return null
          const isOwned = owned.has(`acc:${a.id || a.type}`) || (current.accessories || []).some((x) => (x.id || x.type) === (a.id || a.type))
          return (
            <button key={a.id || a.type} className={`chip ${hasAcc(a) ? 'on' : ''}`} title={a.note || ''} onClick={() => toggleAcc(a)}>
              {a.label}
              {a.price && !isOwned ? ` · ${formatNaira(a.price)}` : ''}
            </button>
          )
        })}
      </div>
      <div className="swatch-row wrap">
        <span>Name</span>
        <select className="text-input small" value={nickname} onChange={(e) => setNickname(e.target.value)} aria-label="Street name">
          {[...new Set([game.player.nickname, ...nicknames])].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </div>
      <p className="muted">
        <strong>Style: {style}.</strong> {WARDROBE.styles[style]}
      </p>
      {error && <p className="warn">{error}</p>}
      <button
        className="btn btn-primary"
        onClick={() => {
          const e = dress({ look, nickname })
          if (e) setError(e)
          else onDone()
        }}
      >
        {cost ? `Buy & wear (${formatNaira(cost)})` : 'Wear it'}
      </button>
    </div>
  )
}
