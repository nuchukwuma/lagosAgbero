// Power-ups, earned by watching a short sponsor message on an activity's
// start screen. Each lasts for that one run. Pure data + a tiny store; each
// mode reads what's active when it starts (has(id) / takePowerups()).
//
//   fight    heavyHands  +30% damage       ironJaw    take 35% less
//            fullMeter   start with the special ready
//   chase    secondWind  +60% stamina      lightFeet  you run 12% faster
//   runner   charm       one free stumble  headStart  they start 15 m further back
//   feeRun   sweetMouth  drivers more willing to pay   extraTime +30 s
import { create } from 'zustand'
import { ARCADE_BOOSTS } from '../modes/arcade/tuning.js'

export const POWERUPS = {
  heavyHands: { mode: 'fight', name: 'Heavy Hands', text: 'Your blows hit 30% harder', icon: 'fist' },
  ironJaw: { mode: 'fight', name: 'Iron Jaw', text: 'Take 35% less damage', icon: 'shield' },
  fullMeter: { mode: 'fight', name: 'Full Meter', text: 'Start with the Lagos Roundabout ready', icon: 'bolt' },
  secondWind: { mode: 'chase', name: 'Second Wind', text: '60% more stamina', icon: 'run' },
  lightFeet: { mode: 'chase', name: 'Light Feet', text: 'Run 12% faster', icon: 'dodge' },
  charm: { mode: 'runner', name: 'Lucky Charm', text: 'One stumble free', icon: 'star' },
  headStart: { mode: 'runner', name: 'Head Start', text: 'They start 15 m further back', icon: 'run' },
  sweetMouth: { mode: 'feeCollection', name: 'Sweet Mouth', text: 'Drivers are more willing to pay', icon: 'talk' },
  extraTime: { mode: 'feeCollection', name: 'Extra Time', text: '30 more seconds at the stop', icon: 'naira' },
}

// the arcade mini-games' power-ups (defined with their effects in modes/arcade/tuning.js)
for (const [mode, list] of Object.entries(ARCADE_BOOSTS)) for (const b of list) POWERUPS[b.id] = { mode, name: b.name, text: b.text, icon: b.icon }

export const powerupsFor = (mode) => Object.entries(POWERUPS).filter(([, p]) => p.mode === mode)

// what's switched on for the next / current run
export const usePowerups = create(() => ({ active: [] }))
export const has = (id) => usePowerups.getState().active.includes(id)
export const grantPowerup = (id) => usePowerups.setState((s) => ({ active: s.active.includes(id) ? s.active : [...s.active, id] }))
/** The run is over: everything used up. */
export const clearPowerups = () => usePowerups.setState({ active: [] })
