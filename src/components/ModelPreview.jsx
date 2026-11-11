import { Model } from '../game/world/Model.jsx'

// Asset browser wrapper: shows a manifest model exactly as the game will
// (tweaks applied, Lambert materials, placeholder box if missing).
export default function ModelPreview({ name }) {
  return <Model name={name} />
}
