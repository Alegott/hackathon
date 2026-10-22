import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import type { PresetVisivo } from "./preset"

const NUVOLE_MAX = 9
const BIANCO = new THREE.Color("#ffffff")
const SCURO = new THREE.Color("#4b4d50")
const NERO = new THREE.Color("#000000")
const BOLLE: [number, number, number, number][] = [[-1, 0, 0, 1], [0, 0.35, 0, 1.3], [1.1, 0, 0.2, 0.9]]

export function Nuvole({ centro, dimensione, y, preset }: {
  centro: [number, number]; dimensione: number; y: number; preset: { current: PresetVisivo }
}) {
  const gruppi = useRef<(THREE.Group | null)[]>([])
  const materiale = useMemo(() => new THREE.MeshStandardMaterial({ flatShading: true, transparent: true, opacity: 0.92, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.45 }), [])
  useEffect(() => () => materiale.dispose(), [materiale])
  const nuvole = useMemo(
    () => Array.from({ length: NUVOLE_MAX }, (_, i) => {
      const a = (i / NUVOLE_MAX) * Math.PI * 2
      const r = dimensione * (0.2 + 0.3 * (((i * 37) % 10) / 10))
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, h: dimensione * (0.65 + 0.12 * (i % 3)), v: 0.02 + 0.01 * (i % 4) }
    }),
    [dimensione],
  )
  useFrame((_, dt) => {
    const { quantita, grigio } = preset.current.nuvole
    const n = Math.round(quantita * NUVOLE_MAX)
    materiale.color.lerpColors(BIANCO, SCURO, grigio)
    materiale.emissive.lerpColors(BIANCO, NERO, grigio)
    nuvole.forEach((p, i) => {
      const g = gruppi.current[i]
      if (!g) return
      g.visible = i < n
      p.x += p.v * dimensione * Math.min(dt, 0.1)
      if (p.x > dimensione) p.x = -dimensione
      g.position.set(centro[0] + p.x, y + p.h, centro[1] + p.z)
    })
  })
  const s = dimensione * 0.04
  return (
    <>
      {nuvole.map((_, i) => (
        <group key={i} ref={(g) => { gruppi.current[i] = g }} visible={false}>
          {BOLLE.map(([x, yy, z, k], j) => (
            <mesh key={j} position={[x * s, yy * s, z * s]} scale={[1.4, 0.7, 1]} material={materiale}>
              <icosahedronGeometry args={[s * k, 0]} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}
