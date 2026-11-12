import { describe, it, expect } from 'vitest'
import { buildChapterGraph, layoutGraph, markGraph } from './storyGraph.js'
import * as engine from './storyEngine.js'
import ch6 from '../data/story/act2/ch6_shellKnock.json'

const tiny = {
  id: 't',
  startScene: 'a',
  scenes: {
    a: { beats: [{ type: 'choice', text: 'Which way?', options: [{ text: 'Left', effects: { goto: 'l' } }, { text: 'Right', effects: { goto: 'r' } }] }] },
    l: { beats: [{ type: 'startMode', mode: 'fight', results: { won: { goto: 'w' }, lost: { goto: 'z' } } }] },
    r: { beats: [{ type: 'goto', if: 'x', scene: 'w' }, { type: 'endChapter', title: 'End', ending: 'rock_bottom' }] },
    w: { beats: [{ type: 'endChapter', title: 'End', next: 'u' }] },
    z: { beats: [{ type: 'endChapter', title: 'End' }] },
  },
}

describe('story graph', () => {
  it('turns scenes and branches into nodes and edges', () => {
    const g = buildChapterGraph(tiny)
    expect(g.nodes.filter((n) => n.kind === 'scene')).toHaveLength(5)
    expect(g.edges.find((e) => e.from === 'a' && e.to === 'l')).toMatchObject({ kind: 'choice', label: 'Left', pick: [0, 0] })
    expect(g.edges.find((e) => e.from === 'l' && e.to === 'w')).toMatchObject({ kind: 'outcome', label: 'won' })
    expect(g.edges.find((e) => e.from === 'r' && e.to === 'w').kind).toBe('condition')
    expect(g.nodes.find((n) => n.id === '@ending:rock_bottom').kind).toBe('end')
    const { rows } = layoutGraph(g)
    expect(rows[0]).toEqual(['a'])
    expect(rows[1].sort()).toEqual(['l', 'r'])
  })

  it('marks the path the player took and the branches they missed', () => {
    const g = buildChapterGraph(tiny)
    const m = markGraph(g, 't', { visited: { 't/a': true, 't/r': true }, picks: [['t', 'a', 0, 1]] })
    expect(m.edges.find((e) => e.to === 'r').taken).toBe(true)
    expect(m.edges.find((e) => e.to === 'l').taken).toBe(false)
    expect(m.nodes.find((n) => n.id === 'l').seen).toBe(false)
    expect(m.explored).toBeCloseTo(2 / 5)
  })

  it('works on a real chapter, and the engine records the history it needs', () => {
    const g = buildChapterGraph(ch6)
    expect(g.edges.filter((e) => e.kind === 'choice').length).toBeGreaterThan(5)
    const ctx = { chapters: { ch6_shellKnock: ch6 }, characters: {}, callbacks: {}, endings: {} }
    let { state } = engine.startChapter(ctx, engine.newGameState({}), 'ch6_shellKnock')
    for (let i = 0; i < 4; i++) state = engine.advance(ctx, state).state
    const v = engine.renderView(ctx, state)
    expect(v.type).toBe('choice')
    state = engine.choose(ctx, state, 0).state
    expect(state.story.visited['ch6_shellKnock/morning']).toBe(true)
    expect(state.story.picks[0].slice(0, 2)).toEqual(['ch6_shellKnock', 'morning'])
    const m = markGraph(g, 'ch6_shellKnock', state.story)
    expect(m.edges.some((e) => e.taken)).toBe(true)
    expect(engine.chapterRecap(ctx, state, 'ch6_shellKnock').picks[0].text).toMatch(/Lead the way/)
  })
})
