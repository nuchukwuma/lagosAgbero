// Imports Kenney's "Mini Characters" (CC0) as the game's people.
//
// Usage:
//   npm run assets:minis -- path/to/kenney_mini-characters.zip   (or the unzipped folder)
//   then: npm run assets:slim && npm run assets:crowd
//
// For each character:
//   1. head and body become ONE mesh (one draw call), on Kenney's own
//      7-bone skeleton (root, legs, torso, arms, head: blocky limbs);
//   2. the pack colours everything from one palette picture. Each palette
//      strip a character uses becomes a paintable part (skin, hair, eyes,
//      shirt, trousers, shoes...), so the story can dress people in its own
//      colours and skin tones; the strip's soft top-to-bottom gradient is
//      kept per corner ("shade") so recoloured people keep the toy look;
//   3. the texture is dropped: colours are vertex colours, like every other
//      person in the game (one shared material).
// Animations (written to public/assets/characters/clips/kenney/):
//   - the game's clips that Kenney animated too (walk, sprint, punch, kick,
//     pick-up, die...) use Kenney's own, made for these blocky bodies;
//   - every other clip (talk, argue, preach, cheer, block...) is converted
//     from the game's skeleton: each Kenney bone turns the way the matching
//     bone of ours turns, in world space.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { unzipSync } from 'fflate'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { WebIO, GLB_BUFFER } from '@gltf-transform/core'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const OUT = path.join(ROOT, 'public/assets/characters/people')
const CLIPS = path.join(ROOT, 'public/assets/characters/clips')
const CLIP_OUT = path.join(CLIPS, 'kenney')
const INDEX = path.join(ROOT, 'src/assets/peopleIndex.json')
const CLIP_INDEX = path.join(ROOT, 'src/assets/clipIndex.json')
const SETS = path.join(ROOT, 'src/assets/clipSets.json')
const REFERENCE = path.join(OUT, 'male_casual.glb') // the skeleton the game's clips are made for

// pack file -> game body
const BODIES = {
  'character-male-a': { id: 'mini_male_a', sex: 'male', label: 'Glasses' },
  'character-male-b': { id: 'mini_male_b', sex: 'male', label: 'Beard' },
  'character-male-c': { id: 'mini_male_c', sex: 'male', label: 'Uniform cap' },
  'character-male-d': { id: 'mini_male_d', sex: 'male', label: 'Suit' },
  'character-male-e': { id: 'mini_male_e', sex: 'male', label: 'Overalls' },
  'character-male-f': { id: 'mini_male_f', sex: 'male', label: 'T-shirt' },
  'character-male-g': { id: 'mini_male_g', sex: 'male', label: 'Eyepatch' },
  'character-worker': { id: 'mini_worker', sex: 'male', label: 'Hard hat' },
  'character-soldier': { id: 'mini_soldier', sex: 'male', label: 'Beanie' },
  'character-raider': { id: 'mini_raider', sex: 'male', label: 'Ponytail' },
  'character-female-a': { id: 'mini_female_a', sex: 'female', label: 'Top' },
  'character-female-b': { id: 'mini_female_b', sex: 'female', label: 'Headband' },
  'character-female-c': { id: 'mini_female_c', sex: 'female', label: 'Cap' },
  'character-female-d': { id: 'mini_female_d', sex: 'female', label: 'Suit' },
  'character-female-e': { id: 'mini_female_e', sex: 'female', label: 'Lab coat' },
  'character-female-f': { id: 'mini_female_f', sex: 'female', label: 'Long hair' },
}

// the game's clip -> Kenney's own animation (when Kenney made one)
const NATIVE = {
  breathingIdle: 'idle',
  walk: 'walk',
  run: 'sprint',
  pickUp: 'pick-up',
  punch: 'attack-melee-right',
  jabCombo: 'attack-melee-left',
  uppercut: 'attack-melee-right',
  kick: 'attack-kick-right',
  roundhouse: 'attack-kick-left',
  knockedOut: 'die',
  crouchIdle: 'crouch',
}

