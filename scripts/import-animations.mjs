// Imports Mixamo animations and retargets them onto our characters
// (the Men / Women packs: they share one 31-bone skeleton).
//
// Usage:
//   npm run assets:animations -- a1.zip a2.zip a3.zip a4.rar a5.zip "Breathing Idle.fbx" Walking.fbx
//   (any mix of .zip, .rar, folders or single .fbx files)
//   Clips whose source isn't given are kept, so one pack can be added alone:
//   npm run assets:animations -- path/to/rpg-pack/Cleric.fbx
//
// Why this exists:
//   The Mixamo files were exported "with skin" on Mixamo's own Beta character,
//   so each is ~2 MB and uses a different skeleton (mixamorig*, 65 bones) from
//   our people (31 bones, different names, arms-down rest pose instead of a
//   T-pose, and feet that hang off the root bone). We can't just play them.
//   This script, for every clip in CLIPS below:
//     1. picks the real clip (some files start with an empty "Take 001"),
//     2. samples it at FPS frames per second,
//     3. retargets each bone: "how far did the Mixamo bone turn away from its
//        T-pose?" is applied as the same world-space turn to our bone, after
//        first lining our bone up with Mixamo's T-pose direction,
//     3b. moves each foot with the end of its lower leg (the feet are not
//        children of the legs in this rig),
//     4. removes forward drift for in-place clips (the game moves the body),
//        and records how far the clip wanted to travel (rootMotion),
//     5. optionally cuts out one clean loop (findLoop),
//     6. writes a small JSON clip to public/assets/characters/clips/ and the
//        list to src/assets/clipIndex.json (read by the asset manifest).

import fs from 'node:fs'
import path from 'node:path'
import { unzipSync } from 'fflate'
import { createExtractorFromData } from 'node-unrar-js'
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
// The target skeleton: any converted body works (they share one skeleton).
// Run `npm run assets:characters` first.
const BODY = path.join(ROOT, 'public/assets/characters/people/male_casual.glb')
const OUT_DIR = path.join(ROOT, 'public/assets/characters/clips')
const INDEX = path.join(ROOT, 'src/assets/clipIndex.json')
const DEFAULT_FPS = 24
const DECIMALS = 4

