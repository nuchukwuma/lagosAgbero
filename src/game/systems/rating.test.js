import { describe, it, expect } from 'vitest'
import { rateRun } from './rating.js'
import ratings from '../data/endingRatings.json'
import endings from '../data/endings.json'

const chapters = import.meta.glob('../data/story/**/*.json', { eager: true, import: 'default' })
const ctx = { chapters: Object.fromEntries(Object.values(chapters).map((c) => [c.id, c])), endings }

describe('ending ratings', () => {
  it('every ending has a tier and a comment', () => {
    const missing = Object.keys(endings).filter((id) => !id.startsWith('_') && !(ratings[id]?.tier && ratings[id]?.comment))
    expect(missing).toEqual([])
  })
  it('a full run to the best ending with good friends grades high; a short one gets a nudge', () => {
    const all = Object.values(ctx.chapters).filter((c) => !c.common && (c.campaign || 'areaBoy') === 'areaBoy').map((c) => c.id)
    const best = rateRun({ id: 'go_home' }, { campaign: 'areaBoy', story: { completedChapters: all }, stats: { mentorBond: 80, friendBond: 85 } }, ctx)
    expect(['S', 'A']).toContain(best.grade)
    const early = rateRun({ id: 'rock_bottom' }, { campaign: 'areaBoy', story: { completedChapters: all.slice(0, 2) }, stats: { mentorBond: 5 } }, ctx, ['rock_bottom'])
    expect(['C', 'D']).toContain(early.grade)
    expect(early.nudge).toMatch(/after 2 of \d+ chapters/)
    expect(early.endingsLeft).toBeGreaterThan(0)
  })
})
