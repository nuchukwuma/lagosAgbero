// The game's verdict on a finished run: a grade and a comment for the ending
// reached, how much of the story was seen, and how close the player got to
// the people in it. Short and bad endings get roasted, gently, with a push to
// go and find the others. Also keeps the player's own star rating of each
// story on the device.

import ratings from '../data/endingRatings.json'
import { campaignEndings } from '../narrative/campaigns.js'
import { STAT_DEFS } from '../narrative/stats.js'

const TIER = { best: 100, good: 80, mixed: 60, bad: 40, early: 25 }
const GRADES = [
  [90, 'S'],
  [75, 'A'],
  [60, 'B'],
  [45, 'C'],
  [0, 'D'],
]

/**
 * view: the ending view (id); game: the game state; ctx: { chapters, endings }.
 * found: ending ids this player has reached (saveSystem.endingsFound()).
 */
export function rateRun(view, game, ctx, found = []) {
  const campaign = game?.campaign || 'areaBoy'
  const r = ratings[view.id] || { tier: 'mixed', comment: '' }
  const chapters = Object.values(ctx.chapters).filter((c) => !c.common && (c.campaign || 'areaBoy') === campaign && c.id !== 'test_run')
  const done = new Set(game?.story?.completedChapters || []).size
  const share = chapters.length ? Math.min(1, done / chapters.length) : 1
  // bonds: the people stats this story uses (Ada, Professor, Nne...), 0..100
  // (the relationships this run actually touched: other stories' people stay at their start)
  const people = Object.keys(game?.stats || {}).filter((k) => STAT_DEFS[k]?.group === 'relationship' && !/heat|hatred|loyalty/i.test(k) && game.stats[k] !== STAT_DEFS[k].start)
  const bonds = people.length ? people.reduce((s, k) => s + Math.max(0, Math.min(100, game.stats[k])), 0) / people.length : 50
  const score = Math.round(TIER[r.tier] * 0.6 + share * 25 + bonds * 0.15)
  const grade = GRADES.find(([min]) => score >= min)[1]
  const all = campaignEndings(ctx.endings, campaign).map(([id]) => id)
  const left = all.filter((id) => id !== view.id && !found.includes(id)).length
  let nudge
  if (r.tier === 'early') nudge = `Your story ended after ${done} of ${chapters.length} chapters: one of the shortest roads through it. ${left} other ending${left === 1 ? '' : 's'} still waiting.`
  else if (left > 0) nudge = `${left} more ending${left === 1 ? '' : 's'} to find in this story. Different choices, different people, different fates.`
  else nudge = 'You have found every ending in this story. Time for a new one.'
  return { grade, score, tier: r.tier, comment: r.comment, nudge, chapters: done, totalChapters: chapters.length, bonds: Math.round(bonds), endingsLeft: left, endingsTotal: all.length }
}

// ---- the player's own star rating of each story ----
const KEY = 'areaBoy.storyRatings'
export function storyRating(campaign) {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || '{}')[campaign] || null
  } catch {
    return null
  }
}
export function rateStory(campaign, stars, ending) {
  try {
    const all = JSON.parse(window.localStorage.getItem(KEY) || '{}')
    all[campaign] = { stars, ending, at: Date.now() }
    window.localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // storage blocked: the rating lasts this session only
  }
}
