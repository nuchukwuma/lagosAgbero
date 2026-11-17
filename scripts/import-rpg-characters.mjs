// Imports the Quaternius RPG characters (Cleric, Monk, Ranger, Rogue,
// Warrior, Wizard) as extra bodies for the game's people.
//
// Usage:
//   npm run assets:rpg -- path/to/rpg-pack.zip      (or the FBX folder)
//   npm run assets:slim && npm run assets:crowd       (afterwards)
//
// The game's animations are made for the Men / Women pack skeleton. These
// bodies have a cousin skeleton (same bones, other names for the hands) but a
// different rest pose and much shorter limbs. So for each one we:
//   1. bend its skeleton until every limb points the way ours does at rest,
//      and bake the body in that pose;
//   2. bind it to a copy of OUR skeleton, with our bone orientations and its
//      own joint positions, so every clip in the game plays on it unchanged;
//   3. record how much shorter its legs are: the game scales the clips' hip
//      and foot movement by that (see Character.jsx);
//   4. merge everything into one mesh (one draw call), leave the weapons out,
//      and simplify the very detailed hair and beards;
//   5. the pack has no texture, so each texture island (a garment piece:
//      hood, sleeve, boot, face...) becomes a paintable part (skin, hair,
//      shirt, trousers, shoes, trim) like the other bodies.

import fs from 'node:fs'
import path from 'node:path'
import { unzipSync } from 'fflate'
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const OUT = path.join(ROOT, 'public/assets/characters/people')
const INDEX = path.join(ROOT, 'src/assets/peopleIndex.json')
const REFERENCE = path.join(OUT, 'male_casual.glb') // the skeleton every clip is made for

// How each region of each character is coloured by default. Regions come
// from the bone a texture island mostly follows (see regionOf), or from the
// name of a separate piece. Anything not listed uses DEFAULT_SLOTS.
const DEFAULT_SLOTS = {
  face: 'skin', hair: 'hair', eyes: 'eyes', neck: 'skin', torso: 'shirt', hips: 'trousers', upperArm: 'shirt', forearm: 'shirt',
  hands: 'skin', thigh: 'trousers', shin: 'trousers', feet: 'shoes', piece: 'accent',
}
const CHARACTERS = {
  'Cleric.fbx': { id: 'rpg_cleric', label: 'Robed', slots: { hips: 'shirt', ShoulderPads: 'shirt2' }, face: ['Head#0'], simplify: { Head: 800 } },
  'Monk.fbx': { id: 'rpg_monk', label: 'Elder', slots: { torso: 'skin', upperArm: 'skin', hips: 'trousers', hands: 'accent', Monk001: 'hair' }, simplify: { Monk001: 900 } },
  'Ranger.fbx': { id: 'rpg_ranger', label: 'Hunter', slots: { Cloak: 'shirt2', forearm: 'shirt2' }, hood: true, simplify: {} },
  'Rogue.fbx': { id: 'rpg_rogue', label: 'Hooded', slots: {}, faceShare: 1, hood: true, simplify: {} },
  'Warrior.fbx': { id: 'rpg_warrior', label: 'Guard', slots: { forearm: 'shirt2', ShoulderPadL: 'shirt2', ShoulderPadR: 'shirt2' }, simplify: { Face: 900 } },
  'Wizard.fbx': { id: 'rpg_wizard', label: 'Prophet', slots: { hips: 'shirt', thigh: 'shirt' }, simplify: { Face: 900 } },
}
const PART_DEFAULT_COLOR = { skin: '#6e4329', hair: '#161110', eyes: '#0a0606', shirt: '#d8d2c4', shirt2: '#8d6e4f', trousers: '#2c3e50', shoes: '#1e1e1e', accent: '#a0522d' }
const PART_NAME = { skin: 'Skin', hair: 'Hair', eyes: 'Eyes', shirt: 'Shirt', shirt2: 'Shirt2', trousers: 'Pants', shoes: 'Shoes', accent: 'Details' }

