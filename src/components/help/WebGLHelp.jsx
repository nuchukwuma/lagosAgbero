import { browserName } from '../../game/world/webgl.js'

// Shown instead of the game when the browser can't draw 3D. Plain steps for
// the browser the player is actually using.
const STEPS = {
  firefox: [
    'Open Firefox Settings (☰ menu → Settings), stay on the General page and scroll to Performance.',
    'Untick "Use recommended performance settings", then tick "Use hardware acceleration when available".',
    'Quit Firefox completely and open it again.',
    'Still not working? Type about:config in the address bar, accept the warning, search for webgl.disabled and make sure it says false.',
  ],
  chrome: [
    'Open Chrome Settings → System.',
    'Turn on "Use graphics acceleration when available", then press Relaunch.',
    'To check, type chrome://gpu in the address bar: WebGL should say "Hardware accelerated".',
  ],
  edge: [
    'Open Edge Settings → System and performance.',
    'Turn on "Use graphics acceleration when available", then restart Edge.',
  ],
  safari: [
    'Quit Safari completely and open it again.',
    'If that doesn’t help, restart your computer, or try Chrome or Firefox.',
  ],
  other: ['Turn on hardware or graphics acceleration in your browser’s settings, then restart it.', 'Or try a recent version of Chrome, Firefox or Safari.'],
}

const NAMES = { firefox: 'Firefox', chrome: 'Chrome', edge: 'Edge', safari: 'Safari', other: 'your browser' }

export default function WebGLHelp({ onBack, compact = false }) {
  const browser = browserName()
  const steps = STEPS[browser]
  return (
    <div className={compact ? 'webgl-help compact' : 'screen webgl-help'} role="alert">
      <h2>3D graphics are switched off</h2>
      <p>
        NaijaVice draws its streets in 3D, and {NAMES[browser]} won&apos;t start 3D graphics on this device right now. It&apos;s
        usually one setting.
      </p>
      <ol>
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <p className="muted">
        Other browsers usually work straight away
        {browser === 'firefox' ? ': on a Mac, try opening the same address in Safari or Chrome.' : '.'}
      </p>
      {!compact && (
        <div className="menu">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Try again
          </button>
          {onBack && (
            <button className="btn" onClick={onBack}>
              Back to title
            </button>
          )}
        </div>
      )}
    </div>
  )
}
