// Live lighting state, written by Lighting.jsx every frame (smoothly blended)
// and read by the sky, the fake shadows and the window lights.
import * as THREE from 'three'

export const env = {
  sunDir: new THREE.Vector3(0.6, 0.6, 0.3).normalize(), // direction TO the sun
  horizon: new THREE.Color('#bfe3f2'),
  zenith: new THREE.Color('#3f8fd6'),
  sunColor: new THREE.Color('#fff4e0'),
  shadow: 0.3, // opacity of fake shadows
  night: 0, // 0 day .. 1 night: window lights, lamps, stars
}
