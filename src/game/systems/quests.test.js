import { describe, it, expect } from 'vitest'
import { QUESTS, availableQuests, questFrom, questState } from './quests.js'
import quests from '../data/story/common/quests.json'
import bonds from '../data/story/common/bonds.json'
import characters from '../data/characters.json'
import campaigns from '../data/campaigns.json'
const worlds = import.meta.glob('../data/world/*.json', { eager: true, import: 'default' })
const worldOf = (campaign) => {
  const id = (campaigns.campaigns || campaigns).find((c) => c.id === (campaign || 'areaBoy')).world
  return Object.entries(worlds).find(([f]) => f.endsWith(`/${id}.json`))[1]
}
const commons = { quests, bonds }

const game = (flags = {}, stats = {}) => ({ flags, stats: { friendBond: 0, day: 1, ...stats }, memory: {} })

describe('side quests', () => {
  it('every quest has a giver in its story\'s world and a starting scene', () => {
    for (const q of QUESTS) {
      const npcs = new Set(worldOf(q.campaign).npcs.map((n) => n.id))
      expect(npcs.has(q.giver), `${q.id}: ${q.giver}`).toBe(true)
      expect(characters[q.giver], q.giver).toBeTruthy()
      const [chapter, scene] = q.start.split(':')
      expect(commons[chapter]?.common, q.start).toBe(true)
      expect(commons[chapter].scenes[scene], q.start).toBeTruthy()
    }
  })

  it('quests unlock with the story and close once started', () => {
    expect(availableQuests(game())).toHaveLength(0)
    const g = game({ dayLoop: true })
    const q = questFrom(g, 'mamaPut')
    expect(q.id).toBe('gasCylinder')
    expect(questState(g, q)).toBe('available')
    g.flags.quest_gasCylinder = true
    expect(questFrom(g, 'mamaPut')).toBe(null)
    expect(questState(g, q)).toBe('active')
  })

  it('follow-up quests need the first part and the right moment', () => {
    const g = game({ dayLoop: true, quest_kelvinPitch: true, quest_kelvinPitch_done: true })
    expect(questFrom(g, 'kelvin')).toBe(null)
    g.flags.electionSeason = true
    expect(questFrom(g, 'kelvin').id).toBe('kelvinCollapse')
  })
})
