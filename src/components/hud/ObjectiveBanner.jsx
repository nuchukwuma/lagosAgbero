import { useEffect, useState } from 'react'

// The current objective. On a phone it shows in full when it changes, then
// folds into a small pill after a few seconds so it doesn't cover the
// street; tap it to read it again. (It's also in the pause menu.)
const phone = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 600

export default function ObjectiveBanner({ text }) {
  const [open, setOpen] = useState(true)
  useEffect(() => {
    setOpen(true)
    if (!phone()) return undefined
    const id = setTimeout(() => setOpen(false), 5000)
    return () => clearTimeout(id)
  }, [text])
  if (!text) return null
  return (
    <button className={`objective ${open ? '' : 'is-folded'}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} title={open ? 'Fold' : 'Show the objective'}>
      <span className="objective-tag">{open ? 'Objective' : '🎯'}</span> {open ? text : <span className="objective-short">{text}</span>}
    </button>
  )
}
