import type { ThreeEvent } from "@react-three/fiber"
import { useEffect, useMemo } from "react"
import * as THREE from "three"
import type { TipoInfra } from "../types"
import type { CasaDiorama, TrattoStradale } from "./strade"

type Props = {
  tipo: TipoInfra
  posizione: [number, number, number]
  s: number // unità di misura del modello, proporzionale al comune
  onClick: (e: ThreeEvent<MouseEvent>) => void
}

const Materiale = ({
  colore,
  emissivo,
  roughness = 0.75,
}: {
  colore: string
  emissivo?: string
  roughness?: number
}) => (
  <meshStandardMaterial
    color={colore}
    roughness={roughness}
    emissive={emissivo ?? "#000000"}
    emissiveIntensity={emissivo ? 0.55 : 0}
  />
)

function AlberoParco({ x, z, s, variante = 0 }: { x: number; z: number; s: number; variante?: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* Tronco con radici */}
      <mesh position={[0, 0.32 * s, 0]}>
        <cylinderGeometry args={[0.07 * s, 0.12 * s, 0.64 * s, 8]} />
        <Materiale colore="#5d4037" />
      </mesh>
      {variante % 2 === 0 ? (
        // Latifoglia (Quercia / Tiglio) a chioma multipla morbida
        <>
          <mesh position={[0, 0.85 * s, 0]}>
            <dodecahedronGeometry args={[0.42 * s, 1]} />
            <Materiale colore="#2e7d32" />
          </mesh>
          <mesh position={[0.2 * s, 0.78 * s, 0.15 * s]}>
            <dodecahedronGeometry args={[0.3 * s, 1]} />
            <Materiale colore="#388e3c" />
          </mesh>
          <mesh position={[-0.18 * s, 0.98 * s, -0.1 * s]}>
            <dodecahedronGeometry args={[0.28 * s, 1]} />
            <Materiale colore="#43a047" />
          </mesh>
        </>
      ) : (
        // Conifera (Abete) a 3 palchi sovrapposti
        <>
          <mesh position={[0, 0.72 * s, 0]}>
            <coneGeometry args={[0.46 * s, 0.65 * s, 8]} />
            <Materiale colore="#1b5e20" />
          </mesh>
          <mesh position={[0, 1.05 * s, 0]}>
            <coneGeometry args={[0.36 * s, 0.58 * s, 8]} />
            <Materiale colore="#2e7d32" />
          </mesh>
          <mesh position={[0, 1.34 * s, 0]}>
            <coneGeometry args={[0.24 * s, 0.48 * s, 8]} />
            <Materiale colore="#388e3c" />
          </mesh>
        </>
      )}
    </group>
  )
}

// Costruisce una geometria a nastro continuo 3D lungo una polilinea sul piano XZ
function creaGeometriaNastro(
  punti: [number, number][],
  larghezza: number,
  quotaY: number,
): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry()
  if (punti.length < 2) return geom

  const half = larghezza * 0.5
  const posizioni: number[] = []
  const normali: number[] = []
  const indici: number[] = []

  for (let i = 0; i < punti.length; i++) {
    const curr = punti[i]!
    const prev = punti[Math.max(0, i - 1)]!
    const next = punti[Math.min(punti.length - 1, i + 1)]!
    let tx = next[0] - prev[0]
    let tz = next[1] - prev[1]
    const len = Math.hypot(tx, tz) || 1
    tx /= len
    tz /= len
    const nx = -tz
    const nz = tx

    posizioni.push(curr[0] + nx * half, quotaY, curr[1] + nz * half)
    posizioni.push(curr[0] - nx * half, quotaY, curr[1] - nz * half)
    normali.push(0, 1, 0, 0, 1, 0)

    if (i < punti.length - 1) {
      const base = i * 2
      indici.push(base, base + 1, base + 2)
      indici.push(base + 1, base + 3, base + 2)
    }
  }

  geom.setAttribute("position", new THREE.Float32BufferAttribute(posizioni, 3))
  geom.setAttribute("normal", new THREE.Float32BufferAttribute(normali, 3))
  geom.setIndex(indici)
  return geom
}

