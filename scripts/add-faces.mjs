// Draws faces onto the people: eyes (with a small highlight), eyebrows and a
// mouth for the RPG-pack bodies, whose faces came blank without their
// texture; a clear mouth for the Men / Women pack bodies, whose lips are the
// same colour as their skin.
//
//   node scripts/add-faces.mjs          (npm run assets:faces)
//   then: npm run assets:slim && npm run assets:crowd
//
// Each feature is a small flat shape pressed onto the face: every corner is
// dropped onto the skin from the front, then lifted a hair off it, so it
// follows the curve of the face. The shapes are added to the body's own mesh
// and ride on the Head bone, so they move with the head, cost no extra draw
// call, and are coloured like any other part (see look.js):
//   eyes   "eyes"  (the energy meter turns them red)
//   shine  "shine" (white)
//   brows  "hair"
//   mouth  "mouth" (a darker shade of the skin)
// Features land only on skin: a beard or a mask in front simply hides them.
//
// Safe to run again: the previous features are removed first (peopleIndex
// remembers where they start).

import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const DIR = path.join(ROOT, 'public/assets')
const INDEX = path.join(ROOT, 'src/assets/peopleIndex.json')

// Sizes are fractions of the head's width (W); heights (y) are fractions of
// the face from chin (0) to the top of the skin (1).
const CHIBI = {
  eyes: { x: 0.2, y: 0.42, w: 0.1, h: 0.15 },
  shine: { dx: 0.022, dy: 0.035, r: 0.028 },
  brows: { dy: 0.13, w: 0.15, h: 0.03, tilt: 0.025 },
  mouth: { y: 0.2, w: 0.16, h: 0.03, smile: 0.025 },
}
const STYLE = {
  rpg_cleric: { ...CHIBI, eyes: { ...CHIBI.eyes, y: 0.36 }, mouth: { ...CHIBI.mouth, y: 0.22 } },
  rpg_monk: CHIBI,
  rpg_ranger: CHIBI,
  // the pack's face mask is worn as his face (scripts/import-rpg-characters.mjs); the hood comes down low
  rpg_rogue: { ...CHIBI, eyes: { ...CHIBI.eyes, y: 0.3 }, brows: { ...CHIBI.brows, dy: 0.11 }, mouth: { ...CHIBI.mouth, y: 0.11 } },
  rpg_warrior: CHIBI,
  rpg_wizard: CHIBI,
}
// Men / Women pack: eyes and brows are modelled; add a mouth, placed
// between the chin and the eyes
const ADULT_MOUTH = { between: 0.36, w: 0.2, h: 0.022, smile: 0.012 }

console.warn = () => {}
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b
      this.onloadend?.()
    })
  }
}

async function load(file) {
  const b = fs.readFileSync(file)
  return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')).scene
}

// plain float copies of every attribute (the slimmed files store bytes)
function toPlain(g) {
  const out = {}
  for (const [name, a] of Object.entries(g.attributes)) {
    const arr = new Float32Array(a.count * a.itemSize)
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) arr[i * a.itemSize + k] = a.getComponent(i, k)
    out[name] = { arr, size: a.itemSize }
  }
  return { attrs: out, index: Array.from(g.index.array), count: g.attributes.position.count }
}

function dominant(plain, i) {
  const j = plain.attrs.skinIndex.arr
  const w = plain.attrs.skinWeight.arr
  let best = 0
  for (let k = 1; k < 4; k++) if (w[i * 4 + k] > w[i * 4 + best]) best = k
  return j[i * 4 + best]
}

