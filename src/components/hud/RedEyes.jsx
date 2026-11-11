// Energy shown as red eyes: the redder the eyes, the more energy you have.
// As energy drops the eyes go pale and the eyelids droop.

function mix(a, b, t) {
  return Math.round(a + (b - a) * t)
}

export default function RedEyes({ energy }) {
  const e = Math.max(0, Math.min(100, energy)) / 100
  const sclera = `rgb(${mix(245, 225, e)}, ${mix(240, 60, e)}, ${mix(232, 55, e)})`
  const lid = (1 - e) * 9 // droop in px (eye is 14px tall)
  const veins = e > 0.35
  return (
    <div className="red-eyes" title={`Energy ${Math.round(energy)}`} aria-label={`Energy ${Math.round(energy)} of 100`}>
      <svg viewBox="0 0 64 22" width="58" height="20" aria-hidden="true">
        {[16, 48].map((cx) => (
          <g key={cx}>
            <ellipse cx={cx} cy="11" rx="13" ry="7.5" fill={sclera} stroke="#1a1408" strokeWidth="1.5" />
            {veins && (
              <path d={`M${cx - 11} 10 l4 1 l2 -2 M${cx + 11} 12 l-4 -1 l-2 2`} stroke="#b0161d" strokeWidth="0.8" fill="none" opacity={e} />
            )}
            <circle cx={cx} cy="11.5" r="4.2" fill="#2b1a0e" />
            <circle cx={cx + 1.2} cy="10.2" r="1.1" fill="#fff" opacity="0.8" />
            <rect x={cx - 14} y="2" width="28" height={lid + 1} fill="#5a3825" />
          </g>
        ))}
      </svg>
      <div className="energy-bar">
        <div className="energy-fill" style={{ width: `${e * 100}%` }} />
      </div>
    </div>
  )
}
