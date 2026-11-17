// Street reactions in progress (see ReactionDirector.jsx and Confrontation.jsx):
//   confront   a driver who got out because you blocked their car
//              { vehicleId, kind, line, look, again }
//   lastFight  { outcome, at } so the street can react when a fight ends
import { create } from 'zustand'

export const useStreet = create((set) => ({
  confront: null,
  lastFight: null,
  setConfront: (confront) => set({ confront }),
}))