// our bone -> theirs (everything else has the same name)
const TO_RPG = { Bone: 'Root', PalmL: 'FistL', PalmR: 'FistR', MiddleHandL: 'Fist1L', MiddleHandR: 'Fist1R', FingersL: 'Fist2L', FingersR: 'Fist2R' }
const FROM_RPG = { ...Object.fromEntries(Object.entries(TO_RPG).map(([a, b]) => [b, a])), WeaponR: 'PalmR' }
const ours = (rpgName) => FROM_RPG[rpgName] || rpgName

// Which way each bone points at rest (towards this child): used to bend
// their skeleton into our rest pose.
const AIM = { Hips: 'Abdomen', Abdomen: 'Torso', Torso: 'Neck', Neck: 'Head' }
for (const s of ['L', 'R'])
  Object.assign(AIM, {
    [`Shoulder${s}`]: `UpperArm${s}`, [`UpperArm${s}`]: `LowerArm${s}`, [`LowerArm${s}`]: `Palm${s}`, [`Palm${s}`]: `MiddleHand${s}`,
    [`MiddleHand${s}`]: `Fingers${s}`, [`UpperLeg${s}`]: `LowerLeg${s}`, [`LowerLeg${s}`]: `Foot${s}`,
  })

const WEAPON = /sword|dagger|staff|bow|arrow|shield|mace|weapon/i

console.warn = () => {}
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b
      this.onloadend?.()
    })
  }
}

function collect(inputs) {
  const files = {}
  const add = (name, bytes) => (files[path.basename(name)] = new Uint8Array(bytes))
  for (const input of inputs) {
    if (fs.statSync(input).isDirectory()) {
      for (const f of fs.readdirSync(input, { recursive: true })) if (String(f).toLowerCase().endsWith('.fbx')) add(f, fs.readFileSync(path.join(input, f)))
    } else if (input.toLowerCase().endsWith('.zip')) {
      for (const [n, b] of Object.entries(unzipSync(new Uint8Array(fs.readFileSync(input))))) if (n.toLowerCase().endsWith('.fbx')) add(n, b)
    } else add(input, fs.readFileSync(input))
  }
  return files
}

const parseFbx = (bytes) => new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
async function loadReference() {
  const b = fs.readFileSync(REFERENCE)
  const gltf = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')
  return gltf.scene
}
const worldPos = (o) => o.getWorldPosition(new THREE.Vector3())
const worldQuat = (o) => o.getWorldQuaternion(new THREE.Quaternion())

// ---------- 1. bend their skeleton into our rest pose ----------
function matchRestPose(rpg, rpgBones, refBones) {
  for (const ref of refBones) {
    const aim = AIM[ref.name]
    const bone = rpgBones.get(TO_RPG[ref.name] || ref.name)
    const child = aim && rpgBones.get(TO_RPG[aim] || aim)
    const refChild = aim && refBones.find((b) => b.name === aim)
    if (!bone || !child || !refChild) continue
    rpg.updateMatrixWorld(true)
    const have = worldPos(child).sub(worldPos(bone)).normalize()
    const want = worldPos(refChild).sub(worldPos(ref)).normalize()
    const turn = new THREE.Quaternion().setFromUnitVectors(have, want)
    const world = turn.multiply(worldQuat(bone))
    bone.quaternion.copy(worldQuat(bone.parent).invert().multiply(world))
  }
  rpg.updateMatrixWorld(true)
}