async function addFace(id, entry) {
  const file = path.join(DIR, entry.file)
  const scene = await load(file)
  scene.updateMatrixWorld(true)
  let mesh = null
  scene.traverse((c) => c.isSkinnedMesh && !mesh && (mesh = c))
  const plain = toPlain(mesh.geometry)
  const matidName = plain.attrs.matid ? 'matid' : '_matid'
  let parts = entry.parts

  // remove what an earlier run added
  if (entry.face) {
    const from = entry.face.from
    for (const p of Object.values(plain.attrs)) p.arr = p.arr.slice(0, from * p.size)
    const kept = []
    for (let t = 0; t < plain.index.length; t += 3) if (plain.index[t] < from && plain.index[t + 1] < from && plain.index[t + 2] < from) kept.push(plain.index[t], plain.index[t + 1], plain.index[t + 2])
    plain.index = kept
    plain.count = from
    parts = parts.slice(0, entry.face.parts)
  }
  const from = plain.count
  const partsBefore = parts.length

  // rest pose, world space (bones are at rest right after loading)
  const head = mesh.skeleton.bones.findIndex((b) => b.name === 'Head')
  const toWorld = mesh.matrixWorld
  const world = (i, v) => v.fromArray(plain.attrs.position.arr, i * 3).applyMatrix4(toWorld)
  const skinIds = new Set(parts.map((p, i) => (p.slot === 'skin' ? i : -1)).filter((i) => i >= 0))
  const eyeIds = new Set(parts.map((p, i) => (p.slot === 'eyes' ? i : -1)).filter((i) => i >= 0))
  const matid = plain.attrs[matidName].arr

  // the skin of the head, as a mesh to drop the features onto
  const tri = []
  const box = new THREE.Box3()
  const eyeBox = new THREE.Box3()
  const v = new THREE.Vector3()
  for (let t = 0; t < plain.index.length; t += 3) {
    const ids = [plain.index[t], plain.index[t + 1], plain.index[t + 2]]
    if (!ids.every((i) => dominant(plain, i) === head)) continue
    const part = Math.round(matid[ids[0]])
    if (eyeIds.has(part)) for (const i of ids) eyeBox.expandByPoint(world(i, v))
    if (!skinIds.has(part)) continue
    for (const i of ids) {
      world(i, v)
      tri.push(v.x, v.y, v.z)
      box.expandByPoint(v)
    }
  }
  const skinGeo = new THREE.BufferGeometry()
  skinGeo.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3))
  const skin = new THREE.Mesh(skinGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
  skin.updateMatrixWorld(true)
  const W = box.max.x - box.min.x
  const H = box.max.y - box.min.y
  const cx = mesh.skeleton.bones[head].getWorldPosition(new THREE.Vector3()).x
  const ray = new THREE.Raycaster()
  const down = new THREE.Vector3(0, 0, -1)
  const eps = 0.012 * W

  // drop a point (x, y) onto the face; null if it misses the skin
  const press = (x, y, lift = 1) => {
    ray.set(new THREE.Vector3(x, y, box.max.z + W), down)
    const hit = ray.intersectObject(skin, false)[0]
    if (!hit) return null
    const n = hit.face.normal.clone()
    if (n.z < 0) n.negate()
    return { p: hit.point.clone().addScaledVector(n, eps * lift), n }
  }

  const add = { pos: [], nor: [], part: [], idx: [] }
  const shape = (outline, partIndex, lift = 1) => {
    // outline: [[x, y], ...] around a centre; drawn as a fan from its average
    const c = outline.reduce((a, [x, y]) => [a[0] + x / outline.length, a[1] + y / outline.length], [0, 0])
    const pts = [c, ...outline].map(([x, y]) => press(x, y, lift))
    if (pts.some((p) => !p)) return false
    const base = from + add.pos.length / 3
    for (const { p, n } of pts) {
      add.pos.push(p.x, p.y, p.z)
      add.nor.push(n.x, n.y, n.z)
      add.part.push(partIndex)
    }
    for (let k = 1; k <= outline.length; k++) add.idx.push(base, base + k, base + (k % outline.length) + 1)
    return true
  }
  const strip = (points, partIndex, half, lift = 1) => {
    // a thick line through points (eyebrow, mouth); quads facing the viewer
    const top = points.map(([x, y]) => press(x, y + half, lift))
    const bot = points.map(([x, y]) => press(x, y - half, lift))
    if ([...top, ...bot].some((p) => !p)) return false
    const base = from + add.pos.length / 3
    for (const { p, n } of [...top, ...bot]) {
      add.pos.push(p.x, p.y, p.z)
      add.nor.push(n.x, n.y, n.z)
      add.part.push(partIndex)
    }
    const m = points.length
    for (let k = 0; k < m - 1; k++) add.idx.push(base + k, base + m + k, base + k + 1, base + k + 1, base + m + k, base + m + k + 1)
    return true
  }
  const oval = (x, y, w, h, n = 10) => Array.from({ length: n }, (_, k) => [x + (w / 2) * Math.cos((k / n) * Math.PI * 2), y + (h / 2) * Math.sin((k / n) * Math.PI * 2)])
  const curve = (x, y, w, bend, tilt, n = 7) => Array.from({ length: n }, (_, k) => {
    const s = (k / (n - 1)) * 2 - 1 // -1 .. 1 across
    return [x + (s * w) / 2, y + bend * s * s + tilt * s]
  })
  const partOf = (slot, name, color) => {
    let i = parts.findIndex((p, k) => k >= partsBefore && p.slot === slot)
    if (i < 0 && slot === 'hair') i = parts.findIndex((p) => p.slot === 'hair')
    if (i < 0) {
      parts = [...parts, { name, slot, color }]
      i = parts.length - 1
    }
    return i
  }

  const placed = []
  const style = STYLE[id]
  if (style) {
    const { eyes, shine, brows, mouth } = style
    const ey = box.min.y + eyes.y * H
    for (const side of [-1, 1]) {
      const ex = cx + side * eyes.x * W
      if (shape(oval(ex, ey, eyes.w * W, eyes.h * W), partOf('eyes', 'Eyes', '#0a0606'))) placed.push('eye')
      shape(oval(ex + shine.dx * W, ey + shine.dy * W, shine.r * 2 * W, shine.r * 2 * W, 8), partOf('shine', 'EyeShine', '#ffffff'), 2)
      if (strip(curve(ex, ey + brows.dy * W, brows.w * W, 0, side * brows.tilt * W, 5), partOf('hair', 'Brows', '#161110'), (brows.h * W) / 2)) placed.push('brow')
    }
    if (strip(curve(cx, box.min.y + mouth.y * H, mouth.w * W, mouth.smile * W, 0), partOf('mouth', 'Mouth', '#3a1a14'), (mouth.h * W) / 2)) placed.push('mouth')
  } else if (!eyeBox.isEmpty()) {
    const eyeY = eyeBox.getCenter(new THREE.Vector3()).y
    const m = ADULT_MOUTH
    const my = box.min.y + (eyeY - box.min.y) * m.between
    if (strip(curve(cx, my, m.w * W, m.smile * W, 0), partOf('mouth', 'Mouth', '#3a1a14'), (m.h * W) / 2)) placed.push('mouth')
  }

  // ---- append to the mesh (in its own space, riding on the Head bone) ----
  const toLocal = new THREE.Matrix4().copy(toWorld).invert()
  const nLocal = new THREE.Matrix3().getNormalMatrix(toLocal)
  const n = add.pos.length / 3
  const grow = (name, values) => {
    const p = plain.attrs[name]
    const arr = new Float32Array(p.arr.length + values.length)
    arr.set(p.arr)
    arr.set(values, p.arr.length)
    p.arr = arr
  }
  const pos = []
  const nor = []
  for (let i = 0; i < n; i++) {
    v.fromArray(add.pos, i * 3).applyMatrix4(toLocal)
    pos.push(v.x, v.y, v.z)
    v.fromArray(add.nor, i * 3).applyMatrix3(nLocal).normalize()
    nor.push(v.x, v.y, v.z)
  }
  grow('position', pos)
  grow('normal', nor)
  grow('skinIndex', Array.from({ length: n * 4 }, (_, k) => (k % 4 === 0 ? head : 0)))
  grow('skinWeight', Array.from({ length: n * 4 }, (_, k) => (k % 4 === 0 ? 1 : 0)))
  grow(matidName, add.part)
  for (const name of Object.keys(plain.attrs)) if (!['position', 'normal', 'skinIndex', 'skinWeight', matidName].includes(name)) grow(name, new Array(n * plain.attrs[name].size).fill(0))

  const g = new THREE.BufferGeometry()
  for (const [name, p] of Object.entries(plain.attrs)) {
    const arr = name === 'skinIndex' ? Uint16Array.from(p.arr) : p.arr
    g.setAttribute(name === '_matid' ? 'matid' : name, new THREE.BufferAttribute(arr, p.size))
  }
  const index = [...plain.index, ...add.idx]
  g.setIndex(new THREE.BufferAttribute(from + n > 65535 ? Uint32Array.from(index) : Uint16Array.from(index), 1))
  mesh.geometry = g
  const glb = Buffer.from(await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true }))
  fs.writeFileSync(file, glb)
  return { parts, face: { from, parts: partsBefore }, placed, tris: add.idx.length / 3 }
}

const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'))
for (const [id, entry] of Object.entries(index.bodies)) {
  if (entry.hasFace) continue // Kenney Mini Characters come with their own faces
  const r = await addFace(id, entry)
  index.bodies[id] = { ...entry, parts: r.parts, face: r.face }
  console.log(`  ✓ ${id.padEnd(20)} ${r.placed.join(', ') || 'nothing placed'}  (+${r.tris} triangles)`)
}
fs.writeFileSync(INDEX, JSON.stringify(index, null, 1) + '\n')
console.log('Updated src/assets/peopleIndex.json')
