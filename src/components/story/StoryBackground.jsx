// Phase 1 background: a flat 2D Lagos street drawn in SVG. Each scene picks
// one by name ("busStopDawn", "market", "night", "underBridge"). From Phase 2
// the 3D street replaces this, and the same names choose camera spots.

const SKIES = {
  busStopDawn: ['#f7b267', '#f4845f', '#7b4b6a'],
  market: ['#9ad1f5', '#f6e7b4', '#e8c28a'],
  night: ['#0b1026', '#1b2245', '#3a2f5b'],
  underBridge: ['#5d6d7e', '#8e9aa6', '#c2b49a'],
  default: ['#f6e7b4', '#e8c28a', '#b98b5a'],
}

function Wires() {
  return (
    <g stroke="#1a1408" strokeWidth="1.5" fill="none" opacity="0.8">
      <path d="M0 120 Q 200 160 400 118 T 800 122" />
      <path d="M0 130 Q 200 175 400 128 T 800 134" />
      <path d="M0 140 Q 220 190 400 140 T 800 146" />
    </g>
  )
}

function Danfo({ x = 470, y = 330 }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="0" width="190" height="70" rx="10" fill="#f2c300" />
      <rect x="0" y="38" width="190" height="8" fill="#1a1408" />
      <rect x="14" y="10" width="34" height="22" rx="3" fill="#2b3a4a" />
      <rect x="56" y="10" width="34" height="22" rx="3" fill="#2b3a4a" />
      <rect x="98" y="10" width="34" height="22" rx="3" fill="#2b3a4a" />
      <rect x="140" y="10" width="40" height="22" rx="3" fill="#2b3a4a" />
      <circle cx="40" cy="72" r="14" fill="#1a1408" />
      <circle cx="150" cy="72" r="14" fill="#1a1408" />
    </g>
  )
}

export default function StoryBackground({ name = 'default' }) {
  const [top, mid, low] = SKIES[name] || SKIES.default
  const night = name === 'night'
  const bridge = name === 'underBridge' || name === 'busStopDawn' || night
  return (
    <svg className="story-bg" viewBox="0 0 800 450" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id={`sky-${name}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="0.6" stopColor={mid} />
          <stop offset="1" stopColor={low} />
        </linearGradient>
      </defs>
      <rect width="800" height="450" fill={`url(#sky-${name})`} />
      {night && [60, 180, 330, 520, 690].map((x) => <circle key={x} cx={x} cy={40 + (x % 50)} r="1.6" fill="#fff" opacity="0.7" />)}
      {/* skyline */}
      <g fill={night ? '#151a33' : '#6d5a46'} opacity="0.9">
        <rect x="20" y="170" width="90" height="200" />
        <rect x="120" y="200" width="70" height="170" />
        <rect x="200" y="150" width="110" height="220" />
        <rect x="330" y="190" width="80" height="180" />
        <rect x="560" y="160" width="100" height="210" />
        <rect x="680" y="200" width="110" height="170" />
        <rect x="690" y="186" width="24" height="16" fill={night ? '#1d2440' : '#4d6b8a'} />
      </g>
      {/* lit windows at night */}
      {night && (
        <g fill="#f2c300" opacity="0.8">
          <rect x="40" y="200" width="10" height="8" />
          <rect x="230" y="190" width="10" height="8" />
          <rect x="590" y="210" width="10" height="8" />
        </g>
      )}
      {/* poles */}
      <g fill="#3a2c1a">
        <rect x="90" y="100" width="6" height="280" />
        <rect x="400" y="96" width="6" height="284" />
        <rect x="720" y="104" width="6" height="276" />
        <rect x="76" y="104" width="34" height="5" />
        <rect x="386" y="100" width="34" height="5" />
        <rect x="706" y="108" width="34" height="5" />
      </g>
      <Wires />
      {/* flyover */}
      {bridge && (
        <g fill={night ? '#20263d' : '#8a7f72'}>
          <rect x="0" y="230" width="800" height="26" />
          <rect x="150" y="256" width="22" height="120" />
          <rect x="620" y="256" width="22" height="120" />
        </g>
      )}
      {/* market stalls */}
      {name === 'market' && (
        <g>
          {[40, 200, 360, 560].map((x, i) => (
            <g key={x} transform={`translate(${x} 300)`}>
              <path d="M0 0 L150 0 L140 24 L10 24 Z" fill={['#d9586b', '#3a8fd9', '#2f8f5b', '#e67e22'][i]} />
              <rect x="10" y="24" width="130" height="56" fill="#b5651d" />
              <rect x="20" y="34" width="20" height="16" fill="#f2c300" />
              <rect x="50" y="34" width="20" height="16" fill="#ecf0f1" />
            </g>
          ))}
        </g>
      )}
      {/* road */}
      <rect x="0" y="380" width="800" height="70" fill={night ? '#14141c' : '#3b3b3b'} />
      <g fill="#f2c300" opacity="0.8">
        {[0, 120, 240, 360, 480, 600, 720].map((x) => <rect key={x} x={x + 20} y="412" width="60" height="5" />)}
      </g>
      {name !== 'market' && <Danfo x={night ? 520 : 470} y={310} />}
      {name === 'busStopDawn' && (
        <g transform="translate(280 290)">
          <rect x="0" y="0" width="6" height="90" fill="#2c3e50" />
          <rect x="-24" y="0" width="54" height="22" rx="3" fill="#2f8f5b" />
          <text x="3" y="15" fontSize="10" fill="#fff" textAnchor="middle" fontWeight="700">BUS STOP</text>
        </g>
      )}
      {/* rain overlay is drawn by CSS when the "raining" flag is set */}
    </svg>
  )
}