// ---------- 2. bake every piece, in the new pose, into world space ----------
// returns pieces: { name, pos, nor, uv, skin: [[ourBone, weight] x4] per corner (or one bone for rigid pieces) }
function bakePieces(rpg) {
  const pieces = []
  const m = new THREE.Matrix4()
  const sum = new THREE.Matrix4()
  const nm = new THREE.Matrix3()
  rpg.traverse((c) => {
    if (!c.isMesh || WEAPON.test(c.name) || WEAPON.test(c.parent?.name || '')) return
    const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry
    const P = g.attributes.position
    if (!P || !P.count) return
    const N = g.attributes.normal
    const UV = g.attributes.uv
    const n = P.count
    const piece = { name: c.name, skinned: c.isSkinnedMesh, pos: new Float32Array(n * 3), nor: new Float32Array(n * 3), uv: new Float32Array(n * 2), joints: [], weights: [] }
    const v = new THREE.Vector3()
    const w = new THREE.Vector3()
    if (c.isSkinnedMesh) {
      c.skeleton.update()
      const SI = g.attributes.skinIndex
      const SW = g.attributes.skinWeight
      for (let i = 0; i < n; i++) {
        sum.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
        const joints = []
        const weights = []
        for (let k = 0; k < 4; k++) {
          const wt = SW.getComponent(i, k)
          const bi = SI.getComponent(i, k)
          joints.push(ours(c.skeleton.bones[bi].name))
          weights.push(wt)
          if (!wt) continue
          m.multiplyMatrices(c.skeleton.bones[bi].matrixWorld, c.skeleton.boneInverses[bi])
          for (let e = 0; e < 16; e++) sum.elements[e] += m.elements[e] * wt
        }
        // as three.js skins it: world = meshWorld * bindInverse * skin * bind * v
        m.copy(c.matrixWorld).multiply(c.bindMatrixInverse).multiply(sum).multiply(c.bindMatrix)
        v.fromBufferAttribute(P, i).applyMatrix4(m)
        w.fromBufferAttribute(N, i).applyMatrix3(nm.getNormalMatrix(m)).normalize()
        piece.pos.set([v.x, v.y, v.z], i * 3)
        piece.nor.set([w.x, w.y, w.z], i * 3)
        piece.joints.push(joints)
        piece.weights.push(weights)
      }
    } else {
      // a stiff piece (pouch, hair, beard...) riding on one bone
      let b = c.parent
      while (b && !b.isBone) b = b.parent
      const bone = ours(b ? b.name : 'Head')
      nm.getNormalMatrix(c.matrixWorld)
      for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(c.matrixWorld)
        w.fromBufferAttribute(N, i).applyMatrix3(nm).normalize()
        piece.pos.set([v.x, v.y, v.z], i * 3)
        piece.nor.set([w.x, w.y, w.z], i * 3)
        piece.joints.push([bone, bone, bone, bone])
        piece.weights.push([1, 0, 0, 0])
      }
    }
    if (UV) for (let i = 0; i < n; i++) piece.uv.set([UV.getX(i), UV.getY(i)], i * 2)
    pieces.push(piece)
  })
  return pieces
}

// ---------- 5. texture islands -> paintable parts ----------
function islands(piece) {
  const n = piece.pos.length / 3
  const tris = n / 3
  const parent = Int32Array.from({ length: tris }, (_, i) => i)
  const find = (x) => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]]
    return x
  }
  const seen = new Map()
  for (let i = 0; i < n; i++) {
    const k = `${piece.pos[i * 3].toFixed(3)},${piece.pos[i * 3 + 1].toFixed(3)},${piece.pos[i * 3 + 2].toFixed(3)}|${piece.uv[i * 2].toFixed(4)},${piece.uv[i * 2 + 1].toFixed(4)}`
    const t = Math.floor(i / 3)
    if (seen.has(k)) {
      const a = find(seen.get(k))
      const b = find(t)
      if (a !== b) parent[a] = b
    } else seen.set(k, t)
  }
  const ids = new Map()
  const islandOf = new Int32Array(tris)
  for (let t = 0; t < tris; t++) {
    const r = find(t)
    if (!ids.has(r)) ids.set(r, ids.size)
    islandOf[t] = ids.get(r)
  }
  return { count: ids.size, islandOf }
}

