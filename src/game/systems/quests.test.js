import { describe, it, expect } from 'vitest'
import { QUESTS, availableQuests, questFrom, questState } from './quests.js'
import quests from '../data/story/common/quests.json'
import characters from '../data/characters.json'
import street from '../data/world/iyanaWahala.json'

const game = (flags = {}, stats = {}) => ({ flags, stats: { friendBond: 0, day: 1, ...stats }, memory: {} })

describe('side quests', () => {
  it('every quest has a giver in the street and a starting scene', () => {
    const npcs = new Set(street.npcs.map((n) => n.id))
    for (const q of QUESTS) {
      expect(npcs.has(q.giver), q.giver).toBe(true)
      expect(characters[q.giver], q.giver).toBeTruthy()
      expect(quests.scenes[q.start.split(':')[1]], q.start).toBeTruthy()
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
