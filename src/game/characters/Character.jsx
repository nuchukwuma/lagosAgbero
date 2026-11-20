import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { ASSET_ROOT, CHARACTER } from '../../assets/assetManifest.js'
import { loadClip, readClip } from './clipLoader.js'
import { bodyInfo, normalizeLook, paintGeometry } from './look.js'
import { attachAccessories } from './accessories.js'
import { useBlobShadow } from '../world/Shadows.jsx'
import { smoothNormals } from './smoothNormals.js'
import { rigFixer } from './rigFix.js'
import { lodIndexFor } from './bodyLod.js'
import { perf } from '../world/worldState.js'
import { addOutlineNormals, addOutline, applyHeadSize, OUTLINE } from '../world/style.js'

// One person in the 3D world. Everyone (player, NPCs, crowd) uses this.
//   look       see look.js (body/outfit, colours, size, accessories)
//   animation  any clip name from clipIndex (walk, run, punch...); 'idle' = breathingIdle
//   speed      animation playback speed
//   onClipEnd  for non-looping clips: called with the clip name when it ends
//   shadow     false for people outside the street (the customisation preview)
// The outer group is forwarded as ref so controllers can move/turn it.

const ALIASES = { idle: 'breathingIdle' }
const tmpPos = new THREE.Vector3()
const tmpMat = new THREE.Matrix4()
const tmpFrustum = new THREE.Frustum()
const tmpSphere = new THREE.Sphere(new THREE.Vector3(), 1.4) // around the middle of a person
// simpler body beyond FAR_LOD metres from the camera, full body again inside NEAR_LOD
const FAR_LOD = 16
const NEAR_LOD = 13

// One material for every person: colours come from vertex colours.
const PERSON_MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true })