// Kenney bone <- our bone (for converting the other clips)
const FROM_OURS = { root: 'Body', 'leg-left': 'UpperLegL', 'leg-right': 'UpperLegR', torso: 'Torso', 'arm-left': 'UpperArmL', 'arm-right': 'UpperArmR', head: 'Head' }
const KENNEY_BONES = ['root', 'leg-left', 'leg-right', 'torso', 'arm-left', 'arm-right', 'head']
// how the game's accessories find bones on these bodies
const BONE_NAMES = { Head: 'head', Neck: 'torso', PalmL: 'arm-left', PalmR: 'arm-right', Body: 'root' }

// palette strips that are skin tones (columns 0-7 of the third row)
const SKIN_STRIPS = new Set([32, 33, 34, 35, 36, 37, 38, 39])
const DARK_LUMA = 0.16

console.warn = () => {}
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b
      this.onloadend?.()
    })
  }
}

// ---------- reading the pack ----------
function collect(input) {
  const files = {}
  if (fs.statSync(input).isDirectory()) {
    for (const f of fs.readdirSync(input, { recursive: true })) {
      const s = String(f)
      if (s.includes('GLB format') && (s.endsWith('.glb') || s.endsWith('colormap.png'))) files[path.basename(s)] = new Uint8Array(fs.readFileSync(path.join(input, s)))
    }
  } else {
    for (const [n, b] of Object.entries(unzipSync(new Uint8Array(fs.readFileSync(input))))) if (n.includes('GLB format') && (n.endsWith('.glb') || n.endsWith('colormap.png'))) files[path.basename(n)] = b
  }
  return files
}

// a small PNG reader (8-bit RGB / RGBA, not interlaced: what Kenney ships)
function readPng(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let at = 8
  let width = 0
  let height = 0
  let channels = 4
  const idat = []
  while (at < bytes.length) {
    const len = dv.getUint32(at)
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8))
    const data = bytes.subarray(at + 8, at + 8 + len)
    if (type === 'IHDR') {
      width = dv.getUint32(at + 8)
      height = dv.getUint32(at + 12)
      channels = { 2: 3, 6: 4 }[data[9]]
      if (data[8] !== 8 || !channels || data[12]) throw new Error('unsupported PNG')
    } else if (type === 'IDAT') idat.push(data)
    at += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const px = new Uint8Array(width * height * channels)
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]
    for (let x = 0; x < stride; x++) {
      const r = raw[y * (stride + 1) + 1 + x]
      const a = x >= channels ? px[y * stride + x - channels] : 0
      const b = y ? px[(y - 1) * stride + x] : 0
      const c = x >= channels && y ? px[(y - 1) * stride + x - channels] : 0
      const p = a + b - c
      const pr = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c
      px[y * stride + x] = (r + [0, a, b, (a + b) >> 1, pr][f]) & 255
    }
  }
  return { width, height, channels, px }
}

const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

// ---------- 1 + 2. one mesh, palette strips -> parts ----------
// The pack's GLB files point at the palette picture next to them; hand it over
// together with the file's own data.
function readGlb(io, bytes, png) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const jsonLen = dv.getUint32(12, true)
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLen)))
  const binAt = 20 + jsonLen
  const bin = bytes.subarray(binAt + 8, binAt + 8 + dv.getUint32(binAt, true))
  const resources = { [GLB_BUFFER]: bin }
  for (const img of json.images || []) if (img.uri) resources[img.uri] = png
  return io.readJSON({ json, resources })
}

