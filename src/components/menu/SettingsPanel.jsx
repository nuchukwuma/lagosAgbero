import { useEffect, useState } from 'react'
import { useSettings, fullscreenSupported, toggleFullscreen, deviceTier } from '../../game/store/settings.js'
import { useDevice } from '../hud/useDevice.js'
import Icon from '../Icon.jsx'

export default function SettingsPanel() {
  const quality = useSettings((s) => s.quality)
  const music = useSettings((s) => s.music !== false)
  const sound = useSettings((s) => s.sound !== false)
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
      <div className="swatch-row">
        <span>Audio</span>
        <button className={`chip ${music ? 'on' : ''}`} onClick={() => update({ music: !music })} aria-pressed={music}>
          <Icon name="music" size={16} /> Music
        </button>
        <button className={`chip ${sound ? 'on' : ''}`} onClick={() => update({ sound: !sound })} aria-pressed={sound}>
          <Icon name={sound ? 'sound' : 'mute'} size={16} /> Sound
        </button>
      </div>
      {quality === 'auto' && <p className="footnote">Auto: {deviceTier() === 'low' ? 'this device gets the battery-saver look.' : 'resolution adapts to how fast this device runs.'}</p>}
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
