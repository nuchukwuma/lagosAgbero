import { describe, it, expect } from 'vitest'
import { howToPlay } from './howToPlay.js'
import { tutorialFor } from './tutorials.js'
import { ARCADE_GAMES } from './arcade/index.js'

const STORY_MODES = ['feeCollection', 'chase', 'fight', 'runner', 'conductor', 'begging', 'rally', 'initiation', 'exam', 'drive', 'bluff', 'haggle', 'dance']

describe('how to play (the pause menu)', () => {
  it('has rules for every game the player can pause in', () => {
    for (const mode of [...STORY_MODES, ...ARCADE_GAMES.map((g) => g.id)]) {
      const h = howToPlay(mode, {})
      expect(h, mode).toBeTruthy()
      expect(typeof h.title, mode).toBe('string')
      expect(h.rules.length, mode).toBeGreaterThan(1)
      for (const r of h.rules) expect(typeof r, mode).toBe('string')
    }
  })
  it('fills in the numbers from the params', () => {
    expect(howToPlay('runner', { goal: 900 }).rules[0]).toContain('900 m')
    expect(howToPlay('exam', { count: 7, seconds: 10 }).rules[0]).toContain('7 questions')
  })
  it('has nothing for an unknown mode', () => {
    expect(howToPlay('nope')).toBeNull()
  })

  it('every game has a guided tutorial, each step saying something', () => {
    for (const mode of [...STORY_MODES, ...ARCADE_GAMES.map((g) => g.id)]) {
      const steps = tutorialFor(mode)
      expect(steps, mode).toBeTruthy()
      for (const st of steps) {
        expect(st.text.length, mode).toBeGreaterThan(15)
        if (st.at) expect(() => st.at.split(',').forEach((q) => q.trim())).not.toThrow()
      }
    }
  })
})
