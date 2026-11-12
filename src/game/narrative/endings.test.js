import { describe, it, expect } from 'vitest'
import * as engine from './storyEngine.js'
import { applyEffects } from './effects.js'
import characters from '../data/characters.json'
import callbacks from '../data/callbacks.json'
import endings from '../data/endings.json'
import ch12 from '../data/story/act4/ch12_final.json'

const ctx = { chapters: { ch12_final: ch12 }, characters, callbacks, endings }

function atFinal(setup) {
  let { state } = engine.startChapter(ctx, engine.newGameState({ name: 'Musa' }), 'ch12_final', 'final')
  state = setup(state)
  for (let i = 0; i < 5; i++) {
    const v = engine.renderView(ctx, state)
    if (v.type === 'choice') return { state, view: v }
    state = engine.advance(ctx, state).state
  }
  throw new Error('no final choice')
}

const withStats = (state, stats, flags = {}) => ({ ...state, stats: { ...state.stats, ...stats }, flags: { ...state.flags, ...flags } })

describe('debt and endings', () => {
  it('payDebt pays from a pocket without going below zero', () => {
    const s = engine.newGameState({})
    const r = applyEffects({ ...s, stats: { ...s.stats, hustleMoney: 30000, debt: 20000 } }, { payDebt: 'hustleMoney' })
    expect(r.state.stats.debt).toBe(0)
    expect(r.state.stats.hustleMoney).toBe(10000)
  })

  it('a player with nothing can only reach Rock Bottom', () => {
    const { view } = atFinal((s) => s)
    const open = view.options.filter((o) => !o.locked)
    expect(open).toHaveLength(1)
    expect(open[0].text).toMatch(/nothing/)
  })

  it('secret endings stay hidden until earned, then appear', () => {
    const hidden = atFinal((s) => s).view.options.map((o) => o.text).join('|')
    expect(hidden).not.toMatch(/Go home/)
    const { view } = atFinal((s) => withStats(s, { debt: 0, notoriety: 10, mentorBond: 50, friendBond: 50 }))
    expect(view.options.find((o) => /Go home/.test(o.text)).locked).toBe(false)
  })

  it('epilogue lines and fates follow the flags', () => {
    let { state, view } = atFinal((s) => withStats(s, { debt: 0, notoriety: 10, mentorBond: 50, friendBond: 70 }, { ada_romance: true, professor_buka: true }))
    state = engine.choose(ctx, state, view.options.find((o) => /Go home/.test(o.text)).index).state
    const end = engine.renderView(ctx, state)
    expect(end).toMatchObject({ type: 'ending', id: 'go_home', secret: true })
    expect(end.epilogue.join(' ')).toMatch(/Ada comes too/)
    expect(end.fates.join(' ')).toMatch(/Professor's Kitchen/)
    expect(end.fates.join(' ')).toMatch(/paid in full/)
  })
})
