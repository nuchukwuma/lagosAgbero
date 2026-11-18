// Is the game paused? True while a panel is open over the game (the pause
// menu, map, status, a shop) or the phone asks to be turned. The 3D world
// stops (GameCanvas freezes its frame loop, which also stops every activity's
// clock: fee runs, chases, fights, the runner...), and countdowns drawn
// outside it (timed choices, quizzes, favours) hold too: see usePaused().
import { create } from 'zustand'

export const usePause = create(() => ({ paused: false }))
export const usePaused = () => usePause((s) => s.paused)
export const isPaused = () => usePause.getState().paused
