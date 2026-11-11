import { useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'

// Shown while the street's models download (first visit only; the browser
// caches them afterwards).
const LINES = ['Packing danfo…', 'Hanging NEPA wires…', 'Waking up Baba Ticket…', 'Finding change for ₦1,000…', 'Sweeping under the bridge…']

export default function LoadingOverlay() {
  const { active, progress } = useProgress()
  const [line, setLine] = useState(0)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const id = setInterval(() => setLine((l) => (l + 1) % LINES.length), 1400)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (!active && progress >= 100) {
      const id = setTimeout(() => setVisible(false), 300)
      return () => clearTimeout(id)
    }
    setVisible(true)
  }, [active, progress])
  if (!visible) return null
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
