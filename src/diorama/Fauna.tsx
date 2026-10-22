import { useFrame } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import * as THREE from "three"
import { posizioniAlberi } from "./alberi"
import type { Punto } from "./geometria"
import type { PresetVisivo } from "./preset"

const UCCELLI_MAX = 12
const ANIMALI_MAX = 8

// Uccelli che girano in cerchio sopra il comune e piccoli animali che si muovono sul terreno.
// Quanti se ne vedono lo decide il preset (la fauna sparisce al peggiorare della fascia).
export function Fauna({ anello, centro, dimensione, y, preset }: {
  anello: Punto[]; centro: Punto; dimensione: number; y: number; preset: { current: PresetVisivo }
}) {
  const uccelli = useRef<(THREE.Group | null)[]>([])
  const ali = useRef<([THREE.Mesh | null, THREE.Mesh | null])[]>([])
  const animali = useRef<(THREE.Mesh | null)[]>([])
  const tana = useMemo(
    () => posizioniAlberi({ poligono: anello, max: ANIMALI_MAX, densita: 1, seme: 99, ostacoli: [] }),
    [anello],
  )
  const s = dimensione * 0.03
  const t = useRef(0)

  useFrame((_, dt) => {
    t.current += Math.min(dt, 0.1)
    const nU = Math.round(preset.current.uccelli)
    const nA = Math.round(preset.current.animali)
    for (let i = 0; i < UCCELLI_MAX; i++) {
      const g = uccelli.current[i]
      if (!g) continue
      g.visible = i < nU
      const a = t.current * (0.35 + 0.05 * (i % 4)) + i * 1.7
      const r = dimensione * (0.18 + 0.07 * (i % 5))
      g.position.set(centro[0] + Math.cos(a) * r, y + dimensione * (0.2 + 0.04 * (i % 3)), centro[1] + Math.sin(a) * r)
      g.rotation.y = -a
      const battito = Math.sin(t.current * 9 + i) * 0.6
      const [sx, dx] = ali.current[i] ?? [null, null]
      if (sx) sx.rotation.x = battito
      if (dx) dx.rotation.x = -battito
    }
    for (let i = 0; i < ANIMALI_MAX; i++) {
      const m = animali.current[i], base = tana[i]
      if (!m || !base) continue
      m.visible = i < nA
      const a = t.current * 0.5 + i * 2.1
      m.position.set(base[0] + Math.cos(a) * 3 * s, y + 0.25 * s, base[1] + Math.sin(a) * 3 * s)
      m.rotation.y = -a
    }
  })

  return (
    <>
      {Array.from({ length: UCCELLI_MAX }, (_, i) => (
        <group key={`u${i}`} ref={(g) => { uccelli.current[i] = g }} visible={false}>
          <mesh scale={[1.6, 0.7, 0.8]}><icosahedronGeometry args={[s * 0.5, 0]} /><meshStandardMaterial color="#37474f" flatShading /></mesh>
          <mesh ref={(m) => { ali.current[i] = [m, ali.current[i]?.[1] ?? null] }} position={[0, 0, s * 0.5]}>
            <boxGeometry args={[s * 0.8, s * 0.05, s * 1.2]} /><meshStandardMaterial color="#546e7a" flatShading />
          </mesh>
          <mesh ref={(m) => { ali.current[i] = [ali.current[i]?.[0] ?? null, m] }} position={[0, 0, -s * 0.5]}>
            <boxGeometry args={[s * 0.8, s * 0.05, s * 1.2]} /><meshStandardMaterial color="#546e7a" flatShading />
          </mesh>
        </group>
      ))}
      {Array.from({ length: ANIMALI_MAX }, (_, i) => (
        <mesh key={`a${i}`} ref={(m) => { animali.current[i] = m }} visible={false}>
          <boxGeometry args={[s * 1.6, s * 0.8, s * 0.8]} />
          <meshStandardMaterial color={i % 2 ? "#8d6e63" : "#a1887f"} flatShading />
        </mesh>
      ))}
    </>
  )
}
