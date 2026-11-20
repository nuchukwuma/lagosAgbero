import { useEffect, useLayoutEffect, useState } from 'react'
import { create } from 'zustand'
import { tutorialFor } from '../../game/modes/tutorials.js'
import { seenIntro, markIntroSeen } from '../../game/systems/records.js'

// The guided tour of a game (modes/tutorials.js): the first time a game
// starts (once its how-to-play card is gone), and from the pause menu. A
// spotlight on each control in turn, a bubble saying what it does, Next /
// Skip. The game holds still meanwhile (StoryScreen pauses while it shows).
export const useTutorial = create(() => ({ mode: null, step: 0 }))
export const tutorialOpen = () => Boolean(useTutorial.getState().mode)
export const showTutorial = (mode) => tutorialFor(mode) && useTutorial.setState({ mode, step: 0 })

const key = (mode) => `tut:${mode}`
const introUp = () => Boolean(document.querySelector('.arcade-intro, .fee-intro, .arcade-result'))

/** Starts the tour by itself the first time `mode` is being played. */
export function useFirstTimeTutorial(mode) {
  useEffect(() => {
    if (!mode || !tutorialFor(mode) || seenIntro(key(mode))) return undefined
    // wait until the game itself is on screen (its start card closed)
    const id = setInterval(() => {
      if (introUp() || useTutorial.getState().mode) return
      clearInterval(id)
      setTimeout(() => !introUp() && showTutorial(mode), 400)
    }, 300)
    return () => clearInterval(id)
  }, [mode])
}

function findTarget(sel) {
  if (!sel) return null
  for (const one of sel.split(',')) {
    const el = document.querySelector(one.trim())
    if (el) {
      const r = el.getBoundingClientRect()
      if (r.width > 2 && r.height > 2) return r
    }
  }
  return null
}

export default function Tutorial() {
  const { mode, step } = useTutorial()
  const steps = mode ? tutorialFor(mode) : null
  const cur = steps?.[step]
  const [rect, setRect] = useState(null)
  useLayoutEffect(() => {
    if (!cur) return undefined
    const update = () => setRect(findTarget(cur.at))
    update()
    const id = setInterval(update, 250) // controls can appear or move (THROW, rotating the phone)
    window.addEventListener('resize', update)
    return () => {
      clearInterval(id)
      window.removeEventListener('resize', update)
    }
  }, [cur])
  if (!cur) return null
  const close = () => {
    markIntroSeen(key(mode))
    useTutorial.setState({ mode: null, step: 0 })
  }
  const next = () => (step + 1 >= steps.length ? close() : useTutorial.setState({ step: step + 1 }))
  const pad = 8
  const vh = window.innerHeight
  const spot = rect ? { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null
  // the bubble goes on whichever side of the spotlight has more room
  const below = spot ? spot.top + spot.height / 2 < vh / 2 : false
  const bubbleStyle = spot ? (below ? { top: Math.min(vh - 150, spot.top + spot.height + 10) } : { bottom: Math.min(vh - 150, vh - spot.top + 10) }) : { top: '38%' }
  return (
    <div className="tutorial" role="dialog" aria-label="How to play">
      <div className="tutorial-block" onClick={next} />
      {spot ? <div className="tutorial-spot" style={spot} /> : <div className="tutorial-dim" />}
      <div className="tutorial-bubble" style={bubbleStyle}>
        <p>{cur.text}</p>
        <div className="tutorial-row">
          <small>
            {step + 1}/{steps.length}
          </small>
          <button className="btn btn-small" onClick={close}>
            Skip
          </button>
          <button className="btn btn-small btn-primary" onClick={next}>
            {step + 1 >= steps.length ? "Let's go!" : 'Next ▸'}
          </button>
        </div>
      </div>
    </div>
  )
}
