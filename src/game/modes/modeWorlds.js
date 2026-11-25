// Modes played in a world of their own, whatever world the story is in
// (Back Gate is always the Royal Crest campus, at night). A tiny module on its
// own so the store and the world code can ask without loading every mode.
const MODE_WORLD = { sneak: 'royalCrest' }
export const worldForMode = (mode, world) => MODE_WORLD[mode] || world
