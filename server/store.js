// Where Lagos Online keeps its players: a JSON file, written a moment after
// anything changes (and on shutdown). Fine for a small world; swap for a
// database when it grows (keep the same { players, save() } shape).
import fs from 'fs'
import path from 'path'

export function fileStore(file) {
  let players = {}
  try {
    players = JSON.parse(fs.readFileSync(file, 'utf8')).players || {}
  } catch {
    players = {}
  }
  let timer = null
  const flush = () => {
    timer = null
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify({ players }))
    fs.renameSync(tmp, file) // never a half-written file
  }
  return {
    players,
    save() {
      if (!timer) timer = setTimeout(flush, 1000)
    },
    flush() {
      clearTimeout(timer)
      flush()
    },
  }
}

/** For tests: everything in memory. */
export const memoryStore = () => ({ players: {}, save() {}, flush() {} })
