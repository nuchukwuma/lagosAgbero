import { useEffect, useState } from 'react'
import Icon from '../Icon.jsx'
import { cycleView, useCamLabel } from '../../game/world/camView.js'

// Change the camera while walking around: each tap steps to the next view
// (Auto, from the other side, the left, the right, the street, above).
// Dragging the screen swings it round freely; pinch (or the wheel) zooms.
// The view's name shows for a moment after each change.
export default function CameraButton() {
  const { label, at, mode } = useCamLabel()
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!label) return undefined
    setShown(true)
    const id = setTimeout(() => setShown(false), 1600)
    return () => clearTimeout(id)
  }, [label, at])
  return (
    <div className="cam-control">
      <button className={`cam-btn ${mode !== 'auto' ? 'on' : ''}`} onClick={cycleView} aria-label="Change camera view" title="Change camera view (V) · drag the screen to turn it">
        <Icon name="camera" size={22} />
      </button>
      {shown && <span className="cam-label">{label}</span>}
    </div>
  )
}