function regionOfBone(b) {
  if (/^Head/.test(b)) return 'head'
  if (/^Neck/.test(b)) return 'neck'
  if (/^(Torso|Abdomen)/.test(b)) return 'torso'
  if (/^(Hips|Body|Bone)/.test(b)) return 'hips'
  if (/^(Shoulder|UpperArm)/.test(b)) return 'upperArm'
  if (/^LowerArm/.test(b)) return 'forearm'
  if (/^(Palm|MiddleHand|Fingers|Thumb)/.test(b)) return 'hands'
  if (/^UpperLeg/.test(b)) return 'thigh'
  if (/^LowerLeg/.test(b)) return 'shin'
  if (/^Foot/.test(b)) return 'feet'
  return 'torso'
}

// (face: extra islands that are face, as "piece#island" from a DEBUG=1 run;
//  faceShare: how close to the best an island must score to count as face too)
//
// Faces: on the head, the island with the most surface facing forward in
// the face zone is the face (hair strands and hood rims stick out further
// but are thin); small islands sitting inside the face are eyes / mouth;
// everything else on the head is hair, a hood or a hat.
function classify(pieces, cfg, headPos) {
  const triPart = new Map() // piece -> slot name per triangle
  const all = pieces.map((p) => ({ p, ...islands(p) }))
  const candidates = [] // { piece, island, score }
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const nrm = new THREE.Vector3()
  for (const { p, count, islandOf } of all) {
    if (cfg.noFace?.includes(p.name)) continue
    const score = new Float32Array(count)
    for (let t = 0; t < islandOf.length; t++) {
      const i = t * 3
      const head = p.joints[i].some((j, k) => j === 'Head' && p.weights[i][k] > 0.5)
      if (!head) continue
      a.fromArray(p.pos, i * 3)
      b.fromArray(p.pos, i * 3 + 3)
      c.fromArray(p.pos, i * 3 + 6)
      const cx = (a.x + b.x + c.x) / 3
      const cy = (a.y + b.y + c.y) / 3
      if (Math.abs(cx - headPos.x) > 16 || cy < headPos.y + 5 || cy > headPos.y + 45) continue
      nrm.subVectors(c, b).cross(b.clone().sub(a))
      const area = nrm.length() / 2
      nrm.normalize()
      if (nrm.z < 0) nrm.negate() // winding can be either way; we only care that it faces front or back
      if (nrm.z > 0.55) score[islandOf[t]] += area * nrm.z
    }
    for (let s = 0; s < count; s++) if (score[s] > 0) candidates.push({ piece: p, island: s, score: score[s] })
  }
  candidates.sort((x, y) => y.score - x.score)
  if (process.env.DEBUG) console.log('   face candidates:', candidates.slice(0, 5).map((f) => `${f.piece.name}#${f.island}:${f.score.toFixed(0)}`).join(' '))
  // the best, and any other island nearly as big (a face can be split in two)
  const share = cfg.faceShare ?? 0.5
  const faces = candidates.filter((f) => f.score >= candidates[0].score * share || cfg.face?.includes(`${f.piece.name}#${f.island}`))
  for (const { p, count, islandOf } of all) {
    const tris = islandOf.length
    // per island: the bone most of its corners follow, its size and middle
    const votes = Array.from({ length: count }, () => new Map())
    const box = Array.from({ length: count }, () => new THREE.Box3())
    const size = new Float32Array(count)
    for (let t = 0; t < tris; t++) {
      const isl = islandOf[t]
      for (let k = 0; k < 3; k++) {
        const i = t * 3 + k
        const j = p.joints[i]
        const w = p.weights[i]
        let best = 0
        for (let q = 1; q < 4; q++) if (w[q] > w[best]) best = q
        votes[isl].set(j[best], (votes[isl].get(j[best]) || 0) + 1)
        box[isl].expandByPoint(new THREE.Vector3(p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]))
      }
      size[isl]++
    }
    const faceIslands = new Set(faces.filter((f) => f.piece === p).map((f) => f.island))
    const faceBox = new THREE.Box3()
    let faceSize = 0
    for (const s of faceIslands) {
      faceBox.union(box[s])
      faceSize = Math.max(faceSize, size[s])
    }
    const slotOf = new Array(count)
    for (let s = 0; s < count; s++) {
      const bone = [...votes[s].entries()].sort((a, b) => b[1] - a[1])[0][0]
      let region = regionOfBone(bone)
      if (!p.skinned) region = cfg.slots[p.name] ? p.name : region === 'head' ? 'head' : 'piece'
      if (region === 'head') {
        if (faceIslands.has(s)) region = 'face'
        else if (faceSize && size[s] < faceSize * 0.12 && faceBox.containsPoint(box[s].getCenter(new THREE.Vector3()))) region = 'eyes'
        else region = cfg.slots[p.name] && !p.skinned ? p.name : 'hair'
      }
      slotOf[s] = cfg.slots[region] || DEFAULT_SLOTS[region] || 'accent'
    }
    const per = new Array(tris)
    for (let t = 0; t < tris; t++) per[t] = slotOf[islandOf[t]]
    triPart.set(p, per)
  }
  return triPart
}

