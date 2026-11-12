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

// One person in the 3D world. Everyone (player, NPCs, crowd) uses this.
//   look       see look.js (body/outfit, colours, size, accessories)
//   animation  any clip name from clipIndex (walk, run, punch...); 'idle' = breathingIdle
//   speed      animation playback speed
//   onClipEnd  for non-looping clips: called with the clip name when it ends
// The outer group is forwarded as ref so controllers can move/turn it.

const ALIASES = { idle: 'breathingIdle' }
const tmpPos = new THREE.Vector3()
const tmpMat = new THREE.Matrix4()
const tmpFrustum = new THREE.Frustum()
const tmpSphere = new THREE.Sphere(new THREE.Vector3(), 1.2)

// One material for every person: colours come from vertex colours.
const PERSON_MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true })

const Character = forwardRef(function Character({ look: lookInput, animation = 'idle', speed = 1, onClipEnd, ...groupProps }, ref) {
  // compare looks by value, so passing a fresh object each render is harmless
  const lookKey = JSON.stringify(lookInput || {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const look = useMemo(() => normalizeLook(lookInput), [lookKey])
  const info = bodyInfo(look.body)
  const gltf = useGLTF(`${ASSET_ROOT}/${info.file}`)
  const idleClip = readClip('breathingIdle') // suspends until the idle is loaded: no T-pose flash

  const rootScale = CHARACTER.targetHeight / info.nativeHeight
  const accessoriesKey = JSON.stringify(look.accessories)

  // Clone the body once per outfit/accessory set...
  const { object, mesh } = useMemo(() => {
    const o = cloneSkinned(gltf.scene)
    let skinned = null
    o.traverse((child) => {
      if (child.isMesh) {
        child.geometry = smoothNormals(child.geometry).clone() // own vertex colours per person
        child.material = PERSON_MATERIAL
        child.frustumCulled = false // skinned bounds are unreliable when animated
        if (child.isSkinnedMesh) skinned = child
      }
    })
    attachAccessories(o, look.accessories, rootScale)
    return { object: o, mesh: skinned }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf, accessoriesKey, rootScale])

  // ...while colours (skin, clothes, red eyes) only repaint vertex colours.
  const paintKey = JSON.stringify([look.body, look.skin, look.hair, look.shirt, look.shirt2, look.trousers, look.shoes, look.socks, look.accent, Math.round((look.eyeRed || 0) * 10)])
  useMemo(() => mesh && paintGeometry(mesh.geometry, look), [mesh, paintKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const mixer = useMemo(() => new THREE.AnimationMixer(object), [object])
  const inner = useRef()
  useBlobShadow(inner, { radius: 0.42 })
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
    loadClip(name)
      .then((c) => !cancelled && setClip(c))
      .catch((e) => console.warn(`[anim] "${name}" failed to load`, e))
    return () => {
      cancelled = true
    }
  }, [animation])

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

  // Animation LOD: people far away or off screen update less often (the
  // skeleton maths is the most expensive thing a crowd does on a phone).
  const lod = useRef({ acc: 0, n: Math.floor(Math.random() * 4) })
  useFrame(({ camera }, delta) => {
    const l = lod.current
    l.acc += Math.min(delta, 0.1)
    l.n++
    const g = inner.current
    let every = 1
    if (g) {
      g.getWorldPosition(tmpPos)
      const d = tmpPos.distanceTo(camera.position)
      tmpSphere.center.copy(tmpPos)
      tmpFrustum.setFromProjectionMatrix(tmpMat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
      const onScreen = tmpFrustum.intersectsSphere(tmpSphere)
      every = !onScreen ? 8 : d > 40 ? 4 : d > 22 ? 2 : 1
    }
    if (l.n % every !== 0) return
    mixer.update(Math.min(l.acc, 0.25))
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
