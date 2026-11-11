import { useEffect, useMemo, useRef } from 'react'
import { useFBX, useTexture, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { ASSET_ROOT, CHARACTER } from '../assets/assetManifest.js'

// Phase 0 check that the one body mesh, a skin and the 3 animations load.
// Skin re-toning, clothes tinting and accessories come in Phase 2.

const url = (f) => `${ASSET_ROOT}/${f}`

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
      if (child.isMesh) {
        // Lambert is cheap on budget phones and looks fine for this art style.
        child.material = new THREE.MeshLambertMaterial({ map: texture })
      }
    })
    const box = new THREE.Box3().setFromObject(o)
    const height = box.max.y - box.min.y || 1
    return { object: o, scale: CHARACTER.targetHeight / height }
  }, [body, texture])

  const clips = useMemo(() => {
    // Each Kenney animation FBX holds two clips: the real one and a 1-frame
    // T-pose called "Targeting Pose". Pick the real one by name.
    const named = (fbx, name) => {
      const real = fbx.animations.find((a) => !a.name.includes('Targeting Pose')) || fbx.animations[0]
      const c = real.clone()
      c.name = name
      return c
    }
    return [named(idle, 'idle'), named(run, 'run'), named(jump, 'jump')]
  }, [idle, run, jump])

  const group = useRef()
  const { actions } = useAnimations(clips, group)

  useEffect(() => {
    const action = actions[animation]
    if (!action) return
    action.reset().fadeIn(0.2).play()
    action.setEffectiveTimeScale(speed)
    return () => action.fadeOut(0.2)
  }, [actions, animation, speed])

  return (
    <group ref={group} scale={scale}>
      <primitive object={object} />
    </group>
  )
}
