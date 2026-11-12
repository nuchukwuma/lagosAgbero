// Side quests (data: src/game/data/quests.json, scenes: story/common/quests.json).
// A quest is offered by a character standing in the street. Walk up to them
// during free roam and the TALK button becomes the quest's button.
import data from '../data/quests.json'
import { checkCondition } from '../narrative/conditions.js'

export const QUESTS = data.quests

/** Quests that can be started now. */
export function availableQuests(game) {
  if (!game) return []
  const campaign = game.campaign || 'areaBoy'
  return QUESTS.filter((q) => (q.campaign || 'areaBoy') === campaign && checkCondition(q.if, game))
}

export function questState(game, q) {
  if (game.flags[`quest_${q.id}_done`]) return 'done'
  if (game.flags[`quest_${q.id}`]) return 'active'
  return checkCondition(q.if, game) ? 'available' : 'locked'
}

/** The quest a giver standing near the player offers, if any. */
export function questFrom(game, giverId) {
  return availableQuests(game).find((q) => q.giver === giverId) || null
}
