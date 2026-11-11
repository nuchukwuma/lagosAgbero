import { describe, it, expect } from 'vitest'
import * as engine from './storyEngine.js'
import { checkCondition } from './conditions.js'
import { validateStory } from './validateStory.js'
import testRun from '../data/story/test_run.json'
import characters from '../data/characters.json'
import callbacks from '../data/callbacks.json'
import endings from '../data/endings.json'

const ctx = { chapters: { test_run: testRun }, characters, callbacks, endings }
const fresh = () => engine.newGameState({ name: 'Emeka' })

// Small helper: keep tapping "next" until a non-dialogue view appears.
function skipTo(state, type) {
  for (let i = 0; i < 50; i++) {
    const v = engine.renderView(ctx, state)
    if (v.type === type) return { state, view: v }
    state = engine.advance(ctx, state, () => 0).state
  }
  throw new Error(`never reached ${type}`)
}

describe('conditions', () => {
  const s = { flags: { a: true }, stats: { friendBond: 25, money: 100 }, memory: { biodun: 'caught' } }
  it('checks flags, stats and memory', () => {
    expect(checkCondition('a', s)).toBe(true)
    expect(checkCondition('!a', s)).toBe(false)
    expect(checkCondition({ stats: { friendBond: '>= 20' } }, s)).toBe(true)
    expect(checkCondition({ stats: { money: '> 100' } }, s)).toBe(false)
    expect(checkCondition({ memory: { biodun: ['caught', 'escaped'] } }, s)).toBe(true)
    expect(checkCondition({ anyOf: ['b', { stats: { friendBond: 25 } }] }, s)).toBe(true)
  })
})

describe('story engine', () => {
  it('the test story is valid', () => {
    const { errors } = validateStory(ctx)
    expect(errors).toEqual([])
  })

  it('starts on the opening cutscene and fills in placeholders', () => {
    const { state } = engine.startChapter(ctx, fresh(), 'test_run')
    const view = engine.renderView(ctx, state)
    expect(view.type).toBe('cutscene')
    expect(view.cards[1].text).toContain('₦2,300')
    expect(view.cards[1].text).toContain('₦850,000')
  })

  it('charges for a choice, changes stats, remembers it and calls back later', () => {
    let { state } = engine.startChapter(ctx, fresh(), 'test_run')
    ;({ state } = skipTo(state, 'choice'))
    const tea = engine.choose(ctx, state, 0)
    state = tea.state
    expect(state.stats.money).toBe(2000)
    expect(state.stats.mentorBond).toBe(15)
    expect(state.memory.professor_tea).toBe('bought')
    expect(tea.events.some((e) => e.type === 'toast' && e.text.includes('Professor'))).toBe(true)
    // the reply uses the variant for boughtProfessorTea
    expect(engine.renderView(ctx, state).text).toContain('home training')
  })

  it('shows a locked option with its reason and refuses to pick it', () => {
    let { state } = engine.startChapter(ctx, fresh(), 'test_run')
    let view
    ;({ state, view } = skipTo(state, 'choice'))
    expect(view.options[2].locked).toBe(true)
    expect(view.options[2].lockedReason).toMatch(/level/)
    expect(engine.choose(ctx, state, 2).state).toBe(state)
  })

  it('starts a mode from a choice and routes the result', () => {
    let { state } = engine.startChapter(ctx, fresh(), 'test_run')
    ;({ state } = skipTo(state, 'choice'))
    state = engine.choose(ctx, state, 1).state // refuse tea
    ;({ state } = skipTo(state, 'choice')) // the chase choice
    const started = engine.choose(ctx, state, 0)
    expect(started.events.find((e) => e.type === 'mode:start')).toMatchObject({ mode: 'chase', params: { target: 'driver_biodun' } })
    const modeView = engine.renderView(ctx, started.state)
    expect(modeView).toMatchObject({ type: 'mode', mode: 'chase', outcomes: ['won', 'lost'] })

    const done = engine.receiveModeResult(ctx, started.state, { outcome: 'won', moneyChange: 500, flags: ['caughtDefaulter'] }).state
    expect(done.stats.money).toBe(2800)
    expect(done.flags.caughtDefaulter).toBe(true)
    expect(done.memory.biodun_test).toBe('caught')
    expect(done.story.sceneId).toBe('caught')
  })

  it('callbacks: Ada remembers what you did with Bíọ́dún', () => {
    let { state } = engine.startChapter(ctx, fresh(), 'test_run')
    ;({ state } = skipTo(state, 'choice'))
    state = engine.choose(ctx, state, 1).state
    ;({ state } = skipTo(state, 'choice'))
    state = engine.choose(ctx, state, 1).state // let him go
    expect(state.flags.letDriverGo).toBe(true)
    // advance until Ada's callback line shows
    for (let i = 0; i < 10; i++) {
      const v = engine.renderView(ctx, state)
      if (v.type === 'dialogue' && v.text.includes('good person')) return
      state = engine.advance(ctx, state, () => 0.9).state
    }
    throw new Error('callback line never appeared')
  })

  it('random events are decided once and survive save/load', () => {
    let { state } = engine.startChapter(ctx, fresh(), 'test_run')
    ;({ state } = skipTo(state, 'choice'))
    state = engine.choose(ctx, state, 1).state
    ;({ state } = skipTo(state, 'choice'))
    state = engine.choose(ctx, state, 1, () => 0).state // letGo; random() = 0 -> rain
    state = engine.advance(ctx, state, () => 0).state // into the market
    expect(state.flags.raining).toBe(true)
    const reloaded = JSON.parse(JSON.stringify(state))
    expect(engine.renderView(ctx, reloaded)).toEqual(engine.renderView(ctx, state))
  })

  it('an ending choice finishes the game', () => {
    const s = engine.newGameState({ name: 'Emeka' })
    let { state } = engine.startChapter(ctx, s, 'test_run', 'night')
    ;({ state } = skipTo(state, 'choice'))
    state = engine.choose(ctx, state, 1).state
    const view = engine.renderView(ctx, state)
    expect(view.type).toBe('ending')
    expect(view.title).toBe('Rock Bottom')
    expect(view.epilogue.join(' ')).toContain('Emeka')
  })

  it('reports broken story data clearly', () => {
    const broken = { ...testRun, scenes: { ...testRun.scenes, arrival: { beats: [{ type: 'goto', scene: 'nowhere' }] } } }
    const { errors } = validateStory({ ...ctx, chapters: { test_run: broken } })
    expect(errors.join('\n')).toMatch(/nowhere/)
  })
})
