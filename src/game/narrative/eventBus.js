// A tiny publish/subscribe bus. Story beats use it to start gameplay modes,
// and modes use it to send their result back.
//
// Events used so far:
//   'mode:start'   { mode, params }            story -> mode host
//   'mode:result'  { outcome, moneyChange... } mode -> story
//   'toast'        { text }                    anyone -> toast UI
//   'saved'        { slot }                    save system -> UI

export function createEventBus() {
  const handlers = new Map()
  return {
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set())
      handlers.get(type).add(fn)
      return () => handlers.get(type)?.delete(fn)
    },
    emit(type, payload) {
      for (const fn of handlers.get(type) || []) fn(payload)
    },
    clear() {
      handlers.clear()
    },
  }
}

export const bus = createEventBus()
