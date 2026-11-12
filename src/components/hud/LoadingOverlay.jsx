import { useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'

// Shown while the street's models download (first visit only; the browser
// caches them afterwards). After the first load, later downloads (a new
// mode's models, a bus stop's people) only show a small pill, never a
// full-screen cover in the middle of play.
let firstLoadDone = false
const LINES = ['Packing danfo…', 'Hanging NEPA wires…', 'Waking up Baba Ticket…', 'Finding change for ₦1,000…', 'Sweeping under the bridge…']

export default function LoadingOverlay() {
  const { active, progress } = useProgress()
  const [line, setLine] = useState(0)
  const [visible, setVisible] = useState(!firstLoadDone)
  const [small, setSmall] = useState(firstLoadDone)
  useEffect(() => {
    const id = setInterval(() => setLine((l) => (l + 1) % LINES.length), 1400)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (!active && progress >= 100) {
      const id = setTimeout(() => {
        setVisible(false)
        firstLoadDone = true
        setSmall(true)
      }, 300)
      return () => clearTimeout(id)
    }
    setVisible(true)
  }, [active, progress])
  if (!visible) return null
  if (small)
    return (
      <div className="loading-pill" aria-live="polite">
        <span className="spinner" /> {Math.round(progress)}%
      </div>
    )
  return (
    <div className="loading-overlay">
      <h2>IYANA-WAHALA</h2>
      <div className="loading-bar">
        <div className="loading-fill" style={{ width: `${Math.round(progress)}%` }} />
      </div>
      <p>{LINES[line]}</p>
    </div>
  )
}
