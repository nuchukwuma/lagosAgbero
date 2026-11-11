import { Component, Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getAsset } from '../../assets/assetManifest.js'
import { useModelPrototype, placementMatrix } from './models.js'

// <Model name="danfo" position={[0,0,0]} rotation-y={1.57} />
//   one copy of a manifest model, with a same-size box if it is missing.
// <ModelInstances name="electricityPole" items={[{ position, rotation, scale }]} />
//   many copies drawn with instancing (one draw call per part).

const boxGeo = new THREE.BoxGeometry(1, 1, 1)
boxGeo.translate(0, 0.5, 0)
const fallbackMaterials = new Map()
const fallbackMaterial = (color) => {
  if (!fallbackMaterials.has(color)) fallbackMaterials.set(color, new THREE.MeshLambertMaterial({ color }))
  return fallbackMaterials.get(color)
}

class Fallback extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    console.warn(`[models] "${this.props.name}" failed to load; using a placeholder box.`, error)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function PlaceholderBox({ name }) {
  const a = getAsset(name)
  return <mesh geometry={boxGeo} material={fallbackMaterial(a.fallbackColor)} scale={a.size} position={[a.offset[0], 0, a.offset[2]]} />
}

function LoadedModel({ name }) {
  const proto = useModelPrototype(name)
  const object = useMemo(() => proto.object.clone(true), [proto])
  return <primitive object={object} />
}

export function Model({ name, ...groupProps }) {
  const asset = getAsset(name)
  const fallback = <PlaceholderBox name={name} />
  return (
    <group {...groupProps}>
      {asset.available ? (
        <Fallback name={name} fallback={fallback}>
          <Suspense fallback={null}>
            <LoadedModel name={name} />
          </Suspense>
        </Fallback>
      ) : (
        fallback
      )}
    </group>
  )
}

function InstancedPart({ geometry, material, partMatrix, items }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    items.forEach((item, i) => {
      m.multiplyMatrices(placementMatrix(item), partMatrix)
      ref.current.setMatrixAt(i, m)
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [items, partMatrix])
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} />
}

function LoadedInstances({ name, items }) {
  const proto = useModelPrototype(name)
  return proto.parts.map((p, i) => <InstancedPart key={i} geometry={p.geometry} material={p.material} partMatrix={p.matrix} items={items} />)
}

function PlaceholderInstances({ name, items }) {
  const a = getAsset(name)
  const partMatrix = useMemo(() => new THREE.Matrix4().makeTranslation(a.offset[0], 0, a.offset[2]).multiply(new THREE.Matrix4().makeScale(...a.size)), [a])
  return <InstancedPart geometry={boxGeo} material={fallbackMaterial(a.fallbackColor)} partMatrix={partMatrix} items={items} />
}

export function ModelInstances({ name, items }) {
  const asset = getAsset(name)
  if (!items?.length) return null
  const fallback = <PlaceholderInstances name={name} items={items} />
  if (!asset.available) return fallback
  return (
    <Fallback name={name} fallback={fallback}>
      <Suspense fallback={null}>
        <LoadedInstances name={name} items={items} />
      </Suspense>
    </Fallback>
  )
}
