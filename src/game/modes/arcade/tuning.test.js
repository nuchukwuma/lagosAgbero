import { describe, it, expect } from 'vitest'
import { tuneParams, ARCADE_BOOSTS } from './tuning.js'
import { ARCADE_GAMES } from './index.js'
import { storyLevel } from '../../systems/progress.js'
import { POWERUPS, powerupsFor } from '../../systems/powerups.js'
import { tunedActivity } from '../../systems/heat.js'
import * as ballots from './games/ballots.js'
import * as pepper from './games/pepperSoup.js'
import * as parts from './games/fakeParts.js'

const chapters = Object.fromEntries(
  Array.from({ length: 15 }, (_, i) => [`c${i + 1}`, { id: `c${i + 1}`, campaign: 'grace', number: i + 1 }]).concat([['side', { id: 'side', common: true }]]),
)

describe('difficulty that rises with the story', () => {
  it('story level runs from 0 in the first chapter to 1 in the last', () => {
    const at = (n, done = []) => storyLevel({ campaign: 'grace', story: { chapterId: `c${n}`, completedChapters: done } }, chapters)
    expect(at(1)).toBe(0)
    expect(at(8)).toBeCloseTo(0.5, 2)
    expect(at(15)).toBe(1)
    // in a side quest (a common chapter), the chapters done still count
    expect(storyLevel({ campaign: 'grace', story: { chapterId: 'side', completedChapters: ['c1', 'c2', 'c3'] } }, chapters)).toBeCloseTo(3 / 14, 2)
  })

  it('late chapters ask more than early ones, and power-ups always make it easier', () => {
    const early = tuneParams('change', { target: 8 }, 0)
    const late = tuneParams('change', { target: 8 }, 1)
    expect(late.target).toBeGreaterThan(early.target)
    expect(late.patienceMul).toBeLessThan(early.patienceMul)
    expect(tuneParams('whot', {}, 1).skill).toBeGreaterThan(tuneParams('whot', {}, 0).skill)
    expect(tuneParams('escape', { difficulty: 2 }, 1).difficulty).toBeGreaterThan(2)
    const boosted = tuneParams('change', { target: 8 }, 1, ['chg_patience', 'chg_time'])
    expect(boosted.patienceMul).toBeGreaterThan(late.patienceMul)
    expect(boosted.seconds).toBeGreaterThan(60)
    for (const [game, list] of Object.entries(ARCADE_BOOSTS)) for (const b of list) expect(tuneParams(game, {}, 1, [b.id]), b.id).not.toEqual(tuneParams(game, {}, 1))
  })

  it('every mini-game has ad power-ups on its start screen', () => {
    for (const g of ARCADE_GAMES) {
      expect(powerupsFor(g.id).length, g.id).toBeGreaterThan(0)
      for (const [id] of powerupsFor(g.id)) expect(POWERUPS[id].name).toBeTruthy()
    }
  })

  it('still beatable at the hardest level: a careful player wins', () => {
    let s = ballots.create(tuneParams('ballots', {}, 1), 3)
    while (!s.over) ballots.sortInto(s, s.ballots[s.i].answer)
    expect(ballots.result(s).outcome).toBe('won')
    s = parts.create(tuneParams('fakeParts', {}, 1), 3)
    while (!s.over) parts.judge(s, s.boxes[s.i].fake)
    expect(parts.result(s).outcome).toBe('won')
    s = pepper.create(tuneParams('pepperSoup', {}, 1), 3)
    while (!s.over) {
      for (const st of s.orders[0].steps) pepper.add(s, st)
      pepper.serve(s)
      pepper.step(s, 3)
    }
    expect(pepper.result(s).outcome).toBe('won')
  })

  it('free-roam fights and chases step up with the story', () => {
    const game = { stats: {} }
    const a = { mode: 'fight', params: { opponent: 'thug', difficulty: 1 } }
    expect(tunedActivity(game, a, 0).params.difficulty).toBe(1)
    expect(tunedActivity(game, a, 1).params.difficulty).toBeGreaterThan(2)
  })
})
