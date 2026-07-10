import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * HeroSignature — the one signature 3D moment on the whole site.
 *
 * A field of particles that reads as "scattered blood cells" at rest,
 * and pulls into a loosely connected network as the user scrolls past
 * the hero — a quiet visual metaphor for what BloodBridge actually does
 * (turning scattered requests into a connected donor network), without
 * spelling it out literally.
 *
 * Kept to a single accent color family (red -> teal) and low particle
 * count so it stays a signature, not a light show.
 */

const COUNT = 720

function CellField({ scrollProgress }) {
  const pointsRef = useRef()
  const mouse = useRef({ x: 0, y: 0 })

  // Two target layouts: scattered sphere (rest) and a flattened,
  // loosely gridded "network" plane (scrolled).
  const { scattered, networked, colors } = useMemo(() => {
    const scattered = new Float32Array(COUNT * 3)
    const networked = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)

    const red = new THREE.Color('#e8493f')
    const teal = new THREE.Color('#7dd3c0')

    for (let i = 0; i < COUNT; i++) {
      // scattered: random point on/in a sphere shell
      const r = 3.4 + Math.random() * 1.8
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      scattered[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      scattered[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      scattered[i * 3 + 2] = r * Math.cos(phi) * 0.7

      // networked: jittered grid on a flattened disc
      const gridSize = Math.ceil(Math.sqrt(COUNT))
      const gx = (i % gridSize) / gridSize - 0.5
      const gy = Math.floor(i / gridSize) / gridSize - 0.5
      networked[i * 3] = gx * 9 + (Math.random() - 0.5) * 0.3
      networked[i * 3 + 1] = gy * 9 + (Math.random() - 0.5) * 0.3
      networked[i * 3 + 2] = (Math.random() - 0.5) * 0.6

      const mixed = red.clone().lerp(teal, Math.random() * 0.35)
      colors[i * 3] = mixed.r
      colors[i * 3 + 1] = mixed.g
      colors[i * 3 + 2] = mixed.b
    }
    return { scattered, networked, colors }
  }, [])

  const positions = useMemo(() => new Float32Array(scattered), [scattered])

  useEffect(() => {
    const onMove = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  useFrame(({ clock }) => {
    if (!pointsRef.current) return
    const t = clock.getElapsedTime()
    const posAttr = pointsRef.current.geometry.attributes.position
    const p = scrollProgress.current

    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3
      const sx = scattered[i3], sy = scattered[i3 + 1], sz = scattered[i3 + 2]
      const nx = networked[i3], ny = networked[i3 + 1], nz = networked[i3 + 2]
      // gentle idle drift on top of the interpolated position
      const drift = Math.sin(t * 0.4 + i) * 0.05
      posAttr.array[i3]     = THREE.MathUtils.lerp(sx, nx, p) + drift
      posAttr.array[i3 + 1] = THREE.MathUtils.lerp(sy, ny, p) + drift * 0.6
      posAttr.array[i3 + 2] = THREE.MathUtils.lerp(sz, nz, p)
    }
    posAttr.needsUpdate = true

    pointsRef.current.rotation.y = t * 0.035 + mouse.current.x * 0.12
    pointsRef.current.rotation.x = mouse.current.y * 0.08
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={COUNT} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        vertexColors
        transparent
        opacity={0.7}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export default function HeroSignature({ scrollProgress }) {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Fallback progress ref if none passed
  const localProgress = useRef(0)
  const progress = scrollProgress || localProgress

  if (reducedMotion) return null

  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 45 }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
    >
      <CellField scrollProgress={progress} />
    </Canvas>
  )
}