async function convertBody(bytes, palette, io, png) {
  const doc = await readGlb(io, bytes, png)
  const root = doc.getRoot()
  const nodes = new Map(root.listNodes().map((n) => [n.getName(), n]))
  const skins = root.listSkins()
  const sample = (u, v) => {
    const x = Math.min(palette.width - 1, Math.max(0, Math.floor(u * palette.width)))
    const y = Math.min(palette.height - 1, Math.max(0, Math.floor(v * palette.height)))
    const i = (y * palette.width + x) * palette.channels
    return [palette.px[i] / 255, palette.px[i + 1] / 255, palette.px[i + 2] / 255]
  }
  const verts = [] // { p, n, j:[4], w:[4], strip, color, head }
  const tris = []
  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const skin = node.getSkin() || skins[0]
    const jointNames = skin.listJoints().map((j) => j.getName())
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute('POSITION')
      const N = prim.getAttribute('NORMAL')
      const UV = prim.getAttribute('TEXCOORD_0')
      const J = prim.getAttribute('JOINTS_0')
      const W = prim.getAttribute('WEIGHTS_0')
      const base = verts.length
      for (let i = 0; i < P.getCount(); i++) {
        const uv = UV.getElement(i, [])
        const j = J.getElement(i, []).map((k) => KENNEY_BONES.indexOf(jointNames[k]))
        const color = sample(uv[0], uv[1])
        const strip = Math.floor(uv[1] * 4) * 16 + Math.floor(uv[0] * 16)
        verts.push({ p: P.getElement(i, []), n: N.getElement(i, []), j, w: W.getElement(i, []), strip, color, head: node.getName().includes('head') })
      }
      const idx = prim.getIndices().getArray()
      for (const k of idx) tris.push(base + k)
    }
  }

  // where on the body each corner is: the face's dark bits (eyes, mouth),
  // the rest of the head (hair, hats, skin), or the body. A part is a palette
  // strip in one of those places, so the same strip can be eyes on the face
  // and a jacket on the body.
  const head = new THREE.Box3()
  for (const v of verts) if (v.head) head.expandByPoint(new THREE.Vector3(...v.p))
  const hw = head.max.x - head.min.x
  const hh = head.max.y - head.min.y
  for (const v of verts) {
    const dark = luma(v.color) < DARK_LUMA * 1.6
    const faceZone = v.p[1] < head.min.y + hh * 0.62 && Math.abs(v.p[0] - (head.min.x + head.max.x) / 2) < hw * 0.38
    const front = v.n[2] > 0.7 && faceZone
    v.region = v.head ? (front ? (dark ? 'face' : 'cheeks') : 'head') : 'body'
    v.key = `${v.strip}:${v.region}`
  }
  // Hair can share the face's palette strip (another shade of it): on the head,
  // corners of the face's strip whose shade is clearly not the face's are hair.
  const faceShade = new Map()
  for (const v of verts) {
    if (v.region !== 'cheeks') continue
    if (!faceShade.has(v.strip)) faceShade.set(v.strip, { sum: [0, 0, 0], n: 0 })
    const f = faceShade.get(v.strip)
    for (let k = 0; k < 3; k++) f.sum[k] += v.color[k]
    f.n++
  }
  for (const v of verts) {
    const f = v.region === 'head' && faceShade.get(v.strip)
    if (!f) continue
    const d = Math.hypot(...v.color.map((c, k) => c - f.sum[k] / f.n))
    if (d > 0.07) {
      v.region = 'hairline'
      v.key = `${v.strip}:hairline`
    }
  }
  const info = new Map()
  for (const v of verts) {
    if (!info.has(v.key)) info.set(v.key, { key: v.key, strip: v.strip, region: v.region, n: 0, front: 0, hands: 0, torso: 0, legs: 0, low: 0, sum: [0, 0, 0] })
    const s = info.get(v.key)
    s.n++
    if (v.n[2] > 0.7) s.front++
    const bone = KENNEY_BONES[v.j[v.w.indexOf(Math.max(...v.w))]]
    if (bone === 'arm-left' || bone === 'arm-right') s.hands++
    if (bone === 'torso') s.torso++
    if (bone === 'leg-left' || bone === 'leg-right') {
      s.legs++
      if (v.p[1] < 0.06) s.low++
    }
    for (let k = 0; k < 3; k++) s.sum[k] += v.color[k]
  }
  const strips = [...info.values()].map((s) => ({ ...s, color: s.sum.map((x) => x / s.n) }))
  const handStrips = new Set(strips.filter((s) => s.region === 'body' && s.hands && SKIN_STRIPS.has(s.strip)).map((s) => s.strip))
  // the face's own skin tone(s): ears, the top of a bald head and hands in the same tone are skin too
  const faceStrips = new Set(strips.filter((s) => s.region === 'cheeks').map((s) => s.strip))
  for (const f of faceStrips) if (SKIN_STRIPS.has(f)) handStrips.add(f)
  const body = strips.filter((s) => s.region === 'body' && !handStrips.has(s.strip))
  const shirt = [...body].sort((a, b) => b.torso - a.torso)[0]
  const pants = body.filter((s) => s.legs > s.torso).sort((a, b) => b.legs - a.legs)[0]
  const slotOf = new Map()
  for (const s of strips) {
    let slot
    if (s.region === 'face') {
      // the darkest bits on the front of the face: eyes and mouth, or a big dark beard
      const frontTotal = strips.filter((x) => x.region === 'cheeks' || x.region === 'face').reduce((a, x) => a + x.n, 0) || 1
      slot = s.n > frontTotal * 0.25 ? 'hair' : 'eyes'
    }
    else if (s.region === 'cheeks') {
      // the front of the face: skin; dark bits are eyes (or, when big, a beard); the rest glasses, masks
      const frontTotal = strips.filter((x) => x.region === 'cheeks' || x.region === 'face').reduce((a, x) => a + x.n, 0) || 1
      if (SKIN_STRIPS.has(s.strip)) slot = 'skin'
      else if (luma(s.color) < 0.35) slot = s.n > frontTotal * 0.25 ? 'hair' : 'eyes'
      else slot = 'accent'
    }
    else if (handStrips.has(s.strip) && (s.region === 'head' ? faceStrips.has(s.strip) : s.hands > 0)) slot = 'skin'
    else if (s.region === 'head' || s.region === 'hairline') slot = 'hair'
    else if (s === shirt) slot = 'shirt'
    else if (s === pants) slot = 'trousers'
    else if (s.legs && s.low > s.legs * 0.5) slot = 'shoes'
    else if (s.torso + s.hands > s.legs) slot = 'shirt2'
    else slot = 'accent'
    slotOf.set(s.key, slot)
  }
  // part list: one per strip and place (keeps the pack's own colours as defaults)
  // (the palette's numbers are screen colours: say so, or every colour comes out paler)
  const parts = strips.map((s) => ({ name: `strip${s.strip}-${s.region}`, slot: slotOf.get(s.key), color: `#${new THREE.Color().setRGB(...s.color, THREE.SRGBColorSpace).getHexString()}` }))
  const partIndex = new Map(strips.map((s, i) => [s.key, i]))

  // geometry
  const n = verts.length
  const pos = new Float32Array(n * 3)
  const nor = new Float32Array(n * 3)
  const ji = new Uint16Array(n * 4)
  const jw = new Float32Array(n * 4)
  const matid = new Float32Array(n)
  const shade = new Float32Array(n)
  verts.forEach((v, i) => {
    pos.set(v.p, i * 3)
    nor.set(v.n, i * 3)
    ji.set(v.j.map((x) => Math.max(0, x)), i * 4)
    jw.set(v.w, i * 4)
    matid[i] = partIndex.get(v.key)
    const base = strips[partIndex.get(v.key)].color
    shade[i] = Math.min(1, (luma(v.color) / Math.max(0.02, luma(base))) / 1.5) // stored /1.5 so it fits 0..1
  })
  let g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('skinIndex', new THREE.BufferAttribute(ji, 4))
  g.setAttribute('skinWeight', new THREE.BufferAttribute(jw, 4))
  g.setAttribute('matid', new THREE.BufferAttribute(matid, 1))
  g.setAttribute('shade', new THREE.BufferAttribute(shade, 1))
  g.setIndex(tris)
  g = mergeVertices(g, 1e-5)

  // skeleton (Kenney's rest pose: no rotations)
  const bones = {}
  for (const name of KENNEY_BONES) {
    const b = new THREE.Bone()
    b.name = name
    const node = nodes.get(name)
    b.position.fromArray(node.getTranslation())
    b.quaternion.fromArray(node.getRotation())
    bones[name] = b
  }
  for (const name of KENNEY_BONES) {
    const parent = nodes.get(name).getParentNode?.() || root.listNodes().find((p) => p.listChildren().includes(nodes.get(name)))
    if (parent && bones[parent.getName()]) bones[parent.getName()].add(bones[name])
  }
  const group = new THREE.Group()
  group.name = 'mini'
  group.add(bones.root)
  const mesh = new THREE.SkinnedMesh(g, new THREE.MeshStandardMaterial({ name: 'person' }))
  mesh.name = 'body'
  group.add(mesh)
  group.updateMatrixWorld(true)
  mesh.bind(new THREE.Skeleton(KENNEY_BONES.map((b) => bones[b])))
  const box = new THREE.Box3().setFromBufferAttribute(g.attributes.position)
  // head size for hats and glasses (accessories.js is measured on a 0.21 m head on a 1.75 m person)
  const headBox = new THREE.Box3()
  const v = new THREE.Vector3()
  for (let i = 0; i < g.attributes.position.count; i++) if (g.attributes.skinIndex.getX(i) === KENNEY_BONES.indexOf('head') && g.attributes.skinWeight.getX(i) > 0.5) headBox.expandByPoint(v.fromBufferAttribute(g.attributes.position, i))
  const height = box.max.y - box.min.y
  // the head box, measured from the head bone, as fractions of the height:
  // hats and glasses are fitted to it (accessories.js)
  const hb = bones.head.getWorldPosition(new THREE.Vector3())
  const headFit = {
    w: (headBox.max.x - headBox.min.x) / height,
    top: (headBox.max.y - hb.y) / height,
    d: (headBox.max.z - headBox.min.z) / height,
    cz: ((headBox.max.z + headBox.min.z) / 2 - hb.z) / height,
  }
  for (const k of Object.keys(headFit)) headFit[k] = Number(headFit[k].toFixed(4))
  const glb = Buffer.from(await new GLTFExporter().parseAsync(group, { binary: true }))
  return { glb, parts, nativeHeight: height, headScale: (headBox.max.x - headBox.min.x) / height / (0.21 / 1.75), head: headFit, tris: g.index.count / 3, rest: Object.fromEntries(KENNEY_BONES.map((b) => [b, bones[b].position.toArray()])) }
}

