import { describe, it, expect } from 'vitest'
import { browserName } from './webgl.js'

describe('browserName', () => {
  it('tells the browsers apart (for the right fix-it steps)', () => {
    expect(browserName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0')).toBe('firefox')
    expect(browserName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15')).toBe('safari')
    expect(browserName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')).toBe('chrome')
    expect(browserName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0')).toBe('edge')
    expect(browserName('')).toBe('other')
  })
})
