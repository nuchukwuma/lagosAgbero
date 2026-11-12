import { describe, it, expect } from 'vitest'
import { createInitiation, answer, currentQuestion, initiationResult, rankName, CULT } from './initiationLogic.js'

describe('initiation', () => {
  it('all right answers is perfect', () => {
    const s = createInitiation({ seed: 3 })
    while (!s.over) answer(s, currentQuestion(s).right)
    expect(s.over).toBe('perfect')
    expect(initiationResult(s).flags).toContain('initiated')
  })

  it('one wrong answer still passes', () => {
    const s = createInitiation({ ids: ['knocks', 'form', 'boss'] })
    answer(s, 0)
    answer(s, CULT.questions.form.right)
    answer(s, CULT.questions.boss.right)
    expect(s.over).toBe('passed')
  })

  it('two wrong answers (or timeouts) get you attacked', () => {
    const s = createInitiation({ ids: ['knocks', 'form', 'boss'] })
    answer(s, null)
    answer(s, 0)
    expect(s.over).toBe('attacked')
  })

  it('rank names clamp', () => {
    expect(rankName(0)).toBe('Outsider')
    expect(rankName(99)).toBe('Number Two Shell')
  })
})
