import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { env } from './env.js'

// A gradient sky dome that follows the camera: horizon haze (same colour as
// the fog), deeper colour overhead, a soft sun, slow clouds and, at night,
// a few stars. One draw call, no textures.

const vertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
    gl_Position.z = gl_Position.w; // always behind everything
  }
`
const fragment = /* glsl */ `
  precision mediump float;
  varying vec3 vDir;
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uNight;
  uniform float uTime;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    vec3 d = normalize(vDir);
    float h = max(d.y, 0.0);
    vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
    // sun: small disc + wide glow
    float s = max(dot(d, uSunDir), 0.0);
    col += uSunColor * (pow(s, 600.0) * 1.4 + pow(s, 12.0) * 0.22) * (1.0 - uNight * 0.6);
    // clouds on a flat layer above
    if (d.y > 0.02) {
      vec2 uv = d.xz / (d.y + 0.25) * 1.6 + vec2(uTime * 0.006, 0.0);
      float c = noise(uv) * 0.6 + noise(uv * 2.3) * 0.4;
      c = smoothstep(0.52, 0.86, c) * smoothstep(0.02, 0.22, d.y);
      col = mix(col, mix(vec3(1.0), uHorizon, 0.35) * (1.0 - uNight * 0.75), c * 0.75);
    }
    // stars
    if (uNight > 0.3 && d.y > 0.05) {
      vec2 g = floor(d.xz / (d.y + 0.4) * 90.0);
      float st = step(0.992, hash(g));
      col += vec3(st) * (uNight - 0.3) * 1.2 * smoothstep(0.05, 0.3, d.y);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

export default function Sky() {
  const ref = useRef()
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: true,
        fog: false,
        uniforms: {
          uHorizon: { value: env.horizon },
          uZenith: { value: env.zenith },
          uSunDir: { value: env.sunDir },
          uSunColor: { value: env.sunColor },
          uNight: { value: 0 },
          uTime: { value: 0 },
        },
      }),
    [],
  )
  useFrame(({ camera, clock }) => {
    if (ref.current) ref.current.position.copy(camera.position)
    material.uniforms.uNight.value = env.night
    material.uniforms.uTime.value = clock.elapsedTime
  })
  return (
    <mesh ref={ref} material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[50, 20, 12]} />
    </mesh>
  )
}
