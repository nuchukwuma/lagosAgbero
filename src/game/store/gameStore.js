// The game store (Zustand). It holds the game state, asks the story engine
// what to do, and turns engine events into toasts, autosaves and bus events.
// React components read from here and call its actions; they never touch
// the engine directly.

import { create } from 'zustand'
import { storyCtx, FIRST_CHAPTER } from '../narrative/storyData.js'
import * as engine from '../narrative/storyEngine.js'
import { bus } from '../narrative/eventBus.js'
import { saveGame, loadGame, latestSave } from './saveSystem.js'
import { defaultStats } from '../narrative/stats.js'

let toastId = 0

function summaryOf(game, view) {
  return {
    name: game.player.name,
    nickname: game.player.nickname,
    chapterTitle: view?.chapterTitle || view?.title || '',
    act: view?.act ?? null,
    money: game.stats.money,
  }
}

export const useGameStore = create((set, get) => {
  // Run an engine step safely and process what it reports.
  function dispatch(step) {
    const { game } = get()
    try {
      const { state, events } = step(game)
      const view = engine.renderView(storyCtx, state)
      const toasts = []
      for (const ev of events) {
        if (ev.type === 'toast') toasts.push({ id: ++toastId, text: ev.text })
        if (ev.type === 'autosave') saveGame('auto', state, summaryOf(state, view))
        if (ev.type === 'mode:start') bus.emit('mode:start', { mode: ev.mode, params: ev.params })
        if (ev.type === 'chapter') bus.emit('chapter:start', ev)
      }
      set((s) => ({ game: state, view, error: null, toasts: [...s.toasts, ...toasts].slice(-4) }))
    } catch (e) {
      console.error(e)
      set({ error: e.message })
    }
  }

  return {
    screen: 'title', // title | newGame | story | about | assets | load
    game: null,
    view: null,
    toasts: [],
    error: null,

    goTo: (screen) => set({ screen }),

    newGame: ({ name, nickname, look }) => {
      set({ game: engine.newGameState({ name, nickname, look }), screen: 'story', toasts: [] })
      dispatch((g) => engine.startChapter(storyCtx, g, FIRST_CHAPTER))
    },

    // Developer: new test player dropped straight into a chapter.
    devStart: (chapterId, sceneId) => {
      set({ game: engine.newGameState({ name: 'Tester' }), screen: 'story', toasts: [] })
      dispatch((g) => engine.startChapter(storyCtx, g, chapterId, sceneId))
    },

    // Jump straight into any chapter (used by the dev chapter picker).
    startChapter: (chapterId) => dispatch((g) => engine.startChapter(storyCtx, g, chapterId)),

    advance: () => dispatch((g) => engine.advance(storyCtx, g)),
    choose: (index) => dispatch((g) => engine.choose(storyCtx, g, index)),
    modeResult: (result) => dispatch((g) => engine.receiveModeResult(storyCtx, g, result)),

    save: (slot) => {
      const { game, view } = get()
      if (!game) return false
      const ok = saveGame(slot, game, summaryOf(game, view))
      set((s) => ({ toasts: [...s.toasts, { id: ++toastId, text: ok ? `Saved to slot ${slot}.` : 'Could not save on this device.' }] }))
      return ok
    },

    load: (slot) => {
      const saved = loadGame(slot)
      if (!saved) return false
      // Saves from older versions may lack stats added later: fill defaults.
      const game = { ...saved, stats: { ...defaultStats(), ...saved.stats }, flags: saved.flags || {}, memory: saved.memory || {} }
      try {
        set({ game, view: engine.renderView(storyCtx, game), screen: 'story', toasts: [], error: null })
        return true
      } catch (e) {
        set({ error: `This save no longer matches the story: ${e.message}` })
        return false
      }
    },

    continueGame: () => {
      const latest = latestSave()
      return latest ? get().load(latest.slot) : false
    },

    quitToTitle: () => set({ screen: 'title', toasts: [] }),
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  }
})

// Gameplay modes report back through the event bus.
bus.on('mode:result', (result) => useGameStore.getState().modeResult(result))
