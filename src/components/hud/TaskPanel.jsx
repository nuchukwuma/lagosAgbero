import { useEffect, useState } from 'react'

// The status box of an activity (fee run, chase, runner, rally...). On a
// phone it takes up a lot of the view, so a tap shrinks it to its first line
// (and back), and it shrinks by itself a few seconds after the activity
// starts. The choice is remembered for the next activity.
const KEY = 'naijavice.taskPanelMin'
const small = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 600

function remembered() {
  try {
    const v = window.localStorage.getItem(KEY)
    return v == null ? null : v === '1'
  } catch {
    return null
  }
}

export default function TaskPanel({ children, className = '' }) {
  const [min, setMin] = useState(() => remembered() === true)
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (remembered() !== null || !small()) return undefined
    const id = setTimeout(() => !touched && setMin(true), 6000)
    return () => clearTimeout(id)
  }, [touched])
  const toggle = (e) => {
    e.stopPropagation()
    setTouched(true)
    setMin((m) => {
      try {
        window.localStorage.setItem(KEY, m ? '0' : '1')
      } catch {
        // storage blocked: the choice lasts for this activity only
      }
      return !m
    })
  }
  return (
    <div className={`fee-hud task-panel ${min ? 'is-min' : ''} ${className}`} onClick={toggle} role="button" aria-expanded={!min} title={min ? 'Show more' : 'Shrink'}>
      {children}
      <span className="task-toggle" aria-hidden="true">
        {min ? '▾' : '▴'}
      </span>
    </div>
  )
}