// game name -> source file and how to treat it
const CLIPS = {
  // street / story
  breathingIdle: { file: 'Breathing Idle.fbx', loop: true, inPlace: true, fps: 15, use: 'Default standing idle for everyone' },
  walk: { file: 'Walking.fbx', loop: true, inPlace: true, use: 'Normal walk' },
  startWalk: { file: 'Start Walking.fbx', loop: false, inPlace: true, use: 'Spare: idle-to-walk start' },
  drunkWalk: { file: 'Drunk Walk.fbx', loop: true, inPlace: true, use: 'Low-energy stagger, red-eye side effects' },
  run: { file: 'Running.fbx', loop: true, inPlace: true, use: 'Run (street, chases)' },
  goofyRun: { file: 'Goofy Running.fbx', loop: true, inPlace: true, use: 'Comic panic run (fleeing defaulters, runner mode)' },
  sneak: { file: 'Crouch Walk Forward.fbx', loop: true, inPlace: true, use: 'Sneaking during raids' },
  crouchWalk: { file: 'Crouched Walking.fbx', loop: true, inPlace: true, use: 'Alternative sneak' },
  crouchDown: { file: 'Crouching.fbx', loop: false, inPlace: false, use: 'Duck down to hide' },
  crouchIdle: { file: 'Crouching Idle.fbx', loop: true, inPlace: true, use: 'Hiding behind a dumpster' },
  slide: { file: 'Running Slide.fbx', loop: false, inPlace: true, use: 'Runner-mode slide under obstacles' },
  talk: { file: 'Talking.fbx', loop: true, inPlace: true, use: 'Dialogue: speaker gesture' },
  argue: { file: 'Standing Arguing.fbx', loop: true, inPlace: true, findLoop: { from: 0.3, to: 3, minPeriod: 4, maxPeriod: 9 }, use: 'Dialogue: angry driver, haggling' },
  bumped: { file: 'Walking Hit Reaction.fbx', loop: false, inPlace: true, use: 'Bumped on the street' },
  turnLeft: { file: 'Walking Left Turn.fbx', loop: false, inPlace: true, use: 'Spare: walking turn' },
  // fight
  fightIdle: { file: 'Boxing.fbx', loop: true, inPlace: true, use: 'Fight stance' },
  punch: { file: 'Punching.fbx', loop: false, inPlace: true, use: 'Fight: punch' },
  jabCombo: { file: 'Jab To Elbow Punch.fbx', loop: false, inPlace: true, use: 'Fight: jab + elbow combo' },
  uppercut: { file: 'Uppercut Jab.fbx', loop: false, inPlace: true, use: 'Fight: uppercut' },
  kick: { file: 'Side Kick.fbx', loop: false, inPlace: true, use: 'Fight: kick' },
  roundhouse: { file: 'Roundhouse Kick.fbx', loop: false, inPlace: true, use: 'Fight: special move ("Lagos Roundabout")' },
  block: { file: 'Blocking.fbx', loop: false, inPlace: true, use: 'Fight: block' },
  blockInward: { file: 'Inward Block.fbx', loop: false, inPlace: true, use: 'Fight: block variation' },
  blockOutward: { file: 'Outward Block.fbx', loop: false, inPlace: true, use: 'Fight: parry / dodge' },
  bodyBlock: { file: 'Body Block.fbx', loop: false, inPlace: true, use: 'Fight: body block' },
  hit: { file: 'Hit Reaction.fbx', loop: false, inPlace: true, use: 'Fight: got hit' },
  takePunch: { file: 'Taking Punch.fbx', loop: false, inPlace: true, use: 'Fight: taking a beating (cutscenes)' },
  stunned: { file: 'Stunned.fbx', loop: false, inPlace: false, use: 'Fight: dizzy / stunned' },
  knockedOut: { file: 'Dying.fbx', loop: false, inPlace: false, use: 'Cartoon knock-out and energy collapse (no gore)' },
  fallFlail: { file: 'Falling.fbx', loop: true, inPlace: true, use: 'Flailing in the air (runner fall, thrown out)' },
  // From the Quaternius RPG pack (Cleric.fbx holds many clips: "clip" picks one).
  // That pack's rig is a cousin of our people's rig, so these retarget cleanly.
  roll: { file: 'Cleric.fbx', clip: 'Roll', rig: 'quaternius', loop: false, inPlace: true, fps: 30, use: 'Tuck-and-roll (runner, getting thrown)' },
  pickUp: { file: 'Cleric.fbx', clip: 'PickUp', rig: 'quaternius', loop: false, inPlace: true, fps: 30, use: 'Reach out and take something (a fee, a purchase)' },
  cheer: { file: 'Cleric.fbx', clip: 'Spell1', rig: 'quaternius', loop: false, inPlace: true, fps: 30, use: 'Arm up: winning a fight, hailing, blessing' },
  preach: { file: 'Cleric.fbx', clip: 'Spell2', rig: 'quaternius', loop: true, inPlace: true, fps: 30, use: 'Arms wide then up: preachers, the dibia, rally speakers' },
}

// Our bone -> Mixamo bone. "Body" is the pelvis (it carries the hip movement).
const BONE_MAP = {
  Body: 'Hips', Hips: 'Spine', Abdomen: 'Spine1', Torso: 'Spine2', Neck: 'Neck', Head: 'Head',
}
for (const [q, m] of [['L', 'Left'], ['R', 'Right']]) {
  Object.assign(BONE_MAP, {
    [`Shoulder${q}`]: `${m}Shoulder`, [`UpperArm${q}`]: `${m}Arm`, [`LowerArm${q}`]: `${m}ForeArm`, [`Palm${q}`]: `${m}Hand`,
    [`UpperLeg${q}`]: `${m}UpLeg`, [`LowerLeg${q}`]: `${m}Leg`, [`Foot${q}`]: `${m}Foot`,
  })
}
const HIP_BONE = 'Body'

// Our bone -> Quaternius RPG-pack bone: the same names, except the hands.
const Q_BONE_MAP = Object.fromEntries(Object.keys(BONE_MAP).map((b) => [b, b.replace(/^Palm/, 'Fist')]))

