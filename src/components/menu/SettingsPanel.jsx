import { useEffect, useState } from 'react'
import { useSettings, fullscreenSupported, toggleFullscreen } from '../../game/store/settings.js'
import { useDevice } from '../hud/useDevice.js'

export default function SettingsPanel() {
  const quality = useSettings((s) => s.quality)
  const update = useSettings((s) => s.update)
  const { touch } = useDevice()
  const [full, setFull] = useState(Boolean(document.fullscreenElement))
  useEffect(() => {
    const on = () => setFull(Boolean(document.fullscreenElement || document.webkitFullscreenElement))
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  return (
    <div className="menu">
      <div className="swatch-row">
        <span>Graphics</span>
        {[
          ['auto', 'Auto'],
          ['low', 'Battery saver'],
          ['high', 'Sharp'],
        ].map(([id, label]) => (
          <button key={id} className={`chip ${quality === id ? 'on' : ''}`} onClick={() => update({ quality: id })}>
            {label}
          </button>
        ))}
      </div>
      {fullscreenSupported() ? (
        <button className="btn" onClick={toggleFullscreen}>
          {full ? 'Exit full screen' : 'Full screen'}
        </button>
      ) : (
        <p className="footnote">Full screen: use your browser's "Add to Home Screen" to play without bars.</p>
      )}
      <p className="footnote">Controls: {touch ? 'joystick on the left, buttons on the right.' : 'WASD / arrows to move, Shift to run, E to talk or act.'}</p>
    </div>
  )
}