// ---------- 3. animations ----------
const FPS = 30

// Kenney's own animation, resampled into the game's clip format
function nativeClip(anim, loop) {
  const channels = anim.listChannels()
  const duration = Math.max(...channels.map((c) => c.getSampler().getInput().getMax([])[0]))
  const frames = Math.max(2, Math.round(duration * FPS) + 1)
  const sampleTrack = (ch, t, size) => {
    const s = ch.getSampler()
    const times = s.getInput().getArray()
    const vals = s.getOutput().getArray()
    let k = 0
    while (k < times.length - 2 && times[k + 1] < t) k++
    const a = times[k]
    const b = times[Math.min(k + 1, times.length - 1)]
    const f = b > a ? Math.min(1, Math.max(0, (t - a) / (b - a))) : 0
    const v0 = Array.from(vals.slice(k * size, k * size + size))
    const v1 = Array.from(vals.slice(Math.min(k + 1, times.length - 1) * size, Math.min(k + 1, times.length - 1) * size + size))
    if (size === 4) return new THREE.Quaternion().fromArray(v0).slerp(new THREE.Quaternion().fromArray(v1), f).toArray()
    return v0.map((x, i) => x + (v1[i] - x) * f)
  }
  const quaternions = KENNEY_BONES.map(() => [])
  const hipsPosition = []
  for (let i = 0; i < frames; i++) {
    const t = Math.min(duration, i / FPS)
    KENNEY_BONES.forEach((bone, bi) => {
      const ch = channels.find((c) => c.getTargetNode().getName() === bone && c.getTargetPath() === 'rotation')
      quaternions[bi].push(...(ch ? sampleTrack(ch, t, 4) : [0, 0, 0, 1]).map((x) => Number(x.toFixed(4))))
    })
    const tr = channels.find((c) => c.getTargetNode().getName() === 'root' && c.getTargetPath() === 'translation')
    hipsPosition.push(...(tr ? sampleTrack(tr, t, 3) : [0, 0, 0]).map((x) => Number(x.toFixed(4))))
  }
  return { fps: FPS, duration: Number(duration.toFixed(3)), loop, bones: KENNEY_BONES, quaternions, hipBone: 'root', hipsPosition, positions: {}, source: `kenney:${anim.getName()}` }
}