// To line up the rest poses we compare each bone's direction (towards the
// bone named here) with the matching Mixamo direction.
const DIRECTION = {
  Body: ['Torso', 'Spine2'], Hips: ['Abdomen', 'Spine1'], Abdomen: ['Torso', 'Spine2'], Torso: ['Neck', 'Neck'], Neck: ['Head', 'Head'],
}
for (const [q, m] of [['L', 'Left'], ['R', 'Right']]) {
  Object.assign(DIRECTION, {
    [`Shoulder${q}`]: [`UpperArm${q}`, `${m}Arm`], [`UpperArm${q}`]: [`LowerArm${q}`, `${m}ForeArm`], [`LowerArm${q}`]: [`Palm${q}`, `${m}Hand`],
    [`Palm${q}`]: [`MiddleHand${q}`, `${m}HandIndex1`], [`UpperLeg${q}`]: [`LowerLeg${q}`, `${m}Leg`], [`LowerLeg${q}`]: [`Foot${q}`, `${m}Foot`],
    [`Foot${q}`]: [`Foot${q}_end`, `${m}ToeBase`],
  })
}

const Q_DIRECTION = { Body: ['Torso', 'Torso'], Hips: ['Abdomen', 'Abdomen'], Abdomen: ['Torso', 'Torso'], Torso: ['Neck', 'Neck'], Neck: ['Head', 'Head'] }
for (const q of ['L', 'R']) {
  Object.assign(Q_DIRECTION, {
    [`Shoulder${q}`]: [`UpperArm${q}`, `UpperArm${q}`], [`UpperArm${q}`]: [`LowerArm${q}`, `LowerArm${q}`], [`LowerArm${q}`]: [`Palm${q}`, `Fist${q}`],
    [`Palm${q}`]: [`MiddleHand${q}`, `Fist1${q}`], [`UpperLeg${q}`]: [`LowerLeg${q}`, `LowerLeg${q}`], [`LowerLeg${q}`]: [`Foot${q}`, `Foot${q}`],
    [`Foot${q}`]: [`Foot${q}_end`, `Foot${q}_end`],
  })
}

// The source skeletons we can read. Mixamo is the default.
const RIGS = {
  mixamo: { prefix: 'mixamorig', map: BONE_MAP, direction: DIRECTION, hips: 'Hips', arms: ['RightArm', 'LeftArm'] },
  quaternius: { prefix: '', map: Q_BONE_MAP, direction: Q_DIRECTION, hips: 'Body', arms: ['UpperArmR', 'UpperArmL'] },
}

// Bones whose POSITION must follow another bone (feet hang off the root).
const FOLLOW = { FootL: 'LowerLegL', FootR: 'LowerLegR' }

// ---------- loading ----------
// FBXLoader logs harmless warnings in Node; keep the output readable.
const warn = console.warn
console.warn = () => {}

function parseFbx(bytes) {
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  return new FBXLoader().parse(buf, '')
}

async function collectFbx(inputs) {
  const files = {}
  const add = (name, bytes) => { files[path.basename(name)] = new Uint8Array(bytes) }
  for (const input of inputs) {
    const stat = fs.statSync(input)
    if (stat.isDirectory()) {
      for (const f of fs.readdirSync(input)) if (f.toLowerCase().endsWith('.fbx')) add(f, fs.readFileSync(path.join(input, f)))
    } else if (input.toLowerCase().endsWith('.zip')) {
      for (const [n, b] of Object.entries(unzipSync(new Uint8Array(fs.readFileSync(input))))) if (n.toLowerCase().endsWith('.fbx')) add(n, b)
    } else if (input.toLowerCase().endsWith('.rar')) {
      const data = Uint8Array.from(fs.readFileSync(input)).buffer
      const { files: list } = (await createExtractorFromData({ data })).extract()
      for (const f of list) if (!f.fileHeader.flags.directory && f.fileHeader.name.toLowerCase().endsWith('.fbx')) add(f.fileHeader.name, f.extraction)
    } else if (input.toLowerCase().endsWith('.fbx')) {
      add(input, fs.readFileSync(input))
    }
  }
  return files
}

