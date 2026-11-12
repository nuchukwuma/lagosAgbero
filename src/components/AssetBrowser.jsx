import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { MODELS, getAsset } from '../assets/assetManifest.js'
import ModelPreview from './ModelPreview.jsx'
import Character from '../game/characters/Character.jsx'
import { CLIP_NAMES } from '../game/characters/clipLoader.js'
import characters from '../game/data/characters.json'

// Developer screen: pick any manifest name and see it at real scale (with its
// Nigerian-look tweaks), next to a 1.75 m person. The "cast" category shows
// every story character's look side by side.

const CATEGORIES = ['vehicle', 'prop', 'road', 'street', 'building', 'nature', 'cast']
const ANIMS = CLIP_NAMES.map((id) => ({ id, label: id }))
const CAST = Object.entries(characters).filter(([, c]) => c.look)

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

function CastLineup({ animation }) {
  const spacing = 1.4
  return CAST.map(([id, c], i) => (
    <Suspense key={id} fallback={null}>
      <Character look={c.look} animation={animation} position={[(i - (CAST.length - 1) / 2) * spacing, 0, 0]} />
    </Suspense>
  ))
}

export default function AssetBrowser({ onBack }) {
  const [category, setCategory] = useState('vehicle')
  const names = useMemo(() => Object.keys(MODELS).filter((n) => MODELS[n].category === category), [category])
  const [selected, setSelected] = useState('danfo')
  const [anim, setAnim] = useState(Math.max(0, CLIP_NAMES.indexOf('breathingIdle')))
  const [person, setPerson] = useState('player')
  const cast = category === 'cast'
  const asset = getAsset(selected)
  const radius = cast ? 15 : Math.max(...asset.size, 3)
  const look = person === 'player' ? undefined : characters[person]?.look

  return (
    <div className="screen asset-browser">
      <div className="asset-toolbar">
        <button className="btn btn-small" onClick={onBack}>
          ← Back
        </button>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {!cast && (
          <select value={names.includes(selected) ? selected : ''} onChange={(e) => setSelected(e.target.value)} aria-label="Model">
            <option value="" disabled>
              pick a model…
            </option>
            {names.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        )}
        <select value={anim} onChange={(e) => setAnim(Number(e.target.value))} aria-label="Animation">
          {ANIMS.map((a, i) => (
            <option key={a.label} value={i}>
              {a.label}
            </option>
          ))}
        </select>
        {!cast && (
          <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Person">
            <option value="player">player (default look)</option>
            {CAST.map(([id]) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="asset-info">
        {cast ? (
          <>
            <strong>Cast lineup</strong> · {CAST.map(([id]) => id).join(', ')}
          </>
        ) : (
          <>
            <strong>{selected}</strong> · <code>{asset.file}</code> · {asset.size.map((v) => v.toFixed(1)).join(' × ')} m
            {!asset.available && <span className="warn"> · MISSING → placeholder</span>}
            <div className="asset-use">{asset.use}</div>
            {asset.tweak && <div className="asset-use">Tweaks: {JSON.stringify(asset.tweak)}</div>}
          </>
        )}
      </div>

      <div className="asset-canvas">
        <Canvas dpr={[1, 1.5]} camera={{ position: [radius * 1.3, radius * 0.8, radius * 1.6], fov: 45 }}>
          <color attach="background" args={['#d9c9a3']} />
          <hemisphereLight args={['#fff6e0', '#6b5a3a', 1.1]} />
          <directionalLight position={[5, 8, 3]} intensity={1.6} />
          <Grid args={[40, 40]} cellSize={1} sectionSize={8} cellColor="#b5a37c" sectionColor="#8a7650" fadeDistance={60} />
          {cast ? (
            <CastLineup animation={ANIMS[anim].id} />
          ) : (
            <>
              <Suspense fallback={null}>
                <Character look={look} animation={ANIMS[anim].id} position={[asset.size[0] / 2 + 1, 0, asset.size[2] / 4]} />
              </Suspense>
              <ModelPreview key={selected} name={selected} />
            </>
          )}
          <OrbitControls makeDefault />
          <FitCamera radius={radius} height={cast ? 1.2 : asset.size[1]} />
        </Canvas>
      </div>
    </div>
  )
}
