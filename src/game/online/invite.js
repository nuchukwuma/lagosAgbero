// Inviting friends to a Lagos Online room: the link that opens the game
// straight into the room, and ways to send it (WhatsApp, the phone's share
// sheet, or a copy to paste anywhere).
import { create } from 'zustand'
import { serverUrl } from './net.js'

const LETTERS = /^[A-Z]{4}$/

/** What the landing page asked for: { create: true } or { code: 'ABCD' } (null: the public world). */
export const useRoomIntent = create(() => ({ intent: null }))
export const setRoomIntent = (intent) => useRoomIntent.setState({ intent })

/** A code from the address bar (?room=abcd), or null. */
export function roomFromUrl(search = typeof location !== 'undefined' ? location.search : '') {
  const c = new URLSearchParams(search).get('room')?.toUpperCase().replace(/[^A-Z]/g, '')
  return c && LETTERS.test(c) ? c : null
}

/** The link that opens the game into this room (carrying a custom server address, if one is set). */
export function roomLink(code, { origin = location.origin, base = import.meta.env?.BASE_URL || '/', server = null } = {}) {
  const url = new URL(base, origin)
  url.searchParams.set('room', code)
  const custom = server ?? customServer()
  if (custom) url.searchParams.set('server', custom)
  return url.toString()
}

function customServer() {
  try {
    // a server chosen with ?server= on this device (not the built-in one) has to travel with the link
    const saved = window.localStorage.getItem('naijavice.onlineServer')
    return saved && saved === serverUrl() && saved !== import.meta.env?.VITE_ONLINE_URL ? saved : null
  } catch {
    return null
  }
}

export const inviteText = (code, link) => `Come and play NaijaVice with me! Room code: ${code}\n${link}`

/** WhatsApp's share link (opens the app, or WhatsApp Web, with the message ready to send). */
export const whatsappLink = (code, link = roomLink(code)) => `https://wa.me/?text=${encodeURIComponent(inviteText(code, link))}`

/** The phone's share sheet where there is one; otherwise a copy. Returns 'shared' | 'copied' | 'failed'. */
export async function shareRoom(code) {
  const link = roomLink(code)
  try {
    if (navigator.share) {
      await navigator.share({ title: 'NaijaVice', text: inviteText(code, link), url: link })
      return 'shared'
    }
  } catch (e) {
    if (e?.name === 'AbortError') return 'failed' // they closed the sheet
  }
  return copyRoomLink(code)
}

export async function copyRoomLink(code) {
  const text = inviteText(code, roomLink(code))
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    // older browsers: the hidden-textarea way
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok ? 'copied' : 'failed'
    } catch {
      return 'failed'
    }
  }
}