// ---------- rig helpers ----------
const worldQuat = (o) => o.getWorldQuaternion(new THREE.Quaternion())
const worldPos = (o) => o.getWorldPosition(new THREE.Vector3())

function firstSkinnedMesh(root) {
  let mesh = null
  root.traverse((c) => { if (!mesh && c.isSkinnedMesh) mesh = c })
  return mesh
}

// Facing direction (yaw) of a rig, from its shoulders.
function facingYaw(get, rightName, leftName) {
  const right = worldPos(get(rightName)).sub(worldPos(get(leftName)))
  const forward = new THREE.Vector3(0, 1, 0).cross(right).normalize()
  return Math.atan2(forward.x, forward.z)
}

// A freshly parsed model is in its rest pose. (Don't call skeleton.pose():
// on some rigs it ignores scale/rotation on the root node and scrambles it.)
function prepareRig(root) {
  root.updateMatrixWorld(true)
  return firstSkinnedMesh(root)
}

// ---------- main retarget ----------
function retargetClip(target, source, clip, cfg) {
  const FPS = cfg.fps || DEFAULT_FPS
  const tBone = (n) => target.getObjectByName(n)
  const rig = RIGS[cfg.rig || 'mixamo']
  const BONE_MAP = rig.map // (shadows the Mixamo table above)
  const DIRECTION = rig.direction
  const sBone = (n) => source.getObjectByName(`${rig.prefix}${n}`)

  prepareRig(target)
  const sourceMesh = prepareRig(source)

  // Align facing: rotation that takes source-world directions into target-world.
  const align = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), facingYaw(tBone, 'UpperArmR', 'UpperArmL') - facingYaw((n) => sBone(n), rig.arms[0], rig.arms[1]))

  // Target bones in parent-first order, with rest data.
  const targetBones = []
  target.traverse((o) => { if (o.isBone) targetBones.push(o) })
  const rest = new Map()
  for (const b of targetBones) rest.set(b, { local: b.quaternion.clone(), pos: b.position.clone(), world: worldQuat(b) })
  const sourceRest = new Map()
  for (const [t, s] of Object.entries(BONE_MAP)) if (sBone(s)) sourceRest.set(t, worldQuat(sBone(s)).premultiply(align))

  // Rest-pose alignment: the turn that points our bone the way Mixamo's
  // T-pose bone points (our characters rest with arms down).
  const restAlign = new Map()
  for (const [t, [tChild, sChild]] of Object.entries(DIRECTION)) {
    const tb = tBone(t)
    const tc = tBone(tChild)
    const sb = sBone(BONE_MAP[t])
    const sc = sBone(sChild)
    if (!tb || !tc || !sb || !sc) continue
    const dt = worldPos(tc).sub(worldPos(tb)).normalize()
    const ds = worldPos(sc).sub(worldPos(sb)).applyQuaternion(align).normalize()
    restAlign.set(t, new THREE.Quaternion().setFromUnitVectors(dt, ds))
  }
  // where each follower sits relative to the bone it follows, at rest
  const followRest = {}
  for (const [f, lead] of Object.entries(FOLLOW)) {
    if (!tBone(f) || !tBone(lead)) continue
    followRest[f] = tBone(lead).worldToLocal(worldPos(tBone(f)))
  }

  const tHips = tBone(HIP_BONE)
  const sHips = sBone(rig.hips)
  const tHipsRestWorld = worldPos(tHips)
  const sHipsRestWorld = worldPos(sHips)
  const tGround = new THREE.Box3().setFromObject(firstSkinnedMesh(target)).min.y
  const sGround = new THREE.Box3().setFromObject(sourceMesh).min.y
  const hipScale = (tHipsRestWorld.y - tGround) / (sHipsRestWorld.y - sGround)
  // source units -> game metres (character is 1.75 m tall in game)
  const sourceHeight = new THREE.Box3().setFromObject(sourceMesh).max.y - sGround
  const sourceHeightToGame = 1.75 / sourceHeight

  const mixer = new THREE.AnimationMixer(source)
  // LoopOnce + clamp: otherwise sampling at t = duration wraps back to frame 0.
  const action = mixer.clipAction(clip)
  action.setLoop(THREE.LoopOnce, 1)
  action.clampWhenFinished = true
  action.play()

  const frames = Math.max(2, Math.round(clip.duration * FPS) + 1)
  const mapped = Object.keys(BONE_MAP).filter((n) => tBone(n) && sBone(BONE_MAP[n]))
  const q = Object.fromEntries(mapped.map((n) => [n, []]))
  const hipsPos = []
  const followPos = Object.fromEntries(Object.keys(followRest).map((f) => [f, []]))
  const pose = [] // source local quats per frame, for loop finding
  const travel = []

  const parentWorld = new THREE.Quaternion()
  for (let f = 0; f < frames; f++) {
    const t = Math.min(clip.duration - 1e-4, f / FPS)
    mixer.setTime(t)
    source.updateMatrixWorld(true)

    // reset target to rest, then pose bones parent-first
    for (const b of targetBones) { const r = rest.get(b); b.quaternion.copy(r.local); b.position.copy(r.pos) }
    target.updateMatrixWorld(true)

    const framePose = []
    for (const b of targetBones) {
      const s = BONE_MAP[b.name] && sBone(BONE_MAP[b.name])
      if (!s) continue
      // delta = how far the source bone turned from its rest, in target-aligned world space
      const sWorld = worldQuat(s).premultiply(align)
      const delta = sWorld.multiply(sourceRest.get(b.name).clone().invert())
      const tWorld = delta.multiply(restAlign.get(b.name) || new THREE.Quaternion()).multiply(rest.get(b).world)
      b.parent.getWorldQuaternion(parentWorld)
      b.quaternion.copy(parentWorld.invert().multiply(tWorld))
      b.updateMatrixWorld(true)
      q[b.name].push(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w)
      framePose.push(s.quaternion.clone())
    }
    pose.push(framePose)

    // hips translation
    const d = worldPos(sHips).sub(sHipsRestWorld).applyQuaternion(align)
    travel.push(new THREE.Vector2(d.x, d.z))
    if (cfg.inPlace) { d.x = 0; d.z = 0 }
    const world = tHipsRestWorld.clone().add(d.multiplyScalar(hipScale))
    const local = tHips.parent.worldToLocal(world)
    hipsPos.push(local.x, local.y, local.z)
    tHips.position.copy(local) // the feet below must see the moved hips

    // feet follow the end of their lower leg
    target.updateMatrixWorld(true)
    for (const [f, local] of Object.entries(followRest)) {
      const fb = tBone(f)
      const world = tBone(FOLLOW[f]).localToWorld(local.clone())
      fb.position.copy(fb.parent.worldToLocal(world))
      followPos[f].push(fb.position.x, fb.position.y, fb.position.z)
    }

  }

  // optional: cut one clean loop
  let start = 0
  let end = frames - 1
  if (cfg.findLoop) {
    const { from, to, minPeriod, maxPeriod } = cfg.findLoop
    const dist = (a, b) => pose[a].reduce((s, qa, i) => s + (1 - Math.abs(qa.dot(pose[b][i]))), 0)
    let best = Infinity
    for (let i = Math.round(from * FPS); i <= Math.min(Math.round(to * FPS), frames - 2); i++) {
      for (let p = Math.round(minPeriod * FPS); p <= Math.round(maxPeriod * FPS); p++) {
        if (i + p + 1 >= frames) break
        const score = dist(i, i + p) + dist(i + 1, i + p + 1)
        if (score < best) { best = score; start = i; end = i + p }
      }
    }
  }

  const slice = (arr, n) => arr.slice(start * n, (end + 1) * n)
  const round = (v) => Number(v.toFixed(DECIMALS))
  const metres = travel[end].clone().sub(travel[start]).length() * sourceHeightToGame
  const duration = (end - start) / FPS

  const out = {
    fps: FPS,
    duration: Number(duration.toFixed(3)),
    loop: Boolean(cfg.loop),
    bones: mapped,
    quaternions: mapped.map((n) => slice(q[n], 4).map(round)),
    hipBone: HIP_BONE,
    hipsPosition: slice(hipsPos, 3).map(round),
    positions: Object.fromEntries(Object.entries(followPos).map(([f, arr]) => [f, slice(arr, 3).map(round)])),
  }
  if (cfg.loop) {
    // make the last frame exactly the first so the loop is seamless
    for (const arr of out.quaternions) arr.splice(arr.length - 4, 4, ...arr.slice(0, 4))
    out.hipsPosition.splice(out.hipsPosition.length - 3, 3, ...out.hipsPosition.slice(0, 3))
    for (const arr of Object.values(out.positions)) arr.splice(arr.length - 3, 3, ...arr.slice(0, 3))
  }
  const rootMotion = { metres: Number(metres.toFixed(2)), speed: Number((metres / Math.max(duration, 1e-3)).toFixed(2)) }
  return { out, rootMotion, start: start / FPS, end: end / FPS }
}

