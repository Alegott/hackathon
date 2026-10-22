import type { ThreeEvent } from "@react-three/fiber"
import type { TipoInfra } from "../types"

type Props = {
  tipo: TipoInfra
  posizione: [number, number, number]
  s: number // unità di misura del modello, proporzionale al comune
  onClick: (e: ThreeEvent<MouseEvent>) => void
}

const Materiale = ({ colore, emissivo }: { colore: string; emissivo?: string }) => (
  <meshStandardMaterial color={colore} flatShading emissive={emissivo ?? "#000000"} emissiveIntensity={emissivo ? 0.5 : 0} />
)

function Albero({ x, z, s }: { x: number; z: number; s: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.35 * s, 0]}><cylinderGeometry args={[0.08 * s, 0.1 * s, 0.7 * s, 5]} /><Materiale colore="#6d4c41" /></mesh>
      <mesh position={[0, 1.0 * s, 0]}><coneGeometry args={[0.45 * s, 1.1 * s, 6]} /><Materiale colore="#2e7d32" /></mesh>
    </group>
  )
}

function Corpo({ tipo, s }: { tipo: TipoInfra; s: number }) {
  switch (tipo) {
    case "parco":
      return (
        <>
          <mesh position={[0, 0.03 * s, 0]}><cylinderGeometry args={[2.4 * s, 2.4 * s, 0.06 * s, 12]} /><Materiale colore="#66bb6a" /></mesh>
          <Albero x={-0.9 * s} z={0.4 * s} s={s} />
          <Albero x={0.7 * s} z={-0.8 * s} s={s} />
          <Albero x={0.9 * s} z={0.9 * s} s={s} />
        </>
      )
    case "ciclabile":
      return (
        <>
          <mesh position={[0, 0.03 * s, 0]}><boxGeometry args={[5 * s, 0.06 * s, 0.7 * s]} /><Materiale colore="#d84a6b" /></mesh>
          <mesh position={[0, 0.07 * s, 0]}><boxGeometry args={[4.6 * s, 0.02 * s, 0.1 * s]} /><Materiale colore="#ffffff" /></mesh>
        </>
      )
    case "colonnine":
      return (
        <>
          {[-0.6, 0.6].map((x) => (
            <group key={x} position={[x * s, 0, 0]}>
              <mesh position={[0, 0.5 * s, 0]}><boxGeometry args={[0.5 * s, 1.0 * s, 0.4 * s]} /><Materiale colore="#1e88e5" /></mesh>
              <mesh position={[0, 0.85 * s, 0.21 * s]}><boxGeometry args={[0.3 * s, 0.25 * s, 0.02 * s]} /><Materiale colore="#b3e5fc" emissivo="#4fc3f7" /></mesh>
            </group>
          ))}
        </>
      )
    case "industria":
      return (
        <>
          <mesh position={[0, 0.7 * s, 0]}><boxGeometry args={[3 * s, 1.4 * s, 2 * s]} /><Materiale colore="#7b838c" /></mesh>
          <mesh position={[-0.9 * s, 1.9 * s, 0.3 * s]}><cylinderGeometry args={[0.25 * s, 0.3 * s, 1.6 * s, 8]} /><Materiale colore="#4e545a" /></mesh>
          <mesh position={[0.1 * s, 1.7 * s, 0.3 * s]}><cylinderGeometry args={[0.22 * s, 0.27 * s, 1.2 * s, 8]} /><Materiale colore="#4e545a" /></mesh>
        </>
      )
    case "strada":
      return (
        <>
          <mesh position={[0, 0.03 * s, 0]}><boxGeometry args={[6 * s, 0.06 * s, 1.0 * s]} /><Materiale colore="#3c4147" /></mesh>
          <mesh position={[0, 0.07 * s, 0]}><boxGeometry args={[5.4 * s, 0.02 * s, 0.08 * s]} /><Materiale colore="#f5f5f5" /></mesh>
        </>
      )
  }
}

export function Infrastruttura({ tipo, posizione, s, onClick }: Props) {
  return (
    <group position={posizione} onClick={onClick}>
      <Corpo tipo={tipo} s={s} />
    </group>
  )
}
