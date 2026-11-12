// Finds asset files the game no longer uses and (with --delete) removes them.
//
//   npm run assets:clean            dry run: lists what would be removed
//   npm run assets:clean -- --delete
//
// "Used" means: listed in the asset manifest AND (for MODELS) referenced by
// name somewhere in src/ (world JSON, vehicles.json, components...).
// Shared atlases, licences, character bodies, clips and extras always stay.

import fs from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const PUBLIC_ASSETS = path.join(ROOT, 'public', 'assets')
const DELETE = process.argv.includes('--delete')
const SKIP_SOURCES = new Set(['src/assets/assetManifest.js', 'src/assets/assetIndex.json', 'src/assets/peopleIndex.json', 'src/assets/clipIndex.json'])

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name)
    return d.isDirectory() ? walk(p, base) : [path.relative(base, p).split(path.sep).join('/')]
  })
}

async function main() {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  try {
    const m = await server.ssrLoadModule('/src/assets/assetManifest.js')
    const sources = walk(path.join(ROOT, 'src'), ROOT)
      .filter((f) => /\.(js|jsx|json)$/.test(f) && !SKIP_SOURCES.has(f) && !f.includes('.test.'))
      .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'))
      .join('\n')
    const usedModels = Object.keys(m.MODELS).filter((name) => new RegExp(`["'\`]${name}["'\`]`).test(sources))
    // models used only as parts of code-built things (keke wheels, stalls...)
    for (const r of Object.values(m.PROCEDURAL)) for (const part of r.parts) if (!usedModels.includes(part)) usedModels.push(part)
    const keep = new Set([
      ...usedModels.map((n) => m.MODELS[n].file),
      ...Object.values(m.CHARACTER.bodies).map((b) => b.file),
      ...Object.values(m.CHARACTER.clips).map((c) => c.file),
      ...Object.values(m.EXTRA_MODELS).map((e) => e.file),
      ...Object.values(m.ATLASES).flatMap((a) => Object.values(a)),
    ])
    const onDisk = walk(PUBLIC_ASSETS)
    const remove = onDisk.filter((f) => !keep.has(f) && !/License\.txt$/i.test(f))
    const bytes = remove.reduce((s, f) => s + fs.statSync(path.join(PUBLIC_ASSETS, f)).size, 0)
    const unusedModels = Object.keys(m.MODELS).filter((n) => !usedModels.includes(n))
    console.log(`Models used in the game: ${usedModels.length}/${Object.keys(m.MODELS).length}`)
    console.log(`Unused manifest models: ${unusedModels.join(', ') || 'none'}`)
    console.log(`Files to remove: ${remove.length} (${(bytes / 1048576).toFixed(1)} MB)`)
    for (const f of remove) console.log(`  ${f}`)
    if (DELETE) {
      for (const f of remove) fs.rmSync(path.join(PUBLIC_ASSETS, f))
      // drop empty folders
      for (const d of fs.readdirSync(PUBLIC_ASSETS, { recursive: true }).map((x) => path.join(PUBLIC_ASSETS, x)).filter((p) => fs.statSync(p).isDirectory()).sort((a, b) => b.length - a.length)) {
        if (!fs.readdirSync(d).length) fs.rmdirSync(d)
      }
      console.log('Deleted. Remove the unused names above from src/assets/assetManifest.js too.')
    }
  } finally {
    await server.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
