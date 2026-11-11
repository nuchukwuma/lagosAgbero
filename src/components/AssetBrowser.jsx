import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { MODELS, getAsset } from '../assets/assetManifest.js'
import ModelPreview from './ModelPreview.jsx'
import CharacterPreview from './CharacterPreview.jsx'
import { CLIP_NAMES } from '../game/characters/clipLoader.js'

// Developer screen: pick any manifest name and see it at real scale, next to
// a 1.75 m person for comparison. Lets you check names, sizes and fallbacks.

const CATEGORIES = ['vehicle', 'prop', 'road', 'street', 'building', 'nature']
// Kenney's 3 animations first, then every retargeted Mixamo clip.
const ANIMS = [
  { id: 'idle', label: 'idle (Kenney)', speed: 1 },
  { id: 'run', label: 'run (Kenney)', speed: 1 },
  { id: 'jump', label: 'jump (Kenney)', speed: 1 },
  ...CLIP_NAMES.map((id) => ({ id, label: `${id} (Mixamo)`, speed: 1 })),
]

// Moves the camera back far enough to see the whole model plus the person.
function FitCamera({ radius, height }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  useEffect(() => {
    camera.position.set(radius * 1.3, Math.max(radius * 0.8, height * 1.2), radius * 1.6)
    camera.lookAt(0, height / 2, 0)
    if (controls) {
      controls.target.set(0, height / 2, 0)
      controls.update()
    }
  }, [camera, controls, radius, height])
  return null
}

export default function AssetBrowser({ onBack }) {
  const [category, setCategory] = useState('vehicle')
  const names = useMemo(() => Object.keys(MODELS).filter((n) => MODELS[n].category === category), [category])
  const [selected, setSelected] = useState('danfo')
  const [anim, setAnim] = useState(0)
  const [skin, setSkin] = useState('male')
  const asset = getAsset(selected)
  const radius = Math.max(...asset.size, 3)

  return (
    <div className="screen asset-browser">
      <div className="asset-toolbar">
        <button className="btn btn-small" onClick={onBack}>
          ← Back
        </button>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={names.includes(selected) ? selected : ''} onChange={(e) => setSelected(e.target.value)}>
          <option value="" disabled>
            pick a model…
          </option>
          {names.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <select value={anim} onChange={(e) => setAnim(Number(e.target.value))}>
          {ANIMS.map((a, i) => (
            <option key={a.label} value={i}>
              {a.label}
            </option>
          ))}
        </select>
        <select value={skin} onChange={(e) => setSkin(e.target.value)}>
          <option value="male">male skin</option>
          <option value="female">female skin</option>
        </select>
      </div>

      <div className="asset-info">
        <strong>{selected}</strong> · <code>{asset.file}</code> · {asset.size.map((v) => v.toFixed(1)).join(' × ')} m
        {!asset.available && <span className="warn"> · MISSING → placeholder</span>}
        <div className="asset-use">{asset.use}</div>
        {asset.tweak && <div className="asset-use">Planned tweak: {JSON.stringify(asset.tweak)}</div>}
      </div>

      <div className="asset-canvas">
        <Canvas dpr={[1, 1.5]} camera={{ position: [radius * 1.3, radius * 0.8, radius * 1.6], fov: 45 }}>
          <color attach="background" args={['#d9c9a3']} />
          <hemisphereLight args={['#fff6e0', '#6b5a3a', 1.1]} />
          <directionalLight position={[5, 8, 3]} intensity={1.6} />
          <Grid args={[40, 40]} cellSize={1} sectionSize={8} cellColor="#b5a37c" sectionColor="#8a7650" fadeDistance={60} />
          <group position={[asset.size[0] / 2 + 1, 0, asset.size[2] / 4]}>
            <Suspense fallback={null}>
              <CharacterPreview skin={skin} animation={ANIMS[anim].id} speed={ANIMS[anim].speed} />
            </Suspense>
          </group>
          <ModelPreview key={selected} name={selected} />
          <OrbitControls makeDefault />
          <FitCamera radius={radius} height={asset.size[1]} />
        </Canvas>
      </div>
    </div>
  )
}