// ---------- 4. simplify the heavy stiff pieces (hair, beards) ----------
function simplifyPiece(p, partsPerTri, slotIndex, target) {
  const n = p.pos.length / 3
  const g = new THREE.BufferGeometry()
  // position + part only: with the normals in, every hard edge splits the
  // mesh apart and the simplifier shreds it; normals are rebuilt afterwards
  g.setAttribute('position', new THREE.BufferAttribute(p.pos, 3))
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) col[i * 3] = slotIndex.get(partsPerTri[Math.floor(i / 3)]) / 16
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const merged = mergeVertices(g)
  const remove = Math.max(0, merged.attributes.position.count - Math.round(target * 0.55))
  const s = new SimplifyModifier().modify(g, remove).toNonIndexed()
  s.computeVertexNormals() // flat per triangle; the game softens them (smoothNormals.js)
  const m = s.attributes.position.count
  const out = { ...p, pos: new Float32Array(m * 3), nor: new Float32Array(m * 3), joints: [], weights: [] }
  const parts = []
  for (let i = 0; i < m; i++) {
    out.pos.set([s.attributes.position.getX(i), s.attributes.position.getY(i), s.attributes.position.getZ(i)], i * 3)
    out.nor.set([s.attributes.normal.getX(i), s.attributes.normal.getY(i), s.attributes.normal.getZ(i)], i * 3)
    out.joints.push(p.joints[0])
    out.weights.push(p.weights[0])
    if (i % 3 === 0) {
      // a triangle takes the part most of its corners carry
      const ids = [0, 1, 2].map((k) => Math.round(s.attributes.color.getX(i + k) * 16))
      const id = ids[1] === ids[2] ? ids[1] : ids[0]
      parts.push([...slotIndex.entries()].find(([, v]) => v === id)[0])
    }
  }
  return { piece: out, parts }
}

