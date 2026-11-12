import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { ASSET_ROOT, CHARACTER } from '../../assets/assetManifest.js'
import { loadClip } from '../characters/clipLoader.js'
import { bodyInfo, paintGeometry, randomLook } from '../characters/look.js'
import { mulberry32 } from './cityFill.js'
import { playerState, npcRegistry } from './worldState.js'
import { crowdBlobs } from './Shadows.jsx'
import { GROUND_Y } from './layout.js'

// The background crowd: dozens of people for the price of a few draw calls.
// A normal Character is a skinned mesh with its own skeleton and animation
// mixer: fine for the cast, far too heavy for a crowd on a budget phone.
// Here the walk cycle is "baked" once into 8 plain meshes per look; walkers
// are instances that flip through those meshes like a flip-book. People who
// stand around are instances of a single baked pose.

const LOOK_SEEDS = [5, 12, 19, 26, 33, 41]
const FRAMES = 8
const NEAR = 55 // metres: people further than this are not drawn
export const CROWD_SIZE = { low: 12, auto: 26, high: 40 }
const MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true })

const v = new THREE.Vector3()

function bakePose(skinned, root, scale, keep) {
  root.updateMatrixWorld(true)
  skinned.skeleton.update()
  const src = skinned.geometry.attributes.position
  const out = new Float32Array(keep.length * 3)
  for (let k = 0; k < keep.length; k++) {
    const i = keep[k]
    v.fromBufferAttribute(src, i)
    skinned.applyBoneTransform(i, v)
    v.applyMatrix4(skinned.matrixWorld)
    out[k * 3] = v.x * scale[0]
    out[k * 3 + 1] = v.y * scale[1]
    out[k * 3 + 2] = v.z * scale[0]
  }
  return out
}

/**
 * Bake one look: { walk: [geometry x FRAMES], idle, talk }.
 * `lod` = { keep, index } from crowd-lod.json: the low-detail version of the
 * body (about a third of the triangles), made by `npm run assets:crowd`.
 */
function bakeLook(gltf, clips, look, lod) {
  const info = bodyInfo(look.body)
  const root = cloneSkinned(gltf.scene)
  let skinned = null
  root.traverse((o) => {
    if (o.isSkinnedMesh) skinned = o
  })
  const painted = skinned.geometry.clone()
  paintGeometry(painted, look)
  const full = painted.attributes.color
  const keep = lod?.keep || [...Array(full.count).keys()]
  const colours = new Float32Array(keep.length * 3)
  keep.forEach((i, k) => colours.set([full.getX(i), full.getY(i), full.getZ(i)], k * 3))
  const colour = new THREE.BufferAttribute(colours, 3)
  const index = lod ? new THREE.BufferAttribute(new Uint16Array(lod.index), 1) : skinned.geometry.index
  painted.dispose()
  const k = CHARACTER.targetHeight / info.nativeHeight
  const scale = [k * look.width, k * look.height]
  const mixer = new THREE.AnimationMixer(root)
  const make = (clip, t) => {
    mixer.stopAllAction()
    const action = mixer.clipAction(clip)
    action.play()
    mixer.setTime(t)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(bakePose(skinned, root, scale, keep), 3))
    g.setAttribute('color', colour)
    g.setIndex(index)
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }
  const walk = Array.from({ length: FRAMES }, (_, i) => make(clips.walk, (i / FRAMES) * clips.walk.duration))
  const idle = make(clips.breathingIdle, 1.0)
  const talk = make(clips.talk, 1.3)
  mixer.stopAllAction()
  return { walk, idle, talk }
}

const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()
const UP = new THREE.Vector3(0, 1, 0)
const pos = new THREE.Vector3()
const ONE = new THREE.Vector3(1, 1, 1)

function Standers({ baked, people, limit }) {
  // one instanced mesh per look + pose; only people near the player are drawn
  const groups = useMemo(() => {
    const map = new Map()
    people.slice(0, limit).forEach((p) => {
      const key = `${p.v % baked.length}|${p.pose}`
      if (!map.has(key)) map.set(key, { geometry: baked[p.v % baked.length][p.pose], list: [] })
      map.get(key).list.push(p)
    })
    return [...map.values()]
  }, [baked, people, limit])
  const meshes = useRef([])
  const timer = useRef(0)
  useEffect(
    () => () => {
      crowdBlobs.standers = []
    },
    [],
  )
  useFrame((_, dt) => {
    timer.current -= dt
    if (timer.current > 0) return
    timer.current = 0.4
    const player = playerState.position
    const visible = []
    groups.forEach((g, gi) => {
      const im = meshes.current[gi]
      if (!im) return
      let n = 0
      for (const p of g.list) {
        if (Math.abs(p.x - player.x) > NEAR || Math.abs(p.z - player.z) > NEAR) continue
        im.setMatrixAt(n++, m4.compose(pos.set(p.x, GROUND_Y, p.z), q.setFromAxisAngle(UP, p.yaw), ONE))
        visible.push(p)
      }
      im.count = n
      im.instanceMatrix.needsUpdate = true
    })
    crowdBlobs.standers = visible
  })
  return groups.map((g, i) => <instancedMesh key={i} ref={(im) => (meshes.current[i] = im)} args={[g.geometry, MATERIAL, g.list.length]} frustumCulled={false} />)
}

