import { OrbitControls } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { store, useApp, useIndici } from "../app/useApp"
import { dataset } from "../data/dataset"
import type { Comune, StatoComune } from "../types"
import { coloreFascia } from "./fasce"
import { creaProiezione, type Proiezione } from "./scena"

const DIMENSIONE = 24
const ALTEZZA_MIN = 0.15
const ALTEZZA_MAX = 0.9
const DIREZIONE_CAMERA = new THREE.Vector3(0, 0.8, 0.6).normalize()

type Hover = { istat: string; x: number; y: number } | null

function creaGeometria(c: Comune, p: Proiezione, altezza: number): THREE.BufferGeometry[] {
  return c.geometria.map((anello) => {
    // Shape sul piano XY: la y della forma diventa −z dopo la rotazione −90° attorno a X.
    const forma = new THREE.Shape(anello.map((pt) => {
      const [x, z] = p.aScena(pt)
      return new THREE.Vector2(x, -z)
    }))
    return new THREE.ExtrudeGeometry(forma, { depth: altezza, bevelEnabled: false })
  })
}

function ComuneMesh({
  comune, stato, proiezione, selezionato, attenuato, onHover,
}: {
  comune: Comune
  stato: StatoComune
  proiezione: Proiezione
  selezionato: boolean
  attenuato: boolean
  onHover: (h: Hover) => void
}) {
  const altezza = ALTEZZA_MIN + (stato.totale / 100) * (ALTEZZA_MAX - ALTEZZA_MIN)
  const geometrie = useMemo(() => creaGeometria(comune, proiezione, altezza), [comune, proiezione, altezza])
  useEffect(() => () => geometrie.forEach((g) => g.dispose()), [geometrie])
  const colore = coloreFascia(stato.fascia)
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {geometrie.map((g, i) => (
        <mesh
          key={i}
          geometry={g}
          onPointerMove={(e) => {
            e.stopPropagation()
            onHover({ istat: comune.istat, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
          }}
          onPointerOut={() => onHover(null)}
          onClick={(e) => {
            e.stopPropagation()
            store.getState().selezionaComune(comune.istat)
          }}
        >
          <meshStandardMaterial
            color={colore}
            flatShading
            transparent={attenuato}
            opacity={attenuato ? 0.35 : 1}
            emissive={selezionato ? colore : "#000000"}
            emissiveIntensity={selezionato ? 0.35 : 0}
          />
        </mesh>
      ))}
    </group>
  )
}

// Zoom animato verso il comune selezionato (o ritorno alla provincia). L'animazione dura poco
// così l'utente può poi ruotare e zoomare liberamente.
function RigCamera({ proiezione }: { proiezione: Proiezione }) {
  const vista = useApp((s) => s.vista)
  const selezionato = useApp((s) => s.comuneSelezionato)
  const controlli = useThree((s) => s.controls) as { target: THREE.Vector3; update(): void } | null
  const camera = useThree((s) => s.camera)
  const fine = useRef(0)
  const mira = useRef({ target: new THREE.Vector3(), distanza: DIMENSIONE * 1.1 })

  useEffect(() => {
    const c = dataset.comuni.find((x) => x.istat === selezionato)
    if (vista === "comune" && c) {
      const [x, z] = proiezione.aScena(c.centroide)
      mira.current = { target: new THREE.Vector3(x, 0, z), distanza: DIMENSIONE * 0.28 }
    } else {
      mira.current = { target: new THREE.Vector3(0, 0, 0), distanza: DIMENSIONE * 1.1 }
    }
    fine.current = performance.now() + 1400
  }, [vista, selezionato, proiezione])

  useFrame(() => {
    if (!controlli || performance.now() > fine.current) return
    const { target, distanza } = mira.current
    controlli.target.lerp(target, 0.08)
    camera.position.lerp(target.clone().addScaledVector(DIREZIONE_CAMERA, distanza), 0.08)
    controlli.update()
  })
  return null
}

export function Provincia() {
  const indici = useIndici()
  const selezionato = useApp((s) => s.comuneSelezionato)
  const vista = useApp((s) => s.vista)
  const proiezione = useMemo(() => creaProiezione(dataset.comuni, DIMENSIONE), [])
  const [hover, setHover] = useState<Hover>(null)
  const comuneHover = hover && dataset.comuni.find((c) => c.istat === hover.istat)
  const statoHover = hover && indici[hover.istat]

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: DIREZIONE_CAMERA.clone().multiplyScalar(DIMENSIONE * 1.1).toArray(), fov: 45, near: 0.1, far: 500 }}
        style={{ background: "#dfeaf2" }}
        onPointerMissed={() => setHover(null)}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 20, 8]} intensity={1.4} />
        <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2.2} minDistance={2} maxDistance={60} />
        <RigCamera proiezione={proiezione} />
        {dataset.comuni.map((c) => {
          const stato = indici[c.istat]
          if (!stato) return null
          return (
            <ComuneMesh
              key={c.istat}
              comune={c}
              stato={stato}
              proiezione={proiezione}
              selezionato={selezionato === c.istat}
              attenuato={vista === "comune" && selezionato !== c.istat}
              onHover={setHover}
            />
          )
        })}
      </Canvas>
      {hover && comuneHover && statoHover && (
        <div style={{
          position: "fixed", left: hover.x + 14, top: hover.y + 14, pointerEvents: "none",
          background: "rgba(20,30,40,0.92)", color: "#fff", padding: "6px 10px", borderRadius: 6, fontSize: 13,
        }}>
          <strong>{comuneHover.nome}</strong> · indice {Math.round(statoHover.totale)}
        </div>
      )}
    </div>
  )
}
