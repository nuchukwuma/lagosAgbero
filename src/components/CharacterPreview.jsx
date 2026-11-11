import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useFBX, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { ASSET_ROOT, CHARACTER } from '../assets/assetManifest.js'
import { loadClip } from '../game/characters/clipLoader.js'

// Shows the one body mesh with a skin, playing any animation: Kenney's own
// idle/run/jump, or any retargeted Mixamo clip (walk, punch, knockedOut...).
// Skin re-toning, clothes tinting and accessories come in Phase 2.

const url = (f) => `${ASSET_ROOT}/${f}`
const KENNEY = ['idle', 'run', 'jump']

// Each Kenney animation FBX holds two clips: the real one and a 1-frame
// T-pose called "Targeting Pose". Pick the real one.
function realClip(fbx, name) {
  const real = fbx.animations.find((a) => !a.name.includes(CHARACTER.skipClipsNamed)) || fbx.animations[0]
  const c = real.clone()
  c.name = name
  return c
}

export default function CharacterPreview({ skin = 'male', animation = 'idle', speed = 1 }) {
  const body = useFBX(url(CHARACTER.body))
  const idle = useFBX(url(CHARACTER.animations.idle))
  const run = useFBX(url(CHARACTER.animations.run))
  const jump = useFBX(url(CHARACTER.animations.jump))
  const texture = useTexture(url(CHARACTER.skins[skin]))

  const { object, scale } = useMemo(() => {
    const o = cloneSkinned(body)
    texture.colorSpace = THREE.SRGBColorSpace
    o.traverse((child) => {
      if (child.isMesh) child.material = new THREE.MeshLambertMaterial({ map: texture })
    })
    const box = new THREE.Box3().setFromObject(o)
    const height = box.max.y - box.min.y || 1
    return { object: o, scale: CHARACTER.targetHeight / height }
  }, [body, texture])

  const kenneyClips = useMemo(
    () => ({ idle: realClip(idle, 'idle'), run: realClip(run, 'run'), jump: realClip(jump, 'jump') }),
    [idle, run, jump],
  )

  const mixer = useMemo(() => new THREE.AnimationMixer(object), [object])
  const current = useRef(null)
  const [clip, setClip] = useState(null)

  // Resolve the requested animation to a clip (Mixamo clips load on demand).
  useEffect(() => {
    let cancelled = false
    if (KENNEY.includes(animation)) {
      setClip(kenneyClips[animation])
    } else {
      loadClip(animation)
        .then((c) => !cancelled && setClip(c))
        .catch((e) => console.warn(`[anim] ${animation} failed, staying on idle`, e))
    }
    return () => {
      cancelled = true
    }
  }, [animation, kenneyClips])

  // Cross-fade to the new clip.
  useEffect(() => {
    if (!clip) return
    const action = mixer.clipAction(clip)
    const info = CHARACTER.clips[clip.name]
    const loops = KENNEY.includes(clip.name) || info?.loop
    action.reset()
    action.setLoop(loops ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
    action.clampWhenFinished = true
    action.setEffectiveTimeScale(speed)
    if (current.current && current.current !== action) action.crossFadeFrom(current.current, 0.25, false)
    action.play()
    current.current = action
  }, [clip, mixer, speed])

  useEffect(() => () => mixer.stopAllAction(), [mixer])
  useFrame((_, delta) => mixer.update(delta))

  return (
    <group scale={scale}>
      <primitive object={object} />
    </group>
  )
}
