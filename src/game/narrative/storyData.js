// Collects every story JSON file in src/game/data/story/ (any sub-folder) plus
// the shared data files. Adding a chapter = dropping a new JSON file there.

import characters from '../data/characters.json'
import callbacks from '../data/callbacks.json'
import endings from '../data/endings.json'

const files = import.meta.glob('../data/story/**/*.json', { eager: true, import: 'default' })

const chapters = {}
for (const [path, chapter] of Object.entries(files)) {
  if (!chapter?.id) {
    console.warn(`[story] ${path} has no "id", skipped`)
    continue
  }
  chapters[chapter.id] = chapter
}

export const storyCtx = { chapters, characters, callbacks, endings }

// The chapter a new game starts on.
export const FIRST_CHAPTER = 'ch1_jjc'
