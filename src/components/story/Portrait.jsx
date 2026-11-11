import characters from '../../game/data/characters.json'

// Simple coloured badge with initials. 3D head portraits can replace it later.
export default function Portrait({ speaker }) {
  const c = characters[speaker]
  const color = speaker === 'player' ? '#f2c300' : c?.color || '#777'
  const name = speaker === 'player' ? 'You' : c?.name || '?'
  const initials = name
    .replace(/[^A-Za-zÀ-ÿ\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
  return (
    <div className="portrait" style={{ background: color }}>
      {initials || '…'}
    </div>
  )
}
