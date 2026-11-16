import { describe, it, expect } from 'vitest'
import { needsTurn } from './orientation.js'

describe('orientation', () => {
  it('asks a phone to turn only when it is held the other way', () => {
    expect(needsTurn('landscape', 'portrait', true)).toBe(true)
    expect(needsTurn('landscape', 'landscape', true)).toBe(false)
    expect(needsTurn('portrait', 'landscape', true)).toBe(true)
    expect(needsTurn('auto', 'portrait', true)).toBe(false)
  })
  it('never bothers computers', () => {
    expect(needsTurn('landscape', 'portrait', false)).toBe(false)
  })
})
