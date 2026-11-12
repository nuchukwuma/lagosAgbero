// One drive. Story / activity params (startMode "drive"):
//   length       route length in metres (default 2400)
//   stops        bus stops on the route (default 5)
//   fuel         starting fuel % (default 55)
//   checkpoints  Task Force checkpoints (default 1; 0 for none)
//   police       false = no police at all
//   difficulty   1..3 (more traffic)
//   slogan       painted on the back of your danfo
//   seed
import { create } from 'zustand'

export const driveInput = { steer: 0, gas: 0, brake: 0, horn: false, keys: new Set(), touch: { left: false, right: false, gas: false, brake: false } }

export function readDriveInput() {
  const k = driveInput.keys
  const t = driveInput.touch
  const steer = (k.has('right') || t.right ? 1 : 0) - (k.has('left') || t.left ? 1 : 0)
  return { steer, gas: k.has('gas') || t.gas ? 1 : 0, brake: k.has('brake') || t.brake ? 1 : 0, horn: driveInput.horn }
}

export const useDrive = create((set, get) => ({
  active: false,
  started: false,
  params: {},
  hud: null,
  prompt: null, // { type: 'fuel' | 'checkpoint' | 'stop', ... } when stopped at a place
  toast: null,
  ended: null,
  result: null,
  drive: null, // the live logic state (mutable; owned by DriveScene)

  start: (params) => set({ active: true, started: false, params, hud: null, prompt: null, toast: null, ended: null, result: null, drive: null }),
  begin: () => set({ started: true }),
  reset: () => {
    driveInput.keys.clear()
    Object.assign(driveInput.touch, { left: false, right: false, gas: false, brake: false })
    driveInput.horn = false
    set({ active: false, started: false, ended: null, prompt: null, drive: null })
  },
  end: (outcome, result) => !get().ended && set({ ended: outcome, result }),
}))