const Character = forwardRef(function Character({ look: lookInput, animation = 'idle', speed = 1, onClipEnd, shadow = true, ...groupProps }, ref) {
  // compare looks by value, so passing a fresh object each render is harmless
  const lookKey = JSON.stringify(lookInput || {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const look = useMemo(() => normalizeLook(lookInput), [lookKey])
  const info = bodyInfo(look.body)
  const gltf = useGLTF(`${ASSET_ROOT}/${info.file}`)
  const clipSet = info.clipSet || null // which skeleton's version of the clips
  const idleClip = readClip('breathingIdle', clipSet) // suspends until the idle is loaded: no T-pose flash

  const rootScale = (CHARACTER.targetHeight * (info.heightScale || 1)) / info.nativeHeight
  const accessoriesKey = JSON.stringify(look.accessories)

  // Clone the body once per outfit/accessory set...
  const { object, mesh, outline } = useMemo(() => {
    const o = cloneSkinned(gltf.scene)
    let skinned = null
    o.traverse((child) => {
      if (child.isMesh) {
        child.geometry = addOutlineNormals(smoothNormals(child.geometry)).clone() // own vertex colours per person
        child.material = PERSON_MATERIAL
        child.frustumCulled = false // skinned bounds are unreliable when animated
        if (child.isSkinnedMesh) skinned = child
      }
    })
    attachAccessories(o, look.accessories, rootScale, info)
    applyHeadSize(o, info) // after the hats, so they grow with the head
    const outline = skinned ? addOutline(skinned, info.nativeHeight) : null
    return { object: o, mesh: skinned, outline }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf, accessoriesKey, rootScale])

  // ...while colours (skin, clothes, red eyes) only repaint vertex colours.
  const paintKey = JSON.stringify([look.body, look.skin, look.hair, look.shirt, look.shirt2, look.trousers, look.shoes, look.socks, look.accent, Math.round((look.eyeRed || 0) * 10)])
  useMemo(() => mesh && paintGeometry(mesh.geometry, look), [mesh, paintKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // the simplified body for when they're far away: their own corners, fewer triangles
  const detail = useMemo(() => ({ full: mesh?.geometry.index || null, far: false }), [mesh])
  // this person's own copy of the body: freed on the graphics card when they leave
  // (the shared far-away triangle list is put back first: other people still use it)
  useEffect(
    () => () => {
      if (mesh && detail.full) mesh.geometry.setIndex(detail.full)
      object.traverse((c) => c.isMesh && c.geometry.dispose())
    },
    [object, mesh, detail],
  )

  const mixer = useMemo(() => new THREE.AnimationMixer(object), [object])
  const fix = useMemo(() => rigFixer(object, info.rig), [object]) // eslint-disable-line react-hooks/exhaustive-deps
  const inner = useRef()
  useBlobShadow(inner, { radius: 0.42 }, shadow)
  const current = useRef(null)
  const [clip, setClip] = useState(idleClip)
  const endRef = useRef(onClipEnd)
  endRef.current = onClipEnd

  // a new mixer (new clone) starts with no current action
  useEffect(() => {
    current.current = null
  }, [mixer])

  useEffect(() => {
    let cancelled = false
    const name = ALIASES[animation] || animation
    loadClip(name, clipSet)
      .then((c) => !cancelled && setClip(c))
      .catch((e) => console.warn(`[anim] "${name}" failed to load`, e))
    return () => {
      cancelled = true
    }
  }, [animation, clipSet])

  useEffect(() => {
    if (!clip) return
    const action = mixer.clipAction(clip)
    const loops = CHARACTER.clips[clip.name]?.loop
    action.setLoop(loops ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
    action.clampWhenFinished = true
    if (current.current !== action) {
      action.reset()
      if (current.current) action.crossFadeFrom(current.current, 0.2, false)
      // first clip of a looping animation starts at a random point, so a
      // crowd doesn't breathe in perfect sync
      else if (loops) action.time = Math.random() * clip.duration
      action.play()
      current.current = action
    }
    action.setEffectiveTimeScale(speed)
  }, [clip, mixer, speed])

  useEffect(() => {
    const onFinished = (e) => endRef.current?.(e.action.getClip().name)
    mixer.addEventListener('finished', onFinished)
    return () => {
      mixer.removeEventListener('finished', onFinished)
      mixer.stopAllAction()
    }
  }, [mixer])

  // Level of detail. The skeleton maths and drawing are the most expensive
  // things people cost on a phone, so:
  //  - off screen: not drawn at all, and the animation ticks only now and then
  //    (often enough that "when this move ends" story moments still happen);
  //  - far away: the animation updates every 2nd or 4th frame, and the body
  //    switches to the simplified one (about a third of the triangles);
  //  - Light mode starts thinning out sooner.
  const lod = useRef({ acc: 0, n: Math.floor(Math.random() * 4) })
  useFrame(({ camera }, delta) => {
    const l = lod.current
    l.acc += Math.max(0, Math.min(delta, 0.1))
    l.n++
    const g = inner.current
    let every = 1
    if (g) {
      g.getWorldPosition(tmpPos)
      const d = tmpPos.distanceTo(camera.position)
      tmpSphere.center.copy(tmpPos).y += 0.9
      tmpFrustum.setFromProjectionMatrix(tmpMat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
      const onScreen = tmpFrustum.intersectsSphere(tmpSphere)
      object.visible = onScreen
      const light = perf.light
      if (outline) outline.visible = d < (light ? OUTLINE.lightDistance : OUTLINE.maxDistance)
      every = !onScreen ? (light ? 12 : 8) : d > (light ? 30 : 40) ? 4 : d > (light ? 15 : 22) ? 2 : 1
      // swap the body's triangle list (the corners and the paint stay the same)
      if (mesh && detail.full && onScreen) {
        const far = detail.far ? d > NEAR_LOD : d > FAR_LOD
        if (far !== detail.far) {
          const simple = far ? lodIndexFor(look.body) : detail.full
          if (simple) {
            mesh.geometry.setIndex(simple)
            detail.far = far
          }
        }
      }
    }
    if (l.n % every !== 0) return
    fix?.before()
    mixer.update(Math.min(l.acc, 0.25))
    fix?.after()
    l.acc = 0
  })

  return (
    <group ref={ref} {...groupProps}>
      <group ref={inner} scale={[rootScale * look.width, rootScale * look.height, rootScale * look.width]}>
        <primitive object={object} />
      </group>
    </group>
  )
})

export default Character
