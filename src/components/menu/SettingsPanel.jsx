import { useEffect, useState } from 'react'
import { useSettings, fullscreenSupported, toggleFullscreen, effectiveQuality } from '../../game/store/settings.js'
import { useDevice } from '../hud/useDevice.js'
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
  const voiceMode = useSettings((s) => (s.voices === false ? 'off' : s.handsFree ? 'hands' : 'on'))
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
      ) : (
        <p className="footnote">Voices: this browser has no built-in voices, so the story is text only here.</p>
      )}
      {voiceMode === 'hands' && <p className="footnote">Hands-free: every line is read aloud and the story moves on by itself. You still pick the choices.</p>}
      <p className="footnote">
        {
          {
            low: 'Low: made for 2 GB phones. Fewer background people, cars and props, lower resolution, a steady 30 frames a second; the story is the same.',
            medium: 'Medium: smoothed edges and a sharper picture. Good for most phones.',
            high: 'High: sharper still and a busier street. For newer phones.',
            sharpest: "Sharpest: your screen's full resolution, the whole crowd and the furthest view. For strong phones and computers: it uses more battery.",
          }[level]
        }
        {quality === 'auto' && ' (Picked for this device.)'}
      </p>
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