// one of the game's clips, turned to drive Kenney's bones
function convertClip(data, ref, refRest, kRest, legRatio) {
  const bones = new Map()
  ref.traverse((o) => o.isBone && bones.set(o.name, o))
  const frames = data.hipsPosition.length / 3
  const restWorld = {}
  ref.updateMatrixWorld(true)
  const restHips = bones.get('Body').getWorldPosition(new THREE.Vector3())
  for (const [, ours] of Object.entries(FROM_OURS)) restWorld[ours] = bones.get(ours).getWorldQuaternion(new THREE.Quaternion())
  const quaternions = KENNEY_BONES.map(() => [])
  const hipsPosition = []
  for (let f = 0; f < frames; f++) {
    // pose our skeleton
    for (const [name, rest] of refRest) {
      const b = bones.get(name)
      b.quaternion.copy(rest.q)
      b.position.copy(rest.p)
    }
    data.bones.forEach((name, i) => bones.get(name)?.quaternion.fromArray(data.quaternions[i], f * 4))
    bones.get(data.hipBone || 'Body')?.position.fromArray(data.hipsPosition, f * 3)
    ref.updateMatrixWorld(true)
    // each Kenney bone turns (in the world) the way its partner of ours does
    const world = {}
    for (const [k, ours] of Object.entries(FROM_OURS)) world[k] = bones.get(ours).getWorldQuaternion(new THREE.Quaternion()).multiply(restWorld[ours].clone().invert())
    const local = {
      root: world.root,
      'leg-left': world.root.clone().invert().multiply(world['leg-left']),
      'leg-right': world.root.clone().invert().multiply(world['leg-right']),
      torso: world.root.clone().invert().multiply(world.torso),
      'arm-left': world.torso.clone().invert().multiply(world['arm-left']),
      'arm-right': world.torso.clone().invert().multiply(world['arm-right']),
      head: world.torso.clone().invert().multiply(world.head),
    }
    KENNEY_BONES.forEach((b, i) => quaternions[i].push(...local[b].toArray().map((x) => Number(x.toFixed(4)))))
    // the hips' movement, scaled to the short legs; never sinking far into the ground
    const d = bones.get('Body').getWorldPosition(new THREE.Vector3()).sub(restHips).multiplyScalar(legRatio)
    d.y = Math.max(d.y, -kRest.torso[1] * 0.35)
    hipsPosition.push(...[d.x, d.y, d.z].map((x) => Number(x.toFixed(4))))
  }
  return { fps: data.fps, duration: data.duration, loop: data.loop, bones: KENNEY_BONES, quaternions, hipBone: 'root', hipsPosition, positions: {}, source: 'converted' }
}

