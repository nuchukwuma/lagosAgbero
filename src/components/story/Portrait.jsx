import { useEffect, useState } from 'react'
import characters from '../../game/data/characters.json'
import { useGameStore } from '../../game/store/gameStore.js'
import { requestPortrait, usePortrait } from '../../game/characters/portraits.js'
import { withAllegiance } from '../../game/characters/look.js'
import { erisFace, erisImages } from '../../game/characters/eris.js'

// The speaker's face: Eris Esra's pixel template painted with their skin, hair
// (or hat) and shirt, with an expression for the line (eris.js). Until that has
// loaded, the face rendered from their 3D body (portraits.js), or a coloured
// badge with initials.
function useErisReady() {
  const [ok, setOk] = useState(() => {
    const { faceImg } = erisImages()
    return Boolean(faceImg?.complete && faceImg.naturalWidth)
  })
  useEffect(() => {
    if (ok) return undefined
    const { faceImg } = erisImages()
    if (!faceImg) return undefined
    const on = () => setOk(true)
    faceImg.addEventListener('load', on)
    return () => faceImg.removeEventListener('load', on)
  }, [ok])
  return ok
}

export default function Portrait({ speaker, size = 'normal', expression = 'neutral' }) {
  const c = characters[speaker]
  const isPlayer = speaker === 'player'
  const playerLook = useGameStore((s) => (isPlayer ? s.game?.player.look : null))
  const flags = useGameStore((s) => (isPlayer ? s.game?.flags : null))
  const look = isPlayer ? withAllegiance(playerLook || {}, flags || {}) : c?.look
  const lookKey = JSON.stringify(look || null)
  useEffect(() => {
    if (look) requestPortrait(speaker, look)
  }, [speaker, lookKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const rendered = usePortrait(speaker)
  const erisReady = useErisReady()
  const pixel = erisReady && look ? erisFace(look, expression) : null
  const url = pixel || rendered

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
    <div className={`portrait ${url ? 'has-face' : ''} ${pixel ? 'pixel-face' : ''} ${size === 'large' ? 'portrait-large' : ''}`} style={{ '--ring': color, background: url ? undefined : color }} title={name}>
      {url ? <img src={url} alt={name} draggable={false} /> : initials || '…'}
    </div>
  )
}
