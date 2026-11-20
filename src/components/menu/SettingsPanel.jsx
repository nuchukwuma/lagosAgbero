import { useEffect, useState } from 'react'
import { useSettings, fullscreenSupported, toggleFullscreen, effectiveQuality } from '../../game/store/settings.js'
import { ORIENTATIONS, isPhone, applyOrientation } from '../../game/systems/orientation.js'
import Icon from '../Icon.jsx'
import { voicesSupported, speak } from '../../game/audio/voices.js'

const VOICE_MODES = [
  ['off', 'Off'],
  ['on', 'Read aloud'],
  ['hands', 'Hands-free'],
]

export default function SettingsPanel() {
  const quality = useSettings((s) => s.quality)
  const level = effectiveQuality(quality) // 'auto' (never chosen) shows the level picked for this device
  const music = useSettings((s) => s.music !== false)
  const sound = useSettings((s) => s.sound !== false)
  const orientation = useSettings((s) => s.orientation || 'landscape')
  const moveControl = useSettings((s) => s.moveControl || 'stick')
  const voiceMode = useSettings((s) => (s.voices === false ? 'off' : s.handsFree ? 'hands' : 'on'))
  const update = useSettings((s) => s.update)
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
          ['low', 'Low'],
          ['medium', 'Medium'],
          ['high', 'High'],
          ['sharpest', 'Sharpest'],
        ].map(([id, label]) => (
          <button key={id} className={`chip ${level === id ? 'on' : ''}`} onClick={() => update({ quality: id })}>
            {label}
          </button>
        ))}
      </div>
      {isPhone() && (
        <div className="swatch-row">
          <span>Screen</span>
          {ORIENTATIONS.map(([id, label]) => (
            <button
              key={id}
              className={`chip ${orientation === id ? 'on' : ''}`}
              onClick={() => {
                update({ orientation: id })
                applyOrientation(id) // inside the tap, so the browser allows full screen + lock
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="swatch-row">
        <span>Controls</span>
        {[
          ['stick', 'Analog stick'],
          ['buttons', 'Arrow buttons'],
        ].map(([id, label]) => (
          <button key={id} className={`chip ${moveControl === id ? 'on' : ''}`} onClick={() => update({ moveControl: id })} aria-pressed={moveControl === id}>
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
      {voicesSupported() ? (
        <div className="swatch-row">
          <span>Voices</span>
          {VOICE_MODES.map(([id, label]) => (
            <button
              key={id}
              className={`chip ${voiceMode === id ? 'on' : ''}`}
              onClick={() => {
                update({ voices: id !== 'off', handsFree: id === 'hands' })
                if (id !== 'off') speak(id === 'hands' ? 'Hands-free. Just listen: the story moves on by itself.' : 'I go read am for you.', 'professor')
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {fullscreenSupported() && (
        <button className="btn" onClick={toggleFullscreen}>
          {full ? 'Exit full screen' : 'Full screen'}
        </button>
      )}
    </div>
  )
}
