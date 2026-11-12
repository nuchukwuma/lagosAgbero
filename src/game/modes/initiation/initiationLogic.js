// Tortoise initiation (pure). Coded questions in a dark room. Each question
// has a time limit; a timeout counts as a wrong answer. Two wrong answers and
// the brothers attack (outcome "attacked": the story starts a fight).
// Outcomes: perfect | passed | attacked

import data from '../../data/cult.json'
import quizzes from '../../data/quizzes.json'
import { RANK_NAMES } from '../../narrative/stats.js'

export const CULT = data
export const MAX_WRONG = 2

export function rankName(n) {
  return RANK_NAMES[Math.max(0, Math.min(RANK_NAMES.length - 1, Math.round(n || 0)))]
}

function rngFrom(seed) {
  let s = seed
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280)
}

export const QUIZZES = quizzes

/**
 * ids: question ids to ask (default: `count` random ones).
 * bank: question bank in quizzes.json ("cult", "gst101", "econ201"...).
 * maxWrong: wrong answers allowed before failing.
 */
export function createInitiation({ ids = null, count = 5, seed = 1, bank = 'cult', maxWrong = MAX_WRONG } = {}) {
  const rng = rngFrom(seed)
  const questions = quizzes[bank]?.questions || data.questions
  const all = Object.keys(questions)
  const pool = ids ? ids.filter((id) => questions[id]) : [...all].sort(() => rng() - 0.5).slice(0, count)
  return { bank, bankQuestions: questions, maxWrong, questions: pool, index: 0, wrong: 0, right: 0, over: null }
}

export const currentQuestion = (s) => (s.over ? null : { id: s.questions[s.index], ...s.bankQuestions[s.questions[s.index]] })

/** answer: index chosen, or null for a timeout. Returns true when correct. */
export function answer(s, choice) {
  if (s.over) return false
  const q = s.bankQuestions[s.questions[s.index]]
  const ok = choice === q.right
  if (ok) s.right++
  else s.wrong++
  s.index++
  if (s.wrong >= s.maxWrong) s.over = 'attacked'
  else if (s.index >= s.questions.length) s.over = s.wrong === 0 ? 'perfect' : 'passed'
  return ok
}

export function initiationResult(s) {
  if (s.bank && s.bank !== 'cult') {
    // an exam: "attacked" reads "failed"; grades move the CGPA
    const outcome = s.over === 'attacked' ? 'failed' : s.over
    return { outcome, stats: { cgpa: { perfect: 0.3, passed: 0.1, failed: -0.4 }[outcome] }, flags: [`exam_${s.bank}_${outcome}`] }
  }
  return {
    outcome: s.over,
    stats: { cultLoyalty: s.over === 'perfect' ? 8 : s.over === 'passed' ? 4 : 0 },
    flags: s.over === 'attacked' ? ['initiationFailed'] : ['initiated'],
  }
}
