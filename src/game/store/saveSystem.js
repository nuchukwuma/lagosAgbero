// Save / load in localStorage. One autosave slot plus three manual slots.
// Every call is wrapped in try/catch: private browsing, full storage or
// blocked storage must never crash the game.

export const SAVE_VERSION = 1
export const SLOTS = ['auto', '1', '2', '3']
const KEY = (slot) => `areaBoy.save.${slot}`

function storage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

// When the save format changes, upgrade old saves here instead of losing them.
function migrate(data) {
  if (!data || typeof data !== 'object') return null
  if (data.version === SAVE_VERSION) return data
  return null // unknown future/past format: ignore rather than crash
}

/** game = { player, stats, flags, memory, story }; summary is shown in the load menu. */
export function saveGame(slot, game, summary = {}) {
  const s = storage()
  if (!s) return false
  try {
    const data = { version: SAVE_VERSION, savedAt: new Date().toISOString(), summary, game }
    s.setItem(KEY(slot), JSON.stringify(data))
    return true
  } catch (e) {
    console.warn('[save] could not save', e)
    return false
  }
}

export function loadGame(slot) {
  const s = storage()
  if (!s) return null
  try {
    const raw = s.getItem(KEY(slot))
    return raw ? migrate(JSON.parse(raw))?.game ?? null : null
  } catch (e) {
    console.warn('[save] could not load', e)
    return null
  }
}

export function listSaves() {
  const s = storage()
  if (!s) return []
  return SLOTS.map((slot) => {
    try {
      const data = migrate(JSON.parse(s.getItem(KEY(slot)) || 'null'))
      return data ? { slot, savedAt: data.savedAt, summary: data.summary } : { slot, empty: true }
    } catch {
      return { slot, empty: true }
    }
  })
}

export function deleteSave(slot) {
  try {
    storage()?.removeItem(KEY(slot))
  } catch {
    /* ignore */
  }
}

/** The most recent save of any slot, for the Continue button. */
export function latestSave() {
  return listSaves()
    .filter((s) => !s.empty)
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1))[0] || null
}
