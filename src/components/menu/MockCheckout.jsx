import { useCheckout, PRODUCTS, purchase, paymentsMode } from '../../game/services/payments.js'
import { formatNaira } from '../../game/narrative/stats.js'

/** The fake Paystack checkout used in test mode. */
export default function MockCheckout() {
  const open = useCheckout((s) => s.open)
  const resolve = useCheckout((s) => s.resolve)
  if (!open) return null
  return (
    <div className="overlay">
      <div className="panel checkout">
        <div className="ad-tag">TEST MODE · NO REAL MONEY</div>
        <h2>{open.product.name}</h2>
        <p>{open.product.blurb}</p>
        <p>
          <strong>{formatNaira(open.product.priceKobo / 100)}</strong> · ref {open.ref}
        </p>
        <div className="menu">
          <button className="btn btn-primary" onClick={() => resolve(true)}>
            Pay (simulated success)
          </button>
          <button className="btn" onClick={() => resolve(false)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

/** "Support the game" block for the About screen. */
export function SupportBlock() {
  const entitlements = useCheckout((s) => s.entitlements)
  return (
    <div className="about-card">
      <h3>Support the game</h3>
      <p className="muted">Optional and cosmetic only. Nothing in the story can be bought with real money.{paymentsMode() === 'mock' ? ' (Payments are in test mode.)' : ''}</p>
      {Object.entries(PRODUCTS).map(([id, p]) => (
        <div key={id} className="shop-item">
          <div className="shop-info">
            <strong>{p.name}</strong>
            <small>{p.blurb}</small>
          </div>
          <button className="btn btn-small btn-primary" disabled={entitlements.includes(id) && id === 'supporterPack'} onClick={() => purchase(id)}>
            {entitlements.includes(id) && id === 'supporterPack' ? 'Owned' : formatNaira(p.priceKobo / 100)}
          </button>
        </div>
      ))}
    </div>
  )
}