async function main() {
  const input = process.argv[2]
  if (!input) {
    console.error('Usage: npm run assets:minis -- path/to/kenney_mini-characters.zip')
    process.exit(1)
  }
  const files = collect(input)
  const palette = readPng(files['colormap.png'])
  const io = new WebIO()
  const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'))
  let kRest = null
  for (const [file, cfg] of Object.entries(BODIES)) {
    const bytes = files[`${file}.glb`]
    if (!bytes) {
      console.log(`  - ${cfg.id.padEnd(14)} SKIPPED (${file}.glb not found)`)
      continue
    }
    const r = await convertBody(bytes, palette, io, files['colormap.png'])
    kRest = kRest || r.rest
    fs.writeFileSync(path.join(OUT, `${cfg.id}.glb`), r.glb)
    index.bodies[cfg.id] = {
      file: `characters/people/${cfg.id}.glb`,
      source: `${file}.glb (Kenney Mini Characters)`,
      label: cfg.label,
      sex: cfg.sex,
      parts: r.parts,
      nativeHeight: Number(r.nativeHeight.toFixed(4)),
      clipSet: 'kenney',
      heightScale: 0.85, // chibis stand a little shorter than the game's 1.75 m people
      bones: BONE_NAMES,
      headScale: Number(r.headScale.toFixed(3)),
      head: r.head,
      hasFace: true,
    }
    const slots = [...new Set(r.parts.map((p) => p.slot))].join(', ')
    console.log(`  ✓ ${cfg.id.padEnd(14)} ${String(Math.round(r.glb.length / 1024)).padStart(4)} KB  ${r.tris} triangles  parts: ${slots}`)
  }
  fs.writeFileSync(INDEX, JSON.stringify(index, null, 1) + '\n')

  // clips
  fs.mkdirSync(CLIP_OUT, { recursive: true })
  const clipIndex = JSON.parse(fs.readFileSync(CLIP_INDEX, 'utf8'))
  const anyBody = files['character-male-a.glb']
  const doc = await readGlb(io, anyBody, files['colormap.png'])
  const anims = new Map(doc.getRoot().listAnimations().map((a) => [a.getName(), a]))
  const refBytes = fs.readFileSync(REFERENCE)
  const ref = (await new GLTFLoader().parseAsync(refBytes.buffer.slice(refBytes.byteOffset, refBytes.byteOffset + refBytes.byteLength), '')).scene
  const refRest = new Map()
  ref.traverse((o) => o.isBone && refRest.set(o.name, { q: o.quaternion.clone(), p: o.position.clone() }))
  ref.updateMatrixWorld(true)
  const ourHips = ref.getObjectByName('Body').getWorldPosition(new THREE.Vector3()).y
  // Kenney sizes are in metres already; the game scales each body to its own height
  const legRatio = (kRest.torso[1] / ourHips) * 1
  const sets = { kenney: { dir: 'characters/clips/kenney', speeds: {} } }
  let native = 0
  let converted = 0
  for (const [name, info] of Object.entries(clipIndex.clips)) {
    let clip
    if (NATIVE[name] && anims.has(NATIVE[name])) {
      clip = nativeClip(anims.get(NATIVE[name]), info.loop)
      native++
    } else {
      const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/assets', info.file), 'utf8'))
      clip = convertClip(data, ref, refRest, kRest, legRatio)
      converted++
    }
    fs.writeFileSync(path.join(CLIP_OUT, `${name}.json`), JSON.stringify(clip))
  }
  // how fast the walk and sprint carry a body of Kenney's size (for the feet not to slide)
  // (metres a second at the game's scale, checked by eye: blocky legs, quick steps)
  sets.kenney.speeds = { walk: 1.35, run: 3.3, startWalk: 1.35, sneak: 0.9, crouchWalk: 0.9, drunkWalk: 1.1, goofyRun: 3.0 }
  fs.writeFileSync(SETS, JSON.stringify(sets, null, 1) + '\n')
  console.log(`Clips: ${native} from Kenney, ${converted} converted. Wrote ${path.relative(ROOT, CLIP_OUT)}/ and src/assets/clipSets.json`)
}

main()