async function convert(bytes, cfg, refScene) {
  const rpg = parseFbx(bytes)
  rpg.animations = []
  rpg.updateMatrixWorld(true)
  const rpgBones = new Map()
  rpg.traverse((c) => c.isBone && rpgBones.set(c.name, c))
  // the reference skeleton (ours), at rest
  const ref = SkeletonUtils.clone(refScene)
  ref.updateMatrixWorld(true)
  let refMesh = null
  ref.traverse((c) => c.isSkinnedMesh && !refMesh && (refMesh = c))
  const refBones = refMesh.skeleton.bones
  // our rig and theirs are both centred on the feet; line them up in size for the bending step
  matchRestPose(rpg, rpgBones, refBones)

  let pieces = bakePieces(rpg)
  const headPos = worldPos(rpgBones.get('Head'))
  let partsPerTri = classify(pieces, cfg, headPos)

  // slots used -> part list (stable order)
  const order = ['skin', 'eyes', 'hair', 'shirt', 'shirt2', 'trousers', 'shoes', 'accent']
  const used = new Set()
  for (const per of partsPerTri.values()) for (const s of per) used.add(s)
  const slots = order.filter((s) => used.has(s))
  const slotIndex = new Map(slots.map((s, i) => [s, i]))

  // simplify heavy pieces
  pieces = pieces.map((p) => {
    const target = process.env.NOSIMPLIFY ? 0 : cfg.simplify[p.name]
    if (!target || p.skinned || p.pos.length / 9 <= target) return p
    const r = simplifyPiece(p, partsPerTri.get(p), slotIndex, target)
    partsPerTri.set(r.piece, r.parts)
    return r.piece
  })

  // ---- the new skeleton: our bones and orientations, their joint positions ----
  const jointAt = (name) => {
    const b = rpgBones.get(TO_RPG[name] || name)
    return b ? worldPos(b) : null
  }
  for (const bone of refBones) {
    // parent-first (skeleton order is parent-first in these rigs)
    const pos = jointAt(bone.name) || worldPos(bone)
    const rot = worldQuat(bone)
    const scl = bone.getWorldScale(new THREE.Vector3())
    const world = new THREE.Matrix4().compose(pos, rot, scl)
    const local = new THREE.Matrix4().copy(bone.parent.matrixWorld).invert().multiply(world)
    local.decompose(bone.position, bone.quaternion, bone.scale)
    bone.updateMatrixWorld(true)
  }
  ref.updateMatrixWorld(true)

  // ---- one merged geometry, in the mesh's own space ----
  const boneIndex = new Map(refBones.map((b, i) => [b.name, i]))
  let total = 0
  for (const p of pieces) total += p.pos.length / 3
  const pos = new Float32Array(total * 3)
  const nor = new Float32Array(total * 3)
  const ji = new Uint16Array(total * 4)
  const jw = new Float32Array(total * 4)
  const matid = new Float32Array(total)
  const toLocal = new THREE.Matrix4().copy(refMesh.matrixWorld).invert()
  const nLocal = new THREE.Matrix3().getNormalMatrix(toLocal)
  const v = new THREE.Vector3()
  let at = 0
  for (const p of pieces) {
    const per = partsPerTri.get(p)
    const n = p.pos.length / 3
    for (let i = 0; i < n; i++, at++) {
      v.set(p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]).applyMatrix4(toLocal)
      pos.set([v.x, v.y, v.z], at * 3)
      v.set(p.nor[i * 3], p.nor[i * 3 + 1], p.nor[i * 3 + 2]).applyMatrix3(nLocal).normalize()
      nor.set([v.x, v.y, v.z], at * 3)
      let sum = 0
      for (let k = 0; k < 4; k++) {
        const idx = boneIndex.get(p.joints[i][k])
        ji[at * 4 + k] = idx ?? 0
        jw[at * 4 + k] = idx === undefined ? 0 : p.weights[i][k]
        sum += jw[at * 4 + k]
      }
      if (!sum) jw[at * 4] = 1
      else for (let k = 0; k < 4; k++) jw[at * 4 + k] /= sum
      matid[at] = slotIndex.get(per[Math.floor(i / 3)])
    }
  }
  let g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('skinIndex', new THREE.BufferAttribute(ji, 4))
  g.setAttribute('skinWeight', new THREE.BufferAttribute(jw, 4))
  g.setAttribute('matid', new THREE.BufferAttribute(matid, 1))
  g = mergeVertices(g, 1e-4)

  refMesh.geometry = g
  refMesh.material = new THREE.MeshStandardMaterial({ name: 'person' })
  refMesh.skeleton.calculateInverses()
  refMesh.bind(refMesh.skeleton, refMesh.matrixWorld)
  ref.traverse((c) => {
    if (c.isMesh && c !== refMesh) c.visible = false
  })

  // ---- 3. how the clips' hip and foot movement must shrink ----
  const refRest = await loadReference()
  refRest.updateMatrixWorld(true)
  const restOf = (o, name) => o.getObjectByName(name).position.toArray()
  const hipsOurs = refRest.getObjectByName('Body').getWorldPosition(new THREE.Vector3()).y
  const hipsTheirs = ref.getObjectByName('Body').getWorldPosition(new THREE.Vector3()).y
  const rig = { k: Number((hipsTheirs / hipsOurs).toFixed(4)), from: {}, to: {} }
  for (const b of ['Body', 'FootL', 'FootR']) {
    rig.from[b] = restOf(refRest, b).map((x) => Number(x.toFixed(4)))
    rig.to[b] = restOf(ref, b).map((x) => Number(x.toFixed(4)))
  }

  const box = new THREE.Box3()
  const tmp = new THREE.Vector3()
  for (let i = 0; i < pos.length; i += 3) box.expandByPoint(tmp.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(refMesh.matrixWorld))
  // head size for hats and glasses (src/game/characters/accessories.js is
  // measured on our bodies: a head 0.21 m wide on a 1.75 m person)
  const skull = new THREE.Box3()
  for (const p of pieces) {
    if (!p.skinned) continue
    for (let i = 0; i < p.pos.length / 3; i++) if (p.joints[i].some((j, k) => j === 'Head' && p.weights[i][k] > 0.5)) skull.expandByPoint(tmp.fromArray(p.pos, i * 3))
  }
  const headScale = (skull.max.x - skull.min.x) / (box.max.y - box.min.y) / (0.21 / 1.75)
  const glb = Buffer.from(await new GLTFExporter().parseAsync(ref, { binary: true, onlyVisible: true }))
  return {
    glb,
    parts: slots.map((s) => ({ name: PART_NAME[s], slot: s, color: PART_DEFAULT_COLOR[s] })),
    nativeHeight: box.max.y - box.min.y,
    tris: total / 3,
    rig,
    headScale: Number(headScale.toFixed(3)),
  }
}

