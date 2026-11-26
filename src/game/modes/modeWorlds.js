// Modes played in a world of their own, whatever world the story is in
// (Back Gate is always the Royal Crest campus, at night). A tiny module on its
// own so the store and the world code can ask without loading every mode.
const MODE_WORLD = { sneak: 'royalCrest', shrineHeist: 'nkwoAgu', raidEscape: 'duplex', penthouseRaid: 'penthouse', warehouseHeist: 'warehouse', examSneak: 'examHall', serverBreak: 'serverRoom', hostelDash: 'royalCrest', paperRelay: 'royalCrest', droneDodge: 'lekki' }
/** The 3D stealth missions (modes/stealth): night, no traffic or crowd, guards with torches. */
export const STEALTH_MODES = new Set(['sneak', 'shrineHeist', 'raidEscape', 'penthouseRaid', 'warehouseHeist', 'examSneak', 'serverBreak', 'hostelDash', 'paperRelay', 'droneDodge'])
export const worldForMode = (mode, world) => MODE_WORLD[mode] || world