// Componente che disegna una strada o pista ciclabile continua, con banchina, asfalto e segnaletica
export function TrattoStradaleMesh({
  tratto,
  y,
  s,
  onClick,
}: {
  tratto: TrattoStradale
  y: number
  s: number
  onClick: (e: ThreeEvent<MouseEvent>) => void
}) {
  const isStrada = tratto.tipo === "strada"

  const geomBanchina = useMemo(
    () => creaGeometriaNastro(tratto.punti, tratto.larghezza * 1.24, y + 0.012 * s),
    [tratto.punti, tratto.larghezza, y, s],
  )
  const geomAsfalto = useMemo(
    () => creaGeometriaNastro(tratto.punti, tratto.larghezza, y + 0.024 * s),
    [tratto.punti, tratto.larghezza, y, s],
  )

  useEffect(
    () => () => {
      geomBanchina.dispose()
      geomAsfalto.dispose()
    },
    [geomBanchina, geomAsfalto],
  )

  const tratteggi = useMemo(() => {
    const out: { pos: [number, number, number]; rotY: number; lungh: number }[] = []
    for (let i = 0; i < tratto.punti.length - 1; i += 2) {
      const p1 = tratto.punti[i]!
      const p2 = tratto.punti[i + 1]!
      const dx = p2[0] - p1[0]
      const dz = p2[1] - p1[1]
      const d = Math.hypot(dx, dz)
      if (d < 0.01 * s) continue
      out.push({
        pos: [(p1[0] + p2[0]) * 0.5, y + 0.032 * s, (p1[1] + p2[1]) * 0.5],
        rotY: -Math.atan2(dz, dx),
        lungh: Math.min(d * 0.65, 0.45 * s),
      })
    }
    return out
  }, [tratto.punti, y, s])

  return (
    <group onClick={onClick}>
      {/* Banchina / cordolo */}
      <mesh geometry={geomBanchina}>
        <meshStandardMaterial
          color={isStrada ? "#90a4ae" : "#f8bbd0"}
          roughness={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Manto stradale continuo */}
      <mesh geometry={geomAsfalto}>
        <meshStandardMaterial
          color={isStrada ? "#2c3137" : "#c62828"}
          roughness={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Segnaletica orizzontale tratteggiata */}
      {tratteggi.map((t, idx) => (
        <mesh key={idx} position={t.pos} rotation={[0, t.rotY, 0]}>
          <boxGeometry args={[t.lungh, 0.008 * s, isStrada ? 0.07 * s : 0.05 * s]} />
          <meshStandardMaterial color={isStrada ? "#f8fafc" : "#fff9c4"} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Edificio residenziale 3D realistico (Casa veneta / villetta con tetto in coppi,
 * finestre, comignolo e pannelli fotovoltaici / solari quando presenti).
 */
export function CasaMesh({
  casa,
  y,
  s,
}: {
  casa: CasaDiorama
  y: number
  s: number
}) {
  const coloriMuri = ["#f5ebe0", "#faedcd", "#ede0d4"] as const
  const coloriTetto = ["#9e472a", "#8d3b23", "#a44a3f"] as const
  const coloreMuro = casa.isCasaUtente ? "#e8f5e9" : coloriMuri[casa.variante]!
  const coloreTetto = coloriTetto[casa.variante]!

  const w = (casa.variante === 1 ? 1.18 : 1.02) * s
  const h = (casa.variante === 2 ? 0.78 : 0.66) * s
  const d = (casa.variante === 0 ? 0.88 : 0.78) * s

  return (
    <group
      position={[casa.posizione[0], y, casa.posizione[1]]}
      rotation={[0, casa.rotazioneY, 0]}
    >
      {/* Piazzola / giardino recintato della casa */}
      <mesh position={[0, 0.015 * s, 0]}>
        <boxGeometry args={[w * 1.38, 0.03 * s, d * 1.38]} />
        <Materiale colore={casa.isCasaUtente ? "#81c784" : "#8d99ae"} roughness={0.9} />
      </mesh>

      {/* Corpo murario principale */}
      <mesh position={[0, h * 0.5 + 0.02 * s, 0]}>
        <boxGeometry args={[w, h, d]} />
        <Materiale colore={coloreMuro} roughness={0.85} />
      </mesh>

      {/* Tetto a falde in coppi vicentini */}
      <mesh position={[0, h + 0.24 * s, 0]} rotation={[0, Math.PI / 4, 0]} scale={[w * 0.86, 0.48 * s, d * 0.86]}>
        <coneGeometry args={[1, 1, 4]} />
        <Materiale colore={coloreTetto} roughness={0.78} />
      </mesh>

      {/* Comignolo */}
      <mesh position={[w * 0.24, h + 0.34 * s, -d * 0.16]}>
        <boxGeometry args={[0.12 * s, 0.24 * s, 0.12 * s]} />
        <Materiale colore="#6d4c41" />
      </mesh>

      {/* Porta d'ingresso e finestre */}
      <mesh position={[0, 0.2 * s, d * 0.505]}>
        <boxGeometry args={[0.18 * s, 0.34 * s, 0.02 * s]} />
        <Materiale colore="#5d4037" />
      </mesh>
      {[-0.28, 0.28].map((fx) => (
        <mesh key={fx} position={[fx * w, h * 0.62, d * 0.505]}>
          <boxGeometry args={[0.18 * s, 0.18 * s, 0.02 * s]} />
          <Materiale colore="#90caf9" emissivo="#fff59d" roughness={0.2} />
        </mesh>
      ))}

      {/* Pannelli fotovoltaici sul tetto se la casa ne è dotata */}
      {casa.fotovoltaico && (
        <mesh position={[0, h + 0.27 * s, d * 0.2]} rotation={[0.48, 0, 0]}>
          <boxGeometry args={[w * 0.68, 0.028 * s, d * 0.42]} />
          <Materiale colore="#0d47a1" emissivo="#1565c0" roughness={0.2} />
        </mesh>
      )}

      {/* Colonnina / Wallbox EV domestica */}
      {casa.colonninaEV && (
        <mesh position={[w * 0.56, 0.18 * s, d * 0.25]}>
          <boxGeometry args={[0.1 * s, 0.28 * s, 0.1 * s]} />
          <Materiale colore="#00c853" emissivo="#00e676" />
        </mesh>
      )}

      {/* Segnaposto luminoso per "La tua casa" */}
      {casa.isCasaUtente && (
        <mesh position={[0, h + 0.68 * s, 0]}>
          <octahedronGeometry args={[0.16 * s, 0]} />
          <Materiale colore="#00e676" emissivo="#00e676" roughness={0.2} />
        </mesh>
      )}
    </group>
  )
}

function Corpo({ tipo, s }: { tipo: TipoInfra; s: number }) {
  switch (tipo) {
    case "parco":
      return (
        <>
          {/* Prato fiorito e laghetto */}
          <mesh position={[0, 0.03 * s, 0]}>
            <cylinderGeometry args={[2.5 * s, 2.6 * s, 0.06 * s, 18]} />
            <Materiale colore="#55a630" />
          </mesh>
          <mesh position={[0.45 * s, 0.065 * s, 0.25 * s]}>
            <cylinderGeometry args={[0.68 * s, 0.65 * s, 0.02 * s, 14]} />
            <Materiale colore="#29b6f6" roughness={0.25} />
          </mesh>
          <AlberoParco x={-1.1 * s} z={0.5 * s} s={s} variante={0} />
          <AlberoParco x={0.8 * s} z={-1.0 * s} s={s} variante={1} />
          <AlberoParco x={1.15 * s} z={0.95 * s} s={s * 0.9} variante={0} />
          <AlberoParco x={-0.75 * s} z={-0.95 * s} s={s * 0.85} variante={1} />
        </>
      )
    case "ciclabile":
      // Gazebo/punto bici sul tracciato continuo della pista ciclabile
      return (
        <group>
          <mesh position={[0, 0.04 * s, 0]}>
            <cylinderGeometry args={[0.55 * s, 0.58 * s, 0.06 * s, 12]} />
            <Materiale colore="#c62828" />
          </mesh>
          <mesh position={[0, 0.35 * s, 0]}>
            <cylinderGeometry args={[0.04 * s, 0.04 * s, 0.65 * s, 6]} />
            <Materiale colore="#eceff1" />
          </mesh>
          <mesh position={[0, 0.68 * s, 0]}>
            <boxGeometry args={[0.34 * s, 0.24 * s, 0.06 * s]} />
            <Materiale colore="#0288d1" emissivo="#29b6f6" />
          </mesh>
        </group>
      )
    case "colonnine":
      return (
        <>
          {/* Piazzola ricarica con pensilina fotovoltaica */}
          <mesh position={[0, 0.025 * s, 0]}>
            <boxGeometry args={[2.1 * s, 0.05 * s, 1.3 * s]} />
            <Materiale colore="#546e7a" />
          </mesh>
          <mesh position={[0, 1.15 * s, -0.15 * s]} rotation={[0.18, 0, 0]}>
            <boxGeometry args={[2.0 * s, 0.06 * s, 1.1 * s]} />
            <Materiale colore="#1a237e" roughness={0.3} />
          </mesh>
          {[-0.6, 0.6].map((x) => (
            <group key={x} position={[x * s, 0, 0]}>
              <mesh position={[0, 0.52 * s, 0]}>
                <boxGeometry args={[0.42 * s, 0.95 * s, 0.34 * s]} />
                <Materiale colore="#1e88e5" />
              </mesh>
              <mesh position={[0, 0.78 * s, 0.18 * s]}>
                <boxGeometry args={[0.26 * s, 0.22 * s, 0.02 * s]} />
                <Materiale colore="#b3e5fc" emissivo="#00e676" />
              </mesh>
            </group>
          ))}
        </>
      )
    case "industria":
      return (
        <>
          {/* Capannone industriale principale + shed + ciminiere */}
          <mesh position={[0, 0.68 * s, 0]}>
            <boxGeometry args={[3.1 * s, 1.36 * s, 2.1 * s]} />
            <Materiale colore="#78909c" />
          </mesh>
          <mesh position={[1.1 * s, 0.52 * s, 0]}>
            <boxGeometry args={[1.2 * s, 1.04 * s, 1.8 * s]} />
            <Materiale colore="#90a4ae" />
          </mesh>
          <mesh position={[-0.9 * s, 1.95 * s, 0.35 * s]}>
            <cylinderGeometry args={[0.22 * s, 0.3 * s, 1.75 * s, 12]} />
            <Materiale colore="#455a64" />
          </mesh>
          <mesh position={[-0.9 * s, 2.72 * s, 0.35 * s]}>
            <cylinderGeometry args={[0.24 * s, 0.24 * s, 0.16 * s, 12]} />
            <Materiale colore="#d32f2f" />
          </mesh>
          <mesh position={[0.1 * s, 1.72 * s, 0.35 * s]}>
            <cylinderGeometry args={[0.19 * s, 0.25 * s, 1.3 * s, 12]} />
            <Materiale colore="#455a64" />
          </mesh>
        </>
      )
    case "strada":
      // Rotatoria / svincolo sul nodo della strada principale (collegato dal nastro continuo)
      return (
        <group>
          <mesh position={[0, 0.026 * s, 0]}>
            <cylinderGeometry args={[0.88 * s, 0.92 * s, 0.05 * s, 20]} />
            <Materiale colore="#2c3137" />
          </mesh>
          <mesh position={[0, 0.055 * s, 0]}>
            <cylinderGeometry args={[0.38 * s, 0.42 * s, 0.05 * s, 16]} />
            <Materiale colore="#4caf50" />
          </mesh>
          <mesh position={[0, 0.058 * s, 0]}>
            <torusGeometry args={[0.41 * s, 0.04 * s, 8, 20]} />
            <Materiale colore="#eceff1" />
          </mesh>
        </group>
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
