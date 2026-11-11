import { describe, it, expect } from 'vitest'
import * as engine from './storyEngine.js'
import ch1 from '../data/story/act1/ch1_jjc.json'
import characters from '../data/characters.json'
import callbacks from '../data/callbacks.json'
import endings from '../data/endings.json'

const ctx = { chapters: { ch1_jjc: ch1 }, characters, callbacks, endings }

function tapUntil(state, type) {
  for (let i = 0; i < 60; i++) {
    const v = engine.renderView(ctx, state)
    if (v.type === type) return { state, view: v }
    if (v.type === 'choice') state = engine.choose(ctx, state, v.options.find((o) => !o.locked).index).state
    else state = engine.advance(ctx, state).state
  }
  throw new Error(`never reached ${type}`)
}

describe('Chapter 1 in the 3D street', () => {
  it('starts at the bus stop at dawn', () => {
    const { state } = engine.startChapter(ctx, engine.newGameState({ name: 'Musa' }), 'ch1_jjc')
    const v = engine.renderView(ctx, state)
    expect(v).toMatchObject({ location: 'arrival', time: 'dawn' })
    expect(v.positions.professor).toBeTruthy()
  })

  it('hands control to the player with a goal, then continues when it is met', () => {
    let { state } = engine.startChapter(ctx, engine.newGameState({ name: 'Musa' }), 'ch1_jjc')
    let view
    ;({ state, view } = tapUntil(state, 'freeRoam'))
    expect(view.goal).toEqual({ reach: 'babaTicketOffice' })
    expect(view.objective).toMatch(/motor park/i)
    state = engine.advance(ctx, state).state // the world reports "goal reached"
    const next = engine.renderView(ctx, state)
    expect(next.sceneId).toBe('meetChairman')
    expect(next.location).toBe('babaTicketOffice')
  })

  it('the scam is remembered and called back at the Back Side', () => {
    let { state } = engine.startChapter(ctx, engine.newGameState({ name: 'Musa' }), 'ch1_jjc')
    ;({ state } = tapUntil(state, 'choice'))
    state = engine.choose(ctx, state, 1).state // ask for ID card
    expect(state.memory.ch1_scam).toBe('questioned')
    state = engine.startChapter(ctx, state, 'ch1_jjc', 'backSideTour').state
    const lines = []
    for (let i = 0; i < 8; i++) {
      const v = engine.renderView(ctx, state)
      if (v.type !== 'dialogue') break
      lines.push(v.text)
      state = engine.advance(ctx, state).state
    }
    expect(lines.join(' ')).toMatch(/ID card/)
  })
})
