// Lagos Online, the game's side: one WebSocket to the server (server/), a
// store with what we know (me, who's around, chat, invites, matches,
// leaderboards), and small helpers to send things. Reconnects by itself.
//
// The server's address: VITE_ONLINE_URL at build time, or ?server=wss://... in
// the address bar (remembered on this device), or ws://<this host>:8787 when
// running locally.
import { create } from 'zustand'

const TOKEN_KEY = 'naijavice.onlineToken'
const SERVER_KEY = 'naijavice.onlineServer'

export const useOnline = create(() => ({
  status: 'off', // off | connecting | online | error
  error: null,
  me: null,
  map: null,
  players: {}, // id -> { id, name, look, group, x, z, ry, anim, at }
  chat: [], // the last 60 lines here
  invites: [], // challenges waiting for your answer
  match: null, // the match you're playing
  lastEnd: null, // how your last match (or bet) ended
  matches: [], // matches here you can bet on
  leaders: null,
  toasts: [],
  liveInbox: [], // moves from the other player in a live game, oldest first
  nearGiver: null, // the quest giver you're standing next to (QuestGivers.jsx)
  guide: null, // the quest giver you asked the way to
}))

let ws = null
let wanted = null // { name, look } while we want to be connected
let retry = 0
let toastId = 0
let tokenWaiter = null // spendToken()'s answer

export function serverUrl() {
  try {
    const q = new URLSearchParams(window.location.search).get('server')
    if (q) window.localStorage.setItem(SERVER_KEY, q)
    const saved = window.localStorage.getItem(SERVER_KEY)
    if (saved) return saved
  } catch {
    // storage blocked
  }
  if (import.meta.env.VITE_ONLINE_URL) return import.meta.env.VITE_ONLINE_URL
  return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname || 'localhost'}:8787`
}

function token() {
  try {
    let t = window.localStorage.getItem(TOKEN_KEY)
    if (!t) {
      t = (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^a-z0-9-]/gi, '') + Math.random().toString(36).slice(2)
      window.localStorage.setItem(TOKEN_KEY, t)
    }
    return t
  } catch {
    return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

export function send(msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg))
}

const addToast = (text) => useOnline.setState((s) => ({ toasts: [...s.toasts, { id: ++toastId, text }].slice(-4) }))
export const dismissToast = (id) => useOnline.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))

function onMessage(msg) {
  const set = useOnline.setState
  switch (msg.t) {
    case 'welcome':
      set({ status: 'online', error: null })
      retry = 0
      break
    case 'me':
      set({ me: msg.me })
      break
    case 'room':
      set({ map: msg.map, players: Object.fromEntries(msg.players.map((p) => [p.id, { ...p, at: performance.now() }])), matches: msg.matches || [], chat: [] })
      break
    case 'joined':
      set((s) => ({ players: { ...s.players, [msg.player.id]: { ...msg.player, at: performance.now() } } }))
      break
    case 'left':
      set((s) => {
        const players = { ...s.players }
        delete players[msg.id]
        return { players }
      })
      break
    case 'moved': {
      // positions change many times a second: update in place (the 3D layer reads them every frame)
      const p = useOnline.getState().players[msg.id]
      if (p) Object.assign(p, { x: msg.x, z: msg.z, ry: msg.ry, anim: msg.anim, at: performance.now() })
      break
    }
    case 'chat':
      set((s) => ({ chat: [...s.chat, msg].slice(-60) }))
      break
    case 'invite':
      set((s) => ({ invites: [...s.invites, msg] }))
      break
    case 'match':
      set({ match: msg.match, liveInbox: [] })
      break
    case 'liveMove':
      set((s) => ({ liveInbox: [...s.liveInbox, msg] }))
      break
    case 'matchEnd':
      set((s) => ({ lastEnd: msg, match: s.match?.id === msg.id ? null : s.match }))
      break
    case 'matches':
      set({ matches: msg.matches })
      break
    case 'leaders':
      set({ leaders: msg })
      break
    case 'toast':
      addToast(msg.text)
      break
    case 'token':
      tokenWaiter?.(Boolean(msg.ok))
      tokenWaiter = null
      break
    case 'error':
      addToast(`⚠ ${msg.text}`)
      break
    default:
  }
}

/** Connect (or stay connected) as this name and look. */
export function connect({ name, look }) {
  wanted = { name, look }
  if (ws && ws.readyState <= 1) return
  useOnline.setState({ status: 'connecting', error: null })
  let sock
  try {
    sock = new WebSocket(serverUrl())
  } catch (e) {
    useOnline.setState({ status: 'error', error: String(e.message || e) })
    return
  }
  ws = sock
  sock.onopen = () => sock.send(JSON.stringify({ t: 'hello', token: token(), name: wanted.name, look: wanted.look }))
  sock.onmessage = (ev) => {
    try {
      onMessage(JSON.parse(ev.data))
    } catch {
      // a bad message: ignore it
    }
  }
  sock.onclose = () => {
    if (ws !== sock) return
    ws = null
    if (!wanted) return useOnline.setState({ status: 'off' })
    // try again, a little later each time
    retry++
    useOnline.setState({ status: retry > 3 ? 'error' : 'connecting', error: retry > 3 ? "Can't reach the Lagos Online server." : null })
    setTimeout(() => wanted && connect(wanted), Math.min(10000, 800 * retry))
  }
}

export function disconnect() {
  wanted = null
  if (ws) ws.close()
  ws = null
  useOnline.setState({ status: 'off', players: {}, map: null, match: null, invites: [], guide: null, nearGiver: null })
}

// the things you can do
export const joinPlace = (map, x, z) => send({ t: 'join', map, x, z })
export const say = (text) => send({ t: 'say', text })
export const challenge = (to, game, stake) => send({ t: 'challenge', to, game, stake })
export function answerInvite(id, accept) {
  useOnline.setState((s) => ({ invites: s.invites.filter((i) => i.id !== id) }))
  send({ t: 'respond', id, accept })
}
export const liveMove = (id, move) => send({ t: 'liveMove', id, move })
export const duelResult = (id, score) => send({ t: 'duelResult', id, score })
export const forfeit = (id) => send({ t: 'forfeit', id })
export const bet = (id, on, amount) => send({ t: 'bet', id, on, amount })
export const soloResult = (game, score) => send({ t: 'soloResult', game, score })
export const joinGroup = (group) => send({ t: 'joinGroup', group })
export const leaveGroup = () => send({ t: 'leaveGroup' })
export const claimQuest = (id) => send({ t: 'claimQuest', id })
export const buy = (item) => send({ t: 'buy', item })
export const askLeaders = () => send({ t: 'leaders' })
/** Spend a Power-up Token (shop). Resolves true if the server took one. */
export function spendToken() {
  if (!ws || ws.readyState !== 1) return Promise.resolve(false)
  return new Promise((resolve) => {
    tokenWaiter?.(false)
    tokenWaiter = resolve
    send({ t: 'useToken' })
    setTimeout(() => tokenWaiter === resolve && (tokenWaiter = null, resolve(false)), 5000)
  })
}
export const clearEnd = () => useOnline.setState({ lastEnd: null })
