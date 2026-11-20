import { describe, it, expect } from 'vitest'
import * as engine from './storyEngine.js'

// a tiny story: scene a at the front stop, scene b at the market, a choice that costs money, a chapter end
const chapters = {
  t1: {
    id: 't1',
    title: 'One',
    startScene: 'a',
    scenes: {
      a: { location: 'frontStop', beats: [{ type: 'dialogue', speaker: 'narrator', text: 'Here.' }, { type: 'goto', scene: 'b' }] },
      b: {
        location: 'market',
        beats: [
          { type: 'dialogue', speaker: 'narrator', text: 'At the market.' },
          { type: 'choice', speaker: 'narrator', text: 'Buy?', options: [{ text: 'Buy the radio', cost: 5000, effects: { setFlag: 'radio' } }, { text: 'No', effects: { setFlag: 'noRadio' } }] },
          { type: 'endChapter', title: 'Done', next: 't2' },
        ],
      },
    },
  },
  t2: { id: 't2', title: 'Two', startScene: 'a', scenes: { a: { location: 'market', beats: [{ type: 'dialogue', speaker: 'narrator', text: 'Chapter two.' }, { type: 'endChapter', title: 'End', ending: 'x' }] } } },
}
const ctx = { chapters, characters: {}, callbacks: {}, endings: {}, places: { iyanaWahala: { market: 'The Market' } }, travel: true }
const fresh = () => engine.startChapter(ctx, engine.newGameState({ name: 'T' }), 't1').state

describe('detours: the player sets the pace', () => {
  it('a scene somewhere else: walk there first, then it plays', () => {
    let s = fresh()
    s = engine.advance(ctx, s).state // past "Here." -> goto b (another spot)
    let v = engine.renderView(ctx, s)
    expect(v.type).toBe('freeRoam')
    expect(v.detour).toBe('travel')
    expect(v.goal).toEqual({ reach: 'market' })
    expect(v.objective).toContain('The Market')
    expect(v.location).toBe(null) // no teleport while walking
    s = engine.advance(ctx, s).state // arrived
    v = engine.renderView(ctx, s)
    expect(v.type).toBe('dialogue')
    expect(v.text).toBe('At the market.')
    expect(v.location).toBe('market')
  })

  it('without travel, scenes still cut straight there', () => {
    let s = engine.startChapter({ ...ctx, travel: false }, engine.newGameState({ name: 'T' }), 't1').state
    s = engine.advance({ ...ctx, travel: false }, s).state
    expect(engine.renderView(ctx, s).type).toBe('dialogue')
  })

  it("a choice you can't afford: go and raise it, come back to the same choice", () => {
    let s = fresh()
    s = engine.advance(ctx, s).state
    s = engine.advance(ctx, s).state // arrived at the market
    s = engine.advance(ctx, s).state // the choice
    expect(engine.renderView(ctx, s).options[0].locked).toBe(true)
    s = engine.raiseMoney(ctx, s, 0).state
    let v = engine.renderView(ctx, s)
    expect(v.detour).toBe('raise')
    expect(v.goal).toEqual({ money: 5000 })
    expect(engine.choose(ctx, s, 1).state).toBe(s) // no choosing while away
    s = { ...s, stats: { ...s.stats, money: 6000 } } // hustled
    s = engine.advance(ctx, s).state
    v = engine.renderView(ctx, s)
    expect(v.type).toBe('choice')
    expect(v.options[0].locked).toBe(false)
    s = engine.choose(ctx, s, 0).state
    expect(s.flags.radio).toBe(true)
    expect(s.stats.money).toBe(1000)
  })

  it('at a chapter end: free roam first, then the next chapter when you like', () => {
    let s = fresh()
    for (let i = 0; i < 3; i++) s = engine.advance(ctx, s).state
    s = engine.choose(ctx, s, 1).state
    let v = engine.renderView(ctx, s)
    expect(v.type).toBe('chapterEnd')
    expect(v.canRoam).toBe(true)
    s = engine.roamFirst(ctx, s).state
    v = engine.renderView(ctx, s)
    expect(v.detour).toBe('roam')
    expect(v.nextTitle).toBe('Two')
    expect(s.story.completedChapters).toContain('t1')
    s = engine.advance(ctx, s).state
    v = engine.renderView(ctx, s)
    expect(v.text).toBe('Chapter two.')
    expect(s.story.completedChapters.filter((c) => c === 't1').length).toBe(1)
  })
})

describe('a side quest while the story is paused', () => {
  const common = {
    id: 'q',
    common: true,
    startScene: 's',
    scenes: { s: { beats: [{ type: 'dialogue', speaker: 'narrator', text: 'A favour.' }, { type: 'freeRoam', objective: 'Go.', goal: { reach: 'market' } }, { type: 'dialogue', speaker: 'narrator', text: 'Thanks.' }, { type: 'goto', scene: '@resume' }] } },
  }
  const qctx = { ...ctx, chapters: { ...chapters, q: common } }
  const playQuest = (s) => {
    s = engine.interrupt(qctx, s, 'q:s').state
    expect(engine.renderView(qctx, s).text).toBe('A favour.')
    s = engine.advance(qctx, s).state
    expect(engine.renderView(qctx, s).type).toBe('freeRoam')
    s = engine.advance(qctx, s).state
    expect(engine.renderView(qctx, s).text).toBe('Thanks.')
    return engine.advance(qctx, s).state
  }

  it('plays the quest, then puts the walk back', () => {
    let s = engine.startChapter(qctx, engine.newGameState({ name: 'T' }), 't1').state
    s = engine.advance(qctx, s).state
    expect(engine.renderView(qctx, s).detour).toBe('travel')
    s = playQuest(s)
    const v = engine.renderView(qctx, s)
    expect(v.detour).toBe('travel')
    expect(v.goal).toEqual({ reach: 'market' })
    s = engine.advance(qctx, s).state
    expect(engine.renderView(qctx, s).text).toBe('At the market.')
  })

  it('between chapters: back to free time, and the next chapter still waits', () => {
    let s = engine.startChapter(qctx, engine.newGameState({ name: 'T' }), 't1').state
    for (let i = 0; i < 3; i++) s = engine.advance(qctx, s).state
    s = engine.choose(qctx, s, 1).state
    s = engine.roamFirst(qctx, s).state
    expect(engine.renderView(qctx, s).detour).toBe('roam')
    s = playQuest(s)
    expect(engine.renderView(qctx, s).detour).toBe('roam')
    s = engine.advance(qctx, s).state
    expect(engine.renderView(qctx, s).text).toBe('Chapter two.')
  })
})

it('a side quest happens in the world of the story it interrupted', () => {
  const village = { id: 'v1', world: 'nkwoAgu', startScene: 'a', scenes: { a: { location: 'square', beats: [{ type: 'freeRoam', objective: 'Look around.' }, { type: 'endChapter', title: 'x', ending: 'y' }] } } }
  const q = { id: 'q', common: true, startScene: 's', scenes: { s: { beats: [{ type: 'dialogue', speaker: 'narrator', text: 'Hi.' }, { type: 'goto', scene: '@resume' }] } } }
  const vctx = { ...ctx, chapters: { v1: village, q } }
  let s = engine.startChapter(vctx, engine.newGameState({ name: 'T' }), 'v1').state
  s = engine.interrupt(vctx, s, 'q:s').state
  expect(engine.renderView(vctx, s).world).toBe('nkwoAgu')
})
