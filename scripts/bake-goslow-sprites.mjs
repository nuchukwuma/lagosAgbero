// Bake the Go-Slow vehicle sprites from the game's 3D vehicles.
//   npx vite --port 5179 &   (the dev server)
//   node scripts/bake-goslow-sprites.mjs [http://localhost:5179]
// Writes public/assets/goslow/vehicles.png and src/game/modes/arcade/games/goslowSprites.json.
/* global document, Image */ // (inside page.evaluate: runs in the browser)
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const KINDS = [
  { name: 'danfo', kind: 'danfo', slogan: 'NO TELLING' },
  { name: 'molue', kind: 'molue' },
  { name: 'taxi', kind: 'taxi' },
  { name: 'car', kind: 'privateCar' },
  { name: 'suv', kind: 'bigManSuv' },
  { name: 'lorry', kind: 'lorry' },
  { name: 'truck', kind: 'boxTruck' },
  { name: 'keke', kind: 'keke', color: '#2e9e4f', rider: 'sunday' },
  { name: 'okada', kind: 'okada', color: '#c0392b', rider: 'scatter' },
  { name: 'convoy', kind: 'taskForceVan' },
]

async function main() {
  const url = process.argv[2] || 'http://localhost:5179'
  const root = path.join(__dirname, '..')
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const p = await (await b.newContext({ viewport: { width: 400, height: 400 } })).newPage()
  p.on('pageerror', (e) => console.log('page error', e.message))
  await p.goto(`${url}/?bench`)
  await p.waitForSelector('.title-screen')
  const res = await p.evaluate(async (kinds) => {
    const { bake } = await import('/src/dev/bakeVehicles.jsx')
    const r = await bake({ kinds })
    // pack: one row per vehicle, one column per heading, each frame trimmed to the same box
    const imgs = {}
    for (const [name, urls] of Object.entries(r.rows)) imgs[name] = await Promise.all(urls.map((u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = u })))
    const names = Object.keys(imgs)
    const atlas = document.createElement('canvas')
    atlas.width = r.cell * r.headings
    atlas.height = r.cell * names.length
    const g = atlas.getContext('2d')
    names.forEach((n, row) => imgs[n].forEach((im, h) => g.drawImage(im, h * r.cell, row * r.cell)))
    return { png: atlas.toDataURL('image/png'), meta: { cell: r.cell, ppm: r.ppm, headings: r.headings, rows: names } }
  }, KINDS)
  const outDir = path.join(root, 'public/assets/goslow')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'vehicles.png'), Buffer.from(res.png.split(',')[1], 'base64'))
  const meta = { source: "the game's own 3D vehicles (Kenney Car Kit models, danfo/keke/okada from the game), isometric", ...res.meta, kinds: Object.fromEntries(KINDS.map((k) => [k.name, k.kind])) }
  fs.writeFileSync(path.join(root, 'src/game/modes/arcade/games/goslowSprites.json'), JSON.stringify(meta, null, 1) + '\n')
  console.log('baked', meta.rows.length, 'vehicles x', meta.headings)
  await b.close()
}

main()
