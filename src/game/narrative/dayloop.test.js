import { describe, it, expect } from 'vitest'
import * as engine from './storyEngine.js'
import ch2 from '../data/story/act2/ch2_rules.json'
import daily from '../data/story/common/daily.json'
import common from '../data/story/common/common.json'
import characters from '../data/characters.json'
import callbacks from '../data/callbacks.json'
import endings from '../data/endings.json'

const ctx = { chapters: { ch2_rules: ch2, daily, common }, characters, callbacks, endings }

describe('day loop', () => {
  it('evening -> pay -> sleep -> morning -> back on the street, one day later', () => {
    let s = engine.newGameState({ name: 'Musa' })
    s = engine.startChapter(ctx, s, 'ch2_rules', 'street').state
    expect(engine.renderView(ctx, s).type).toBe('freeRoam')
    const day = s.stats.day
    s = { ...s, stats: { ...s.stats, money: 20000 }, time: 21 * 60 }
    s = engine.interrupt(ctx, s, 'daily:evening').state
    for (let i = 0; i < 20; i++) {
      const v = engine.renderView(ctx, s)
      if (v.type === 'freeRoam') break
      s = v.type === 'choice' ? engine.choose(ctx, s, 0, () => 0).state : engine.advance(ctx, s, () => 0).state
    }
    const v = engine.renderView(ctx, s)
    expect(v.type).toBe('freeRoam')
    expect(v.sceneId).toBe('street')
    expect(s.stats.day).toBe(day + 1)
    expect(s.stats.money).toBe(20000 - 15000)
    expect(s.time).toBe(6 * 60)
  })

  it('a collapse during the day loop resumes the street scene', () => {
    let s = engine.startChapter(ctx, engine.newGameState({ name: 'Musa' }), 'ch2_rules', 'street').state
    s = { ...s, stats: { ...s.stats, money: 5000 } }
    s = engine.interrupt(ctx, s, 'common:collapse').state
    for (let i = 0; i < 20; i++) {
      const v = engine.renderView(ctx, s)
      if (v.type === 'freeRoam') break
      s = v.type === 'choice' ? engine.choose(ctx, s, 0).state : engine.advance(ctx, s).state
    }
    expect(engine.renderView(ctx, s).sceneId).toBe('street')
    expect(s.stats.collapses).toBe(1)
  })
})
