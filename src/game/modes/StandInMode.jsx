// Placeholder for gameplay modes that are not built yet. It shows what the
// story asked for and lets you choose the outcome, so every story branch can
// be tested now. Real modes replace it phase by phase (see modeRegistry.js).

const PRETTY = {
  chase: 'Chase',
  fight: 'Fight',
  runner: 'Escape run',
  raid: 'Task Force raid',
  conductor: 'Bus conductor',
  feeCollection: 'Fee collection',
  begging: 'Begging run',
  shop: 'Shop',
}

export default function StandInMode({ mode, params, outcomes, onFinish }) {
  const choices = outcomes.length ? outcomes : ['won', 'lost']
  return (
    <div className="standin-mode">
      <div className="standin-card">
        <div className="standin-label">Gameplay mode (stand-in)</div>
        <h2>{PRETTY[mode] || mode}</h2>
        <pre className="standin-params">{JSON.stringify(params, null, 2)}</pre>
        <p className="standin-help">This mode isn't built yet. Pick how it ends to test the story branch:</p>
        <div className="standin-buttons">
          {choices.map((outcome) => (
            <button key={outcome} className="btn" onClick={() => onFinish({ outcome, moneyChange: outcome === 'won' ? 500 : 0 })}>
              {outcome}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
