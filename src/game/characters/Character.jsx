import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useFBX, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { ASSET_ROOT, CHARACTER } from '../../assets/assetManifest.js'
import { loadClip } from './clipLoader.js'
import { makeSkinTexture, normalizeLook } from './look.js'
import { attachAccessories } from './accessories.js'

// One person in the 3D world. Everyone (player, NPCs, crowd) uses this.
//   look       see look.js
//   animation  any clip name from clipIndex (walk, run, punch...), 'idle'
//              (= breathingIdle), 'jump', or kenneyIdle / kenneyRun / kenneyJump
//   speed      animation playback speed
//   once       for non-looping clips: called when the clip ends
// The outer group is forwarded as ref so controllers can move/turn it.

const url = (f) => `${ASSET_ROOT}/${f}`
// Kenney's own clips (always available instantly) and friendly aliases.
const KENNEY = ['kenneyIdle', 'kenneyRun', 'kenneyJump']
const ALIASES = { idle: 'breathingIdle', jump: 'kenneyJump' }
const NATIVE_HEIGHT = 376.47 // Kenney units; measured once (see docs)

function realClip(fbx, name) {
  const real = fbx.animations.find((a) => !a.name.includes(CHARACTER.skipClipsNamed)) || fbx.animations[0]
  const c = real.clone()
  c.name = name
  return c
}

const Character = forwardRef(function Character({ look: lookInput, animation = 'idle', speed = 1, onClipEnd, ...groupProps }, ref) {
  // compare looks by value, so passing a fresh object each render is harmless
  const lookKey = JSON.stringify(lookInput || {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const look = useMemo(() => normalizeLook(lookInput), [lookKey])
  const body = useFBX(url(CHARACTER.body))
  const idleFbx = useFBX(url(CHARACTER.animations.idle))
  const runFbx = useFBX(url(CHARACTER.animations.run))
  const jumpFbx = useFBX(url(CHARACTER.animations.jump))
  const baseSkin = useTexture(url(CHARACTER.skins[look.base] || CHARACTER.skins.male))

  const rootScale = CHARACTER.targetHeight / NATIVE_HEIGHT
  const accessoriesKey = JSON.stringify(look.accessories)

  // The mesh is cloned once per body/accessory set...
  const { object, material } = useMemo(() => {
    const o = cloneSkinned(body)
    const m = new THREE.MeshLambertMaterial()
    o.traverse((child) => {
      if (child.isMesh) {
        child.material = m
        child.frustumCulled = false // skinned bounds are unreliable when animated
      }
    })
    attachAccessories(o, look.accessories, rootScale)
    return { object: o, material: m }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, accessoriesKey, rootScale])

  // ...while colours (skin, clothes, red eyes) only swap the texture.
  const texture = makeSkinTexture(baseSkin.image, look)
  if (material.map !== texture) {
    material.map = texture
    material.needsUpdate = true
  }

  const kenneyClips = useMemo(
    () => ({ kenneyIdle: realClip(idleFbx, 'kenneyIdle'), kenneyRun: realClip(runFbx, 'kenneyRun'), kenneyJump: realClip(jumpFbx, 'kenneyJump') }),
    [idleFbx, runFbx, jumpFbx],
  )

  const mixer = useMemo(() => new THREE.AnimationMixer(object), [object])
  const current = useRef(null)
  const [clip, setClip] = useState(kenneyClips.kenneyIdle)
  const endRef = useRef(onClipEnd)
  endRef.current = onClipEnd

  // a new mixer (new clone) starts with no current action
  useEffect(() => {
    current.current = null
  }, [mixer])

  useEffect(() => {
    let cancelled = false
    const name = ALIASES[animation] || animation
    if (KENNEY.includes(name)) setClip(kenneyClips[name])
    else
      loadClip(name)
        .then((c) => !cancelled && setClip(c))
        .catch((e) => console.warn(`[anim] "${animation}" failed to load`, e))
    return () => {
      cancelled = true
    }
  }, [animation, kenneyClips])

  useEffect(() => {
    if (!clip) return
    const action = mixer.clipAction(clip)
    const loops = KENNEY.includes(clip.name) || CHARACTER.clips[clip.name]?.loop
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

  useFrame((_, delta) => mixer.update(Math.min(delta, 0.1)))

  return (
    <group ref={ref} {...groupProps}>
      <group scale={[rootScale * look.width, rootScale * look.height, rootScale * look.width]}>
        <primitive object={object} />
      </group>
    </group>
  )
})

export default Character
