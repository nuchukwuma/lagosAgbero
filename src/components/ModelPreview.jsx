import { Component, Suspense, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { getAsset } from '../assets/assetManifest.js'

// Shows one manifest model at world scale. If the file is missing or fails to
// load, it shows a coloured box of the same size instead (the fallback rule).

function FallbackBox({ asset }) {
  const [w, h, d] = asset.size
  return (
    <mesh position={[0, h / 2, 0]}>
      <boxGeometry args={[w, h, d]} />
      <meshLambertMaterial color={asset.fallbackColor} wireframe={false} />
    </mesh>
  )
}

function LoadedModel({ asset }) {
  const { scene } = useGLTF(asset.url)
  // Clone so the cached original stays untouched when we tweak it later.
  const object = useMemo(() => scene.clone(true), [scene])
  return <primitive object={object} scale={asset.scale} />
}

class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    console.warn(`[assets] "${this.props.asset.name}" failed to load, using a placeholder.`, error)
  }
  render() {
    return this.state.failed ? <FallbackBox asset={this.props.asset} /> : this.props.children
  }
}

export default function ModelPreview({ name }) {
  const asset = getAsset(name)
  if (!asset.available) return <FallbackBox asset={asset} />
  return (
    <ModelErrorBoundary key={name} asset={asset}>
      <Suspense fallback={<FallbackBox asset={asset} />}>
        <LoadedModel asset={asset} />
      </Suspense>
    </ModelErrorBoundary>
  )
}
