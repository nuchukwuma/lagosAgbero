// Course runs: what the overlay shows. The run itself (courseLogic) lives in
// `course.current`, stepped by CourseScene inside the 3D canvas.
import { create } from 'zustand'

export const COURSE_MODES = new Set(['creekRun', 'customsBreakout', 'cartDash', 'convoyEscort'])

export const course = { current: null }
export const courseInput = { keys: new Set(), touch: { left: false, right: false, gas: false, brake: false } }

export function readCourseInput() {
  const k = courseInput.keys
  const t = courseInput.touch
  return {
    steer: (k.has('right') || t.right ? 1 : 0) - (k.has('left') || t.left ? 1 : 0),
    gas: k.has('gas') || t.gas ? 1 : 0,
    brake: k.has('brake') || t.brake ? 1 : 0,
  }
}

export const useCourse = create((set) => ({
  active: false,
  id: null,
  started: false,
  params: {},
  attempt: 0,
  hud: null, // { time, speed, done (0..1), damage, crates, convoy, behind, boost, rivalGap }
  ended: false,
  start: (id, params) => set((s) => ({ active: true, id, started: false, params, ended: false, hud: null, attempt: s.attempt + 1 })),
  begin: () => set({ started: true }),
  retry: () => set((s) => ({ started: true, ended: false, hud: null, attempt: s.attempt + 1 })),
  reset: () => {
    course.current = null
    courseInput.keys.clear()
    Object.assign(courseInput.touch, { left: false, right: false, gas: false, brake: false })
    set({ active: false, id: null, started: false, ended: false })
  },
}))