async function main() {
  const inputs = process.argv.slice(2)
  if (!inputs.length) {
    console.error('Usage: npm run assets:animations -- a1.zip a2.zip a3.zip a4.rar a5.zip')
    process.exit(1)
  }
  const fbx = await collectFbx(inputs)
  console.log(`Found ${Object.keys(fbx).length} FBX files`)

  if (!fs.existsSync(BODY)) {
    console.error('Run `npm run assets:characters` first (the target skeleton comes from it).')
    process.exit(1)
  }
  const bodyBytes = fs.readFileSync(BODY)
  const loadTarget = async () => (await new GLTFLoader().parseAsync(bodyBytes.buffer.slice(bodyBytes.byteOffset, bodyBytes.byteOffset + bodyBytes.byteLength), '')).scene
  fs.mkdirSync(OUT_DIR, { recursive: true })

  // Clips whose source file isn't given this time keep what was imported before,
  // so you can add one pack without re-importing the rest.
  const previous = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, 'utf8')) : { clips: {} }
  const index = {}
  const usedFiles = new Set()
  for (const [name, cfg] of Object.entries(CLIPS)) {
    const bytes = fbx[cfg.file]
    if (!bytes) {
      const kept = previous.clips[name] && fs.existsSync(path.join(OUT_DIR, `${name}.json`))
      if (kept) index[name] = previous.clips[name]
      console.log(`  - ${name.padEnd(12)} ${kept ? 'kept as it was' : 'SKIPPED'}: ${cfg.file} not given`)
      continue
    }
    usedFiles.add(cfg.file)
    const source = parseFbx(bytes)
    const target = await loadTarget() // fresh copy each time
    const clip = cfg.clip
      ? source.animations.find((a) => a.name.endsWith(`|${cfg.clip}`) || a.name === cfg.clip)
      : source.animations.reduce((a, b) => (b.tracks.length > a.tracks.length ? b : a))
    if (!clip) { console.log(`  - ${name.padEnd(12)} SKIPPED: no "${cfg.clip}" clip in ${cfg.file}`); continue }
    const { out, rootMotion, start, end } = retargetClip(target, source, clip, cfg)
    const json = JSON.stringify(out)
    fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), json)
    index[name] = { file: `characters/clips/${name}.json`, source: cfg.file, duration: out.duration, loop: out.loop, rootMotion, use: cfg.use }
    const cut = cfg.findLoop ? ` (loop ${start.toFixed(2)}–${end.toFixed(2)}s)` : ''
    console.log(`  ✓ ${name.padEnd(12)} ${out.duration.toFixed(2)}s ${String(Math.round(json.length / 1024)).padStart(4)} KB  travel ${rootMotion.speed} m/s${cut}`)
  }
  const fresh = Object.keys(fbx).filter((f) => !usedFiles.has(f))
  const unused = [...new Set([...(previous.unusedSourceFiles || []), ...fresh])].filter((f) => !usedFiles.has(f) && !Object.values(CLIPS).some((c) => c.file === f)).sort()
  fs.writeFileSync(INDEX, JSON.stringify({ clips: index, unusedSourceFiles: unused }, null, 1) + '\n')
  if (unused.length) console.log(`Not used (duplicates or spare): ${unused.join(', ')}`)
  console.log('Wrote public/assets/characters/clips/*.json and src/assets/clipIndex.json')
  console.warn = warn
}

main()