function Walkers({ baked, walkways, count, paused }) {
  const meshes = useRef([])
  // each walker: which look, which path, where on it
  const walkers = useMemo(() => {
    const rng = mulberry32(61)
    const total = walkways.reduce((n, w) => n + (w.n || 3), 0)
    const list = []
    walkways.forEach((w, wi) => {
      const n = Math.max(1, Math.round(((w.n || 3) / total) * count))
      const len = Math.hypot(w.to[0] - w.from[0], w.to[1] - w.from[1])
      for (let i = 0; i < n; i++) {
        const look = Math.floor(rng() * baked.length)
        list.push({ look, group: look * 2 + (i % 2), w, wi, len, d: rng() * len, dir: rng() < 0.5 ? 1 : -1, side: (rng() - 0.5) * 0.7, dodge: 0 })
      }
    })
    return list
  }, [baked, walkways, count])
  const groups = baked.length * 2
  const capacity = useMemo(() => {
    const c = new Array(groups).fill(0)
    for (const w of walkers) c[w.group]++
    return c
  }, [walkers, groups])
  const clock = useRef(0)

  useFrame((_, raw) => {
    const dt = paused ? 0 : Math.min(raw, 0.05)
    clock.current += dt
    const player = playerState.position
    const used = new Array(groups).fill(0)
    const blobs = crowdBlobs.walkers
    blobs.length = 0
    for (const w of walkers) {
      const speed = 1.25 + (w.group % 5) * 0.09
      w.d += w.dir * speed * dt
      if (w.d > w.len || w.d < 0) {
        if (w.w.wrap) w.d = (w.d + w.len) % w.len
        else {
          w.dir *= -1
          w.d = Math.max(0, Math.min(w.len, w.d))
        }
      }
      const ux = (w.w.to[0] - w.w.from[0]) / w.len
      const uz = (w.w.to[1] - w.w.from[1]) / w.len
      let x = w.w.from[0] + ux * w.d
      let z = w.w.from[1] + uz * w.d
      // step around the player and the cast instead of walking through them
      let push = 0
      const near = (ox, oz) => {
        const along = (ox - x) * ux * w.dir + (oz - z) * uz * w.dir
        const across = (ox - x) * -uz + (oz - z) * ux
        if (along > -0.6 && along < 2.2 && Math.abs(across - w.side - w.dodge) < 0.8) push = across - w.side > 0 ? -0.9 : 0.9
      }
      near(player.x, player.z)
      for (const n of npcRegistry.values()) near(n.position.x, n.position.z)
      w.dodge += (push - w.dodge) * Math.min(1, dt * 4)
      const off = w.side + w.dodge
      x += -uz * off
      z += ux * off
      if (Math.abs(x - player.x) > NEAR || Math.abs(z - player.z) > NEAR) continue
      const im = meshes.current[w.group]
      if (!im) continue
      im.setMatrixAt(used[w.group]++, m4.compose(pos.set(x, GROUND_Y, z), q.setFromAxisAngle(UP, Math.atan2(ux * w.dir, uz * w.dir)), ONE))
      blobs.push(x, z)
    }
    for (let g = 0; g < groups; g++) {
      const im = meshes.current[g]
      if (!im) continue
      im.count = used[g]
      im.instanceMatrix.needsUpdate = true
      // flip-book: every group steps through the baked walk at its own pace
      const speed = 1.25 + (g % 5) * 0.09
      const cycles = (clock.current * speed) / (CHARACTER.clips.walk.rootMotion.metres || 1.56) + g * 0.37
      im.geometry = baked[Math.floor(g / 2)].walk[Math.floor((cycles % 1) * FRAMES)]
    }
  })

  return capacity.map((n, g) =>
    n ? <instancedMesh key={g} ref={(im) => (meshes.current[g] = im)} args={[baked[Math.floor(g / 2)].walk[0], MATERIAL, n]} frustumCulled={false} /> : null,
  )
}

export default function Crowd({ layout, quality = 'auto', paused = false }) {
  const looks = useMemo(() => LOOK_SEEDS.map((s, i) => ({ ...randomLook(s, i % 3 === 2 ? 'female' : 'male'), accessories: [] })), [])
  const gltfs = useGLTF(looks.map((l) => `${ASSET_ROOT}/${bodyInfo(l.body).file}`))
  const [baked, setBaked] = useState(null)

  // bake after the street is on screen, one look per tick, so nothing freezes
  useEffect(() => {
    let cancelled = false
    const out = []
    Promise.all([
      ...['walk', 'breathingIdle', 'talk'].map(loadClip),
      fetch(`${ASSET_ROOT}/characters/crowd-lod.json`)
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({})),
    ])
      .then(([walk, breathingIdle, talk, lod]) => {
        const step = (i) => {
          if (cancelled) return
          if (i >= looks.length) return setBaked(out)
          out.push(bakeLook(gltfs[i], { walk, breathingIdle, talk }, looks[i], lod[looks[i].body]))
          setTimeout(() => step(i + 1), 30)
        }
        setTimeout(() => step(0), 400)
      })
      .catch((e) => console.warn('[crowd] could not bake the crowd', e))
    return () => {
      cancelled = true
    }
  }, [gltfs, looks])

  if (!baked) return null
  const people = layout.fill.people
  return (
    <>
      <Standers baked={baked} people={people} limit={quality === 'low' ? Math.ceil(people.length / 2) : people.length} />
      <Walkers baked={baked} walkways={layout.raw.walkways || []} count={CROWD_SIZE[quality] ?? CROWD_SIZE.auto} paused={paused} />
    </>
  )
}
