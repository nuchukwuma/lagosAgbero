import { describe, it, expect } from 'vitest'
import * as engine from './storyEngine.js'

const chapters = {
  main: {
    id: 'main',
    startScene: 'a',
    scenes: {
      a: {
        beats: [
          { type: 'dialogue', speaker: 'narrator', text: 'Intro line' },
          { type: 'freeRoam', objective: 'Walk about' },
          { type: 'dialogue', speaker: 'narrator', text: 'After' },
          { type: 'endChapter', title: 'x', summary: 'y' },
        ],
      },
    },
  },
  side: { id: 'side', common: true, startScene: 'q', scenes: { q: { beats: [{ type: 'dialogue', speaker: 'narrator', text: 'Quest' }, { type: 'goto', scene: '@resume' }] } } },
}
const ctx = { chapters, characters: {}, callbacks: {}, endings: {} }

describe('resume after an interruption', () => {
  it('comes back to the free-roam beat, not the scene start', () => {
    let { state } = engine.startChapter(ctx, engine.newGameState({}), 'main')
    state = engine.advance(ctx, state).state
    expect(engine.renderView(ctx, state).type).toBe('freeRoam')
    state = engine.interrupt(ctx, state, 'side:q').state
    expect(engine.renderView(ctx, state).text).toBe('Quest')
    state = engine.advance(ctx, state).state
    const v = engine.renderView(ctx, state)
    expect(v.type).toBe('freeRoam') // not "Intro line" again
  })

  it('an interruption during dialogue still restarts the scene', () => {
    let { state } = engine.startChapter(ctx, engine.newGameState({}), 'main')
    state = engine.interrupt(ctx, state, 'side:q').state
    state = engine.advance(ctx, state).state
    expect(engine.renderView(ctx, state).text).toBe('Intro line')
  })
})
