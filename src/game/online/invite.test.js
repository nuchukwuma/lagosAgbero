import { describe, it, expect } from 'vitest'
import { roomFromUrl, roomLink, whatsappLink, inviteText } from './invite.js'

describe('room invites', () => {
  it('reads a room code from the address bar, tidied up', () => {
    expect(roomFromUrl('?room=bcdf')).toBe('BCDF')
    expect(roomFromUrl('?room=BC-DF')).toBe('BCDF')
    expect(roomFromUrl('?room=BCD')).toBe(null)
    expect(roomFromUrl('?x=1')).toBe(null)
  })
  it('makes the room link and the WhatsApp message with the code and the link', () => {
    const link = roomLink('KXTZ', { origin: 'https://nuchukwuma.github.io', base: '/lagosAgbero/', server: '' })
    expect(link).toBe('https://nuchukwuma.github.io/lagosAgbero/?room=KXTZ')
    const wa = whatsappLink('KXTZ', link)
    expect(wa.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(wa.slice('https://wa.me/?text='.length))).toBe(inviteText('KXTZ', link))
    expect(inviteText('KXTZ', link)).toContain('KXTZ')
    // a custom server travels with the link
    expect(roomLink('KXTZ', { origin: 'https://a.b', base: '/', server: 'wss://srv.example' })).toBe('https://a.b/?room=KXTZ&server=wss%3A%2F%2Fsrv.example')
  })
})
