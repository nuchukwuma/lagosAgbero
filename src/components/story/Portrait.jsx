import { useEffect } from 'react'
import characters from '../../game/data/characters.json'
import { useGameStore } from '../../game/store/gameStore.js'
import { requestPortrait, usePortrait } from '../../game/characters/portraits.js'
import { withAllegiance } from '../../game/characters/look.js'

// The speaker's face: a picture rendered from their 3D body (portraits.js).
// Until it's ready (or with no 3D at all) a coloured badge with initials.
export default function Portrait({ speaker, size = 'normal' }) {
  const c = characters[speaker]
  const isPlayer = speaker === 'player'
  const playerLook = useGameStore((s) => (isPlayer ? s.game?.player.look : null))
  const flags = useGameStore((s) => (isPlayer ? s.game?.flags : null))
  const look = isPlayer ? withAllegiance(playerLook || {}, flags || {}) : c?.look
  const lookKey = JSON.stringify(look || null)
  useEffect(() => {
    if (look) requestPortrait(speaker, look)
  }, [speaker, lookKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const url = usePortrait(speaker)

  const color = isPlayer ? '#f2c300' : c?.color || '#777'
  const name = isPlayer ? 'You' : c?.name || '?'
  const initials = name
    .replace(/[^A-Za-zÀ-ÿ\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
  return (
    <div className={`portrait ${url ? 'has-face' : ''} ${size === 'large' ? 'portrait-large' : ''}`} style={{ '--ring': color, background: url ? undefined : color }} title={name}>
      {url ? <img src={url} alt={name} draggable={false} /> : initials || '…'}
    </div>
  )
}