async function main() {
  const inputs = process.argv.slice(2)
  if (!inputs.length) {
    console.error('Usage: npm run assets:rpg -- path/to/rpg-pack.zip')
    process.exit(1)
  }
  const files = collect(inputs)
  const refScene = await loadReference()
  const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'))
  for (const [src, cfg] of Object.entries(CHARACTERS)) {
    if (!files[src]) {
      console.log(`  - ${cfg.id.padEnd(14)} SKIPPED (${src} not found)`)
      continue
    }
    const r = await convert(files[src], cfg, refScene)
    fs.writeFileSync(path.join(OUT, `${cfg.id}.glb`), r.glb)
    index.bodies[cfg.id] = {
      file: `characters/people/${cfg.id}.glb`,
      source: `${src} (Quaternius RPG pack)`,
      label: cfg.label,
      parts: r.parts,
      nativeHeight: Number(r.nativeHeight.toFixed(2)),
      rig: r.rig,
      headScale: r.headScale,
      ...(cfg.hood ? { hood: true } : {}),
    }
    console.log(`  ✓ ${cfg.id.padEnd(14)} ${String(Math.round(r.glb.length / 1024)).padStart(4)} KB  ${Math.round(r.tris)} triangles  legs x${r.rig.k}  head x${r.headScale}  parts: ${r.parts.map((p) => p.slot).join(', ')}`)
  }
  fs.writeFileSync(INDEX, JSON.stringify(index, null, 1) + '\n')
  console.log('Updated src/assets/peopleIndex.json')
}

main()
